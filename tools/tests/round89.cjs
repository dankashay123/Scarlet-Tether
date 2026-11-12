// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round89.cjs <outDir> [WxH]
// Round 89: every talent's own icon, named builds and the summary asked before a swap,
// titles on the character select.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  p.on('dialog', (d) => d.accept('Wardens')); // the name prompt
  const shot = (n) => p.screenshot({ path: `${S}/shots/r89-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 4).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 100; HS.SAVE.cleared = 29; HS.SAVE.talents = {}; HS.SAVE.talPages = null; HS.SAVE.talPage = 0; HS.SAVE.talNames = null; });
  // Icons: one frame for every plain node, in the sheet's order.
  out.icons = await p.evaluate(() => { const plain = HS.TALENT_TREES.flatMap((T0) => T0.nodes).filter((t) => !t.legend); return { plain: plain.length, listed: HS.TAL_NODES.length, missing: plain.filter((t) => !HS.TAL_NODES.includes(t.id)).map((t) => t.id) }; });
  for (let ti = 0; ti < 3; ti++) { await p.evaluate((ti) => { HS.openCanonry(); HS.game.talTab = ti; HS.game.talSel = null; for (const t of HS.TALENT_TREES[ti].nodes) if (t.c < 4) HS.SAVE.talents[t.id] = t.max; }, ti); await p.waitForTimeout(250); await shot(['offence', 'defence', 'rites'][ti]); await check(`tree ${ti}`); }
  // Builds: name the one in use, then the swap asks with the other build's summary.
  out.build = await p.evaluate(() => { HS.SAVE.talents = { might: 5, brawn: 3, greatbolt: 1, vigour: 5, aegis: 1 }; HS.SAVE.talPages = [null, { devout: 5, cadence: 1, choir: 1 }]; const L = HS.talLayout(), r = {};
    HS.canonryTap(L.page(0).x + 4, L.page(0).y + 4); r.name = HS.talName(0); r.sum0 = HS.talSummary(0); r.sum1 = HS.talSummary(1); HS.canonryTap(L.page(1).x + 4, L.page(1).y + 4); r.asked = !!HS.game.ask; r.pageStill = HS.talPageNo(); return r; });
  await p.waitForTimeout(300); await shot('swap-ask'); await check('swap ask');
  out.swapped = await p.evaluate(() => { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); return { page: HS.talPageNo(), choir: HS.tal('choir'), might: HS.tal('might') }; });
  await p.waitForTimeout(300); await shot('build2'); await check('build 2');
  // The character select shows the title before the class.
  await p.evaluate(() => { HS.SAVE.name = HS.SAVE.name || 'ALDRIC'; HS.persist(); const R0 = HS.roster(); if (!R0.list.length) { R0.list.push({ id: 't1', name: HS.SAVE.name, hero: 'anchoress' }); R0.active = 't1'; localStorage.setItem('hollow-saint-chars', JSON.stringify(R0)); } HS.game.state = 'chars'; }); await p.waitForTimeout(400); out.chars = await p.evaluate(() => HS.charsLayout().list.map((c) => `${HS.titleOf(c.lvl || 1)}${c.hero} ${c.lvl}`)); await shot('chars'); await check('chars');
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
