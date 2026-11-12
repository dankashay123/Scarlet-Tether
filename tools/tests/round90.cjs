// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round90.cjs <outDir> [WxH]
// Round 90: a talent's card closes when its node is tapped again or anywhere empty is tapped,
// and LEARN and the build buttons still work with a card open; the redrawn talent icons.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const tap = async (x, y) => { const k = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { l: c.left, t: c.top, kx: c.width / HS.W, ky: c.height / HS.H }; }); await p.touchscreen.tap(k.l + x * k.kx, k.t + y * k.ky); await p.waitForTimeout(120); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 20; HS.SAVE.cleared = -1; HS.SAVE.talents = {}; HS.openCanonry(); HS.game.talTab = 0; });
  await p.waitForTimeout(300);
  const L = await p.evaluate(() => { const L = HS.talLayout(); return { might: L.cell(HS.TAL_BY.might), execute: L.cell(HS.TAL_BY.execute), learn: L.learn, empty: { x: L.gx + L.cw * 2.5, y: L.top + L.rh * 0.5 } }; });
  const sel = () => p.evaluate(() => HS.game.talSel), mid = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const r = {};
  await tap(...mid(L.might)); r.open = await sel();
  await tap(...mid(L.might)); r.sameAgain = await sel();
  await tap(...mid(L.might)); await tap(L.empty.x, L.empty.y); r.empty = await sel();
  await tap(...mid(L.execute)); await tap(L.learn.x + 10, L.learn.y + 10); r.learned = await p.evaluate(() => HS.tal('execute')); r.keptAfterLearn = await sel();
  await tap(...mid(L.might)); r.switched = await sel();
  await p.screenshot({ path: `${S}/shots/r90-card-${VW}.png` });
  r.problems = await p.evaluate(() => HS.textProblems().length);
  for (const ti of [1, 2]) { await p.evaluate((ti) => { HS.game.talTab = ti; HS.game.talSel = null; }, ti); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r90-tree${ti}-${VW}.png` }); }
  out.card = r;
  console.log(JSON.stringify(out)); console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
