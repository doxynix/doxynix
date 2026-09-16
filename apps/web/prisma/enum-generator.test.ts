import { beforeEach, describe, expect, it, vi } from "vitest";

const { captured, execFileSyncMock, mkdirMock, writeFileMock } = vi.hoisted(() => ({
  captured: {
    onGenerate: undefined as undefined | ((options: never) => Promise<void>),
    onManifest: undefined as undefined | (() => unknown),
  },
  execFileSyncMock: vi.fn(),
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
  },
  mkdir: mkdirMock,
  writeFile: writeFileMock,
}));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
}));

vi.mock("@prisma/generator-helper", () => ({
  generatorHandler: (handler: {
    onGenerate: (options: never) => Promise<void>;
    onManifest: () => unknown;
  }) => {
    captured.onGenerate = handler.onGenerate;
    captured.onManifest = handler.onManifest;
  },
}));

import "./enum-generator";

type DmmfEnum = {
  name: string;
  values: Array<{ name: string }>;
};

const makeOptions = (enums: DmmfEnum[], output?: string) =>
  ({
    dmmf: { datamodel: { enums } },
    generator: { output: output == null ? undefined : { value: output } },
  }) as never;

/** Извлекает ключи const-объекта `export const X = { ... } as const;` из контента. */
const extractConstKeys = (content: string, enumName: string): string[] =>
  content
    .split(`export const ${enumName} = {`)[1]!
    .split("} as const;")[0]!
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(":")[0]!);

describe("prisma/enum-generator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    execFileSyncMock.mockReturnValue(undefined);
  });

  it("writes sorted z.enum + const object and runs biome format", async () => {
    const outputPath = "/tmp/out/enums/index.ts";
    const enums: DmmfEnum[] = [
      {
        name: "BannedEmailReason",
        values: [
          { name: "BOUNCED" },
          { name: "COMPLAINED" },
          { name: "SUPPRESSED" },
          { name: "FAILED" },
          { name: "DISPOSABLE" },
          { name: "MANUAL" },
        ],
      },
      { name: "UserRole", values: [{ name: "USER" }, { name: "ADMIN" }] },
    ];

    await captured.onGenerate!(makeOptions(enums, outputPath));

    expect(mkdirMock).toHaveBeenCalledWith("/tmp/out/enums", { recursive: true });
    const [writtenPath, content, encoding] = writeFileMock.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect(writtenPath).toBe(outputPath);
    expect(encoding).toBe("utf-8");

    expect(content).toContain(
      "// This file was automatically generated via Prisma DMMF. DO NOT EDIT MANUALLY.",
    );
    expect(content).toContain("// ------------------- BannedEmailReason -------------------");
    expect(content).toContain("// ------------------- UserRole -------------------");
    expect(content).toContain(
      'export const BannedEmailReasonSchema = z.enum(["BOUNCED", "COMPLAINED", "DISPOSABLE", "FAILED", "MANUAL", "SUPPRESSED"]);',
    );
    expect(content).toContain(
      "export type BannedEmailReason = z.infer<typeof BannedEmailReasonSchema>;",
    );
    expect(content).toContain("} as const;");

    expect(extractConstKeys(content, "BannedEmailReason")).toEqual([
      "BOUNCED",
      "COMPLAINED",
      "DISPOSABLE",
      "FAILED",
      "MANUAL",
      "SUPPRESSED",
    ]);
    expect(extractConstKeys(content, "UserRole")).toEqual(["ADMIN", "USER"]);

    expect(execFileSyncMock).toHaveBeenCalledWith(
      "bun",
      ["x", "biome", "format", "--write", outputPath],
      { stdio: "ignore" },
    );
  });

  it("sorts values regardless of DMMF declaration order", async () => {
    const enums: DmmfEnum[] = [
      {
        name: "Status",
        values: [{ name: "ZEBRA" }, { name: "ALPHA" }, { name: "MIKE" }, { name: "BRAVO" }],
      },
    ];

    await captured.onGenerate!(makeOptions(enums, "/tmp/out/a.ts"));

    const content = writeFileMock.mock.calls[0]![1] as string;
    expect(content).toContain(
      'export const StatusSchema = z.enum(["ALPHA", "BRAVO", "MIKE", "ZEBRA"]);',
    );
    expect(extractConstKeys(content, "Status")).toEqual(["ALPHA", "BRAVO", "MIKE", "ZEBRA"]);
  });

  it("throws when no output file is configured", async () => {
    await expect(captured.onGenerate!(makeOptions([]))).rejects.toThrow("No output file specified");
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("still writes the file when biome formatting fails", async () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("biome missing");
    });

    await captured.onGenerate!(
      makeOptions([{ name: "X", values: [{ name: "A" }] }], "/tmp/out/b.ts"),
    );

    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });

  it("announces the default output path and pretty name", () => {
    expect(captured.onManifest!()).toEqual({
      defaultOutput: "../../../packages/shared/src/enums/index.ts",
      prettyName: "Doxynix Enums & Zod Generator",
    });
  });
});
