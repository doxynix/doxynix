export const FILE_PATTERNS = {
  API: [
    "router",
    "route",
    "controller",
    "handler",
    "schema",
    "dto",
    "model",
    "trpc",
    "openapi",
    "swagger",
    "gql",
    "graphql",
  ],

  CONFIG: [
    "package.json",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "go.mod",
    "go.sum",
    "requirements.txt",
    "pyproject.toml",
    "poetry.lock",
    "cargo.toml",
    "cargo.lock",
    "composer.json",
    "composer.lock",
    "gemfile",
    "gemfile.lock",
    "mix.exs",
    "dockerfile",
    "docker-compose",
    "makefile",
    ".env",
    ".env.example",
    ".env.local",
    "next.config",
    "vite.config",
    "webpack.config",
    "tsconfig.json",
  ],

  IGNORE: [
    ".git/",
    "node_modules",
    "dist",
    "build",
    ".next",
    "coverage",
    ".ico",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".zip",
    ".tar.gz",
    ".7z",
    ".rar",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".ds_store",
    "thumbs.db",
  ],

  TEST: [".test.", ".spec.", "__tests__", "__mocks__", "test/", "tests/"],
};

export class FileClassifier {
  static isConfigFile(path: string): boolean {
    const lower = path.toLowerCase();
    return FILE_PATTERNS.CONFIG.some((pattern) => lower.includes(pattern));
  }

  static isApiFile(path: string): boolean {
    const lower = path.toLowerCase();
    if (this.isTestFile(path)) return false;
    return FILE_PATTERNS.API.some((pattern) => lower.includes(pattern));
  }

  static isIgnored(path: string): boolean {
    const lower = path.toLowerCase();
    return FILE_PATTERNS.IGNORE.some((pattern) => lower.includes(pattern));
  }

  static isTestFile(path: string): boolean {
    const lower = path.toLowerCase();
    return FILE_PATTERNS.TEST.some((pattern) => lower.includes(pattern));
  }

  static getScore(path: string): number {
    if (this.isConfigFile(path)) return 100;
    if (this.isApiFile(path)) return 90;
    if (this.isTestFile(path)) return 20;
    if (path.includes("ui/") || path.includes("components/")) return 40;
    return 50;
  }
}
