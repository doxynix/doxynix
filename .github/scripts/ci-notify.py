#!/usr/bin/env python3
"""Aggregate CI status across all workflows and emit the notify payload.

Single entrypoint for the `notify` job in `.github/workflows/global-ci.yml`:

1. Polls `GET /repos/{owner}/{repo}/actions/runs?head_sha=` until every other
   workflow on the head commit has finished (or a hard deadline expires).
2. Combines their outcome with Global CI's own `quality`/`security` jobs.
3. Writes the Telegram markdown message and `is_success` to `$GITHUB_OUTPUT`.

No third-party dependencies - stdlib `urllib` only.
"""

import datetime
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

POLL_INTERVAL_SECONDS = 20
WAIT_DEADLINE_SECONDS = 6600  # 110 minutes; on expiry the check turns pending/failed
FAILED_CONCLUSIONS = {"failure", "timed_out", "action_required"}
API_VERSIONS_HEADER = "X-GitHub-Api-Version: 2022-11-28"


def env(name, default=""):
    return os.environ.get(name, default)


def api_get(url, token):
    """Perform an authenticated GET and return the decoded JSON body."""
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def api_get_with_retry(url, token, attempts=4):
    """Fetch with a small backoff; last attempt re-raises."""
    for attempt in range(attempts):
        try:
            return api_get(url, token)
        except (urllib.error.URLError, urllib.error.HTTPError):
            if attempt == attempts - 1:
                raise
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("unreachable")


def other_workflow_runs(repo, sha, token, self_run_id, workflow_name):
    """List other workflows' runs for the head commit (may be None on API error)."""
    url = f"https://api.github.com/repos/{repo}/actions/runs?head_sha={sha}&per_page=100"
    try:
        payload = api_get_with_retry(url, token)
    except urllib.error.HTTPError as exc:
        # Auth failures cannot self-heal mid-run - fail fast instead of
        # silently spinning in the poll loop until the wait deadline.
        if exc.code in (401, 403):
            raise SystemExit(
                f"GitHub API auth failed with HTTP {exc.code} - check GITHUB_TOKEN env"
            )
        print(f"API poll failed: {exc}", flush=True)
        return None
    except urllib.error.URLError as exc:
        print(f"API poll failed: {exc}", flush=True)
        return None
    return [
        {
            "name": run.get("name") or "unknown",
            "status": run.get("status"),
            "conclusion": run.get("conclusion"),
        }
        for run in payload.get("workflow_runs", [])
        if run.get("id") != self_run_id and run.get("name") != workflow_name
    ]


def wait_for_other_runs(repo, sha, token, self_run_id, workflow_name):
    """Poll until other workflows finish.

    Returns a (status, runs) tuple:
      - ("success", [])            all other workflows finished, none failed
      - ("failure", failed_runs)   at least one other workflow failed
      - ("pending", pending_runs)  deadline hit before everything finished
    """
    deadline = time.time() + WAIT_DEADLINE_SECONDS
    while True:
        runs = other_workflow_runs(repo, sha, token, self_run_id, workflow_name)
        if runs is not None:
            failed = [
                run
                for run in runs
                if run["status"] == "completed" and run["conclusion"] in FAILED_CONCLUSIONS
            ]
            if failed:
                return "failure", failed
            pending = [run for run in runs if run["status"] != "completed"]
            if not pending:
                return "success", []
        else:
            pending = []
        if time.time() >= deadline:
            return "pending", pending
        time.sleep(POLL_INTERVAL_SECONDS)


def escape_markdown(text):
    for char in ["_", "`", "*"]:
        text = text.replace(char, f"\\{char}")
    return text


def load_pr(event_path):
    """Extract PR metadata from the event payload."""
    pr_url, pr_user, changed_files, additions, deletions = "no", "—", "0", "0", "0"
    if not event_path or not os.path.exists(event_path):
        return pr_url, pr_user, changed_files, additions, deletions
    try:
        with open(event_path, encoding="utf-8") as handle:
            event = json.load(handle)
        pr = event.get("pull_request")
        if pr:
            pr_url = pr.get("html_url", "no PR")
            pr_user = pr.get("user", {}).get("login", "—")
            additions = str(pr.get("additions", 0))
            deletions = str(pr.get("deletions", 0))
            changed_files = str(pr.get("changed_files", 0))
    except (OSError, ValueError):  # PR metadata is optional — keep the defaults on any parse/missing-file error
        pass
    return pr_url, pr_user, changed_files, additions, deletions


def main():
    repo = env("GITHUB_REPOSITORY")
    sha = env("GITHUB_SHA")
    token = env("GITHUB_TOKEN")
    self_run_id = int(env("GITHUB_RUN_ID"))
    workflow_name = env("GITHUB_WORKFLOW")
    quality_result = env("QUALITY_RESULT", "skipped")
    security_result = env("SECURITY_RESULT", "skipped")

    other_status, failed_runs = wait_for_other_runs(
        repo, sha, token, self_run_id, workflow_name
    )

    failed_names = []
    for name, result in (("Global Quality", quality_result), ("Global Security Scanning", security_result)):
        if result == "failure":
            failed_names.append(name)
    if other_status == "failure":
        failed_names.extend(run["name"] for run in failed_runs)

    if other_status == "pending":
        status_emoji, status_text, is_success = "⏳", "Pending", False
    elif other_status == "failure" or failed_names:
        status_emoji, status_text, is_success = "❌", "Failed", False
    else:
        status_emoji, status_text, is_success = "✅", "Success", True

    started_at = env("CI_STARTED_AT")
    run_started_human, duration = "—", "—"
    if started_at:
        start_ts = int(started_at)
        naive_utc = datetime.datetime.fromtimestamp(start_ts, datetime.timezone.utc)
        run_started_human = naive_utc.astimezone(
            datetime.timezone(datetime.timedelta(hours=3))
        ).strftime("%Y-%m-%d %H:%M:%S MSK")
        diff = max(0, int(time.time()) - start_ts)
        duration = f"{diff // 3600:02d}:{(diff % 3600) // 60:02d}:{diff % 60:02d}"

    branch = env("GITHUB_HEAD_REF") or env("GITHUB_REF_NAME")
    actor = env("GITHUB_ACTOR", "—")
    try:
        author = subprocess.check_output(
            ["git", "show", "-s", "--format=%an", sha], text=True
        ).strip()
        if author:
            actor = author
    except (OSError, subprocess.CalledProcessError):  # best-effort: fall back to the actor login if git cannot resolve the commit
        pass
    actor = escape_markdown(actor)
    commit_url = f"https://github.com/{repo}/commit/{sha}"
    branch_url = f"https://github.com/{repo}/tree/{branch}"

    pr_url, pr_user, changed_files, additions, deletions = load_pr(env("GITHUB_EVENT_PATH"))

    failed_line = ""
    if failed_names:
        unique = list(dict.fromkeys(failed_names))
        failed_line = (
            "**Failed workflows:** "
            + ", ".join(f"`{escape_markdown(name)}`" for name in unique)
            + "\n"
        )

    message = (
        f"{status_emoji} **Doxynix CI {status_text}**\n\n"
        f"Project **{repo}**\n\n"
        f"**Branch:** [{branch}]({branch_url})\n"
        f"**Commit:** [`{sha}`]({commit_url}) — author: `{actor}`\n"
        f"**PR:** {pr_url}\n"
        f"**PR Author:** `{pr_user}` • Files: `{changed_files}` • `+{additions} / -{deletions}`\n"
        f"{failed_line}"
        f"**Start:** `{run_started_human}`\n"
        f"**Duration:** `{duration}`\n\n"
        f"[Open workflow run](https://github.com/{repo}/actions/runs/{env('GITHUB_RUN_ID')})"
    )

    output_path = env("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as out:
            out.write(f"message<<EOF\n{message}\nEOF\n")
            out.write(f"run_started_human={run_started_human}\n")
            out.write(f"run_duration={duration}\n")
            out.write(f"pr_url={pr_url}\n")
            out.write(f"pr_user={pr_user}\n")
            out.write(f"changed_files={changed_files}\n")
            out.write(f"additions={additions}\n")
            out.write(f"deletions={deletions}\n")
            out.write(f"is_success={'true' if is_success else 'false'}\n")


if __name__ == "__main__":
    main()