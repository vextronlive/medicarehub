/**
 * Cross-platform copy script for Next.js standalone output.
 * Works on Windows, macOS, and Linux (no Unix `cp` dependency).
 *
 * Copies:
 *   .next/static  ->  .next/standalone/.next/static
 *   public        ->  .next/standalone/public
 *
 * Usage:  node scripts/copy-standalone.js
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠  Source not found, skipping: ${path.relative(projectRoot, src)}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log("📦 Copying standalone assets...\n");

const tasks = [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
];

for (const [from, to] of tasks) {
  const src = path.join(projectRoot, from);
  const dest = path.join(projectRoot, to);
  console.log(`  →  ${from}  ⟶  ${to}`);
  copyRecursive(src, dest);
}

console.log("\n✅ Standalone assets copied successfully.");
