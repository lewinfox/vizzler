// Production build: runs `bun build` then post-processes the output to
// inline every <script src> and <link rel=stylesheet> directly into the
// HTML, producing a single self-contained file at dist/index.html.

import { spawn } from "bun";
import path from "node:path";
import {
  unlinkSync,
  readdirSync,
  statSync,
  rmdirSync,
  rmSync,
  existsSync,
} from "node:fs";

const DIST = "./dist";

// Clean dist/ first so stale dev artifacts don't survive into a prod build.
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });

console.log("building…");
const proc = spawn({
  cmd: ["bun", "build", "./src/index.html", "--outdir", DIST, "--minify"],
  stdout: "inherit",
  stderr: "inherit",
});
const code = await proc.exited;
if (code !== 0) {
  console.error("build failed");
  process.exit(code);
}

// Read the produced HTML and walk it for asset references to inline.
const htmlPath = `${DIST}/index.html`;
let html = await Bun.file(htmlPath).text();

const inlinedAssets = new Set<string>();

// Inline script tags: <script ... src="..."></script>
//   - Strip the src attribute.
//   - Replace with the file contents inside <script>...</script>.
//   - Preserve type="module" if present so the script still runs as a module.
html = await replaceAsync(
  html,
  /<script\b([^>]*?)\s+src="([^"]+)"([^>]*)>\s*<\/script>/g,
  async (_, before: string, src: string, after: string) => {
    const filePath = resolveAsset(src);
    const code = await Bun.file(filePath).text();
    inlinedAssets.add(filePath);
    const attrs = `${before} ${after}`.replace(/\s+/g, " ").trim();
    return `<script${attrs ? ` ${attrs}` : ""}>${code}</script>`;
  },
);

// Inline stylesheet links: <link rel="stylesheet" href="...">
html = await replaceAsync(
  html,
  /<link\b([^>]*?)\s+href="([^"]+)"([^>]*)>/g,
  async (full: string, before: string, href: string, after: string) => {
    const all = `${before} ${after}`;
    if (!/rel="stylesheet"/.test(all)) return full;
    const filePath = resolveAsset(href);
    const css = await Bun.file(filePath).text();
    inlinedAssets.add(filePath);
    return `<style>${css}</style>`;
  },
);

await Bun.write(htmlPath, html);

// Clean up the now-inlined chunk files so dist/ contains only index.html.
for (const f of inlinedAssets) {
  try {
    unlinkSync(f);
  } catch {}
}
removeEmptyDirs(DIST);

const size = (await Bun.file(htmlPath).bytes()).byteLength;
console.log(`\n  → dist/index.html  (${(size / 1024).toFixed(1)} KB)\n`);

// ---- helpers ----

function resolveAsset(ref: string): string {
  // Handle both absolute (/chunk-abc.js) and relative (./chunk-abc.js) refs.
  const cleaned = ref.replace(/^\.\//, "").replace(/^\//, "");
  return path.join(DIST, cleaned);
}

async function replaceAsync(
  input: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => Promise<string>,
): Promise<string> {
  const matches = [...input.matchAll(pattern)];
  const replacements = await Promise.all(
    matches.map((m) => replacer(m[0], ...m.slice(1).map((g) => g ?? ""))),
  );
  let out = "";
  let cursor = 0;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    out += input.slice(cursor, m.index);
    out += replacements[i];
    cursor = (m.index ?? 0) + m[0].length;
  }
  out += input.slice(cursor);
  return out;
}

function removeEmptyDirs(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      removeEmptyDirs(full);
      try {
        rmdirSync(full);
      } catch {}
    }
  }
}
