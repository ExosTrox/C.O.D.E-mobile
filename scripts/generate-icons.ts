#!/usr/bin/env bun
// ── Generate PWA Icons ──────────────────────────────────────
// Generates polished PNG icons at various sizes from SVG source using sharp.
// Usage: bun scripts/generate-icons.ts

import sharp from "sharp";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const SIZES = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const OUT_DIR = join(import.meta.dir, "../packages/web/public/icons");
const PUBLIC_DIR = join(import.meta.dir, "../packages/web/public");

function generateSvg(size: number): string {
  const rx = Math.round(size * 0.22);
  const promptSize = Math.round(size * 0.30);
  const promptY = Math.round(size * 0.58);
  const promptX = Math.round(size * 0.50);
  const cursorW = Math.round(size * 0.08);
  const cursorH = Math.round(size * 0.28);
  const cursorX = Math.round(size * 0.58);
  const cursorY = Math.round(size * 0.38);
  const dotR = Math.round(size * 0.015) || 1;
  const dotSpacing = Math.round(size * 0.06);
  const dotY = Math.round(size * 0.15);
  const dotStartX = Math.round(size * 0.15);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1b26"/>
      <stop offset="100%" stop-color="#24283b"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7aa2f7" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#7aa2f7" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <!-- Subtle top glow -->
  <rect width="${size}" height="${Math.round(size * 0.5)}" rx="${rx}" fill="url(#glow)"/>
  <!-- Window dots -->
  <circle cx="${dotStartX}" cy="${dotY}" r="${dotR}" fill="#f7768e" opacity="0.8"/>
  <circle cx="${dotStartX + dotSpacing}" cy="${dotY}" r="${dotR}" fill="#e0af68" opacity="0.8"/>
  <circle cx="${dotStartX + dotSpacing * 2}" cy="${dotY}" r="${dotR}" fill="#9ece6a" opacity="0.8"/>
  <!-- Terminal prompt > -->
  <text x="${promptX}" y="${promptY}" text-anchor="middle" font-family="'SF Mono','Fira Code','Cascadia Code',monospace" font-size="${promptSize}" font-weight="700" fill="#7aa2f7">&gt;_</text>
  <!-- Blinking cursor -->
  <rect x="${cursorX}" y="${cursorY}" width="${cursorW}" height="${cursorH}" rx="${Math.round(cursorW * 0.15) || 1}" fill="#7aa2f7" opacity="0.6"/>
  <!-- Bottom accent line -->
  <rect x="${Math.round(size * 0.2)}" y="${Math.round(size * 0.82)}" width="${Math.round(size * 0.6)}" height="${Math.round(size * 0.02) || 1}" rx="${Math.round(size * 0.01) || 1}" fill="#7aa2f7" opacity="0.3"/>
</svg>`;
}

// Simpler design for very small icons (16, 32)
function generateSmallSvg(size: number): string {
  const rx = Math.round(size * 0.2);
  const fontSize = Math.round(size * 0.5);
  const y = Math.round(size * 0.65);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1b26"/>
      <stop offset="100%" stop-color="#24283b"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <text x="${size / 2}" y="${y}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" font-weight="bold" fill="#7aa2f7">&gt;_</text>
</svg>`;
}

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

// Generate PNGs
for (const size of SIZES) {
  const svgFn = size <= 32 ? generateSmallSvg : generateSvg;
  const svg = Buffer.from(svgFn(size));
  const outPath = join(OUT_DIR, `icon-${size}.png`);
  await sharp(svg).resize(size, size).png().toFile(outPath);
  console.log(`  Generated: icons/icon-${size}.png (${size}x${size})`);
}

// Also generate main SVGs
const svg192 = generateSvg(192);
const svg512 = generateSvg(512);
writeFileSync(join(PUBLIC_DIR, "icon-192x192.svg"), svg192);
writeFileSync(join(PUBLIC_DIR, "icon-512x512.svg"), svg512);

// Generate favicon
const faviconSvg = Buffer.from(generateSmallSvg(32));
await sharp(faviconSvg).resize(32, 32).png().toFile(join(PUBLIC_DIR, "favicon.png"));

console.log("\n  Icon generation complete!");
