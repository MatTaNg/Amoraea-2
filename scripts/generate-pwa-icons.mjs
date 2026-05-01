/**
 * Regenerates public/icons + Expo icons from assets/icons/icon-source-flame.png (RGBA).
 * Usage: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const source = path.join(root, 'assets', 'icons', 'icon-source-flame.png');
const publicIcons = path.join(root, 'public', 'icons');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const themeBg = { r: 5, g: 6, b: 13, alpha: 1 };

async function pngSquare(size, outPath, { fit = 'contain', background = transparent } = {}) {
  await sharp(source)
    .resize(size, size, {
      fit,
      background,
      kernel: sharp.kernel.lanczos3,
      position: 'center',
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function maskable512(outPath) {
  const size = 512;
  const inner = Math.round(size * 0.68);
  const innerBuf = await sharp(source)
    .resize(inner, inner, {
      fit: 'contain',
      background: transparent,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: themeBg },
  })
    .composite([{ input: innerBuf, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

const iconSizes = [48, 72, 96, 128, 144, 192, 256, 384, 512];

async function main() {
  await pngSquare(16, path.join(publicIcons, 'favicon-16x16.png'));
  await pngSquare(32, path.join(publicIcons, 'favicon-32x32.png'));

  for (const s of iconSizes) {
    await pngSquare(s, path.join(publicIcons, `icon-${s}x${s}.png`));
  }

  await maskable512(path.join(publicIcons, 'icon-512x512-maskable.png'));

  await pngSquare(180, path.join(publicIcons, 'apple-touch-icon.png'));
  await pngSquare(120, path.join(publicIcons, 'apple-touch-icon-120x120.png'));
  await pngSquare(152, path.join(publicIcons, 'apple-touch-icon-152x152.png'));
  await pngSquare(167, path.join(publicIcons, 'apple-touch-icon-167x167.png'));

  await pngSquare(512, path.join(root, 'assets', 'icons', 'icon-512x512.png'));
  await maskable512(path.join(root, 'assets', 'icons', 'icon-512x512-maskable.png'));

  const meta = await sharp(source).metadata();
  console.log('Wrote PWA icons from', source, `(${meta.width}x${meta.height})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
