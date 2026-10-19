// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/wardens.cjs <outDir>
// Summons each of the five Wardens in turn and photographs it mid-fight.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(900);
  const ids = await p.evaluate(() => Object.keys(HS.MON).filter((k) => HS.MON[k].warden));
  for (const id of ids) {
    await p.evaluate((id) => {
      HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.player.hp = HS.player.maxHp = 1e6;
      for (const e of HS.enemies) e.dead = true;
      HS.spawnWarden(id);
    }, id);
    const seen = new Set();
    for (let k = 0; k < 12; k++) { await p.waitForTimeout(500); const w = await p.evaluate(() => { const w = HS.game.warden; return w && w.atk && w.state !== 'move' ? w.atk.type : null; }); if (w) seen.add(w); if (k === 5) await p.screenshot({ path: `${S}/shots/w-${id}.png` }); }
    console.log(id, await p.evaluate(() => { const w = HS.game.warden; return JSON.stringify({ hp: Math.round(w.hp), max: w.maxHp, hazards: HS.hazardsN }); }), 'used', [...seen].join(','));
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
