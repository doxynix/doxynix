
***

# ⚡ Doxynix

<div align="center">

<!-- Status Badges -->
[![CI Status](https://img.shields.io/github/actions/workflow/status/doxynix/doxynix/ci.yml?style=for-the-badge&logo=github-actions&label=CI%20Pipeline)](https://github.com/doxynix/doxynix/actions)
[![Security: CodeQL](https://img.shields.io/github/actions/workflow/status/doxynix/doxynix/codeql.yml?style=for-the-badge&logo=github-security&label=CodeQL&color=blue)](https://github.com/doxynix/doxynix/actions)
[![Website Status](https://img.shields.io/website?url=https%3A%2F%2Fdoxynix.space&style=for-the-badge&logo=vercel&label=System%20Status&up_message=Operational&down_message=Downtime&up_color=success&down_color=red)](https://doxynix.space)

<!-- Core Stack Badges -->
![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

<!-- Backend & Tools Badges -->
![tRPC](https://img.shields.io/badge/tRPC-v11-2596BE?style=for-the-badge&logo=trpc&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-Validation-3068b7?style=for-the-badge&logo=zod&logoColor=white)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?style=for-the-badge&logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)

<!-- Header Content -->
<h3>Repository Analysis & Documentation Generator Service</h3>
<p>Turn your code into insights. Automatic analysis, quality metrics, and documentation generation for GitHub repositories.</p>

[View Demo](https://doxynix.space) · [Report Bug](https://github.com/doxynix/doxynix/issues) · [Request Feature](https://github.com/doxynix/doxynix/issues)

</div>

---

## 🚀 About The Project

**Doxynix** is an enterprise-grade web application designed to help developers understand complex codebases. It leverages static analysis to calculate complexity metrics, track technical debt, and generate comprehensive documentation automatically.

Engineered with extreme attention to performance and type safety, Doxynix utilizes the bleeding-edge **Next.js 16** stack with **Partial Prerendering (PPR)** to deliver a native-like experience.

### Key Features
*   📊 **Deep Static Analysis:** powered by custom parsers and `jscpd` for copy-paste detection.
*   ⚡ **Zero-Latency UI:** Utilizing `TanStack Query` and `PPR` for instant state management.
*   🔒 **Enterprise Security:** `NextAuth.js` with GitHub OAuth, secured by `Secretlint` and `CodeQL`.
*   📄 **Auto-Docs:** `tRPC` to OpenAPI generation via `Scalar`.
*   ☁️ **Serverless Infrastructure:** Database on Neon (Pg), queues on Upstash, files on UploadThing.

---

## 🛠️ Tech Stack

### Frontend & UI
| Technology | Version | Usage |
| :--- | :--- | :--- |
| **Next.js** | `16.1.0` | App Router, Server Actions, PPR. |
| **React** | `19.2.3` | Server Components, Suspense, Actions. |
| **Tailwind CSS** | `4.1` | Utility-first styling (Oxide engine). |
| **Shadcn/ui** | Latest | Radix UI primitives for accessible components. |
| **Lucide React** | `0.562` | Optimized SVG icons. |
| **Sonner** | `2.0` | High-performance toast notifications. |

### Backend & Data
| Technology | Usage |
| :--- | :--- |
| **tRPC** | `v11` | End-to-end typesafe API without schemas. |
| **Prisma** | `v7.2` | ORM with `adapter-pg` for serverless PostgreSQL. |
| **Zod** | `v4` | Runtime validation for ENV, API, and Forms. |
| **Resend** | `v6` | Transactional emails (React Email). |
| **Upstash QStash** | `v2` | Serverless message queue / cron jobs. |
| **UploadThing** | `v7` | Direct S3 file uploads (Oregon region). |

### Quality Control & DX
| Tool | Purpose |
| :--- | :--- |
| **Husky** | Git hooks (pre-commit, pre-push). |
| **Commitlint** | Enforces Conventional Commits standard. |
| **Secretlint** | Prevents committing API keys and secrets. |
| **JSCPD** | Detects copy-pasted code duplicates. |
| **Bundle Analyzer** | Keeps the build size minimal. |

---

## 🏁 Getting Started

### Prerequisites
*   Node.js 22+ (Required for Next.js 16)
*   pnpm 8+ (Recommended)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/doxynix/doxynix.git
    cd doxynix
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Environment Setup**
    ```bash
    cp .env.example .env.local
    ```
    *Fill in your secrets (Database, Auth, UploadThing).*

4.  **Database Migration**
    ```bash
    pnpm prisma generate
    pnpm prisma db push
    ```

5.  **Run Development Server**
    ```bash
    pnpm dev
    ```

---

## 🤝 Development Standards

We strictly follow **Conventional Commits** and ensure code quality via git hooks.

### Commit Message Convention
Your commit messages must follow the standard: `type(scope): subject`

*   `feat`: A new feature
*   `fix`: A bug fix
*   `docs`: Documentation only changes
*   `style`: Changes that do not affect the meaning of the code
*   `refactor`: A code change that neither fixes a bug nor adds a feature
*   `chore`: Changes to the build process or auxiliary tools

**Example:**
```bash
git commit -m "feat(repo): add copy-paste detection via jscpd"
```
*If you violate this rule, `commitlint` will reject your commit.*

---

## 🛡️ Security

This project is secured by default.
*   **Secretlint** scans every commit for leaked keys.
*   **CodeQL** runs deep semantic code analysis on every push.
*   **Dependabot** keeps dependencies up to date.

See [SECURITY.md](SECURITY.md) for our vulnerability reporting policy.

---

## 📄 License

Distributed under the MIT License. See [LICENSE.md](LICENSE.md) for more information.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/doxynix">Doxynix Team</a></p>
</div>
