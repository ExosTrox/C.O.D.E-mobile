#!/usr/bin/env bun
// ── Generate PWA Icons ──────────────────────────────────────
// Generates PNG icons at various sizes from the SVG source.
// Usage: bun scripts/generate-icons.ts

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const SIZES = [16, 32, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const SVG_PATH = join(import.meta.dir, "../packages/web/public/icon-192x192.svg");
const OUT_DIR = join(import.meta.dir, "../packages/web/public/icons");

// Create a proper SVG at each size
function generateSvgAtSize(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.125)}" fill="#1a1b26"/>
  <text x="${size / 2}" y="${size * 0.604}" text-anchor="middle" font-family="monospace" font-size="${Math.round(size * 0.375)}" font-weight="bold" fill="#7aa2f7">&gt;_</text>
</svg>`;
}

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

for (const size of SIZES) {
  const svg = generateSvgAtSize(size);
  const outPath = join(OUT_DIR, `icon-${size}.svg`);
  writeFileSync(outPath, svg);
  console.log(`  Generated: icons/icon-${size}.svg (${size}x${size})`);
}

// Also update the main icon with the ">_" terminal prompt design
const mainSvg192 = generateSvgAtSize(192);
const mainSvg512 = generateSvgAtSize(512);
writeFileSync(join(import.meta.dir, "../packages/web/public/icon-192x192.svg"), mainSvg192);
writeFileSync(join(import.meta.dir, "../packages/web/public/icon-512x512.svg"), mainSvg512);

console.log("\n  Icon generation complete!");
console.log("  Note: For production, convert SVGs to PNGs using sharp or canvas.");
console.log("  Example: bun add sharp && convert with sharp(svg).png().toFile(path)");
