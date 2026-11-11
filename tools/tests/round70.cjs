// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round70.cjs <outDir> [WxH]
// Characters: the splash, making a first character (class and name), the
// select screen with two characters, swapping between them (each keeps its
// own save), deleting one, an old save turning into the first character,
// and no hero switching in town.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [w, h] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r70-${n}.png` });
  const st = () => p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene, hero: HS.heroId(), name: HS.SAVE.name, chars: JSON.parse(localStorage.getItem('hollow-saint-chars') || 'null') }));
  const tapAt = (x, y) => p.evaluate(([x, y]) => HS.onTap(x, y), [x, y]);
  const out = {};
  // A fresh player: splash, then straight to making a character.
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(1200); await shot('splash');
  await tapAt(10, 10); await p.waitForTimeout(300); out.afterSplash = (await st()).state;
  await p.evaluate(() => { HS.game.create.name = 'TAMSIN'; const L = HS.createLayout(); HS.onTap(L.cards[1].x + 20, L.cards[1].y + 20); }); await p.waitForTimeout(300); await shot('create');
  out.createProblems = await p.evaluate(() => HS.textProblems());
  await p.evaluate(() => { const L = HS.createLayout(); HS.onTap(L.create.x + 10, L.create.y + 10); }); await p.waitForTimeout(2500);
  out.first = await st();
  // Earn something on her, then make a second character (a Saint).
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.SAVE.lvl = 7; HS.SAVE.cleared = 2; HS.SAVE.gold = 777; HS.SAVE.tutorialDone = true; HS.persist(); });
  await p.evaluate(() => { HS.game.state = 'chars'; }); await p.waitForTimeout(300);
  await p.evaluate(() => { const L = HS.charsLayout(); HS.onTap(L.plus.x + 10, L.plus.y + 10); HS.game.create.name = 'ALDRIC'; const C = HS.createLayout(); HS.onTap(C.create.x + 10, C.create.y + 10); }); await p.waitForTimeout(2500);
  out.second = await st(); out.secondGold = await p.evaluate(() => HS.SAVE.gold || 0);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'chars'; }); await p.waitForTimeout(300); await shot('chars');
  out.charsProblems = await p.evaluate(() => HS.textProblems());
  // Back to the first: her gold and level come back.
  await p.evaluate(() => { const L = HS.charsLayout(), s0 = L.slots.find((q) => q.c.name === 'TAMSIN'); HS.onTap(s0.x + 40, s0.y + 10); const L2 = HS.charsLayout(); HS.onTap(L2.start.x + 10, L2.start.y + 10); }); await p.waitForTimeout(2500);
  out.back = { ...(await st()), gold: await p.evaluate(() => HS.SAVE.gold), lvl: await p.evaluate(() => HS.SAVE.lvl) };
  // No switching in town: no other saint in the close, no tile on the pause screen.
  out.noSwitch = await p.evaluate(() => ({ npc: HS.room.npcs.some((n) => n.hero), tile: (() => { HS.game.state = 'pause'; return pauseLayout().tiles.some((t) => t.id === 'hero'); })() }));
  await p.waitForTimeout(200); await shot('pause');
  // Delete the second character.
  await p.evaluate(() => { HS.game.state = 'chars'; const L = HS.charsLayout(), s0 = L.slots.find((q) => q.c.name === 'ALDRIC'); HS.onTap(s0.x + 40, s0.y + 10); const L2 = HS.charsLayout(); HS.onTap(L2.del.x + 5, L2.del.y + 5); }); await p.waitForTimeout(300); await shot('delete-ask');
  await p.evaluate(() => { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); }); await p.waitForTimeout(400);
  out.afterDelete = (await st()).chars.list.map((c) => c.name);
  // An old save (no roster) becomes the first character.
  const p2 = await (await b.newContext({ viewport: { width: w, height: h } })).newPage(); p2.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p2.goto('http://localhost:8123/'); await p2.evaluate(() => { localStorage.clear(); localStorage.setItem('hollow-saint', JSON.stringify({ descents: 5, lvl: 9, gold: 1234, hero: 'mendicant', tutorialDone: true, stations: 1 })); });
  await p2.reload(); await p2.waitForTimeout(1200);
  out.migrated = await p2.evaluate(() => { const R = JSON.parse(localStorage.getItem('hollow-saint-chars')); return { n: R.list.length, hero: R.list[0].hero, name: !!R.list[0].name, gold: HS.SAVE.gold }; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
