// One-off icon generator for MediCare Hub PWA / APK packaging.
// Produces:
//   public/icon-192.png          (any purpose)
//   public/icon-512.png          (any purpose)
//   public/icon-maskable-512.png (maskable — padded for Android adaptive icons)
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT_DIR = join(process.cwd(), "public");

// Cross + heart pulse on a teal rounded square. SVG scales cleanly to 512.
const buildSvg = ({ size, maskable }: { size: number; maskable?: boolean }) => {
  const pad = maskable ? size * 0.12 : 0; // 12% safe-zone padding for maskable
  const inner = size - pad * 2;
  const r = maskable ? 0 : inner * 0.18; // rounded corners for non-maskable
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d9488"/>
      <stop offset="100%" stop-color="#0f766e"/>
    </linearGradient>
    <linearGradient id="cross" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e2f5f3"/>
    </linearGradient>
  </defs>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${r}" ry="${r}" fill="url(#bg)"/>
  <!-- Medical cross -->
  <g transform="translate(${size / 2} ${size / 2 - size * 0.04})">
    <rect x="${-size * 0.075}" y="${-size * 0.21}" width="${size * 0.15}" height="${size * 0.42}" rx="${size * 0.03}" fill="url(#cross)"/>
    <rect x="${-size * 0.21}" y="${-size * 0.075}" width="${size * 0.42}" height="${size * 0.15}" rx="${size * 0.03}" fill="url(#cross)"/>
  </g>
  <!-- Heart pulse line -->
  <polyline points="${pad + inner * 0.18},${size * 0.78} ${size * 0.42},${size * 0.78} ${size * 0.47},${size * 0.68} ${size * 0.52},${size * 0.88} ${size * 0.57},${size * 0.78} ${pad + inner * 0.82},${size * 0.78}"
    fill="none" stroke="#5eead4" stroke-width="${size * 0.022}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
};

const write = async (name: string, size: number, maskable = false) => {
  const outPath = join(OUT_DIR, name);
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(buildSvg({ size, maskable }))).png().toFile(outPath);
  console.log("wrote", outPath);
};

await write("icon-192.png", 192);
await write("icon-512.png", 512);
await write("icon-maskable-512.png", 512, true);
console.log("Done.");
