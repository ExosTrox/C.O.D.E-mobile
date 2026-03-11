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
  // Scale all measurements relative to 512
  const s = (v: number) => Math.round((v / 512) * size);
  const rx = s(108);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08090d"/>
      <stop offset="50%" stop-color="#0c0e14"/>
      <stop offset="100%" stop-color="#10121a"/>
    </linearGradient>
    <linearGradient id="arc-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="40%" stop-color="#7aa2f7"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
    <linearGradient id="arc-grad2" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#2dd4bf"/>
    </linearGradient>
    <radialGradient id="center-glow" cx="0.5" cy="0.5" r="0.4">
      <stop offset="0%" stop-color="#7aa2f7" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#7aa2f7" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cursor-grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7aa2f7"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="arc-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${Math.max(1, s(6))}" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="cursor-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${Math.max(1, s(8))}" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#center-glow)"/>

  <!-- Outer orbit -->
  <circle cx="${s(256)}" cy="${s(256)}" r="${s(185)}" fill="none" stroke="#7aa2f7" stroke-width="0.5" opacity="0.08"/>

  <!-- Orbit dots -->
  <circle cx="${s(441)}" cy="${s(256)}" r="${Math.max(1, s(3))}" fill="#38bdf8" opacity="0.7"/>
  <circle cx="${s(256)}" cy="${s(71)}" r="${Math.max(1, s(2.5))}" fill="#a78bfa" opacity="0.6"/>
  <circle cx="${s(125)}" cy="${s(370)}" r="${Math.max(1, s(2))}" fill="#2dd4bf" opacity="0.5"/>

  <!-- Main C arc -->
  <g filter="url(#arc-glow)">
    <path d="M ${s(340)} ${s(130)} A ${s(150)} ${s(150)} 0 0 0 ${s(140)} ${s(220)}"
          fill="none" stroke="url(#arc-grad)" stroke-width="${Math.max(2, s(18))}" stroke-linecap="round"/>
    <path d="M ${s(140)} ${s(292)} A ${s(150)} ${s(150)} 0 0 0 ${s(340)} ${s(382)}"
          fill="none" stroke="url(#arc-grad2)" stroke-width="${Math.max(2, s(18))}" stroke-linecap="round"/>
    <path d="M ${s(140)} ${s(220)} A ${s(150)} ${s(150)} 0 0 0 ${s(140)} ${s(292)}"
          fill="none" stroke="url(#arc-grad)" stroke-width="${Math.max(2, s(18))}" stroke-linecap="round"/>
  </g>

  <!-- Cursor -->
  <g filter="url(#cursor-glow)">
    <rect x="${s(248)}" y="${s(200)}" width="${Math.max(2, s(16))}" height="${s(112)}" rx="${Math.max(1, s(4))}" fill="url(#cursor-grad)" opacity="0.9"/>
  </g>

  <!-- Prompt chevron -->
  <path d="M ${s(220)} ${s(240)} L ${s(196)} ${s(256)} L ${s(220)} ${s(272)}"
        fill="none" stroke="#7aa2f7" stroke-width="${Math.max(1, s(6))}" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>

  <!-- Code dots -->
  <circle cx="${s(290)}" cy="${s(244)}" r="${Math.max(1, s(4))}" fill="#a78bfa" opacity="0.35"/>
  <circle cx="${s(308)}" cy="${s(244)}" r="${Math.max(1, s(4))}" fill="#a78bfa" opacity="0.2"/>

  <!-- Bottom accent -->
  <rect x="${s(176)}" y="${s(430)}" width="${s(160)}" height="${Math.max(1, s(4))}" rx="${Math.max(1, s(2))}" fill="url(#arc-grad)" opacity="0.2"/>
</svg>`;
}

// Simplified version for tiny icons (16, 32)
function generateSmallSvg(size: number): string {
  const rx = Math.round(size * 0.2);
  const cx = size / 2;
  const cy = size / 2;
  const r = Math.round(size * 0.3);
  const sw = Math.max(2, Math.round(size * 0.08));
  const cursorW = Math.max(1, Math.round(size * 0.06));
  const cursorH = Math.round(size * 0.35);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#08090d"/>
      <stop offset="100%" stop-color="#10121a"/>
    </linearGradient>
    <linearGradient id="arc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <!-- Simplified C arc -->
  <path d="M ${cx + r * 0.7} ${cy - r * 0.8} A ${r} ${r} 0 1 0 ${cx + r * 0.7} ${cy + r * 0.8}"
        fill="none" stroke="url(#arc)" stroke-width="${sw}" stroke-linecap="round"/>
  <!-- Cursor -->
  <rect x="${cx - cursorW / 2}" y="${cy - cursorH / 2}" width="${cursorW}" height="${cursorH}" rx="${Math.max(1, Math.round(cursorW * 0.3))}" fill="#7aa2f7" opacity="0.85"/>
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
