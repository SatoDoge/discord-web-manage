import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const importPrefix = '#server/';

function toRelativeImport(fromFile, subpath) {
  const target = path.join(distDir, subpath);
  let relative = path.relative(path.dirname(fromFile), target);
  relative = relative.split(path.sep).join('/');
  if (!relative.startsWith('.')) {
    relative = `./${relative}`;
  }
  return relative;
}

function rewriteFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const pattern = /(from\s+['"])#server\/([^'"]+)(['"])/g;
  const updated = content.replace(pattern, (_match, start, subpath, end) => {
    const relative = toRelativeImport(filePath, subpath);
    return `${start}${relative}${end}`;
  });

  if (updated !== content) {
    writeFileSync(filePath, updated, 'utf8');
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.endsWith('.js')) {
      rewriteFile(full);
    }
  }
}

walk(distDir);
