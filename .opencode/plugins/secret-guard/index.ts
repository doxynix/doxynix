// Global guard: the repo cannot disable or edit this file. It runs on every
// permission decision (including "Allow always" approvals) and redacts output.
// Keep in sync with ~/.config/opencode/plugins/secret-guard.ts; both load, the
// stale one wins. The global copy is chmod 444 and denied to edit, so the owner applies it.
type PermissionEvent = {
  action: string;
  resources: readonly string[];
  effect: string;
  message?: string;
};

type ShellBefore = { env: Record<string, string | undefined> };

type ToolAfter = { tool?: string; status?: string; result?: unknown };

type PluginContext = {
  permission: {
    hook: (name: string, cb: (event: PermissionEvent) => unknown) => Promise<unknown>;
  };
  shell?: {
    hook: (name: string, cb: (event: ShellBefore) => unknown) => Promise<unknown>;
  };
  tool: {
    hook: (name: string, cb: (event: ToolAfter) => unknown) => Promise<unknown>;
  };
};

const DOPPLER_DENY =
  "Blocked: Doppler access. Secrets are injected only into commands the user runs themselves. " +
  "Never read, print, download, decrypt or forward them.";

const INLINE_CODE_DENY =
  "Blocked: inline code execution (-e/-p/--eval/-c) can read any file and print any variable. " +
  "Write a script file with the write tool instead, then run it.";

const WRAPPED_DENY =
  "Blocked: that task runs through with-doppler, which injects every secret of the config into the process. " +
  "Use the secrets-free form `CI=true bun run <task>` (scripts/doppler.ts passes through when CI=true), " +
  "or ask the user to run it.";

// Binaries that read credentials or move data off the machine.
const DENY_BINARIES = new Set([
  "aws",
  "bwrap",
  "curl",
  "doctl",
  "doppler",
  "eval",
  "exec",
  "flatpak",
  "ftp",
  "gcloud",
  "kubectl",
  "mail",
  "mc",
  "nc",
  "ncat",
  "netcat",
  "op",
  "podman",
  "docker",
  "printenv",
  "rsync",
  "scp",
  "sftp",
  "sendmail",
  "socat",
  "ssh",
  "sudo",
  "su",
  "telnet",
  "vault",
  "wget",
  "with-doppler",
]);

// Anything matching these in a path is a credential store, never agent input.
const SECRET_PATH_HINTS = [
  "/.doppler",
  ".doppler.yaml",
  "/.ssh/",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "/.aws/",
  "/.gnupg/",
  "/.netrc",
  ".npmrc",
  ".git-credentials",
  "bunfig.toml",
  "/.netlify/",
  "/.vercel/",
  "/.local/share/opencode/",
  "/proc/",
  "/.kube/",
  "/.gnome/keyring",
  "/.password-store",
];

const SECRET_FILE_SUFFIXES = [".pem", ".p12", ".pfx", ".jks", ".keystore", ".ppk", ".kdbx", ".age"];

const escapeLiteral = (value: string) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Suffixes are anchored to the end of the path; unanchored, `.age` matches `.agents/`
// and every path under it. Hints stay unanchored because they are path fragments.
const SECRET_PATH_RE = new RegExp(
  `(?:^|[\\\\/])\\.env(?:\\.[^\\\\/]*)?$|${SECRET_PATH_HINTS.map(escapeLiteral).join("|")}|${SECRET_FILE_SUFFIXES.map((s) => `${escapeLiteral(s)}$`).join("|")}`,
  "i",
);

const DOPPLER_TOKEN_RE = /\bdp\.(?:st|ct|sa|pt|srv)\.[A-Za-z0-9=_-]{6,}/;

const DOPPLER_COMMAND_RE =
  /with-doppler|doppler\.ts|\bDOPPLER_[A-Z0-9_]+|api\.doppler\.com|dashboard\.doppler\.com/i;

// Interpreters whose inline-code flags can read any file and print any variable.
const INLINE_CODE_INTERPRETERS = new Set([
  "bun",
  "bunx",
  "deno",
  "node",
  "osascript",
  "perl",
  "php",
  "powershell",
  "pwsh",
  "python",
  "python3",
  "ruby",
  "ts-node",
  "tsx",
]);

const INLINE_CODE_FLAGS = /^(-e|-p|-c|--eval|--print|--eval=|--print=)/;

const DENY_GREP_RE =
  /dp\.(st|ct|sa|pt)\.|DOPPLER_TOKEN|-----BEGIN [A-Z ]*PRIVATE KEY|BEGIN OPENSSH PRIVATE KEY|(?:api[_-]?key|secret|passwd|password|authorization)\s*[:=]/i;

const EXFIL_HOSTS = [
  "api.doppler.com",
  "dashboard.doppler.com",
  "pastebin.com",
  "hastebin.com",
  "0x0.st",
  "file.io",
  "transfer.sh",
  "termbin.com",
  "webhook.site",
  "requestbin",
  "ngrok.io",
  "trycloudflare.com",
  "api.telegram.org",
  "discord.com/api/webhooks",
];

// gh is allowed (PR/issue workflow); these subcommands read tokens, write
// secrets or talk to the raw API and stay denied.
const DENY_GH_SUBCOMMANDS = new Set(["api", "auth", "codespace", "gist", "secret", "ssh-key"]);

// Package.json tasks that go through scripts/doppler.ts.
const DOPPLER_WRAPPED_TASKS = new Set([
  "analyze",
  "analyze:exp",
  "build",
  "build:turbopack",
  "db:drop-migration",
  "db:generate",
  "db:migrate",
  "db:migrate-prod",
  "db:push",
  "db:push:test",
  "db:reset",
  "db:seed",
  "db:studio",
  "dev",
  "dev:analyze",
  "dev:fast",
  "dev:trace",
  "lint",
  "seed:admin",
  "start",
  "test",
  "test:coverage",
  "test:e2e",
  "test:int",
  "test:stryker",
  "test:unit",
  "type-check",
  "validate",
]);

const SECRET_ENV_NAME_RE =
  /(SECRET|TOKEN|PASSWORD|PASSWD|APIKEY|API_KEY|_KEY|CREDENTIAL|AUTH|DOPPLER)/i;

const REDACTIONS: Array<[RegExp, string]> = [
  [DOPPLER_TOKEN_RE, "[redacted:doppler-token]"],
  [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    "[redacted:private-key]",
  ],
  [/gh[pousr]_[A-Za-z0-9]{16,}/g, "[redacted:github-token]"],
  [/github_pat_[A-Za-z0-9_]{20,}/g, "[redacted:github-token]"],
  [/sk-(?:ant-|proj-|or-|live-|test-)?[A-Za-z0-9_-]{20,}/g, "[redacted:api-key]"],
  [/xox[abopsr]-[A-Za-z0-9-]{10,}/g, "[redacted:slack-token]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[redacted:aws-key-id]"],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, "[redacted:google-key]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted:jwt]"],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g, "Bearer [redacted:bearer-token]"],
  [/\bglpat-[A-Za-z0-9_-]{16,}/g, "[redacted:gitlab-token]"],
  [/\bnpm_[A-Za-z0-9]{20,}/g, "[redacted:npm-token]"],
];

function segments(command: string): string[] {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function tokenize(segment: string): string[] {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((token) =>
    token.startsWith('"') || token.startsWith("'") ? token.slice(1, -1) : token,
  );
}

function binaryOf(tokens: readonly string[]): string {
  const first = tokens.find((token) => !/^[A-Z_]+=/.test(token));
  return (first?.split("/").pop() ?? "").toLowerCase();
}

// Returns the doppler-wrapped task a segment would run, or null when the segment is
// secrets-free (`CI=true`, per scripts/doppler.ts) or runs nothing wrapped.
function wrappedTask(segment: string): string | null {
  if (/\bCI\s*=\s*true\b/.test(segment)) {
    return null;
  }
  const tokens = tokenize(segment);
  const binary = binaryOf(tokens);
  if (binary !== "bun" && binary !== "bunx" && binary !== "turbo") {
    return null;
  }
  // `bun build` and `bun test` are bun subcommands, not package.json scripts;
  // only `run` / `--filter` style invocations reach a wrapped task.
  const scriptInvocation =
    tokens.includes("run") ||
    tokens.includes("--filter") ||
    tokens.includes("-f") ||
    binary === "turbo";
  if (!scriptInvocation) {
    return null;
  }
  const candidates = tokens.filter(
    (token) =>
      !token.startsWith("-") &&
      !/^[A-Z_]+=/.test(token) &&
      !token.startsWith("@") &&
      !token.includes("/"),
  );
  return candidates.find((token) => DOPPLER_WRAPPED_TASKS.has(token)) ?? null;
}

function shellDeny(command: string): string | null {
  for (const segment of segments(command)) {
    const tokens = tokenize(segment);
    const binary = binaryOf(tokens);

    if (DENY_BINARIES.has(binary)) {
      if (binary === "printenv") {
        return DOPPLER_DENY;
      }
      return `Blocked: "${binary}" can read credentials or move data off this machine.`;
    }
    if (binary === "gh") {
      const subcommand = tokens.slice(1).find((token) => !token.startsWith("-"));
      if (subcommand != null && DENY_GH_SUBCOMMANDS.has(subcommand)) {
        return `Blocked: "gh ${subcommand}" reaches credentials or the raw GitHub API. gh pr/issue/run/repo/label/changelog/completion stay available.`;
      }
    }
    if (DOPPLER_COMMAND_RE.test(segment)) {
      return DOPPLER_DENY;
    }
    if (DOPPLER_TOKEN_RE.test(segment)) {
      return "Blocked: a Doppler token appears in the command.";
    }
    if (
      INLINE_CODE_INTERPRETERS.has(binary) &&
      tokens.some((token) => INLINE_CODE_FLAGS.test(token))
    ) {
      return INLINE_CODE_DENY;
    }

    const task = wrappedTask(segment);
    if (task != null) {
      return WRAPPED_DENY;
    }

    for (const token of tokens) {
      if (SECRET_PATH_RE.test(token) && !token.startsWith("-")) {
        return DOPPLER_DENY;
      }
    }
  }
  return null;
}

function pathDeny(resources: readonly string[]): string | null {
  for (const raw of resources) {
    const path = raw.replaceAll("\\", "/");
    if (SECRET_PATH_RE.test(path)) {
      return `Blocked: ${path} holds credentials and is never agent input.`;
    }
  }
  return null;
}

function webfetchDeny(resources: readonly string[]): string | null {
  for (const raw of resources) {
    if (EXFIL_HOSTS.some((host) => raw.includes(host))) {
      return `Blocked: ${raw} is a credential or exfiltration endpoint.`;
    }
  }
  return null;
}

function grepDeny(resources: readonly string[]): string | null {
  for (const raw of resources) {
    if (DENY_GREP_RE.test(raw)) {
      return "Blocked: that search pattern targets credentials.";
    }
  }
  return null;
}

function redact(text: string): { text: string; changed: boolean } {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) {
    out = out.replace(pattern, replacement);
  }
  return { changed: out !== text, text: out };
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8 || value == null) {
    return value;
  }
  if (typeof value === "string") {
    return redact(value).text;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const scrubbed = scrub(item, depth + 1);
      if (scrubbed !== item) {
        changed = true;
      }
      return scrubbed;
    });
    return changed ? next : value;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(record)) {
      if (typeof item === "string") {
        const { text, changed: hit } = redact(item);
        next[key] = text;
        if (hit) {
          changed = true;
        }
      } else {
        const scrubbed = scrub(item, depth + 1);
        next[key] = scrubbed;
        if (scrubbed !== item) {
          changed = true;
        }
      }
    }
    return changed ? next : value;
  }
  return value;
}

export default {
  id: "doxynix-secret-guard",
  async setup(ctx: PluginContext) {
    await ctx.permission.hook("evaluate", (event) => {
      const { action, resources } = event;

      if (action === "shell") {
        for (const resource of resources) {
          const reason = shellDeny(resource);
          if (reason != null) {
            event.effect = "deny";
            event.message = reason;
            return;
          }
          if (/\bbunx?\s+(?:run\s+)?x\b/.test(resource) || /^\s*bunx\b/.test(resource)) {
            event.effect = "ask";
            event.message = "`bun x` downloads and executes remote code. Confirm the package.";
            return;
          }
        }
        return;
      }

      if (action === "read" || action === "edit" || action === "write" || action === "patch") {
        const reason = pathDeny(resources);
        if (reason != null) {
          event.effect = "deny";
          event.message = reason;
        }
        return;
      }

      if (action === "glob") {
        const reason = pathDeny(resources);
        if (reason != null) {
          event.effect = "deny";
          event.message = reason;
        }
        return;
      }

      if (action === "grep") {
        const reason = grepDeny(resources);
        if (reason != null) {
          event.effect = "deny";
          event.message = reason;
        }
        return;
      }

      if (action === "webfetch") {
        const reason = webfetchDeny(resources);
        if (reason != null) {
          event.effect = "deny";
          event.message = reason;
        }
        return;
      }

      // external_directory and MCP calls are left to the user's own rules: forcing
      // ask here overrode a deliberate `allow` and produced a prompt per call.
    });

    try {
      await ctx.shell?.hook("create.before", (event) => {
        for (const name of Object.keys(event.env)) {
          if (SECRET_ENV_NAME_RE.test(name)) {
            delete event.env[name];
          }
        }
      });
    } catch (error) {
      console.warn("secret-guard: shell env scrubbing unavailable", error);
    }

    await ctx.tool.hook("execute.after", (event) => {
      if (event.status !== "completed" || event.result == null) {
        return;
      }
      try {
        event.result = scrub(event.result);
      } catch {
        // never let redaction break a tool result
      }
    });
  },
};
