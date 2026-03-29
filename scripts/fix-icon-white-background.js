/**
 * Flattens app icon PNGs with a solid white background so iOS does not show
 * a black border (transparent pixels rendered as black).
 * Run: npm run fix-icon-background
 * Requires: npm install sharp --save-dev
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets', 'icons');
const ICONS = [
  'icon-512x512.png',
  'icon-512x512-maskable.png',
];

const WHITE = { r: 255, g: 255, b: 255 };

async function main() {
  if (!fs.existsSync(ASSETS)) {
    console.error('Missing folder:', ASSETS);
    console.error('Create assets/icons/ and add your icon PNGs, then run again.');
    process.exit(1);
  }

  for (const name of ICONS) {
    const inputPath = path.join(ASSETS, name);
    if (!fs.existsSync(inputPath)) {
      console.warn('Skip (not found):', name);
      continue;
    }
    try {
      const tmpPath = path.join(ASSETS, `.${name}.tmp`);
      await sharp(inputPath)
        .flatten({ background: WHITE })
        .toFile(tmpPath);
      fs.renameSync(tmpPath, inputPath);
      console.log('OK:', name);
    } catch (err) {
      console.error('Error processing', name, err.message);
      process.exit(1);
    }
  }
  console.log('Done. Rebuild the app for icon changes to apply: eas build --platform ios');
}

main();
