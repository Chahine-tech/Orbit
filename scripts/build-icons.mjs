import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const src = new URL('../src/assets/icon.svg', import.meta.url).pathname;
const assetsDir = path.dirname(src);
const iconsetDir = path.join(assetsDir, 'icon.iconset');

fs.mkdirSync(iconsetDir, { recursive: true });

// Render SVG at `inner` size then extend canvas to `outer` with transparent padding.
// Apple HIG: artwork should fill ~80% of the canvas (10% padding each side).
async function renderWithPadding(outputPath, outer) {
  const inner = Math.round(outer * 0.8);
  const pad = Math.round((outer - inner) / 2);
  await sharp(src)
    .resize(inner, inner)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);
}

const macSizes = [16, 32, 64, 128, 256, 512, 1024];

for (const size of macSizes) {
  await renderWithPadding(path.join(iconsetDir, `icon_${size}x${size}.png`), size);
  if (size <= 512) {
    await renderWithPadding(path.join(iconsetDir, `icon_${size}x${size}@2x.png`), size * 2);
  }
}

execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(assetsDir, 'icon.icns')}"`);
console.log('icon.icns created');

// 256×256 with padding for Linux / generic use
await renderWithPadding(path.join(assetsDir, 'icon.png'), 256);
console.log('icon.png created');

// 1024×1024 with padding — used by app.dock.setIcon() in dev
await renderWithPadding(path.join(assetsDir, 'icon@1024.png'), 1024);
console.log('icon@1024.png created');

fs.rmSync(iconsetDir, { recursive: true });
console.log('Done.');
