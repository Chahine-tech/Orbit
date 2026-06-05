import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const src = new URL('../src/assets/icon.svg', import.meta.url).pathname;
const assetsDir = path.dirname(src);
const iconsetDir = path.join(assetsDir, 'icon.iconset');

fs.mkdirSync(iconsetDir, { recursive: true });

const macSizes = [16, 32, 64, 128, 256, 512, 1024];

for (const size of macSizes) {
  await sharp(src).resize(size, size).png().toFile(path.join(iconsetDir, `icon_${size}x${size}.png`));
  if (size <= 512) {
    await sharp(src).resize(size * 2, size * 2).png().toFile(path.join(iconsetDir, `icon_${size}x${size}@2x.png`));
  }
}

execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(assetsDir, 'icon.icns')}"`);
console.log('icon.icns created');

// 256×256 PNG for Linux / generic
await sharp(src).resize(256, 256).png().toFile(path.join(assetsDir, 'icon.png'));
console.log('icon.png created');

// 1024×1024 for reference
await sharp(src).resize(1024, 1024).png().toFile(path.join(assetsDir, 'icon@1024.png'));
console.log('icon@1024.png created');

fs.rmSync(iconsetDir, { recursive: true });
console.log('Done.');
