// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round109.cjs <outDir> [WxH]
// Round 109: the Wounds page (pause tile during a descent): every held Wound, a row's text, SACRIFICE (one rank more
// than on the level-up screen, no level-up choice used), the mythic reveal, and a long list in three columns.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r109-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500);
  out.town = await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'pause'; return HS.pauseLayout().tiles.some((t) => t.id === 'wounds'); }); // no tile in town
  await p.goto('http://localhost:8123/?run&dev'); await p.waitForTimeout(1800);
  const open = () => p.evaluate(() => { HS.game.state = 'pause'; const t = HS.pauseLayout().tiles.find((q) => q.id === 'wounds'); HS.pauseTap(t.x + 4, t.y + 4); return HS.game.state; });
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.enemies.length = 0; HS.game.run.wounds = {}; HS.applyGear(); });
  out.empty = await open(); await p.waitForTimeout(300); await check('empty'); await shot('empty');
  await p.evaluate(() => { HS.game.run.wounds = { wrath: 5, quick: 3, vigil: 2, crescent: 1, swift: 1 }; HS.applyGear(); });
  await open(); await p.waitForTimeout(300);
  out.page = await p.evaluate(() => { const L = HS.woundsLayout(); HS.woundsTap(L.cell(2).x + 4, L.cell(2).y + 4); return { rows: L.list.length, sel: HS.game.woundWin.sel, first: L.list[0].w.id }; });
  await p.waitForTimeout(200); await check('page'); await shot('page');
  out.sac = await p.evaluate(() => { const L = HS.woundsLayout(), pend = HS.game.run.pending; HS.woundsTap(L.sac.x + 4, L.sac.y + 4); const asked = !!HS.game.ask; if (asked) { const A = HS.game.ask; HS.game.ask = null; A.yes(); }
    const W = HS.game.run.wounds, myth = Object.keys(W).filter((id) => HS.WOUNDS.find((w) => w.id === id).mythic); return { asked, state: HS.game.state, ranks: Object.entries(W).reduce((a, [id, n]) => a + (myth.includes(id) ? 0 : n), 0), myth, pendSame: HS.game.run.pending === pend }; });
  await p.waitForTimeout(600); await shot('sacrifice'); await p.waitForTimeout(1600); await check('reveal'); await shot('reveal');
  out.after = await p.evaluate(() => { HS.stigTap(HS.W / 2, HS.H / 2); return HS.game.state; });
  // Too few ranks: the button refuses.
  out.few = await p.evaluate(() => { HS.game.run.wounds = { wrath: 3 }; HS.game.state = 'pause'; const t = HS.pauseLayout().tiles.find((q) => q.id === 'wounds'); HS.pauseTap(t.x + 4, t.y + 4); const L = HS.woundsLayout(); HS.woundsTap(L.sac.x + 4, L.sac.y + 4); return { asked: !!HS.game.ask, toast: HS.game.toast && HS.game.toast.msg }; });
  // A long list.
  await p.evaluate(() => { const W = {}; HS.WOUNDS.filter((w) => !w.rite && (!w.hero || w.hero === 'saint')).slice(0, 22).forEach((w) => { W[w.id] = 1; }); HS.game.run.wounds = W; HS.applyGear(); });
  await open(); await p.waitForTimeout(300); out.long = await p.evaluate(() => ({ held: HS.woundsHeld().length, shown: HS.woundsLayout().list.length })); await check('long'); await shot('long');
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
