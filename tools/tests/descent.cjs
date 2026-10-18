// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/descent.cjs <outDir>
// Town minimap, the full town map, a locked site panel, the descent panel at
// each difficulty, then descends on Zealot and checks it took.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town&fps'); await p.waitForTimeout(1200);
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); }
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.descents = 1; HS.SAVE.eliteKills = 4; HS.player.x = HS.townX(1600); HS.player.y = HS.room.top * 16 + 60; });
  await p.waitForTimeout(800); await p.screenshot({ path: `${S}/shots/t1-minimap.png` });
  // Tap the minimap to open the full map.
  const box = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); return { l: r.left, t: r.top, k: r.width / HS.W, m: HS.hud.minimap }; });
  await p.mouse.click(box.l + (box.m.x + 20) * box.k, box.t + (box.m.y + 20) * box.k); await p.waitForTimeout(300);
  console.log('map state', await p.evaluate(() => HS.game.state));
  await p.screenshot({ path: `${S}/shots/t2-map.png` });
  await p.keyboard.press('Escape');
  // Walk to the Vigil and use it.
  await p.evaluate(() => { HS.player.x = HS.townX(1664); HS.player.y = HS.room.top * 16 + 60; }); await p.waitForTimeout(300);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  console.log('site', await p.evaluate(() => HS.game.state + ' ' + (HS.game.site && HS.game.site.s.id)));
  await p.screenshot({ path: `${S}/shots/t3-site.png` });
  await p.keyboard.press('Escape');
  // The descent panel.
  await p.evaluate(() => { HS.player.x = HS.townX(2340); HS.player.y = HS.room.top * 16 + 14; }); await p.waitForTimeout(300);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  console.log('descent', await p.evaluate(() => HS.game.state));
  await p.screenshot({ path: `${S}/shots/t4-descent0.png` });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/t5-descent1.png` });
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/t6-descent2-locked.png` });
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter'); await p.waitForTimeout(2600);
  const r = await p.evaluate(() => ({ scene: HS.game.scene, diff: HS.game.run && HS.game.run.diff, hp: HS.spawnMonster('risen', HS.player.x + 80, HS.player.y).maxHp }));
  console.log('run', JSON.stringify(r));
  await p.screenshot({ path: `${S}/shots/t7-run.png` });
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
