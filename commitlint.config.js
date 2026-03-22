module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-leading-blank": [2, "always"],
    "footer-leading-blank": [2, "always"],

    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "chore",
        "docs",
        "refactor",
        "test",
        "style",
        "perf",
        "build",
        "ci",
        "revert",
      ],
    ],

    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],

    "scope-empty": [1, "never"],
  },
};
