import fs from 'node:fs';
import path from 'node:path';

const distAssetsDir = path.resolve('apps/web/dist/assets');
const baselinePath = path.resolve('apps/web/build-baseline.json');

if (!fs.existsSync(distAssetsDir)) {
  console.error('[check-web-bundle-shape] Missing apps/web/dist/assets. Run the web build first.');
  process.exit(1);
}

if (!fs.existsSync(baselinePath)) {
  console.error('[check-web-bundle-shape] Missing apps/web/build-baseline.json.');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const assetEntries = fs
  .readdirSync(distAssetsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => {
    const absolutePath = path.join(distAssetsDir, entry.name);
    return {
      name: entry.name,
      size: fs.statSync(absolutePath).size,
    };
  });

const jsAssets = assetEntries
  .filter((asset) => /\.(?:js|mjs)$/i.test(asset.name))
  .sort((left, right) => right.size - left.size);
const cssAssets = assetEntries
  .filter((asset) => /\.css$/i.test(asset.name))
  .sort((left, right) => right.size - left.size);

const firstLoadPatterns = baseline.firstLoadJsPatterns.map((pattern) => new RegExp(pattern));
const firstLoadAssets = jsAssets.filter((asset) =>
  firstLoadPatterns.some((pattern) => pattern.test(asset.name)),
);
const firstLoadJsBytes = firstLoadAssets.reduce((sum, asset) => sum + asset.size, 0);

console.log('Web bundle shape summary');
console.log('');
console.log(`- First-load JS baseline: ${baseline.firstLoadJsBytes} B`);
console.log(`- First-load JS current:  ${firstLoadJsBytes} B`);
console.log('');
console.log('Top JS assets:');
for (const asset of jsAssets.slice(0, 10)) {
  console.log(`  - ${asset.name}: ${asset.size} B`);
}
console.log('');
console.log('Top CSS assets:');
for (const asset of cssAssets.slice(0, 10)) {
  console.log(`  - ${asset.name}: ${asset.size} B`);
}

if (firstLoadJsBytes >= baseline.firstLoadJsBytes) {
  console.error(
    `\n[check-web-bundle-shape] First-load JS must decrease below the baseline (${baseline.firstLoadJsBytes} B).`,
  );
  process.exit(1);
}

console.log('\nWeb bundle shape check passed.');
