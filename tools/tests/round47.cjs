// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round47.cjs <outDir> [WxH]
// Round 47: the Rites panel's NEXT line at a low Saint level, passives you can
// wear listed first, the new hedges and flower beds, the Acre fence.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); }
  await p.evaluate(() => { HS.tut.on = false; });
  // Rites at Saint level 12: the header names the next rite.
  const next = await p.evaluate(() => { HS.SAVE.lvl = 12; HS.openRites('play'); HS.game.riteFocus = 'm1'; return HS.nextRite(); });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r47-rites-next.png` });
  // Passives: one deed passive earned (Blood Tithe) sorts ahead of the locked ones.
  const order = await p.evaluate(() => { HS.SAVE.life = { ...(HS.SAVE.life || {}), kills: 5000 }; HS.game.riteFocus = 'passive'; HS.game.passSel = 'bloodtithe'; return HS.passOrder().map((q) => q.id); });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r47-passives.png` });
  const problems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; });
  // The hedges by the road into the square and the flower beds by the fountain.
  await p.evaluate(() => { HS.player.x = 720; HS.player.y = 470; }); await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/shots/r47-square.png` });
  await p.evaluate(() => { HS.player.x = HS.STALLS.ench; HS.player.y = 470; }); await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/shots/r47-acre.png` });
  console.log('next', JSON.stringify(next), 'order', order.indexOf('bloodtithe'), order.indexOf('hunter'), 'text problems', problems);
  console.log('overlaps', await p.evaluate(() => JSON.stringify(HS.townOverlaps())));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
