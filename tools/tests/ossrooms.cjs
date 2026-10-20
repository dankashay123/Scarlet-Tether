// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/ossrooms.cjs <outDir> [stratum] [floors]
// Photographs every room of a descent in one stratum, for layout review.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], K = +(process.argv[3] || 3), N = +(process.argv[4] || 1);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(900);
  for (let f = 0; f < N; f++) {
    await p.evaluate((k) => { HS.SAVE.cleared = 8; HS.game.nextStratum = k; HS.game.nextDiff = 6; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, K);
    await p.waitForTimeout(400);
    const rooms = await p.evaluate(() => { window.DY = -3; for (const r of HS.room.rooms) { r.state = 'clear'; r.visited = r.known = true; } return HS.room.rooms.map((r) => ({ id: r.id, type: r.type, theme: r.theme, plan: r.plan || '' })); });
    for (const r of rooms) {
      await p.evaluate((id) => { const r = HS.room.rooms[id]; HS.enemies.length = 0; HS.player.x = (r.cx + 0.5) * 16; HS.player.y = (r.cy + 0.5 + (window.DY || 0)) * 16; HS.game.cardAt = -99; }, r.id);
      await p.waitForTimeout(450);
      await p.screenshot({ path: `${S}/shots/s${K}-${f}-${r.id}-${r.type}-${r.theme}-${r.plan}.png` });
    }
    console.log('floor', f, JSON.stringify(rooms.map((r) => `${r.type}/${r.theme}/${r.plan}`)));
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
