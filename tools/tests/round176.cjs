// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round176.cjs <outDir> [WxH]
// Round 176: the epilogue in Vael after the ending (lines, barks, the title, the slow bell), HARD region trips and the
// travel map's world boss and places lines, crabs and weed in the tide pools and foes slowed in a full pool, the walk's
// pointer to the next person.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r176-${n}-${vw}.png` });
  const until = async (fn, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn)); i++) await p.waitForTimeout(100); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  // 1. The walk's pointer (a character still on the walk).
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 0; HS.SAVE.walkDone = false; HS.SAVE.walkStart = true; HS.SAVE.q.walk_vael = { st: 'active', step: 0, c: {} }; HS.game.state = 'play'; HS.player.x = 300; HS.player.y = 1900; });
  await p.waitForTimeout(800); await shot('walk-pointer');
  // 2. After the ending.
  out.epilogue = await p.evaluate(() => { HS.SAVE.walkDone = true; HS.SAVE.q.walk_vael.st = 'done'; HS.SAVE.story = 6; HS.SAVE.cleared = 29; HS.SAVE.ending = 1; HS.SAVE.lvl = 60; HS.ensureQuests(); return { title: HS.saintTitle(), barks: HS.EPILOGUE_BARKS.length }; });
  await p.evaluate(() => { HS.talk('vane'); }); await p.waitForTimeout(400); await shot('vane'); out.vaneLine = await p.evaluate(() => HS.game.dialog && HS.game.dialog.lines && HS.game.dialog.lines[0]);
  for (let i = 0; i < 8 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(150); }
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(300); await shot('pause-title'); await p.evaluate(() => { HS.game.state = 'play'; });
  // 3. The travel map: HARD, the world boss and places.
  await p.evaluate(() => { HS.SAVE.worldBossT = { charnelKing: Date.now() - 60000 }; HS.SAVE.marksSeen = { moor: { circle: 1, gibbet: 1 } }; HS.openTravel('moor'); }); await p.waitForTimeout(400); await shot('travel');
  out.travelProblems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { const L = HS.travelLayout(), R = L.card(1), tx = R.x + Math.round(R.w * 0.45); HS.travelTap(tx + 60, R.y + R.h - 20); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'fen');
  await p.waitForTimeout(300); out.hard = await p.evaluate(() => ({ hard: !!(HS.game.run && HS.game.run.hard), station: HS.curDiff ? null : null, banner: HS.game.banner && HS.game.banner.text, foes: HS.enemies.length }));
  await shot('hard');
  // 4. The coast's tide pools: crabs, weed, a foe slowed in a full pool.
  await p.evaluate(() => { HS.enterTown(false); HS.travelRegion('salt'); }); await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'salt');
  out.crabs = await p.evaluate(() => HS.room.critters.filter((c) => c.kind === 'crab').length);
  await p.evaluate(() => { HS.SAVE.god = 1; HS.DEV.god = true; const t = HS.room.tides[0]; HS.player.x = t.x + 50; HS.player.y = t.y + 40; for (const e of HS.enemies) if (Math.hypot(e.x - t.x, e.y - t.y) < 500) e.dead = true; HS.game.banner = null; });
  await p.waitForTimeout(800); await shot('pool');
  out.slow = await p.evaluate(async () => { const t = HS.room.tides.find((q) => q) ; const e = HS.spawnMonster('risen', t.x, t.y, {}); e.asleep = false; let full = false; for (let i = 0; i < 80 && !full; i++) { await new Promise((r) => setTimeout(r, 250)); full = HS.tideFull(e.x, e.y) && e.slowK < 1; } return { full, slowK: e.slowK }; });
  out.logged = await p.evaluate(() => (HS.ERRS || []).map((e) => e.msg).slice(-4));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
