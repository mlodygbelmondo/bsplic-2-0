import { gzipSync } from 'node:zlib';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = new URL('../dist/assets/', import.meta.url);

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} kB`;
}

async function collectAssets() {
  const entries = await readdir(distDir, { withFileTypes: true });
  const assets = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name);
    if (ext !== '.js' && ext !== '.css') {
      continue;
    }

    const fileUrl = new URL(entry.name, distDir);
    const [fileStat, content] = await Promise.all([
      stat(fileUrl),
      readFile(fileUrl),
    ]);

    assets.push({
      name: entry.name,
      ext,
      size: fileStat.size,
      gzipSize: gzipSync(content).length,
    });
  }

  return assets.sort((a, b) => b.size - a.size);
}

const assets = await collectAssets();
const totals = assets.reduce(
  (acc, asset) => {
    acc[asset.ext].size += asset.size;
    acc[asset.ext].gzipSize += asset.gzipSize;
    return acc;
  },
  {
    '.js': { size: 0, gzipSize: 0 },
    '.css': { size: 0, gzipSize: 0 },
  },
);
const largestJs = assets.find((asset) => asset.ext === '.js');

console.log('Build asset size summary');
console.log(
  `JS total: ${formatBytes(totals['.js'].size)} (${formatBytes(totals['.js'].gzipSize)} gzip)`,
);
console.log(
  `CSS total: ${formatBytes(totals['.css'].size)} (${formatBytes(totals['.css'].gzipSize)} gzip)`,
);

if (largestJs) {
  console.log(
    `Largest JS: ${largestJs.name} ${formatBytes(largestJs.size)} (${formatBytes(largestJs.gzipSize)} gzip)`,
  );
}

console.log('\nLargest assets:');
assets.slice(0, 12).forEach((asset) => {
  console.log(
    `- ${asset.name} ${formatBytes(asset.size)} (${formatBytes(asset.gzipSize)} gzip)`,
  );
});
