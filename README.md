
# ⚡ Doxynix

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2d3748?style=for-the-badge&logo=prisma)
![tRPC](https://img.shields.io/badge/tRPC-v11-2596be?style=for-the-badge&logo=trpc)

[![CI](https://github.com/kramqx/doxynix/actions/workflows/ci.yml/badge.svg)](https://github.com/kramqx/doxynix/actions)
[![Security: CodeQL](https://github.com/kramqx/doxynix/actions/workflows/codeql.yml/badge.svg)](https://github.com/kramqx/doxynix/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<h3>Repository Analysis & Documentation Generator Service</h3>
<p>Turn your code into insights. Automatic analysis, quality metrics, and documentation generation for GitHub repositories.</p>

[View Demo](https://doxynix.space) · [Report Bug](https://github.com/kramqx/doxynix/issues) · [Request Feature](https://github.com/kramqx/doxynix/issues)

</div>

---

## 🚀 About The Project

**Doxynix** is a full-stack web application designed to help developers understand codebases faster. It analyzes GitHub repositories, calculates complexity metrics, and generates comprehensive documentation using static analysis.

Built with performance and type-safety in mind, leveraging the latest **Next.js 16** features like **Partial Prerendering (PPR)** and **Server Actions**.

### Key Features
*   📊 **Deep Analysis:** Automatic calculation of repository metrics.
*   ⚡ **Blazing Fast:** Powered by Next.js Partial Prerendering and Vercel Edge Network.
*   🔒 **Secure:** Enterprise-grade security with NextAuth.js and CodeQL scanning.
*   ☁️ **Cloud Native:** Serverless architecture with direct S3 uploads via UploadThing.
*   🛠 **Developer First:** Full type-safety from database to UI.

---

## 🛠️ Tech Stack

### Core
| Technology | Description |
| --- | --- |
| **Next.js 16** | App Router, Server Actions, Partial Prerendering (PPR). |
| **TypeScript** | Strict mode, Typed Routes, Typed Env. |
| **tRPC** | End-to-end typesafe API (Backend <-> Frontend). |
| **Prisma** | Modern ORM for PostgreSQL. |

### UI & Styling
| Technology | Description |
| --- | --- |
| **Tailwind CSS** | Utility-first CSS framework. |
| **Shadcn/ui** | Re-usable components built with Radix UI. |
| **Lucide React** | Beautiful & consistent icons (Optimized imports). |
| **Framer Motion** | Smooth animations. |

### Infrastructure & Services
| Technology | Description |
| --- | --- |
| **PostgreSQL** | Managed SQL Database (Neon/Vercel). |
| **UploadThing** | File storage (S3 wrapper) with Oregon/Portland region optimization. |
| **NextAuth.js** | Authentication (GitHub OAuth). |
| **Vercel** | Serverless deployment & Edge Network. |
| **GitHub Actions** | CI/CD pipeline with Security checks. |

---

## 🏁 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js 18+
*   pnpm (recommended) or npm

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/kramqx/doxynix.git
    cd doxynix
    ```

2.  **Install dependencies**
    ```bash
    pnpm install
    ```

3.  **Set up Environment Variables**
    Copy the example env file and fill in your secrets.
    ```bash
    cp .env.example .env.local
    ```
    *You will need keys for: Database (Postgres), NextAuth, GitHub OAuth, and UploadThing.*

4.  **Setup Database**
    ```bash
    pnpm prisma generate
    pnpm prisma db push
    ```

5.  **Run Development Server**
    ```bash
    pnpm dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## 🛡️ Security

This project takes security seriously. We use:
*   **CodeQL** analysis in CI pipelines.
*   **Dependabot** for dependency updates.
*   **Zod** for strict runtime validation.
*   **Typed Environment Variables** to prevent leaks.

See [SECURITY.md](SECURITY.md) for our vulnerability reporting policy.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/kramqx">Doxynix Team</a></p>
</div>
