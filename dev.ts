// Dev server: builds in watch mode + serves dist/ on localhost.
// The page itself contains a Last-Modified poller that triggers a reload
// whenever the bundled HTML changes — so you save a source file, Bun
// rebuilds, the poller sees the new mtime, and the browser refreshes.

import { spawn } from "bun";
import { existsSync } from "node:fs";

const PORT = Number(Bun.env.PORT ?? 8000);
const DIST = "./dist";

// Spawn `bun build --watch` in the background. Output streams to our stdio
// so build errors are visible in the terminal.
const builder = spawn({
  cmd: ["bun", "build", "./src/index.html", "--outdir", DIST, "--watch"],
  stdout: "inherit",
  stderr: "inherit",
});

// Clean up the watcher when the dev server stops.
const stop = () => {
  builder.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// Wait briefly for the first build to land before serving requests, otherwise
// the first GET / will 404. Best-effort poll.
for (let i = 0; i < 50 && !existsSync(`${DIST}/index.html`); i++) {
  await Bun.sleep(100);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = url.pathname;
    if (pathname === "/") pathname = "/index.html";
    const file = Bun.file(`${DIST}${pathname}`);
    if (!(await file.exists())) {
      return new Response("not found", { status: 404 });
    }
    return new Response(file, {
      headers: {
        // The live-reload poller relies on Last-Modified; Bun.file already
        // exposes it. Disable client-side caching so the poller always sees
        // fresh headers.
        "Cache-Control": "no-store",
      },
    });
  },
});

console.log(`\n  swirly · disco — dev server`);
console.log(`  http://localhost:${server.port}`);
console.log(`  watching src/ — save to rebuild\n`);
