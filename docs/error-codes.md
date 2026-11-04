# Error codes

Backend errors carry a stable, machine-readable `messageCode` next to the English `message`.
Clients translate the code; logs, the CLI and webhooks keep reading the English text, which is
never removed from the wire.

## Adding an error

1. Add the member to `MessageCode` in `packages/shared/src/errors/index.ts` (and to
   `MessageCodeSchema`). Never write a code as a raw string.
2. Pass it on the throw: `new AppError({ code: "NOT_FOUND", messageCode: MessageCode.REPO_NOT_FOUND,
   publicMessage: "Repository not found" })`. Add `params` when the copy interpolates values.
3. Map the code to a snake_case key in `ERROR_MESSAGE_KEYS` in
   `apps/web/src/shared/i18n/use-error-message.ts`. The `satisfies Record<MessageCode, ...>` makes a
   missing entry a type error.
4. Add the copy under the `Errors` namespace in every file in `apps/web/messages/`. Keys must match
   across locales and placeholders must be identical; `bun run lint:locales` enforces both.

Codes on non-public `ErrorCode`s are masked to `null`, just like the English message, so a 500 never
leaks its cause. `bun run lint:message-codes` fails CI when a public throw has no code or a code has
no translation key.
