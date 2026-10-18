// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/<name>.cjs <outDir>   (screenshots go to <outDir>/shots/)
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run&fps'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${S}/shots/d1-start.png` });
  const info = await p.evaluate(() => { const R = HS.room; return { rooms: R.rooms.map((r) => [r.type, r.theme, r.depth, r.links.length]), start: R.start.id }; });
  console.log(JSON.stringify(info));
  // Walk to an adjacent room through its gate.
  await p.evaluate(() => { const R = HS.room, s = R.start, g = s.gates[0], [x, y] = g.tiles[1]; const t = R.rooms[g.to]; HS.player.x = (t.cx + 0.5) * 16; HS.player.y = (t.cy + 0.5) * 16; });
  await p.waitForTimeout(2500);
  console.log('room', JSON.stringify(await p.evaluate(() => ({ state: HS.game.curRoom.state, type: HS.game.curRoom.type, n: HS.enemies.length, locked: HS.game.curRoom.locked }))));
  await p.screenshot({ path: `${S}/shots/d2-fight.png` });
  await p.evaluate(() => { HS.player.hp = 9999; HS.player.maxHp = 9999; const r = HS.game.curRoom; HS.spawnPack('knight', 'rare', HS.player.x + 80, HS.player.y, 2, r.id); HS.spawnPack('titan', 'elite', HS.player.x - 90, HS.player.y + 10, 3, r.id); });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${S}/shots/d3-elite.png` });
  for (let i = 0; i < 10; i++) { await p.keyboard.down(['KeyD', 'KeyS', 'KeyA', 'KeyW'][i % 4]); await p.waitForTimeout(600); await p.keyboard.press(i % 2 ? 'KeyQ' : 'KeyF'); await p.keyboard.up(['KeyD', 'KeyS', 'KeyA', 'KeyW'][i % 4]); }
  await p.screenshot({ path: `${S}/shots/d4-later.png` });
  console.log('later', JSON.stringify(await p.evaluate(() => ({ kills: HS.game.kills, n: HS.enemies.length, gold: HS.game.run.gold, items: HS.game.run.items.length, drops: HS.drops.length, hz: HS.hazards.length, state: HS.game.curRoom.state, wave: HS.game.curRoom.wave }))));
  console.log('errors', errs.slice(0, 5)); await b.close();
})();
