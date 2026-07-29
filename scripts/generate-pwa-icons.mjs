/**
 * Regenerates app + PWA icons from assets/icons/icon-source-flame.png.
 * Usage: node scripts/generate-pwa-icons.mjs
 *
 * Android adaptive icons mask to a circle (~66% safe zone). iOS rounds corners.
 * Keep the flame smaller than the canvas so wispy top/bottom are not clipped.
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'assets', 'icons', 'icon-source-flame.png');
const assetsIcons = path.join(root, 'assets', 'icons');
const publicIcons = path.join(root, 'public', 'icons');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const themeBg = { r: 5, g: 6, b: 13, alpha: 1 };

/** Standard launcher icon — fits iOS rounded rect with margin. */
const STANDARD_INNER_RATIO = 0.78;
/** Android adaptive / maskable safe zone — circle mask ~66% diameter. */
const MASKABLE_INNER_RATIO = 0.64;

async function flameBuffer(innerSize) {
  return sharp(source)
    .resize(innerSize, innerSize, {
      fit: 'contain',
      background: transparent,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

async function composeSquare(size, innerRatio, background, outPath) {
  const inner = Math.round(size * innerRatio);
  const innerBuf = await flameBuffer(inner);
  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: innerBuf, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function pngSquare(size, outPath, innerRatio = STANDARD_INNER_RATIO) {
  await composeSquare(size, innerRatio, themeBg, outPath);
}

async function maskable512(outPath) {
  await composeSquare(512, MASKABLE_INNER_RATIO, themeBg, outPath);
}

const iconSizes = [48, 72, 96, 128, 144, 192, 256, 384, 512];

async function main() {
  if (!fs.existsSync(source)) {
    console.error('Missing source flame:', source);
    process.exit(1);
  }

  await pngSquare(512, path.join(assetsIcons, 'icon-512x512.png'));
  await maskable512(path.join(assetsIcons, 'icon-512x512-maskable.png'));

  await pngSquare(16, path.join(publicIcons, 'favicon-16x16.png'));
  await pngSquare(32, path.join(publicIcons, 'favicon-32x32.png'));

  for (const s of iconSizes) {
    await pngSquare(s, path.join(publicIcons, `icon-${s}x${s}.png`));
  }

  await pngSquare(180, path.join(publicIcons, 'apple-touch-icon.png'));
  await pngSquare(120, path.join(publicIcons, 'apple-touch-icon-120x120.png'));
  await pngSquare(152, path.join(publicIcons, 'apple-touch-icon-152x152.png'));
  await pngSquare(167, path.join(publicIcons, 'apple-touch-icon-167x167.png'));

  await maskable512(path.join(publicIcons, 'icon-512x512-maskable.png'));

  await sharp(path.join(assetsIcons, 'icon-512x512.png'))
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, 'assets', 'icon.png'));

  const meta = await sharp(source).metadata();
  console.log(
    'Wrote icons from',
    source,
    `(${meta.width}x${meta.height})`,
    `standard=${STANDARD_INNER_RATIO}`,
    `maskable=${MASKABLE_INNER_RATIO}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
