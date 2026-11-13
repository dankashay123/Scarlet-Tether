// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round97.cjs <outDir> [WxH]
// Round 97: the Enchanter's gear picker as the forge's list (drag, pick), the forge's VALUES and BUY tabs,
// the Codex's RUBRICS section (and an old save's Rubrics counted), stat tips on a bag card, the tutorial per class.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r97-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.embers = 60; HS.SAVE.gold = 90000; HS.SAVE.equip = {}; HS.SAVE.bag = [];
    ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'].forEach((sl, i) => { const it = HS.makeItem(sl, 1 + i % 4, `PIECE ${i}`, undefined, 4 + i); if (i % 3 === 0 && it.stats[1]) it.stats[1] = [it.stats[1][0], 9, i % 5]; if (i % 4 === 1) { it.ench = HS.ENCHANTS[i % HS.ENCHANTS.length].id; it.enchT = 1 + i % 2; } HS.SAVE.equip[sl] = it; });
    for (let k = 0; k < 6; k++) HS.SAVE.bag.push(HS.makeItem('hood', 2, `SPARE ${k}`, undefined, 6)); HS.applyGear(); HS.openEnchant(); });
  // The Enchanter's picker: open by the frame, drag, pick the last piece.
  out.pick = await p.evaluate(() => { const L = HS.featLayout(), G0 = HS.enchGeo(L); HS.enchantTap(G0.show.x + 10, G0.show.y + 10); return HS.game.ench.pick; });
  await p.waitForTimeout(250); await shot('ench-pick'); await check('ench-pick');
  out.ench = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(), kx = c.width / HS.W, ky = c.height / HS.H, L = HS.featLayout(), N = HS.game.ench, n = HS.forgeItems().length;
    const B = HS.gearGeo(L, HS.enchPick(N), n).box, x = c.left + (B.x + 30) * kx, y0 = c.top + (B.y + B.h - 10) * ky;
    HS.pointerDown(5, x, y0); for (let k = 1; k <= 6; k++) HS.pointerMove(5, x, y0 - 600 * ky * k / 6); HS.pointerUp(5);
    const G = HS.gearGeo(L, HS.enchPick(N), n), r = G.row(n - 1), sc = Math.round(N.gl.scroll); HS.enchantTap(r.x + 40, r.y + 10); return { scroll: sc, max: Math.round(G.max), item: N.item, last: n - 1, closed: !N.pick }; });
  await p.waitForTimeout(200); await shot('ench-picked'); await check('ench-picked');
  // The forge's VALUES tab: pick a piece in the list; the BUY tab: buy one, then ten (asks).
  await p.evaluate(() => { HS.game.ench = null; HS.game.state = 'play'; HS.openForge(); HS.game.forge.tab = 2; });
  await p.waitForTimeout(250); await shot('values'); await check('values');
  out.values = await p.evaluate(() => { const L = HS.featLayout(), r = HS.forgeGeo(L).row(2); HS.forgeTap(r.x + 40, r.y + 10); return HS.game.forge.sel; });
  await p.waitForTimeout(200); await shot('values2');
  await p.evaluate(() => { HS.game.forge.tab = 3; }); await p.waitForTimeout(250); await shot('buy'); await check('buy');
  out.buy = await p.evaluate(() => { const L = HS.featLayout(), e0 = HS.SAVE.embers, g0 = HS.SAVE.gold; let r = HS.emberBuyRow(L, 0); HS.forgeBuyTap(L, r.x + 5, r.y + 5); r = HS.emberBuyRow(L, 1); HS.forgeBuyTap(L, r.x + 5, r.y + 5); const asked = !!HS.game.ask; if (asked) { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); } return { embers: HS.SAVE.embers - e0, gold: g0 - HS.SAVE.gold, asked }; });
  // The Codex: an old codex without Rubrics counts the ones held; a pick adds one.
  out.codex = await p.evaluate(() => { HS.game.forge = null; HS.game.state = 'play'; HS.codexData(); HS.SAVE.rubrics = [{ u: 'a', r: 'water', k: 'might', t: 2 }, { u: 'b', r: 'water', k: 'zeal', t: 1 }]; delete HS.SAVE.codex.rk; delete HS.SAVE.codex.r; HS.codexData();
    const before = { ...HS.SAVE.codex.rk }; HS.pickRubric({ r: 'water', k: 'might', t: 3 }); HS.pickRubric({ r: 'chain', k: 'echo', t: 1 });
    HS.openCodex(5, 'pause'); const L = HS.codexLayout(); HS.game.codex.sel = L.list.findIndex((q) => q.id === 'water'); const q = L.list[HS.game.codex.sel];
    return { before, rk: HS.SAVE.codex.rk, n: HS.SAVE.codex.r, secs: HS.CODEX_SECS.length, entries: L.list.length, seen: L.list.filter((z) => z.seen).length, lines: q.lines, isNew: Object.keys(HS.SAVE.codexNew || {}).filter((k) => k.startsWith('5:')) }; });
  await p.waitForTimeout(250); await shot('codex'); await check('codex');
  // A stat tip from a bag card.
  await p.evaluate(() => { HS.game.state = 'play'; HS.game.codex = null; HS.openInventory(); HS.game.inv.sel = { from: 'bag', i: 0 }; });
  await p.waitForTimeout(250);
  out.tip = await p.evaluate(() => { const it = HS.SAVE.bag[0], R = HS.game.inv.tipR, q = R.filter((r) => it.stats.some((st) => st[0] === r.k) && r.x >= HS.invLayout().card.x - 4)[0]; if (!q) return { none: R.map((r) => r.k) }; HS.invTap(q.x + 4, q.y + 4); return { k: q.k, tip: HS.game.statTip && HS.game.statTip.k }; });
  await p.waitForTimeout(200); await shot('cardtip'); await check('cardtip');
  // The tutorial's text per class.
  out.tut = await p.evaluate(() => HS.TUT.map((s) => HS.tutText(s)));
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
