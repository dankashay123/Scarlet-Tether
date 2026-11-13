// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round96.cjs <outDir> [WxH]
// Round 96: the forge in the Enchanter's style (gear rows, drag to scroll, showcase, stat rows, a reforge and an affix cut),
// stat tips in the bag, the bag's RUBRICS tab and salvage, the reworded Codex cards and death recap.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r96-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.embers = 60; HS.SAVE.gold = 90000; HS.SAVE.tears = 2; HS.SAVE.equip = {}; HS.SAVE.bag = [];
    ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'].forEach((sl, i) => { const it = HS.makeItem(sl, 1 + i % 4, `PIECE ${i}`, undefined, 4 + i); if (i % 3 === 0 && it.stats[1]) it.stats[1] = [it.stats[1][0], 9, i % 5]; HS.SAVE.equip[sl] = it; });
    for (let k = 0; k < 6; k++) HS.SAVE.bag.push(HS.makeItem('hood', 2, `SPARE ${k}`, undefined, 6)); HS.applyGear(); HS.openForge(); });
  await p.waitForTimeout(300); await shot('forge'); await check('forge');
  // Drag the gear list; pick the last piece; pick its second stat; reforge it.
  out.forge = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(), kx = c.width / HS.W, ky = c.height / HS.H, L = HS.featLayout(), B = HS.forgeGeo(L).box, x = c.left + (B.x + 30) * kx, y0 = c.top + (B.y + B.h - 10) * ky;
    HS.pointerDown(5, x, y0); for (let k = 1; k <= 6; k++) HS.pointerMove(5, x, y0 - 600 * ky * k / 6); HS.pointerUp(5); const G = HS.forgeGeo(L), n = HS.forgeItems().length, r = G.row(n - 1);
    HS.forgeTap(r.x + 40, r.y + 10); const sel = HS.game.forge.sel, it = HS.forgeItems()[sel], st = G.stat(1); HS.forgeTap(st.x + 20, st.y + 5); const stat = HS.game.forge.stat, e0 = HS.SAVE.embers;
    HS.forgeTap(L.btnA.x + 5, L.btnA.y + 5); if (HS.game.ask) { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); }
    return { scroll: Math.round(HS.game.forge.scroll), max: Math.round(G.max), sel, last: n - 1, stat, spent: e0 - HS.SAVE.embers, reforged: it.stats[1][2] !== undefined }; });
  await p.waitForTimeout(200); await shot('forge-scrolled');
  out.affix = await p.evaluate(() => { HS.game.forge.tab = 1; const L = HS.featLayout(), r = HS.affixGeo(L).rows[0], it = HS.forgeItems()[HS.game.forge.sel]; HS.forgeTap(r.btn.x + 4, r.btn.y + 4); return { lines: (it.adv || []).length }; });
  await p.waitForTimeout(200); await shot('affix'); await check('affix');
  // Stat tips in the bag.
  await p.evaluate(() => { HS.game.forge = null; HS.game.state = 'play'; HS.openInventory(); }); await p.waitForTimeout(300);
  out.tip = await p.evaluate(() => { const R = HS.game.inv.tipR, q = R.find((r) => r.k === 'sanct'); HS.invTap(q.x + 4, q.y + 4); return { rects: R.length, tip: HS.game.statTip && HS.game.statTip.k }; });
  await p.waitForTimeout(200); await shot('tip'); await check('tip');
  // The RUBRICS tab: eight Rubrics, one socketed; salvage one, then every spare.
  await p.evaluate(() => { HS.game.statTip = null; HS.SAVE.rubrics = []; const K = ['might', 'swift', 'zeal', 'mercy', 'echo', 'ward']; for (let i = 0; i < 8; i++) HS.SAVE.rubrics.push({ u: `r${i}`, r: i % 2 ? 'water' : 'chain', k: K[i % 6], t: 1 + i % 3 }); HS.SAVE.rsock = { water: ['r1', null, null] }; HS.rubBuild(); HS.game.inv.tab = 3; });
  await p.waitForTimeout(250); await shot('rubrics'); await check('rubrics');
  out.rub = await p.evaluate(() => { const L = HS.invLayout(), G = HS.rubBagGeo(L), e0 = HS.SAVE.embers, j = G.list.findIndex((q) => q.u === 'r0'); const bt = G.btn(j); HS.invTap(bt.x + 4, bt.y + 4); if (HS.game.ask) { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); }
    const one = { left: HS.rubrics().length, got: HS.SAVE.embers - e0 }; HS.invTap(G.all.x + 4, G.all.y + 4); if (HS.game.ask) { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); }
    return { one, left: HS.rubrics().map((q) => q.u), embers: HS.SAVE.embers - e0 }; });
  // The Codex and the death recap.
  await p.evaluate(() => { HS.game.inv = null; HS.game.state = 'play'; HS.codexSee('m', 'risen', 12); HS.openCodex(0, 'pause'); const L = HS.codexLayout(); HS.game.codex.sel = L.list.findIndex((q) => q.id === 'risen'); });
  await p.waitForTimeout(250); await shot('codex'); await check('codex');
  out.codex = await p.evaluate(() => HS.codexList(0).find((q) => q.id === 'risen').lines);
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
