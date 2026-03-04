#!/usr/bin/env bun
// ── Generate PWA Icons ──────────────────────────────────────
// Generates PNG icons at various sizes from SVG source using sharp.
// Usage: bun scripts/generate-icons.ts

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const SIZES = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const OUT_DIR = join(import.meta.dir, "../packages/web/public/icons");
const PUBLIC_DIR = join(import.meta.dir, "../packages/web/public");

function generateSvg(size: number): string {
  const rx = Math.round(size * 0.125);
  const fontSize = Math.round(size * 0.375);
  const y = Math.round(size * 0.6);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${rx}" fill="#1a1b26"/>
  <text x="${size / 2}" y="${y}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="#7aa2f7">&gt;_</text>
</svg>`;
}

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// Generate PNGs
for (const size of SIZES) {
  const svg = Buffer.from(generateSvg(size));
  const outPath = join(OUT_DIR, `icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`  Generated: icons/icon-${size}.png (${size}x${size})`);
}

// Also generate main SVGs with the ">_" design
const svg192 = generateSvg(192);
const svg512 = generateSvg(512);
writeFileSync(join(PUBLIC_DIR, "icon-192x192.svg"), svg192);
writeFileSync(join(PUBLIC_DIR, "icon-512x512.svg"), svg512);

// Generate favicon.ico (32x32 PNG works as favicon)
const faviconSvg = Buffer.from(generateSvg(32));
await sharp(faviconSvg).resize(32, 32).png().toFile(join(PUBLIC_DIR, "favicon.png"));

console.log("\n  Icon generation complete!");
