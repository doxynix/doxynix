import { describe, expect, it } from "vitest";

import type { RepoSearchResult } from "./repo.types";
import {
  buildRepoCodeHref,
  buildRepoDetailHref,
  buildRepoDocsHref,
  buildRepoMapHref,
  buildRepoSearchResultHref,
} from "./repo-workspace-navigation";

function params(values: Record<string, string> = {}): URLSearchParams {
  return {
    get: (key: string) => values[key] ?? null,
  } as unknown as URLSearchParams;
}

function query(href: null | string): URLSearchParams {
  return new URL(href ?? "", "http://localhost").searchParams;
}

describe("buildRepoDetailHref", () => {
  it("returns the base path without search params", () => {
    expect(buildRepoDetailHref("/repos", undefined)).toBe("/repos");
    expect(buildRepoDetailHref("/repos", null)).toBe("/repos");
    expect(buildRepoDetailHref("/repos", params())).toBe("/repos");
  });

  it("carries the workspace params over", () => {
    const href = buildRepoDetailHref(
      "/repos",
      params({
        filter: "all",
        node: "n1",
        path: "src/a.ts",
        search: "foo",
        section: "s1",
        type: "blob",
        view: "tree",
      }),
    );

    const q = query(href);
    expect(q.get("filter")).toBe("all");
    expect(q.get("node")).toBe("n1");
    expect(q.get("path")).toBe("src/a.ts");
    expect(q.get("search")).toBe("foo");
    expect(q.get("section")).toBe("s1");
    expect(q.get("type")).toBe("blob");
    expect(q.get("view")).toBe("tree");
  });
});

describe("buildRepoCodeHref", () => {
  it("builds the code url with encoded owner and name", () => {
    const href = buildRepoCodeHref({ name: "c%20d", owner: "a b" });
    expect(href).toBe("/dashboard/repo/a%20b/c%2520d/code");
  });

  it("attaches aid, node and path params", () => {
    const href = buildRepoCodeHref({
      aid: "abc",
      name: "n",
      nodeId: "n1",
      owner: "o",
      path: "x/y.ts",
    });

    const q = query(href);
    expect(q.get("aid")).toBe("abc");
    expect(q.get("node")).toBe("n1");
    expect(q.get("path")).toBe("x/y.ts");
  });
});

describe("buildRepoDocsHref", () => {
  it("attaches section and doc type params", () => {
    const href = buildRepoDocsHref({
      docType: "api",
      name: "n",
      nodeId: "n1",
      owner: "o",
      section: "s1",
    });

    const q = query(href);
    expect(href).toContain("/dashboard/repo/o/n/docs");
    expect(q.get("node")).toBe("n1");
    expect(q.get("section")).toBe("s1");
    expect(q.get("type")).toBe("api");
  });
});

describe("buildRepoMapHref", () => {
  it("sets the view param for group node ids", () => {
    const href = buildRepoMapHref({ name: "n", nodeId: "group:src", owner: "o" });
    expect(query(href).get("view")).toBe("group:src");
  });

  it("omits the view param for regular node ids", () => {
    const href = buildRepoMapHref({ name: "n", nodeId: "src/index.ts", owner: "o" });
    const hrefWithoutNode = buildRepoMapHref({ name: "n", owner: "o" });

    expect(query(href).get("view")).toBeNull();
    expect(query(hrefWithoutNode).get("view")).toBeNull();
  });
});

describe("buildRepoSearchResultHref", () => {
  const base = { aid: "abc", name: "n", owner: "o" };

  it("routes docs results through the docs builder", () => {
    const href = buildRepoSearchResultHref({
      ...base,
      result: {
        docSectionId: "s1",
        docType: "api",
        nodeId: "n1",
        path: null,
        targetView: "docs",
      } as RepoSearchResult,
    });

    expect(href).toContain("/docs");
    expect(query(href).get("type")).toBe("api");
    expect(query(href).get("section")).toBe("s1");
    expect(query(href).get("aid")).toBe("abc");
  });

  it("routes code results through the code builder", () => {
    const href = buildRepoSearchResultHref({
      ...base,
      result: {
        docSectionId: null,
        docType: null,
        nodeId: "n1",
        path: "src/a.ts",
        targetView: "code",
      } as RepoSearchResult,
    });

    expect(href).toContain("/code");
    expect(query(href).get("path")).toBe("src/a.ts");
  });

  it("routes everything else through the map builder", () => {
    const href = buildRepoSearchResultHref({
      ...base,
      result: {
        docSectionId: null,
        docType: null,
        nodeId: "group:x",
        path: null,
        targetView: "map",
      } as RepoSearchResult,
    });

    expect(href).toContain("/map");
    expect(query(href).get("view")).toBe("group:x");
  });
});
