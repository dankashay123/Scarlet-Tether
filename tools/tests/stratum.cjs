// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/stratum.cjs <outDir>
// Stratum II, the Drowned Nave: its look, its monsters, its two Wardens and
// the stratum choice on the descent panel.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1000); await p.evaluate(() => { window.HS_AUTOSTIG = true; });
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.cleared = 2; HS.startDescent(); HS.descent.stratum = 2; });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/n1-panel.png` });
  await p.evaluate(() => { HS.game.nextStratum = 2; HS.game.nextDiff = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.player.hp = HS.player.maxHp = 1e7; });
  const info = await p.evaluate(() => { const c = {}; for (const e of HS.enemies) c[e.type] = (c[e.type] || 0) + 1; return JSON.stringify({ name: HS.room.name, stratum: HS.game.run.stratum, foes: HS.enemies.length, types: c }); });
  console.log('run', info);
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/n2-start.png` });
  const [tx, ty] = await p.evaluate(() => { const r = HS.room.rooms.find((q) => q.type !== 'start'); return [(r.cx + 0.5) * 16, (r.cy + 1.5) * 16]; });
  for (let k = 0; k < 10; k++) { await p.evaluate(([tx, ty]) => { const P = HS.player; P.x += (tx - P.x) * 0.25; P.y += (ty - P.y) * 0.25; }, [tx, ty]); await p.waitForTimeout(90); }
  await p.waitForTimeout(1500); await p.screenshot({ path: `${S}/shots/n3-fight.png` });
  for (const id of ['tideBishop', 'organist']) {
    await p.evaluate((id) => { for (const e of HS.enemies) e.dead = true; HS.spawnWarden(id); }, id);
    const seen = new Set();
    for (let k = 0; k < 14; k++) { await p.waitForTimeout(450); const w = await p.evaluate(() => { const w = HS.game.warden; return w && w.atk && w.state !== 'move' ? w.atk.type : null; }); if (w) seen.add(w); if (k === 5) await p.screenshot({ path: `${S}/shots/n4-${id}.png` }); }
    console.log(id, 'used', [...seen].join(','));
    await p.evaluate(() => HS.killEnemy(HS.game.warden, 1, 0)); await p.waitForTimeout(300);
  }
  // Back in town the sheets are the Undercroft's again.
  await p.evaluate(() => HS.enterTown()); await p.waitForTimeout(600); await p.screenshot({ path: `${S}/shots/n5-town.png` });
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
