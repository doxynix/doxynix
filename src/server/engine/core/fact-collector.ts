import { XMLParser } from "fast-xml-parser";
import pm from "picomatch";
import YAML from "yaml";

import { dumpDebug } from "@/server/utils/debug-logger";

import {
  collectFrameworkFactsFromTokens,
  selectRepositoryFrameworkFacts,
} from "./framework-catalog";
import type {
  FileSignals,
  FrameworkFact,
  RepositoryEvidence,
  TechCategory,
  TechFact,
} from "./types";

const xmlParser = new XMLParser({ ignoreAttributes: false });

type AnalyzedFile = { content: string; path: string };
type ManifestHandler = {
  matches: (fileName: string) => boolean;
  run: (collector: FactCollector, file: AnalyzedFile) => void;
};

const FILE_TRIGGERS: Record<string, { category: TechCategory; name: string }> = {
  "**/*.tf": { category: "Infrastructure", name: "Terraform" },
  "**/.github/workflows/**": { category: "CI/CD", name: "GitHub Actions" },
  "**/.gitlab-ci.yml": { category: "CI/CD", name: "GitLab CI" },
  "**/ansible.cfg": { category: "Infrastructure", name: "Ansible" },
  "**/capacitor.config.*": { category: "Mobile", name: "Capacitor" },
  "**/deployment.{yml,yaml}": { category: "Infrastructure", name: "Kubernetes" },
  "**/docker-compose.{yml,yaml}": { category: "Infrastructure", name: "Docker Compose" },
  "**/dockerfile": { category: "Infrastructure", name: "Docker" },
  "**/expo.json": { category: "Mobile", name: "Expo" },
  "**/k8s/**": { category: "Infrastructure", name: "Kubernetes" },
  "**/tailwind.config.*": { category: "UI/Styling", name: "Tailwind CSS" },
};

function mapFrameworkCategory(category: FrameworkFact["category"]): TechCategory {
  switch (category) {
    case "api":
      return "Framework";
    case "cloud":
      return "Cloud";
    case "database":
      return "Database";
    case "framework":
      return "Framework";
    case "infrastructure":
      return "Infrastructure";
    case "orm":
      return "ORM";
    case "testing":
      return "Testing";
    case "tooling":
      return "CI/CD";
    case "ui":
      return "UI/Styling";
    case "runtime":
      return "Framework";
    default:
      return "Library";
  }
}

export class FactCollector {
  private facts = new Map<string, TechFact>();
  private frameworkFacts: FrameworkFact[] = [];

  static collect(
    files: { content: string; path: string }[],
    evidence?: Pick<RepositoryEvidence, "configs" | "frameworkFacts" | "routeInventory">,
    fileSignalsByPath?: Map<string, FileSignals>
  ) {
    const collector = new FactCollector();

    if (evidence?.frameworkFacts?.length) {
      collector.frameworkFacts.push(...evidence.frameworkFacts);
    }
    if (
      (evidence?.routeInventory.source === "mixed" ||
        evidence?.routeInventory.source === "openapi") &&
      evidence.routeInventory.sourceFiles.length > 0
    ) {
      collector.addFact("OpenAPI", "Framework", 92);
    }
    for (const config of evidence?.configs ?? []) {
      collector.collectFrameworkFactsFromTokens([config.kind, config.path], config.path, 68);
    }

    for (const file of files) {
      collector.analyzeFile(file, fileSignalsByPath?.get(file.path));
    }

    collector.promoteMergedFrameworkFacts();
    const result = Array.from(collector.facts.values()).sort((a, b) => b.confidence - a.confidence);
    dumpDebug("tech-facts-detected", result);
    return result;
  }

  private static readonly manifestHandlers: ManifestHandler[] = [
    {
      matches: (fileName) => fileName === "package.json",
      run: (collector, file) => collector.parseManifestPackageJson(file.content, file.path),
    },
    {
      matches: (fileName) =>
        fileName === "package-lock.json" ||
        fileName === "pnpm-lock.yaml" ||
        fileName === "yarn.lock",
      run: (collector, file) =>
        collector.collectFrameworkFactsFromTokens(
          [file.path.split("/").pop() ?? ""],
          file.path,
          60
        ),
    },
    {
      matches: (fileName) => fileName === "composer.json",
      run: (collector, file) =>
        collector.parseManifestJsonDependencies(
          file.content,
          ["require", "require-dev"],
          file.path
        ),
    },
    {
      matches: (fileName) => fileName === "pom.xml",
      run: (collector, file) => collector.parseManifestMaven(file.content, file.path),
    },
    {
      matches: (fileName) => fileName.endsWith(".csproj"),
      run: (collector, file) => collector.parseManifestDotNet(file.content, file.path),
    },
    {
      matches: (fileName) => fileName === "requirements.txt",
      run: (collector, file) =>
        collector.parseManifestRegex(file.content, /^([a-z0-9_.-]+)/gim, file.path, 88),
    },
    {
      matches: (fileName) => fileName === "go.mod",
      run: (collector, file) =>
        collector.parseManifestRegex(file.content, /^[\t ]*([\w./-]+)[\t ]+v\d/gim, file.path, 88),
    },
    {
      matches: (fileName) => fileName === "cargo.toml",
      run: (collector, file) =>
        collector.parseManifestRegex(
          file.content,
          /^[\t ]*([\w-]+)[\t ]*=[\t ]*["{]/gim,
          file.path,
          88
        ),
    },
    {
      matches: (fileName) => fileName === "pubspec.yaml",
      run: (collector, file) => collector.parseManifestPubspec(file.content, file.path),
    },
  ];

  private analyzeFile(file: AnalyzedFile, signals?: FileSignals) {
    const rawFileName = file.path.split("/").pop()?.toLowerCase();
    const fileName = rawFileName ?? "";
    const pathLower = file.path.toLowerCase();

    this.collectFileTriggerFacts(pathLower);
    this.collectManifestFacts(fileName, file);
    this.collectSignalDerivedFacts(file.path, signals);
    if (this.isOneC(pathLower)) this.addFact("1C:Enterprise", "Language", 95);
  }

  private collectFileTriggerFacts(pathLower: string) {
    for (const [pattern, info] of Object.entries(FILE_TRIGGERS)) {
      if (!pm(pattern)(pathLower)) continue;
      this.addFact(info.name, info.category, 100);
    }
  }

  private collectManifestFacts(fileName: string, file: AnalyzedFile) {
    for (const handler of FactCollector.manifestHandlers) {
      if (!handler.matches(fileName)) continue;
      handler.run(this, file);
    }
  }

  private collectSignalDerivedFacts(filePath: string, signals?: FileSignals) {
    if (signals?.frameworkHints?.length) {
      this.frameworkFacts.push(...signals.frameworkHints);
    }
    if (signals?.imports?.length) {
      this.collectFrameworkFactsFromTokens(signals.imports, filePath, 72);
    }
  }

  private collectFrameworkFactsFromTokens(tokens: string[], filePath: string, confidence: number) {
    this.frameworkFacts.push(...collectFrameworkFactsFromTokens(tokens, filePath, confidence));
  }

  private promoteMergedFrameworkFacts() {
    for (const fact of selectRepositoryFrameworkFacts(this.frameworkFacts)) {
      this.addFact(fact.name, mapFrameworkCategory(fact.category), fact.confidence);
    }
  }

  private addFact(name: string, category: TechCategory, confidence: number) {
    const existing = this.facts.get(name);
    if (!existing || existing.confidence < confidence) {
      this.facts.set(name, { category, confidence, name });
    }
  }

  private parseManifestPackageJson(content: string, filePath: string) {
    this.parseManifestJsonDependencies(
      content,
      ["dependencies", "devDependencies", "peerDependencies"],
      filePath
    );

    try {
      const data = JSON.parse(content);
      const frameworkTokens = [
        data.name,
        ...Object.keys(data.scripts || {}),
        ...Object.keys(data.dependencies || {}),
        ...Object.keys(data.devDependencies || {}),
      ].filter((value): value is string => typeof value === "string");
      this.collectFrameworkFactsFromTokens(frameworkTokens, filePath, 95);
    } catch {
      // Optional signal only.
    }
  }

  private parseManifestJsonDependencies(content: string, keys: string[], filePath: string) {
    try {
      const data = JSON.parse(content);
      for (const key of keys) {
        const deps = Object.keys(data[key] || {});
        this.collectFrameworkFactsFromTokens(deps, filePath, 94);
      }
    } catch {
      // Optional signal only.
    }
  }

  private parseManifestMaven(content: string, filePath: string) {
    try {
      const jsonObj = xmlParser.parse(content);
      const deps = jsonObj?.project?.dependencies?.dependency;
      const depArray = Array.isArray(deps) ? deps : [deps];
      const tokens = depArray
        .flatMap((item: any) => [item?.artifactId, item?.groupId])
        .filter((value: unknown): value is string => typeof value === "string");
      this.collectFrameworkFactsFromTokens(tokens, filePath, 92);
    } catch {
      // Optional signal only.
    }
  }

  private parseManifestDotNet(content: string, filePath: string) {
    try {
      const jsonObj = xmlParser.parse(content);
      const itemGroups = jsonObj?.Project?.ItemGroup;
      const groupArray = Array.isArray(itemGroups) ? itemGroups : [itemGroups];
      const pkgArray = groupArray.flatMap((group: unknown) => {
        const refs = (group as { PackageReference?: unknown })?.PackageReference;
        return Array.isArray(refs) ? refs : [refs];
      });
      const tokens = pkgArray
        .map((pkg: any) => pkg?.["@_Include"])
        .filter((value: unknown): value is string => typeof value === "string");
      this.collectFrameworkFactsFromTokens(tokens, filePath, 92);
    } catch {
      // Optional signal only.
    }
  }

  private parseManifestRegex(content: string, regex: RegExp, filePath: string, confidence: number) {
    const tokens: string[] = [];
    for (const match of content.matchAll(regex)) {
      if (typeof match[1] === "string" && match[1].length > 0) tokens.push(match[1]);
    }
    this.collectFrameworkFactsFromTokens(tokens, filePath, confidence);
  }

  private parseManifestPubspec(content: string, filePath: string) {
    try {
      const data = YAML.parse(content);
      const deps = Object.keys(data?.dependencies || {});
      this.collectFrameworkFactsFromTokens(deps, filePath, 88);
    } catch {
      // Optional signal only.
    }
  }

  private isOneC(path: string): boolean {
    return (
      path.endsWith(".bsl") ||
      path.endsWith(".os") ||
      path.includes("/catalogs/") ||
      path.includes("/documents/")
    );
  }
}
