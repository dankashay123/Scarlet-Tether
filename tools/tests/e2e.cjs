// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/<name>.cjs <outDir>   (screenshots go to <outDir>/shots/)
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const st = () => p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene, step: HS.tut.step, on: HS.tut.on, hp: HS.player && Math.round(HS.player.hp) }));
  const tap = async (x, y) => { const pos = await p.evaluate(([x, y]) => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left + x / HS.W * r.width, r.top + y / HS.H * r.height]; }, [x, y]); await p.touchscreen.tap(pos[0], pos[1]); };
  const closeDialog = async () => { for (let i = 0; i < 60 && (await st()).state === 'dialog'; i++) { await p.evaluate(() => { if (HS.game.dialog) HS.game.dialog.t = 99; }); await tap(200, 150); await p.waitForTimeout(90); } };
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(900);
  const W = await p.evaluate(() => HS.W), H = await p.evaluate(() => HS.H);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(500);
  // Round 70: a fresh player makes a character first (the CREATE button sits where START was); the page reloads into Vael.
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(2500);
  await closeDialog(); console.log('after wake', JSON.stringify(await st()));
  await p.keyboard.down('KeyA'); await p.waitForTimeout(1200); await p.keyboard.up('KeyA');
  // Round 171: the walk through Vael (four people), then the night fight in the Quiet Acre, before Vane's chapter.
  for (const who of ['hollis', 'pell', 'barkeep', 'crier']) { await p.evaluate((who) => { const n = HS.room.npcs.find((m) => (m.talk || m.npc) === who); HS.player.x = n.x - 18; HS.player.y = n.y + 10; }, who); await p.waitForTimeout(250); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await closeDialog(); }
  for (let i = 0; i < 50 && !(await p.evaluate(() => HS.room.region === 'acre')); i++) await p.waitForTimeout(100);
  console.log('acre', JSON.stringify(await st()), await p.evaluate(() => HS.room.region));
  await p.waitForTimeout(800); await p.screenshot({ path: `${S}/shots/e-acre.png` });
  await p.evaluate(() => { for (const e of HS.enemies) HS.killEnemy(e, 0, 0); });
  for (let i = 0; i < 80 && (await st()).scene !== 'town'; i++) { if ((await st()).state === 'stig') await p.evaluate(() => HS.pickStigma(0)); await p.waitForTimeout(100); }
  await p.waitForTimeout(1200); await closeDialog(); console.log('after acre', JSON.stringify(await st()));
  await p.evaluate(() => { const v = HS.room.npcs.find((n) => n.npc === 'vane'); HS.player.x = v.x - 16; HS.player.y = v.y + 4; });
  await p.waitForTimeout(200); await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/shots/e-vane.png` });
  await closeDialog(); console.log('after talk', JSON.stringify(await st()));
  await p.evaluate(() => { HS.player.x = HS.CATHEDRAL_X; HS.player.y = HS.room.top * 16 + 14; }); await p.waitForTimeout(200);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(300); await closeDialog(); await p.waitForTimeout(2600); // round 150: chapter 1's opening scene plays first
  console.log('dungeon', JSON.stringify(await st()));
  await p.screenshot({ path: `${S}/shots/e-dungeon.png` });
  // Walk into the first combat room for the next lesson.
  await p.evaluate(() => { const R = HS.room, t = R.rooms[R.start.links[0]]; HS.player.x = (t.cx + 0.5) * 16; HS.player.y = (t.cy + 0.5) * 16; });
  await p.waitForTimeout(3000); console.log('room', JSON.stringify(await st()), await p.evaluate(() => HS.enemies.length));
  await p.screenshot({ path: `${S}/shots/e-room.png` });
  for (let i = 0; i < 6 && (await st()).state === 'stig'; i++) { await p.evaluate(() => HS.pickStigma(0)); await p.waitForTimeout(300); } // round 171: kills in the Acre can leave a level-up waiting
  await p.evaluate(() => { if (HS.game.run) HS.game.run.pending = 0; });
  // Die on purpose to check the death loop back to town.
  await p.evaluate(() => { HS.player.hp = 1; HS.player.iframes = 0; for (let k = 0; k < 4; k++) { const e = HS.spawnMonster('risen', HS.player.x + 14 * Math.cos(k * 1.6), HS.player.y + 10 * Math.sin(k * 1.6), { room: HS.game.curRoom.id }); e.state = 'move'; } });
  await p.waitForTimeout(6000); console.log('after hits', JSON.stringify(await st()));
  if ((await st()).state === 'dead') { await p.waitForTimeout(1500); await p.screenshot({ path: `${S}/shots/e-dead.png` }); await tap(W / 2, H / 2); await p.waitForTimeout(600); await closeDialog(); }
  console.log('end', JSON.stringify(await st()), 'gold', await p.evaluate(() => HS.SAVE.gold));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
