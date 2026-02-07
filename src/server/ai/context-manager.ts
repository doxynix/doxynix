import { cleanCodeForAi } from "@/server/utils/optimizers";

type FileEntry = { path: string; content: string };

const CRITICAL_FILES = [
  "package.json",
  "tsconfig.json",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "requirements.txt",
  "Gemfile",
  "docker-compose.yml",
  "Dockerfile",
  "Makefile",
  ".env.example",

  "schema.prisma",
  "schema.rb",
  "models.py",

  "openapi.yaml",
  "swagger.json",
];

const HIGH_PRIORITY_TOKENS = [
  "types",
  "interface",
  "api",
  "router",
  "controller",
  "model",
  "entity",
  "config",
  "auth",
  "service",
  "main",
  "index",
  "app",
];

const LOW_PRIORITY_TOKENS = [
  "test",
  "spec",
  "mock",
  "fixture",
  "e2e",
  "ui/",
  "view/",
  "style/",
  "css",
  "icon",
  "assets",
  "public",
];

function getGenericFileScore(filePath: string): number {
  const fileName = filePath.split("/").pop()?.toLowerCase() ?? "";
  const pathLower = filePath.toLowerCase();

  if (CRITICAL_FILES.some((f) => fileName === f.toLowerCase())) return 100;

  if (fileName.includes("config") || fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
    return 85;

  let score = 50;

  if (HIGH_PRIORITY_TOKENS.some((token) => pathLower.includes(token))) score += 25;

  if (LOW_PRIORITY_TOKENS.some((token) => pathLower.includes(token))) score -= 30;

  const depth = filePath.split("/").length;
  if (depth < 3) score += 10;

  return score;
}

export function prepareSmartContext(files: FileEntry[], maxChars: number = 1000000): string {
  const scoredFiles = files.map((f) => ({
    ...f,
    score: getGenericFileScore(f.path),
    cleanContent: cleanCodeForAi(f.content),
  }));

  scoredFiles.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.cleanContent.length - b.cleanContent.length;
  });

  let currentChars = 0;
  const selectedFiles: string[] = [];
  const skippedFiles: string[] = [];

  for (const file of scoredFiles) {
    const fileXml = `<file path="${file.path}">\n${file.cleanContent}\n</file>`;

    if (currentChars + fileXml.length <= maxChars) {
      selectedFiles.push(fileXml);
      currentChars += fileXml.length;
    } else {
      skippedFiles.push(file.path);
    }
  }

  let result = selectedFiles.join("\n");

  if (skippedFiles.length > 0) {
    result += `\n\n<!-- INFO: The following files exist but were omitted from context to save space. Infer their purpose from their names:\n${skippedFiles.join("\n")}\n-->`;
  }

  return result;
}
