import fs from 'node:fs';
import path from 'node:path';

const searchDirs = [
  process.cwd(),
  path.resolve(process.cwd(), '../..'),
  path.resolve(process.cwd(), '..'),
];

let cleanedCount = 0;

for (const baseDir of searchDirs) {
  const bunCacheDir = path.join(baseDir, 'node_modules', '.bun');
  if (!fs.existsSync(bunCacheDir)) continue;

  try {
    const entries = fs.readdirSync(bunCacheDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('tree-sitter-wasms')) {
        const nestedNodeModules = path.join(
          bunCacheDir,
          entry.name,
          'node_modules',
          'tree-sitter-wasms',
          'node_modules'
        );

        if (fs.existsSync(nestedNodeModules)) {
          fs.rmSync(nestedNodeModules, { recursive: true, force: true });
          console.log(`🧹 [clean:symlinks] Removed circular symlink directory: ${nestedNodeModules}`);
          cleanedCount++;
        }
      }
    }
  } catch (err) {
    console.error(`⚠️ [clean:symlinks] Error reading ${bunCacheDir}:`, err?.message ?? err);
  }

  const directNested = path.join(baseDir, 'node_modules', 'tree-sitter-wasms', 'node_modules');
  if (fs.existsSync(directNested)) {
    try {
      fs.rmSync(directNested, { recursive: true, force: true });
      console.log(`🧹 [clean:symlinks] Removed circular directory: ${directNested}`);
      cleanedCount++;
    } catch (err) {
      console.error(`⚠️ [clean:symlinks] Error removing ${directNested}:`, err?.message ?? err);
    }
  }
}

if (cleanedCount > 0) {
  console.log(`✅ [clean:symlinks] Successfully cleaned ${cleanedCount} circular symlink path(s).`);
} else {
  console.log('✨ [clean:symlinks] No circular symlinks found.');
}
