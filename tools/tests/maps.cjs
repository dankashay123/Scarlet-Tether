// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/maps.cjs [count]
// Builds many floors and checks that every room can be walked to from the
// spawn with all gates open, that the spawn is clear, and that every
// corridor joins two rooms.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const N = +(process.argv[2] || 200);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(800);
  const res = await p.evaluate((N) => {
    const bad = [];
    for (let i = 0; i < N; i++) {
      HS.newRun();
      const R = HS.room, P = HS.player, T = 16;
      // Free = not solid, or a gate tile (gates open).
      const gates = new Set(R.rooms.flatMap((r) => r.gates.flatMap((g) => g.tiles.map(([x, y]) => `${x},${y}`))));
      const free = (x, y) => !R.isSolid(x, y) || gates.has(`${x},${y}`);
      // The player's circle must not touch a solid tile.
      const sx = Math.floor(P.x / T), sy = Math.floor(P.y / T);
      let spawnOk = true;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]]) { const x = P.x + dx * P.r, y = P.y + dy * P.r; if (!free(Math.floor(x / T), Math.floor(y / T))) spawnOk = false; }
      // Flood fill from the spawn.
      const seen = new Set([`${sx},${sy}`]), q = [[sx, sy]];
      while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${x + dx},${y + dy}`; if (!seen.has(k) && free(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); } } }
      const unreached = R.rooms.filter((r) => { let n = 0, hit = 0; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (free(x, y)) { n++; if (seen.has(`${x},${y}`)) hit++; } return hit < n * 0.97; }).map((r) => r.id);
      const diag = R.rooms.flatMap((r) => r.links.filter((id) => { const o = R.rooms[id]; return Math.abs(o.gx - r.gx) + Math.abs(o.gy - r.gy) !== 1; }).map((id) => `${r.id}-${id}`));
      if (!spawnOk || unreached.length || diag.length) bad.push({ i, spawnOk, unreached, diag });
    }
    return bad;
  }, N);
  console.log(`maps ${N}, bad ${res.length}`, JSON.stringify(res.slice(0, 8)));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
