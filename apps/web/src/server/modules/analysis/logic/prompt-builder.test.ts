import { describe, expect, it } from "vitest";

import { PromptFactory, UserPromptBuilder } from "./prompt-builder";

describe("PromptFactory.forRole", () => {
  it("устанавливает role-секцию с описанием роли", () => {
    const builder = PromptFactory.forRole("readme-writer");

    expect(builder.getSections().get("role")).toBe(
      "# ROLE\nYou are a Developer Relations Engineer. Write an executive-level README.md blueprint. Ensure it includes quick-start commands, configuration options, prerequisites, and a high-level value proposition of the system.",
    );
  });

  it("каждая роль получает своё описание", () => {
    expect(PromptFactory.forRole("generic").getSections().get("role")).toContain(
      "Expert Technical Writer",
    );
    expect(PromptFactory.forRole("security-sentinel").getSections().get("role")).toContain(
      "Offensive Security Engineer",
    );
  });

  it("buildSystem() по умолчанию начинается с <|think|> и содержит секцию роли", () => {
    const system = PromptFactory.forRole("architect").buildSystem();

    expect(system.startsWith("<|think|>\n# ROLE\n")).toBe(true);
  });

  it("язык по умолчанию English не создаёт language-секцию", () => {
    const system = PromptFactory.forRole("generic").withLanguageNotice().buildSystem();

    expect(system).not.toContain("# LANGUAGE CONFIGURATION");
  });

  it("withLanguageNotice с не-English языком добавляет секцию", () => {
    const system = PromptFactory.forRole("generic", "Deutsch").withLanguageNotice().buildSystem();

    expect(system).toContain("# LANGUAGE CONFIGURATION");
    expect(system).toContain("strictly in **Deutsch**");
  });
});

describe("PromptBuilder (через PromptFactory)", () => {
  it("buildSystem() собирает секции в порядке role→task→constraints→grounding→strategy→anti_fluff→output", () => {
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

  it("нестандартные секции добавляются после стандартных", () => {
    const system = PromptFactory.forRole("generic")
      .withRole("R")
      .addSection("custom", "extra content")
      .buildSystem();

    expect(system.indexOf("# CUSTOM\n")).toBeGreaterThan(system.indexOf("# ROLE"));
    expect(system).toContain("extra content");
  });

  it("addSection нормализует ключ в нижний регистр (task из TASK)", () => {
    const system = PromptFactory.forRole("generic")
      .withRole("R")
      .addSection("TASK", "T body")
      .buildSystem();

    expect(system.indexOf("# TASK")).toBeGreaterThan(system.indexOf("# ROLE"));
  });

  it("withThinking(false) добавляет операционное ограничение и убирает <|think|>", () => {
    const system = PromptFactory.forRole("generic").withRole("R").withThinking(false).buildSystem();

    expect(system).toContain("# OPERATIONAL CONSTRAINT");
    expect(system).toContain("Thinking Mode: BYPASS");
    expect(system).not.toContain("<|think|>");
  });

  it("withConstraints нумерует правила и пропускает falsy-значения", () => {
    const system = PromptFactory.forRole("generic")
      .withConstraints("A", undefined, "", "B")
      .buildSystem();

    expect(system).toContain("# CONSTRAINTS\n1. A\n2. B");
  });

  it("withConstraints без правил не создаёт секцию", () => {
    const system = PromptFactory.forRole("generic").withConstraints().buildSystem();

    expect(system).not.toContain("# CONSTRAINTS");
  });

  it("withGrounding формирует буллеты и фильтрует falsy", () => {
    const system = PromptFactory.forRole("generic")
      .withGrounding("G1", undefined, "G2")
      .buildSystem();

    expect(system).toContain("# GROUNDING\n- G1\n- G2");
  });

  it("withStrategy нумерует шаги", () => {
    const system = PromptFactory.forRole("generic").withStrategy("S1", "S2").buildSystem();

    expect(system).toContain("# STRATEGY\n1. S1\n2. S2");
  });

  it("withJsonSchema формирует OUTPUT_SCHEMA с pretty-printed JSON", () => {
    const schema = { name: "x", score: 0 };
    const system = PromptFactory.forRole("generic").withJsonSchema(schema).buildSystem();

    expect(system).toContain("# OUTPUT_SCHEMA");
    expect(system).toContain("```json");
    expect(system).toContain(JSON.stringify(schema, null, 2));
  });

  it("withOutputFormat принимает строку и объект", () => {
    const asString = PromptFactory.forRole("generic").withOutputFormat("plain").buildSystem();
    const asObject = PromptFactory.forRole("generic")
      .withOutputFormat({ content: "body", title: "MY FORMAT" })
      .buildSystem();

    expect(asString).toContain("# OUTPUT\nplain");
    expect(asObject).toContain("# MY FORMAT\nbody");
  });

  it("reset() очищает секции и возвращает thinking в исходное состояние", () => {
    const builder = PromptFactory.forRole("generic").withRole("R").withThinking(false);

    builder.reset();

    expect(builder.buildSystem()).toBe("<|think|>\n");
  });

  it("getSections() возвращает копию, не влияя на билдер", () => {
    const builder = PromptFactory.forRole("generic");
    const copy = builder.getSections();

    copy.set("task", "# TASK\nX");

    expect(builder.getSections().has("task")).toBe(false);
  });
});

describe("UserPromptBuilder", () => {
  it("build() пустого билдера — пустая строка", () => {
    expect(new UserPromptBuilder().build()).toBe("");
  });

  it("addRaw соединяет части переносами строк", () => {
    const built = new UserPromptBuilder().addRaw("a").addRaw("b").build();

    expect(built).toBe("a\nb");
  });

  it("addHeading добавляет markdown-заголовок уровня 1-4", () => {
    expect(new UserPromptBuilder().addHeading(1, "Title").build()).toBe("\n# Title\n");
    expect(new UserPromptBuilder().addHeading(4, "Deep").build()).toBe("\n#### Deep\n");
  });

  it("addList поддерживает маркированные и нумерованные списки", () => {
    expect(new UserPromptBuilder().addList(["a", "b"]).build()).toBe("- a\n- b");
    expect(new UserPromptBuilder().addList(["a", "b"], true).build()).toBe("1. a\n2. b");
  });

  it("addJsonBlock оборачивает JSON в CDATA-XML", () => {
    const built = new UserPromptBuilder().addJsonBlock({ a: 1 }, "data").build();

    expect(built).toBe('<data>\n<![CDATA[\n{\n  "a": 1\n}\n]]>\n</data>');
  });

  it("addXmlSection экранирует атрибуты (HTML-escape)", () => {
    const built = new UserPromptBuilder()
      .addXmlSection("file", "content", { path: 'a"b&c' })
      .build();

    expect(built).toContain('path="a&quot;b&amp;c"');
  });

  it("addXmlSection заменяет закрывающую CDATA-последовательность", () => {
    const built = new UserPromptBuilder().addXmlSection("t", "a ]]> b").build();

    expect(built).toContain("a ]]&gt; b");
    expect(built).not.toContain("a ]]> b");
  });

  it("reset() очищает части", () => {
    const builder = new UserPromptBuilder().addRaw("x");

    builder.reset();

    expect(builder.build()).toBe("");
  });
});
