import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import fg from "fast-glob";
import { dirname, join } from "pathe";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const DOCS_ROOT = join(process.cwd(), "content", "docs");

const REQUIRED_SLUGS = ["/docs"] as const;

type DocPage = {
  description: string;
  file: string;
  raw: string;
  slug: string;
  title: string;
};

function toSlug(file: string): string {
  const withoutExtension = file.replace(/\.mdx$/, "");
  if (withoutExtension === "index") {
    return "/docs";
  }
  return `/docs/${withoutExtension.replace(/\/index$/, "")}`;
}

async function loadPages(): Promise<DocPage[]> {
  const files = await fg("**/*.mdx", { cwd: DOCS_ROOT });

  return Promise.all(
    files.map(async (file) => {
      const raw = await readFile(join(DOCS_ROOT, file), "utf8");
      const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1];
      expect(frontmatter, `${file} is missing frontmatter`).toBeDefined();

      const data = parseYaml(frontmatter ?? "") as { description?: string; title?: string };
      expect(data.title, `${file} is missing a title`).toBeTruthy();
      expect(data.description, `${file} is missing a description`).toBeTruthy();

      return {
        description: data.description ?? "",
        file,
        raw,
        slug: toSlug(file),
        title: data.title ?? "",
      };
    }),
  );
}

describe("docs content", () => {
  it("contains every required page", async () => {
    const pages = await loadPages();
    const slugs = new Set(pages.map((page) => page.slug));

    for (const slug of REQUIRED_SLUGS) {
      expect(slugs, `missing page: ${slug}`).toContain(slug);
    }
  });

  it("does not contain unresolved markers", async () => {
    const pages = await loadPages();

    for (const page of pages) {
      expect(page.raw, `${page.file} contains a placeholder`).not.toMatch(/\b(TODO|TBD|FIXME)\b/);
    }
  });

  it("does not link to missing docs pages", async () => {
    const pages = await loadPages();
    const slugs = new Set(pages.map((page) => page.slug));

    for (const page of pages) {
      for (const match of page.raw.matchAll(/\]\((\/docs[^)\s#?]*)/g)) {
        const target = (match[1] ?? "").replace(/\/$/, "") || "/docs";
        expect(slugs.has(target), `${page.file} links to missing ${target}`).toBe(true);
      }
    }
  });

  it("keeps meta.json page references valid", async () => {
    const metaFiles = await fg("**/meta.json", { cwd: DOCS_ROOT });

    for (const file of metaFiles) {
      const data = JSON.parse(await readFile(join(DOCS_ROOT, file), "utf8")) as {
        pages?: Array<string | { href: string }>;
      };
      const folder = dirname(join(DOCS_ROOT, file));

      for (const entry of data.pages ?? []) {
        if (typeof entry !== "string" || entry === "..." || entry.startsWith("---")) {
          continue;
        }

        const asFile = join(folder, `${entry}.mdx`);
        const asIndex = join(folder, entry, "index.mdx");
        expect(
          existsSync(asFile) || existsSync(asIndex),
          `${file} references missing ${entry}`,
        ).toBe(true);
      }
    }
  });
});
