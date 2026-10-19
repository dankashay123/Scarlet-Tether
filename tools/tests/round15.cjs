// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round15.cjs <outDir>
// The worn quiver and Odile's Habit look, the bounty board, and suspend and
// resume across a page reload.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1000);
  const log = [];
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.SAVE.cleared = 4; HS.SAVE.eliteKills = 20; HS.SAVE.bag = []; HS.SAVE.equip = {};
    for (const sl of HS.VSETS.habit.slots.slice(0, 4)) { const it = HS.makeItem(sl, 4, 'X', undefined, 3); it.set = 'habit'; HS.SAVE.equip[sl] = it; }
    HS.SAVE.equip.quiver = HS.armsItem('font', 'quiver', 5); HS.applyGear(true); });
  log.push('look ' + await p.evaluate(() => JSON.stringify({ skin: HS.G.skin, quiver: HS.G.quiver, xskin: HS.G.xskin })));
  await p.evaluate(() => { HS.player.x = HS.townX(2340) - 60; }); await p.waitForTimeout(500); await p.screenshot({ path: `${S}/shots/q1-habit-quiver.png` });
  // Bounty board: fill one bounty and claim it.
  await p.evaluate(() => { const B = HS.bounties(); B.list[0].have = B.list[0].need; HS.openBoard(); }); await p.waitForTimeout(200);
  await p.screenshot({ path: `${S}/shots/q2-board.png` });
  const g0 = await p.evaluate(() => HS.SAVE.gold || 0);
  await p.evaluate(() => { const r = HS.bountyRow(HS.featLayout(), 0); HS.boardTap(r.x + r.w - 30, r.y + 15); }); await p.waitForTimeout(200);
  log.push('board ' + await p.evaluate((g0) => JSON.stringify({ gold: (HS.SAVE.gold || 0) - g0, claimed: HS.SAVE.bounty.list[0].claimed, bag: HS.SAVE.bag.length + Object.keys(HS.SAVE.equip).length }), g0));
  await p.evaluate(() => { HS.game.state = 'play'; });
  // Suspend: a run, some kills, a move, then reload.
  await p.evaluate(() => { HS.game.nextDiff = 1; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e6; });
  await p.waitForTimeout(500);
  const before = await p.evaluate(() => { const P = HS.player; let n = 0; for (const e of HS.enemies) if (n < 25 && !e.dead) { HS.killEnemy(e, 0, 0); n++; } const r = HS.room.rooms[1]; P.x = (r.cx + 0.5) * 16; P.y = (r.cy + 1.5) * 16; HS.game.run.gold = 321; return { total: HS.enemies.length, x: Math.round(P.x), y: Math.round(P.y), seed: HS.game.run.seed }; });
  await p.waitForTimeout(800);
  await p.evaluate(() => HS.snapRun());
  await p.reload(); await p.waitForTimeout(1200);
  log.push('after reload ' + await p.evaluate(() => JSON.stringify({ state: HS.game.state, suspend: !!HS.SAVE.suspend })));
  await p.screenshot({ path: `${S}/shots/q3-resume.png` });
  await p.evaluate(() => { const B = HS.resumeBtns(); HS.resumeTap(B.go.x + 5, B.go.y + 5); }); await p.waitForTimeout(2600);
  const after = await p.evaluate(() => ({ scene: HS.game.scene, total: HS.enemies.filter((e) => !e.dead).length, x: Math.round(HS.player.x), y: Math.round(HS.player.y), seed: HS.game.run.seed, gold: HS.game.run.gold, kills: HS.game.kills }));
  log.push('resume ' + JSON.stringify({ before, after }));
  await p.screenshot({ path: `${S}/shots/q4-resumed.png` });
  console.log(log.join('\n'));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
