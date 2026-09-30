import pm from "picomatch";

export const IGNORE_PATTERNS = [
  "**/{.git,node_modules,dist,build,out,public,static,target,.next,.nuxt,.svelte-kit,.astro,.nitro,.wrangler,.output,vendor,bower_components,coverage,.pnpm-store,.yarn,.turbo,.parcel-cache,.cache,.serverless,.terraform,.gradle,.mvn,.dart_tool,__pycache__,.pytest_cache,.mypy_cache,.ruff_cache,.tox,.nox,.venv,venv,obj,Debug,Release}/**",
  "**/{.ds_store,thumbs.db,.idea,.vscode}/**",
  "**/*.{pdf,doc,docx,xls,xlsx,ppt,pptx,zip,tar,gz,7z,rar,mp3,mp4,wav,exe,dll,so,pyc, png, jpg, jpeg}",
];

const isIgnoredPath = pm(IGNORE_PATTERNS.map((pattern) => pattern.toLowerCase()));

export function isIgnored(path: string): boolean {
  return isIgnoredPath(path.toLowerCase());
}
