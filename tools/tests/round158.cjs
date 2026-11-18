// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round158.cjs <outDir>
// Round 158: each Warden's own death. Kills each one and photographs the death at five moments, cropped round
// the Warden into <outDir>/shots/death-<id>.png (one strip each); checks the fall runs its whole length and ends.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2]; fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(900);
  const ids = await p.evaluate(() => Object.keys(HS.MON).filter((k) => HS.MON[k].warden));
  const out = {};
  for (const id of ids) {
    await p.evaluate((id) => { HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.player.hp = HS.player.maxHp = 1e6; for (const e of HS.enemies) e.dead = true; HS.spawnWarden(id); }, id);
    await p.waitForTimeout(1800);
    await p.evaluate(() => { const e = HS.game.warden; e.cds = e.cds.map(() => 99); HS.player.x = e.x - 70; HS.player.y = e.y; HS.game.banner = null; HS.game.toast = null; });
    await p.waitForTimeout(300);
    await p.evaluate(() => { const e = HS.game.warden; HS.hurtEnemy(e, e.hp + 10); });
    const shots = [];
    for (const ms of [150, 700, 700, 800, 1200]) {
      await p.waitForTimeout(ms);
      const r = await p.evaluate(() => { const f = HS.falls.find((q) => q.wd); if (!f) return null; HS.game.banner = null; HS.game.toast = null; const k = innerWidth / HS.W; return { x: (f.e.x - HS.cam.x) * k, y: (f.e.y - HS.cam.y) * k, k, t: f.t }; });
      if (!r) { shots.push('gone'); continue; }
      const path = `${S}/shots/death-${id}-${shots.length}.png`;
      await p.screenshot({ path, clip: { x: Math.max(0, r.x - 90 * r.k), y: Math.max(0, r.y - 110 * r.k), width: 180 * r.k, height: 125 * r.k } });
      shots.push(+r.t.toFixed(2));
    }
    await p.waitForTimeout(2500);
    out[id] = { at: shots, left: await p.evaluate(() => HS.falls.filter((q) => q.wd).length) };
  }
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
