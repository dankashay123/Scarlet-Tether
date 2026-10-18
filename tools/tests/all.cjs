// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/<name>.cjs <outDir>   (screenshots go to <outDir>/shots/)
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  await p.addInitScript(() => { window.HS_AUTOSTIG = true; }); // level-up cards pick themselves
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run&fps'); await p.waitForTimeout(800);
  const ids = await p.evaluate(() => Object.keys(HS.MON).filter((k) => k !== 'imp'));
  await p.evaluate(() => { const R = HS.room, t = R.rooms[R.start.gates[0].to]; HS.player.x = (t.cx + 0.5) * 16; HS.player.y = (t.cy + 0.5) * 16; HS.player.hp = HS.player.maxHp = 1e6; });
  await p.waitForTimeout(1500);
  let shot = 0;
  for (let i = 0; i < ids.length; i += 3) {
    const batch = ids.slice(i, i + 3);
    await p.evaluate((batch) => { const r = HS.game.curRoom; HS.enemies.forEach((e) => { e.hp = 0; e.dead = true; }); for (const id of batch) { const t = HS.MON[id].tier; if (t === 'common') HS.spawnMonster(id, HS.player.x + Math.random() * 120 - 60, HS.player.y + Math.random() * 80 - 40, { room: r.id }); else HS.spawnPack(id, t, HS.player.x + Math.random() * 120 - 60, HS.player.y + Math.random() * 60 - 30, 3, r.id); } }, batch);
    await p.waitForTimeout(4500);
    if (i % 9 === 0) await p.screenshot({ path: `${S}/shots/all-${shot++}.png` });
    console.log(batch.join(','), JSON.stringify(await p.evaluate(() => ({ n: HS.enemies.length, hz: HS.hazards.length, aff: [...new Set(HS.enemies.flatMap((e) => e.affixes))].join(' ') }))));
  }
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
