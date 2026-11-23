// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/regionclip.cjs [maps]   (HARD=1 builds HARD trips too)
// Round 186: builds each open-world region several times and lists props that clip (HS.propClash: two pictures
// overlapping on one row or two tall ones overlapping; a person on a place's use spot). Round 187: also every use spot
// (LOOK, OPEN, ENTER, TALK...) must stand on ground the Saint can walk to from the camp. Keep it at 0.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const N = +(process.argv[2] || 4), HARD = !!process.env.HARD;
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1200);
  const res = await p.evaluate(({ N, HARD }) => {
    const tally = {}, ex = [], per = {}; let maps = 0;
    HS.SAVE.story = 10; HS.SAVE.ending = 1; HS.SAVE.cleared = 29;
    for (const hard of HARD ? [false, true] : [false]) for (const id of ['moor', 'fen', 'ash', 'salt', 'isle']) for (let i = 0; i < N; i++) {
      HS.game.nextRegion = id; HS.game.nextStory = null; HS.game.nextSeed = 4000 + i * 13 + (hard ? 7 : 0); HS.game.nextStratum = 1; HS.game.nextDiff = hard ? 14 : 11; HS.game.nextHard = hard;
      HS.newRun(); maps++;
      if (HS.room.region !== id) { ex.push(`${id}: not built (${HS.room.region})`); continue; }
      // Ground reachable from where the Saint starts (4-way over open tiles).
      const R = HS.room, T = 16, seen = new Uint8Array(R.w * R.h), q = [];
      { const px = Math.floor(HS.player.x / T), py = Math.floor(HS.player.y / T); for (let r = 0; r < 6 && !q.length; r++) for (let dy = -r; dy <= r && !q.length; dy++) for (let dx = -r; dx <= r; dx++) if (!R.isSolid(px + dx, py + dy)) { q.push([px + dx, py + dy]); break; } }
      for (const [x, y] of q) { if (x < 0 || y < 0 || x >= R.w || y >= R.h || seen[y * R.w + x] || R.isSolid(x, y)) continue; seen[y * R.w + x] = 1; q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      // A use spot works when the Saint can stand within its radius (on a reachable tile's centre).
      const near = (sx, sy, r) => { const k = Math.ceil(r / T) + 1; for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) { const x = Math.floor(sx / T) + dx, y = Math.floor(sy / T) + dy; if (x >= 0 && y >= 0 && x < R.w && y < R.h && seen[y * R.w + x] && Math.hypot((x + 0.5) * T - sx, (y + 0.5) * T - sy) < r - 4) return true; } return false; };
      const bad = R.interact.filter((it) => !near(it.x, it.y, it.r || 26)).map((it) => `${it.label} spot out of reach at ${Math.round(it.x / T)},${Math.round(it.y / T)}`);
      for (const c of [...HS.propClash(), ...bad]) { const key = `${id}: ${c.replace(/ at .*/, '')}`; tally[key] = (tally[key] || 0) + 1; per[id] = (per[id] || 0) + 1; if (ex.length < 16) ex.push(`${id} #${i}: ${c}`); }
    }
    return { maps, per, tally, ex };
  }, { N, HARD });
  console.log(JSON.stringify(res, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
