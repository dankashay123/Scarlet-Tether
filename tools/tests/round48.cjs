// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round48.cjs <outDir> [WxH]
// Round 48: the Training Yard's RECORDS tab, its 30 s test and reset, and
// Stratum III's ambience (falling ash, green cairn flames, bone rattles).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r48-${n}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 6; HS.SAVE.lvl = 60;
    // A few past builds so the list has rows.
    HS.SAVE.yardBest = { 'nails:storm,chain,volley': 18400, 'font:water,asperse,font': 9100, 'mixed:water,chain,rain': 2300, all: 18400 }; HS.SAVE.yardTest = { 'nails:storm,chain,volley': 15200, all: 15200 }; });
  await p.evaluate(() => HS.openYard()); await p.waitForTimeout(3500);
  // The records tab (the Saint stands out of range first so no damage numbers are in the air).
  await p.evaluate(() => { const d = HS.yard.dummy; HS.player.x = d.x - 320; HS.player.y = d.y; HS.enemies.forEach((e) => { if (e.type !== 'dummy') e.dead = true; }); }); await p.waitForTimeout(3500);
  await p.evaluate(() => { HS.game.state = 'yard'; HS.yard.tab = 4; }); await p.waitForTimeout(250); await shot('records');
  out.problems = await p.evaluate(() => HS.textProblems().length);
  out.rows = await p.evaluate(() => HS.yardRecords().length);
  // Start the 30 s test (run at 3x speed), with the dummy under fire.
  await p.evaluate(() => { const G = HS.yardGeo(); HS.yardTap(G.btn(0).x + 4, G.btn(0).y + 4); HS.DEV.god = true; const d = HS.yard.dummy; HS.player.x = d.x - 60; HS.player.y = d.y; });
  await p.waitForTimeout(1200); await shot('test-count');
  await p.evaluate(() => { HS.DEV.speed = 3; }); await p.waitForTimeout(3000); await shot('test-run');
  out.during = await p.evaluate(() => ({ state: HS.game.state, dmg: Math.round(HS.yard.test && HS.yard.test.dmg || 0) }));
  await p.waitForTimeout(9500); await shot('test-done');
  await p.evaluate(() => { HS.DEV.speed = 1; });
  out.after = await p.evaluate(() => ({ test: HS.SAVE.yardTest[HS.yardKey()] || 0, key: HS.yardKey() }));
  await p.evaluate(() => { HS.game.state = 'yard'; HS.yard.tab = 4; }); await p.waitForTimeout(250); await shot('records-after');
  // Reset asks first; YES clears both tables.
  out.reset = await p.evaluate(() => { const G = HS.yardGeo(); HS.yardTap(G.btn(1).x + 4, G.btn(1).y + 4); const asked = !!HS.game.ask; const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); return { asked, rows: HS.yardRecords().length }; });
  await p.evaluate(() => { HS.game.state = 'play'; HS.yard.test = null; });
  // Stratum III: falling ash, a cairn's green flames, a skull heap that rattles.
  await p.evaluate(() => { HS.SAVE.cleared = 8; HS.game.nextYard = false; HS.game.nextStratum = 3; HS.game.nextDiff = 6; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(500);
  for (let i = 0; i < 8 && !await p.evaluate(() => HS.room.props.some((q) => q.kind === 'cairn')); i++) { await p.evaluate(() => { HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; }); await p.waitForTimeout(300); }
  const cairn = await p.evaluate(() => { HS.enemies.length = 0; const c = HS.room.props.find((q) => q.kind === 'cairn'); if (c) { HS.player.x = c.x + 70; HS.player.y = c.y + 40; } return !!c; });
  await p.waitForTimeout(3200); await shot('ossuary-cairn');
  out.rattle = await p.evaluate(async () => { const h = HS.room.props.find((q) => q.kind === 'skullheap'); if (!h) return 'no heap'; HS.enemies.length = 0; HS.player.x = h.x - 30; HS.player.y = h.y + 8;
    for (let i = 0; i < 20; i++) { HS.player.x += 2; await new Promise((r) => setTimeout(r, 30)); } return h.rattleT > 0; });
  await p.waitForTimeout(150); await shot('ossuary-rattle');
  out.cairn = cairn;
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
