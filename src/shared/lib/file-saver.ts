export function saveFile(blob: Blob, fileName: string) {
  if (typeof globalThis.window === "undefined") return;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  queueMicrotask(() => {
    URL.revokeObjectURL(url);
  });
}
