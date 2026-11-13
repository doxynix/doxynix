# vendor/wasms

Optional override directory for grammar wasm files. Anything dropped here is picked up before the
`tree-sitter-wasm` bundle, so a single grammar can be replaced without swapping bundle versions.

Naming must match the `wasm` field of the matching spec in
`src/server/core/tree-sitter/index.ts` (for example `tree-sitter-typescript.wasm`).

Deployment: `trigger.config.ts` copies `node_modules/tree-sitter-wasm/out/**/*.wasm` into the
image, preserving the `out/<lang>/tree-sitter-<lang>.wasm` layout that
`resolveGrammarWasmPath` reads from `process.cwd()`. This directory is copied through the
`vendor/wasms/*.wasm` matcher.
