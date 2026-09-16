import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

export default defineConfig([
  ...fsd.configs.recommended,

  {
    files: ["**/*"],
    rules: {
      "fsd/ambiguous-slice-names": "warn",
      "fsd/excessive-slicing": "warn",
      "fsd/forbidden-imports": "warn",
      "fsd/inconsistent-naming": "off",
      "fsd/insignificant-slice": "off",
      "fsd/no-cross-imports": "warn",
      "fsd/no-higher-level-imports": "warn",
      "fsd/no-layer-public-api": "warn",
      "fsd/no-processes": "warn",
      "fsd/no-public-api-sidestep": "off",
      "fsd/no-reserved-folder-names": "warn",
      "fsd/no-segmentless-slices": "warn",
      "fsd/no-segments-on-sliced-layers": "warn",
      "fsd/no-ui-in-app": "warn",
      "fsd/public-api": "off",
      "fsd/repetitive-naming": "warn",
      "fsd/segments-by-purpose": "warn",
      "fsd/shared-lib-grouping": "off",
      "fsd/typo-in-layer-name": "warn",
    },
  },

  {
    files: ["./src/entities/**", "./src/features/**", "./src/widgets/**"],
    rules: {
      "fsd/import-locality": "warn",
    },
  },

  {
    files: ["./src/shared/ui/**"],
    rules: {
      "fsd/import-locality": "off",
    },
  },
]);
