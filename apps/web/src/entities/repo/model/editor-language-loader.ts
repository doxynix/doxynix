import type { Extension } from "@codemirror/state";

// Lives outside the editor component on purpose: React Compiler cannot lower a dynamic
// import and bails out of the whole function that contains one.
export async function loadLanguageExtension(path: string): Promise<Extension | null> {
  const extName = (path.split(".").pop() ?? "").toLowerCase();
  const { languages } = await import("@codemirror/language-data");

  const langDesc = languages.find(
    (l) => l.extensions.includes(extName) || l.alias.includes(extName),
  );

  return langDesc ? langDesc.load() : null;
}
