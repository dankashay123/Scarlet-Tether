// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/<name>.cjs <outDir>   (screenshots go to <outDir>/shots/)
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const st = () => p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene, step: HS.tut.step, on: HS.tut.on }));
  const tap = async (x, y) => { const pos = await p.evaluate(([x, y]) => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left + x / HS.W * r.width, r.top + y / HS.H * r.height]; }, [x, y]); await p.touchscreen.tap(pos[0], pos[1]); };
  const closeDialog = async () => { for (let i = 0; i < 20 && (await st()).state === 'dialog'; i++) { await tap(200, 150); await p.waitForTimeout(120); } };
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(900);
  const W = await p.evaluate(() => HS.W), H = await p.evaluate(() => HS.H);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(500);
  await closeDialog(); console.log('after wake', JSON.stringify(await st()));
  await p.keyboard.down('KeyA'); await p.waitForTimeout(1200); await p.keyboard.up('KeyA');
  await p.evaluate(() => { const v = HS.room.npcs.find((n) => n.npc === 'vane'); HS.player.x = v.x - 16; HS.player.y = v.y + 4; });
  await p.waitForTimeout(200); await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/shots/e-vane.png` });
  await closeDialog(); console.log('after talk', JSON.stringify(await st()));
  await p.evaluate(() => { HS.player.x = 2340; HS.player.y = HS.room.top * 16 + 14; }); await p.waitForTimeout(200);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(2600);
  console.log('dungeon', JSON.stringify(await st()));
  await p.screenshot({ path: `${S}/shots/e-dungeon.png` });
  // Walk into the first combat room for the next lesson.
  await p.evaluate(() => { const R = HS.room, t = R.rooms[R.start.gates[0].to]; HS.player.x = (t.cx + 0.5) * 16; HS.player.y = (t.cy + 0.5) * 16; });
  await p.waitForTimeout(3000); console.log('room', JSON.stringify(await st()), await p.evaluate(() => HS.enemies.length));
  await p.screenshot({ path: `${S}/shots/e-room.png` });
  // Die on purpose to check the death loop back to town.
  await p.evaluate(() => { HS.player.hp = 1; HS.player.iframes = 0; });
  await p.waitForTimeout(6000); console.log('after hits', JSON.stringify(await st()));
  if ((await st()).state === 'dead') { await p.waitForTimeout(1500); await p.screenshot({ path: `${S}/shots/e-dead.png` }); await tap(W / 2, H / 2); await p.waitForTimeout(600); await closeDialog(); }
  console.log('end', JSON.stringify(await st()), 'gold', await p.evaluate(() => HS.SAVE.gold));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
