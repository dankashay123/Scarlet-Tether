// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round93.cjs <outDir> [WxH]
// Round 93: the reworked Enchanter: every enchant a full-width row with its worn tag (piece and tier),
// ingredient gems, drag to scroll; the showcase opens the gear picker; the tier switch; ENCHANT works.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r93-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.gold = 9000; const I = HS.ingrs(); for (let i = 0; i < I.length; i++) I[i] = i % 4 ? 2 : 0;
    HS.SAVE.equip = {}; for (const s of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) HS.SAVE.equip[s] = HS.makeItem(s, 3, 'X', undefined, 10);
    HS.SAVE.equip.hood.ench = HS.ENCHANTS[2].id; HS.SAVE.equip.relic.ench = HS.ENCHANTS[14].id; HS.SAVE.equip.relic.enchT = 2; HS.applyGear(); HS.openEnchant(); });
  await p.waitForTimeout(300); await shot('top'); await check('top');
  out.worn = await p.evaluate(() => HS.ENCHANTS.map((E) => HS.enchWorn(E.id)).map((w, i) => w ? `${i}:${w.sl}:${w.t}` : null).filter(Boolean));
  // Drag the list up with a finger: it scrolls and stops at the end.
  const drag = async (dy) => p.evaluate((dy) => { const c = document.querySelector('canvas').getBoundingClientRect(), kx = c.width / HS.W, ky = c.height / HS.H, B = HS.enchGeo(HS.featLayout()).box, x = c.left + (B.x + B.w / 2) * kx, y0 = c.top + (B.y + B.h - 10) * ky;
    HS.pointerDown(7, x, y0); for (let k = 1; k <= 8; k++) HS.pointerMove(7, x, y0 + dy * ky * k / 8); HS.pointerUp(7); return Math.round(HS.game.ench.scroll); }, dy);
  out.scroll = [await drag(-120), await drag(-2000)];
  await p.waitForTimeout(200); await shot('bottom'); await check('bottom');
  out.max = await p.evaluate(() => Math.round(HS.enchGeo(HS.featLayout()).max));
  // Choose the last enchant and a bare piece through the showcase, view tier II, enchant.
  out.enchant = await p.evaluate(() => { const N = HS.game.ench, L = HS.featLayout(), G = HS.enchGeo(L), last = HS.ENCHANTS.length - 1, I = HS.ingrs(); for (let k = 0; k < 3; k++) I[last * 3 + k] = 1;
    const r = G.row(last); HS.enchantTap(r.x + 40, r.y + 10); const sel = N.sel;
    HS.enchantTap(G.show.x + 10, G.show.y + 10); const picking = N.pick; const c = HS.forgeCell(L, 1); HS.enchantTap(c.x + 4, c.y + 4);
    const T2 = G.tier(1); HS.enchantTap(T2.x + 4, T2.y + 4); const tier = N.tier;
    HS.enchantTap(G.go.x + 4, G.go.y + 4); if (HS.game.ask) { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); }
    return { sel, picking, item: N.item, tier, ench: HS.forgeItems()[1].ench, worn: !!HS.enchWorn(HS.ENCHANTS[last].id) }; });
  await p.waitForTimeout(250); await shot('done'); await check('done');
  await p.evaluate(() => { HS.game.ench.pick = true; }); await p.waitForTimeout(200); await shot('pick'); await check('pick');
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
