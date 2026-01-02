# @doxynix/cli 💻

The official command-line interface for **Doxynix**. Manage your repositories, monitor analysis statuses, and access analytics directly from your favorite terminal.

![Version](https://img.shields.io/npm/v/@doxynix/cli.svg?style=flat-square)
![License](https://img.shields.io/npm/l/@doxynix/cli.svg?style=flat-square)
![Node Support](https://img.shields.io/badge/node-%3E%3D18.0.0-blue?style=flat-square)

---

## 📦 Installation

Install the CLI globally using your preferred package manager:

```bash
# npm
npm install -g @doxynix/cli

# pnpm
pnpm add -g @doxynix/cli

# yarn
yarn global add @doxynix/cli

Requirements: Node.js >= 18.0.0

```

After installation, the following command will be available:

```bash
dxnx
```

---

## 🔐 Authorization

To work with the API, you need a personal access key:

1. Go to [**Doxynix Profile Settings**](https://doxynix.space/settings?tab=api-keys).
2. Generate a new key (it will start with dxnx_).
3. Run the login command:

```bash
dxnx login dxnx_your_secret_key_here
```

Your key is stored securely in ~/.dxnxconfig with restricted file permissions.

---

## 🚀 Commands

### Repositories

| Command                    | Description                                              | Example
| -------------------------- | -------------------------------------------------------- |---------
| `dxnx repos list`          | List all tracked repositories                            | dxnx repos list --limit 5
| `dxnx repos add <url>`     | Track a new repository (URL or `owner/name` format)      | dxnx repos add facebook/react
| `dxnx repos remove <uuid>` | Delete a repository                                      | dxnx repos remove <uuid>

### Analytics

| Command      | Description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| `dxnx stats` | Display dashboard statistics, including the number of repositories, documents, and analysis statuses |

### System

| Command            | Description                       |
| ------------------ | --------------------------------- |
| `dxnx login <key>` | Authenticate with the CLI       |
| `dxnx logout`      | Log out and delete the local key        |
| `dxnx --help`      | Show all available commands           |

---

## 🛠 Development

To set up the CLI for local development:

```bash
# 1. Clone the monorepo
git clone https://github.com/kramqx/doxynix.git
cd cli

# 2. Install & Build
pnpm install
pnpm build

# 3. Link for global usage
pnpm link --global
```

### Environment variables

By default, the CLI uses `https://doxynix.space/api/v1`. For development, you can point it to a local server:

```bash
# Linux/macOS
export DOXYNIX_API_URL=http://localhost:3000/api/v1

# Windows (PowerShell)
$env:DOXYNIX_API_URL="http://localhost:3000/api/v1"
```

---

## 🔗 Links

* Home: [doxynix.space](https://doxynix.space)
* API Docs: [doxynix.space/api/docs](https://doxynix.space/api/docs)
* Main repository: [GitHub Repo](https://github.com/kramqx/doxynix)
* Support: [Report an Issue](https://github.com/kramqx/doxynix/issues)

<p align="center">Made with ❤️ for developers by developers</p>
