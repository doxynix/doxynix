# PR Impact Layer Plan

Date: 2026-04-26

Goal:
- Make PR analysis a first-class continuation of `Repo Workspace`.
- Persist safe changed-file metadata for each PR analysis without storing code or patches.
- Map PR changes back to repository structure so `pull/[number]` can navigate into `map`, `code`, and `docs`.

Implementation focus:
- Add `changedFilesJson` snapshot storage to `PullRequestAnalysis`.
- Introduce stable `PRImpactPayload` contract under `prAnalysis`.
- Reuse `AnalyzeContextBuilder` and existing structure graph instead of creating a new graph model.
- Keep UI changes minimal and centered on the current PR detail page.

Planned deliverables:
- Safe PR changed-file snapshot persisted during Trigger.dev PR analysis.
- Backend impact derivation: changed files -> affected nodes/zones -> navigation hints.
- New `prAnalysis.getImpactByPRNumber` endpoint.
- PR detail page updated from placeholder state to structure-aware impact view.
