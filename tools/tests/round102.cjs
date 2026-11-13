// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round102.cjs <outDir> [WxH]
// Round 102: class enchants (18 a class in the Enchanter and the bag, each one's effect), the Calling (26 nodes a class,
// rite nodes on damage and cooldown, every legendary hook, Testaments: cap, drop, pickup, never enough to fill the tree), dev rows.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r102-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; });
  // The trees: shape and the owner's rule.
  out.trees = await p.evaluate(() => Object.fromEntries(Object.entries(HS.CALLING).map(([h, T]) => { const ranks = T.nodes.reduce((a, t) => a + t.max, 0), cells = new Set(T.nodes.map((t) => `${t.c},${t.r}`));
    return [h, { nodes: T.nodes.length, legends: T.nodes.filter((t) => t.legend).length, rites: T.nodes.filter((t) => t.rite).length, ranks, cap: HS.TEST_MAX, ruleOk: HS.TEST_MAX < ranks, noOverlap: cells.size === T.nodes.length, general: HS.TALENT_TREES.map((q) => q.nodes.length) }]; })));
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    // The Enchanter lists 18, with the class's two at the end; the bag's INGREDIENTS tab shows them.
    await p.evaluate((hero) => { HS.SAVE.hero = hero; HS.SAVE.lvl = 100; HS.SAVE.testaments = 30; HS.SAVE.talents = {}; HS.SAVE.equip = { hood: HS.makeItem('hood', 2, 'PIECE', undefined, 6) }; HS.applyGear(); HS.game.state = 'play';
      const M = HS.myEnch(); for (const e of M.slice(-2)) for (let k = 0; k < 3; k++) HS.ingrs()[e * 3 + k] = 2; HS.openEnchant(); HS.game.ench.sel = M[M.length - 1]; HS.game.ench.scroll = 9999; }, hero);
    await p.waitForTimeout(300); await check(`ench-${hero}`); await shot(`ench-${hero}`);
    const en = await p.evaluate(() => ({ n: HS.myEnch().length, own: HS.myEnch().slice(-2).map((i) => HS.ENCHANTS[i].name) }));
    await p.evaluate(() => { HS.game.ench = null; HS.game.state = 'play'; HS.openInventory(); HS.game.inv.tab = 2; }); await p.waitForTimeout(250); await check(`ingr-${hero}`); if (hero === 'saint') await shot('ingr');
    // The Calling: learn the first rite node thrice, open a card, photograph.
    await p.evaluate(() => { HS.game.inv = null; HS.game.state = 'play'; HS.openCanonry(); HS.game.talTab = 3; }); await p.waitForTimeout(250);
    const tal = await p.evaluate(() => { const L = HS.talLayout(), T = HS.CALLING[HS.heroId()], t = T.nodes[0], c = L.cell(t); HS.canonryTap(c.x + c.w / 2, c.y + c.h / 2); for (let k = 0; k < 4; k++) HS.canonryTap(L.learn.x + 5, L.learn.y + 5);
      return { node: t.id, rank: HS.tal(t.id), left: HS.testPts(), general: HS.talPts(), text: t.text(3) }; });
    await p.waitForTimeout(200); await check(`calling-${hero}`); await shot(`calling-${hero}`);
    out[hero] = { ench: en, tal };
  }
  // Hooks, on the Saint: a rite node's damage and cooldown, then each class's legendary numbers.
  out.hooks = await p.evaluate(() => { const o = {}; HS.game.state = 'play'; HS.SAVE.hero = 'saint'; HS.SAVE.rites = { m1: 'water', m2: 'chain', pen: 'rain' }; HS.SAVE.talents = {}; HS.applyGear(); const cd0 = HS.riteCd('m1'), c0 = HS.censers();
    HS.SAVE.talents = { c_water: 3, c_scenser: 1 }; HS.applyGear(); o.cd = +(HS.riteCd('m1') / cd0).toFixed(3); o.censers = [c0, HS.censers()];
    HS.SAVE.hero = 'mendicant'; HS.SAVE.talents = {}; HS.applyGear(true); const g0 = HS.setGuard(); HS.SAVE.talents = { c_mbulwark: 1 }; o.bulwark = +(HS.setGuard() / g0).toFixed(2);
    HS.SAVE.hero = 'anchoress'; HS.SAVE.talents = {}; HS.game.nextDiff = 2; HS.newRun(); HS.tut.on = false; HS.applyGear(true); const s0 = HS.shardCount(); HS.SAVE.talents = { c_ashard: 1 }; o.shards = [s0, HS.shardCount()];
    const it = HS.makeItem('hood', 2, 'X', undefined, 6); it.ench = 'sparerelic'; it.enchT = 2; HS.SAVE.equip = { hood: it }; HS.applyGear(true); o.spareRelic = HS.shardCount(); return o; });
  // Testaments: a drop on the ground is picked up; at the cap none drops.
  out.test = await p.evaluate(async () => { HS.SAVE.testaments = 3; HS.DEV.god = true; const P = HS.player; HS.maybeTestament(P.x + 10, P.y, 1); await new Promise((q) => setTimeout(q, 1500)); const got = HS.SAVE.testaments;
    HS.SAVE.testaments = HS.TEST_MAX; const n0 = HS.drops.length; HS.maybeTestament(P.x + 10, P.y, 1); return { got, atCap: HS.drops.length - n0 }; });
  // The dev menu still fits every label.
  await p.evaluate(() => { HS.SAVE.dev = true; HS.game.state = 'play'; HS.openDev ? HS.openDev() : null; });
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
