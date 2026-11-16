// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/survey.cjs <outDir> [seed] [strata e.g. 1,2,3] [kinds e.g. rooms,open]
// Round 144: photographs every room (or open-map clearing) of one seeded map per stratum and map kind, with the
// monsters cleared and the HUD hidden, for a decoration review (props on walls and floors).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], SEED = +(process.argv[3] || 7), STRATA = (process.argv[4] || '1,2,3').split(',').map(Number), KINDS = (process.argv[5] || 'rooms,open').split(',');
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run&dev'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(300);
  for (const st of STRATA) for (const kind of KINDS) {
    const rooms = await p.evaluate(([st, kind, seed]) => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.cleared = 29; HS.game.nextStratum = st; HS.game.nextMap = kind; HS.game.nextSeed = seed; HS.newRun();
      HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; HS.game.hideHud = true;
      return HS.room.rooms.map((r) => ({ id: r.id, cx: r.cx, cy: r.cy, type: r.type, plan: r.plan || '' })); }, [st, kind, SEED]);
    for (const r of rooms) {
      // Two shots: the middle, and the back wall (the first wall tile straight up from the middle, the camera a little below it).
      for (const view of ['mid', 'wall']) {
        const ok = await p.evaluate(([r, view]) => { const R = HS.room; let ty = r.cy; if (view === 'wall') { while (ty > 1 && !(R.solid[ty - 1] && R.solid[ty - 1][r.cx])) ty--; ty += 3; }
          HS.player.x = (r.cx + 0.5) * 16; HS.player.y = (ty + 0.5) * 16; HS.game.cardAt = -99; HS.enemies.length = 0; return true; }, [r, view]);
        await p.waitForTimeout(350);
        await p.screenshot({ path: `${S}/shots/s${st}-${kind}-${String(r.id).padStart(2, '0')}-${view}-${r.type}-${r.plan}.png` }); }
    }
    console.log(`stratum ${st} ${kind}: ${rooms.length} rooms`);
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
