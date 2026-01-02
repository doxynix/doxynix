import fs from "node:fs";
import path from "node:path";

const file = path.resolve("dist/index.js");

let content = fs.readFileSync(file, "utf8");

if (!content.startsWith("#!/usr/bin/env node")) {
  content = "#!/usr/bin/env node\n" + content;
  fs.writeFileSync(file, content);
}

fs.chmodSync(file, 0o755);
