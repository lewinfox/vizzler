// Localhost-only Last-Modified poller. Reloads the page when the served
// HTML changes — works against `bun build --watch` + Bun.serve in dev.ts.
// Safe to leave in production: gated to localhost so it no-ops elsewhere.

export function startLiveReload(): void {
  if (
    location.hostname !== "localhost" &&
    location.hostname !== "127.0.0.1"
  ) {
    return;
  }
  let lastMod: string | null = null;
  setInterval(async () => {
    try {
      const r = await fetch(location.pathname, {
        method: "HEAD",
        cache: "no-store",
      });
      const m = r.headers.get("last-modified");
      if (lastMod && m && m !== lastMod) location.reload();
      if (m) lastMod = m;
    } catch {
      /* ignore transient errors */
    }
  }, 800);
}
