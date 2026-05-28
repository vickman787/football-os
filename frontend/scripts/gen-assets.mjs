#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Football OS · asset generator
//
// Reads frontend/public/logo.png and produces every branded asset the app
// references: favicons, apple-touch-icon, OG image, PWA icons.
//
//   npm run gen:assets
//
// Re-run after replacing logo.png. Output files are written to public/ and
// should be committed so Vercel doesn't need to run sharp at build time.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PUBLIC = resolve(ROOT, 'public');
const SOURCE = resolve(PUBLIC, 'logo.png');

if (!existsSync(SOURCE)) {
  console.error(`\n[gen-assets] missing source: ${SOURCE}`);
  console.error('[gen-assets] place the master logo at frontend/public/logo.png and re-run.\n');
  process.exit(1);
}

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('\n[gen-assets] `sharp` is not installed. Run `npm install` in /frontend first.\n');
  process.exit(1);
}

await mkdir(PUBLIC, { recursive: true });

async function pngFromLogo({ size, out, padding = 0.08, background = { r: 0, g: 0, b: 0, alpha: 0 } }) {
  const inner = Math.round(size * (1 - padding * 2));
  const buf = await sharp(SOURCE)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: buf, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(PUBLIC, out));
}

console.log('[gen-assets] generating PNG icons…');
await pngFromLogo({ size: 16,  out: 'favicon-16x16.png' });
await pngFromLogo({ size: 32,  out: 'favicon-32x32.png' });
await pngFromLogo({ size: 48,  out: 'favicon-48x48.png' });
await pngFromLogo({ size: 180, out: 'apple-touch-icon.png', background: { r: 0, g: 0, b: 0, alpha: 1 } });
await pngFromLogo({ size: 192, out: 'favicon-192.png',     background: { r: 0, g: 0, b: 0, alpha: 1 } });
await pngFromLogo({ size: 512, out: 'favicon-512.png',     background: { r: 0, g: 0, b: 0, alpha: 1 } });

// Multi-resolution favicon.ico (16 + 32 + 48). sharp writes ICO from a single
// composite buffer; for a multi-size ICO we use png-to-ico via dynamic import.
console.log('[gen-assets] writing favicon.ico…');
try {
  const pngToIco = (await import('png-to-ico')).default;
  const icoBuf = await pngToIco([
    resolve(PUBLIC, 'favicon-16x16.png'),
    resolve(PUBLIC, 'favicon-32x32.png'),
    resolve(PUBLIC, 'favicon-48x48.png'),
  ]);
  await writeFile(resolve(PUBLIC, 'favicon.ico'), icoBuf);
} catch (e) {
  console.warn('[gen-assets] png-to-ico unavailable; falling back to a single-size ICO via sharp.');
  await sharp(resolve(PUBLIC, 'favicon-32x32.png'))
    .toFile(resolve(PUBLIC, 'favicon.ico'));
}

// Open Graph 1200×630 — logo centered on a black canvas with a soft neon glow.
console.log('[gen-assets] generating og-image.png…');
{
  const W = 1200, H = 630;
  const logoBuf = await sharp(SOURCE)
    .resize(620, 620, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const glow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <defs>
         <radialGradient id="g" cx="50%" cy="50%" r="50%">
           <stop offset="0%" stop-color="#39ff14" stop-opacity="0.18" />
           <stop offset="60%" stop-color="#39ff14" stop-opacity="0.04" />
           <stop offset="100%" stop-color="#000" stop-opacity="0" />
         </radialGradient>
       </defs>
       <rect width="100%" height="100%" fill="#000" />
       <rect width="100%" height="100%" fill="url(#g)" />
       <g font-family="ui-monospace, Menlo, Consolas, monospace" fill="#7a8a7d" font-size="22" letter-spacing="6">
         <text x="60" y="80">FOOTBALL · OS</text>
       </g>
       <g font-family="-apple-system, Segoe UI, Roboto, sans-serif" fill="#eafff0">
         <text x="60" y="560" font-size="42" font-weight="600">AI-powered football intelligence</text>
         <text x="60" y="600" font-size="22" fill="#39ff14" letter-spacing="3">ON X LAYER · zkEVM</text>
       </g>
     </svg>`
  );

  await sharp(glow)
    .composite([{ input: logoBuf, gravity: 'east', left: W - 700, top: 5 }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(PUBLIC, 'og-image.png'));
}

console.log('[gen-assets] done. Files written to public/.\n');
