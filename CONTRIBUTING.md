# Contributing Guide

We are delighted that you are interested in contributing to the **[PROJECT NAME]** project! Your participation is vital for us.

Please take a moment to review these guidelines.

## 🤝 Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## 💡 How to Report a Bug / Create an Issue

We use **Linear** for issue tracking. All issues must be created in Linear.

1.  **Check Existing Issues:** Before creating a new Issue, please check the [Issue tracker] (in Linear) to see if the bug has already been reported.
2.  **Create a New Issue:** If not, create a new one in Linear.
3.  **Provide Details:** Clearly describe the bug, including steps to reproduce it, expected and actual behavior, and information about your environment (OS, **[PROJECT NAME]** version, etc.).
4.  **Issue ID:** After creation in Linear, the Issue will be assigned a unique ID with the prefix **`DXNX-`** (e.g., `DXNX-123`). This ID **must** be used in your branch names and commit messages.

## ✨ How to Suggest a Feature

1.  **Check Existing Issues:** Ensure the feature hasn't been discussed yet.
2.  **Create a New Issue (in Linear):** Use the feature request template if one is available.
3.  **Explain the Value:** Clearly articulate the problem the feature solves and why it would be valuable to the project.

## 💻 How to Submit Code (Pull Request)

We welcome Pull Requests! Our workflow relies on **Conventional Commits** and **Linear Issue IDs**.

### Getting Started

1.  **Discuss:** If you plan to introduce a significant change, please open an Issue in Linear first to discuss it with the project maintainers. This helps prevent wasted effort.
2.  **Get ID:** Ensure your task has a Linear ID (e.g., `DXNX-420`).
3.  **Fork & Clone:** Fork the repository and clone it locally.

### Development

1.  **Create a Branch:** Your branch name **must** include the Linear Issue ID.
    *   **Format:** `<type>/DXNX-ID-<short-description>`
    *   **Example:** `feat/DXNX-420-add-user-auth` or `fix/DXNX-123-crash-on-login`
    *   *Note: The `<type>` must follow the Conventional Commits specification (see below).*
2.  **Code:** Make your changes. Please adhere to the existing coding style.
3.  **Tests:** Ensure all existing tests pass, and add new tests for your changes where necessary.

### Commit Formatting (Conventional Commits)

Your commits **must** follow the Conventional Commits specification to enable automated Changelog generation.

*   **Format:** `<type>(<scope>): <description>`
*   **Mandatory Types:**
    *   `feat`: A new feature (Minor release).
    *   `fix`: A bug fix (Patch release).
    *   `docs`: Documentation only changes.
    *   `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
    *   `refactor`: A code change that neither fixes a bug nor adds a feature.
    *   `perf`: A code change that improves performance.
    *   `test`: Adding missing tests or correcting existing tests.
    *   `chore`: Other changes that don't modify src or test files (e.g. updating build scripts).
*   **Commit Example:** `feat(auth): add email validation for registration`

### Submitting the Pull Request

1.  **Link Linear:** Include a link to the Linear issue in the body of the PR.
2.  **Submit the Pull Request:** Submit your PR against the `main` branch of this repository. Fill out the PR template (if one is provided) and describe your changes in detail.

Thank you for your contributions!
