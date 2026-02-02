import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const iconsDir = join(rootDir, 'public/icons');

const svgPath = join(iconsDir, 'icon.svg');
const svgContent = readFileSync(svgPath, 'utf-8');

const sizes = [16, 48, 128];

for (const size of sizes) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: true },
  });
  
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  
  const outputPath = join(iconsDir, `icon${size}.png`);
  writeFileSync(outputPath, pngBuffer);
  console.log(`Generated ${outputPath} (${size}x${size})`);
}

console.log('All icons generated successfully!');
