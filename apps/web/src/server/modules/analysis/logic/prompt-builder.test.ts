import { describe, expect, it } from "vitest";

import { PromptFactory, UserPromptBuilder } from "./prompt-builder";

describe("PromptFactory.forRole", () => {
  it("sets the role section with a role description", () => {
    const builder = PromptFactory.forRole("readme-writer");

    expect(builder.getSections().get("role")).toBe(
      "# ROLE\nYou are a Developer Relations Engineer. Write an executive-level README.md blueprint. Ensure it includes quick-start commands, configuration options, prerequisites, and a high-level value proposition of the system.",
    );
  });

  it("each role gets its own description", () => {
    expect(PromptFactory.forRole("generic").getSections().get("role")).toContain(
      "Expert Technical Writer",
    );
    expect(PromptFactory.forRole("security-sentinel").getSections().get("role")).toContain(
      "Offensive Security Engineer",
    );
  });

  it("buildSystem() by default starts with <|think|> and contains the role section", () => {
    const system = PromptFactory.forRole("architect").buildSystem();

    expect(system.startsWith("<|think|>\n# ROLE\n")).toBe(true);
  });

  it("default English language does not create a language section", () => {
    const system = PromptFactory.forRole("generic").withLanguageNotice().buildSystem();

    expect(system).not.toContain("# LANGUAGE CONFIGURATION");
  });

  it("withLanguageNotice with a non-English language adds the section", () => {
    const system = PromptFactory.forRole("generic", "Deutsch").withLanguageNotice().buildSystem();

    expect(system).toContain("# LANGUAGE CONFIGURATION");
    expect(system).toContain("strictly in **Deutsch**");
  });
});

describe("PromptBuilder (via PromptFactory)", () => {
  it("buildSystem() assembles sections in order role→task→constraints→grounding→strategy→anti_fluff→output", () => {
    const system = PromptFactory.forRole("generic")
      .withRole("R")
      .withTask("T")
      .withConstraints("C1", undefined, "C2")
      .withGrounding("G")
      .withStrategy("S1", "S2")
      .withAntiFluff()
      .withOutputFormat("json")
      .buildSystem();

    const headings = [
      "# ROLE",
      "# TASK",
      "# CONSTRAINTS",
      "# GROUNDING",
      "# STRATEGY",
      "# QUALITY STANDARDS",
      "# OUTPUT",
    ].map((h) => system.indexOf(h));

    expect(headings).toEqual([...headings].sort((a, b) => a - b));
    expect(headings.every((h) => h >= 0)).toBe(true);
  });

  it("custom sections are added after standard ones", () => {
    const system = PromptFactory.forRole("generic")
      .withRole("R")
      .addSection("custom", "extra content")
      .buildSystem();

    expect(system.indexOf("# CUSTOM\n")).toBeGreaterThan(system.indexOf("# ROLE"));
    expect(system).toContain("extra content");
  });

  it("addSection normalizes the key to lowercase (task from TASK)", () => {
    const system = PromptFactory.forRole("generic")
      .withRole("R")
      .addSection("TASK", "T body")
      .buildSystem();

    expect(system.indexOf("# TASK")).toBeGreaterThan(system.indexOf("# ROLE"));
  });

  it("withThinking(false) adds an operational constraint and removes <|think|>", () => {
    const system = PromptFactory.forRole("generic").withRole("R").withThinking(false).buildSystem();

    expect(system).toContain("# OPERATIONAL CONSTRAINT");
    expect(system).toContain("Thinking Mode: BYPASS");
    expect(system).not.toContain("<|think|>");
  });

  it("withConstraints numbers rules and skips falsy values", () => {
    const system = PromptFactory.forRole("generic")
      .withConstraints("A", undefined, "", "B")
      .buildSystem();

    expect(system).toContain("# CONSTRAINTS\n1. A\n2. B");
  });

  it("withConstraints without rules does not create the section", () => {
    const system = PromptFactory.forRole("generic").withConstraints().buildSystem();

    expect(system).not.toContain("# CONSTRAINTS");
  });

  it("withGrounding builds bullets and filters falsy values", () => {
    const system = PromptFactory.forRole("generic")
      .withGrounding("G1", undefined, "G2")
      .buildSystem();

    expect(system).toContain("# GROUNDING\n- G1\n- G2");
  });

  it("withStrategy numbers the steps", () => {
    const system = PromptFactory.forRole("generic").withStrategy("S1", "S2").buildSystem();

    expect(system).toContain("# STRATEGY\n1. S1\n2. S2");
  });

  it("withJsonSchema builds OUTPUT_SCHEMA with pretty-printed JSON", () => {
    const schema = { name: "x", score: 0 };
    const system = PromptFactory.forRole("generic").withJsonSchema(schema).buildSystem();

    expect(system).toContain("# OUTPUT_SCHEMA");
    expect(system).toContain("```json");
    expect(system).toContain(JSON.stringify(schema, null, 2));
  });

  it("withOutputFormat accepts a string and an object", () => {
    const asString = PromptFactory.forRole("generic").withOutputFormat("plain").buildSystem();
    const asObject = PromptFactory.forRole("generic")
      .withOutputFormat({ content: "body", title: "MY FORMAT" })
      .buildSystem();

    expect(asString).toContain("# OUTPUT\nplain");
    expect(asObject).toContain("# MY FORMAT\nbody");
  });

  it("reset() clears sections and restores thinking to its initial state", () => {
    const builder = PromptFactory.forRole("generic").withRole("R").withThinking(false);

    builder.reset();

    expect(builder.buildSystem()).toBe("<|think|>\n");
  });

  it("getSections() returns a copy without affecting the builder", () => {
    const builder = PromptFactory.forRole("generic");
    const copy = builder.getSections();

    copy.set("task", "# TASK\nX");

    expect(builder.getSections().has("task")).toBe(false);
  });
});

describe("UserPromptBuilder", () => {
  it("build() of an empty builder — empty string", () => {
    expect(new UserPromptBuilder().build()).toBe("");
  });

  it("addRaw joins parts with line breaks", () => {
    const built = new UserPromptBuilder().addRaw("a").addRaw("b").build();

    expect(built).toBe("a\nb");
  });

  it("addHeading adds a markdown heading of level 1-4", () => {
    expect(new UserPromptBuilder().addHeading(1, "Title").build()).toBe("\n# Title\n");
    expect(new UserPromptBuilder().addHeading(4, "Deep").build()).toBe("\n#### Deep\n");
  });

  it("addList supports bulleted and numbered lists", () => {
    expect(new UserPromptBuilder().addList(["a", "b"]).build()).toBe("- a\n- b");
    expect(new UserPromptBuilder().addList(["a", "b"], true).build()).toBe("1. a\n2. b");
  });

  it("addJsonBlock wraps JSON in CDATA-XML", () => {
    const built = new UserPromptBuilder().addJsonBlock({ a: 1 }, "data").build();

    expect(built).toBe('<data>\n<![CDATA[\n{\n  "a": 1\n}\n]]>\n</data>');
  });

  it("addXmlSection escapes attributes (HTML-escape)", () => {
    const built = new UserPromptBuilder()
      .addXmlSection("file", "content", { path: 'a"b&c' })
      .build();

    expect(built).toContain('path="a&quot;b&amp;c"');
  });

  it("addXmlSection replaces the closing CDATA sequence", () => {
    const built = new UserPromptBuilder().addXmlSection("t", "a ]]> b").build();

    expect(built).toContain("a ]]&gt; b");
    expect(built).not.toContain("a ]]> b");
  });

  it("reset() clears parts", () => {
    const builder = new UserPromptBuilder().addRaw("x");

    builder.reset();

    expect(builder.build()).toBe("");
  });
});
