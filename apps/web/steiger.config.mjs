import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

// Public-API rules are off because this codebase deliberately uses deep imports instead of barrel files.
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
    // `shared` has no slices, so import-locality (slice-internal relative imports) does not apply there.
    files: ["./src/shared/**"],
    rules: {
      "fsd/import-locality": "off",
    },
  },
]);
