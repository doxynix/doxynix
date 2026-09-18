import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

// Full-power FSD config: every rule from @feature-sliced/steiger-plugin is
// enabled at its maximum severity ("error"), including the three rules that
// are defined but NOT part of fsd.configs.recommended:
//   - fsd/no-cross-imports
//   - fsd/no-higher-level-imports
//   - fsd/import-locality
//
// The barrel-file (public API) rules are intentionally turned OFF — this
// codebase deliberately does not use barrel files:
//   - fsd/public-api              (requires slices to have an index.ts)
//   - fsd/no-public-api-sidestep  (bans deep imports that bypass index.ts)
export default defineConfig([
  ...fsd.configs.recommended,

  {
    files: ["**/*"],
    rules: {
      "fsd/ambiguous-slice-names": "error",
      "fsd/excessive-slicing": "error",
      "fsd/forbidden-imports": "error",
      "fsd/import-locality": "error",
      "fsd/inconsistent-naming": "error",
      "fsd/insignificant-slice": "off",
      "fsd/no-cross-imports": "error",
      "fsd/no-higher-level-imports": "error",
      "fsd/no-layer-public-api": "error",
      "fsd/no-processes": "error",
      "fsd/no-public-api-sidestep": "off",
      "fsd/no-reserved-folder-names": "error",
      "fsd/no-segmentless-slices": "error",
      "fsd/no-segments-on-sliced-layers": "error",
      "fsd/no-ui-in-app": "error",
      "fsd/public-api": "off",
      "fsd/repetitive-naming": "error",
      "fsd/segments-by-purpose": "error",
      "fsd/shared-lib-grouping": "off",
      "fsd/typo-in-layer-name": "error",
    },
  },

  {
    // The shared layer has no slices — its segments may import each other
    // freely, and the import-locality rationale (slice-internal imports stay
    // relative) does not apply. Enforcing it there only fights the IDE, which
    // suggests the "@/shared/..." alias over relative paths.
    files: ["./src/shared/**"],
    rules: {
      "fsd/import-locality": "off",
    },
  },
]);
