// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/<name>.cjs <outDir>   (screenshots go to <outDir>/shots/)
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  await p.addInitScript(() => { window.HS_AUTOSTIG = true; }); // level-up cards pick themselves
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(800);
  await p.evaluate(() => { HS.player.hp = HS.player.maxHp = 1e6; });
  // Visit rooms in BFS order: walk through each room's centre and wipe its waves.
  const order = await p.evaluate(() => { const R = HS.room.rooms, seen = [HS.room.start.id], q = [HS.room.start.id]; while (q.length) { const id = q.shift(); for (const l of R[id].links) if (!seen.includes(l)) { seen.push(l); q.push(l); } } return seen; });
  for (const id of order) {
    await p.evaluate((id) => { const r = HS.room.rooms[id]; HS.player.x = (r.cx + 0.5) * 16; HS.player.y = (r.cy + 0.5) * 16; HS.room.solid[r.cy][r.cx] = false; }, id);
    for (let i = 0; i < 40; i++) {
      await p.waitForTimeout(250);
      const st = await p.evaluate((id) => { const r = HS.room.rooms[id]; HS.enemies.forEach((e) => { if (e.state !== 'spawn' && !(e.spawnDelay > 0)) HS.killEnemy(e, 1, 0); }); return r.state; }, id);
      if (st === 'clear') break;
    }
    const r = await p.evaluate((id) => { const r = HS.room.rooms[id]; return [r.type, r.state, r.locked, HS.drops.length]; }, id);
    console.log(id, JSON.stringify(r));
    if (r[0] === 'exit') await p.screenshot({ path: `${S}/shots/f-exit.png` });
  }
  console.log('waystone', await p.evaluate(() => !!HS.game.waystone), 'gold', await p.evaluate(() => HS.game.run.gold), 'items', await p.evaluate(() => HS.game.run.items.map((i) => i.rarity).join(',')));
  await p.evaluate(() => { const w = HS.game.waystone; HS.player.x = w.x; HS.player.y = w.y + 6; });
  await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(1800);
  await p.screenshot({ path: `${S}/shots/f-tally.png` });
  console.log('state', await p.evaluate(() => HS.game.state), 'saved gold', await p.evaluate(() => HS.SAVE.gold));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
