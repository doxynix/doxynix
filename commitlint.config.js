module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", ["feat", "fix", "chore", "docs", "refactor", "test", "style"]],
    "scope-empty": [2, "never"],
    "subject-case": [2, "always", "lower-case"],
  },
};
