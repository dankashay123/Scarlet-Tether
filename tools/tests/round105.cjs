// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round105.cjs <outDir> [WxH]
// Round 105: the bag's PETS tab (equip, a full kind is refused, follow, pages, the shop button), the 36 px pet sprites
// in the shop and beside the hero, four-piece defence (SETK.guard4) in setGuard and on the cards.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r105-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.SAVE.pets = HS.PETS.map((P) => P.id); HS.SAVE.petEq = null; HS.SAVE.indul = 900; HS.openInventory(); HS.game.inv.tab = 4; });
  await p.waitForTimeout(300);
  out.sprites = await p.evaluate(() => { const f = HS.SPR.pets.anims.tithecat[0]; return { w: f.w, h: f.h, hub: HS.hubTabs ? HS.hubTabs(HS.invLayout()).map((t) => t.id) : null }; });
  out.bag = await p.evaluate(() => { const L = HS.invLayout(), o = {}, tap = (r) => HS.invTap(r.x + 4, r.y + 4); let G = HS.petBagGeo(L); o.owned = G.list.length; o.pages = G.pages; o.per = G.per;
    tap(G.eq(0)); tap(G.eq(1)); const b2 = [...HS.petEq().battle]; tap(G.eq(2)); o.battle = b2; o.thirdRefused = HS.petEq().battle.join() === b2.join(); o.follower = HS.petShown();
    tap(G.fol(1)); o.follow2 = HS.petShown(); tap(G.eq(0)); o.afterUnequip = [...HS.petEq().battle];
    HS.game.inv.ppage = G.pages - 1; G = HS.petBagGeo(L); const last = G.list.length - 1 - (G.pages - 1) * G.per; tap(G.eq(last)); o.drop = [...HS.petEq().drop]; HS.game.inv.ppage = 0; return o; });
  await p.waitForTimeout(250); await check('bag-pets'); await shot('bag-pets');
  out.shopBtn = await p.evaluate(() => { const G = HS.petBagGeo(HS.invLayout()); HS.invTap(G.shop.x + 4, G.shop.y + 4); return HS.game.state; });
  await p.waitForTimeout(300); await check('shop'); await shot('shop');
  await p.evaluate(() => { HS.game.state = 'play'; HS.petEq().show = 'tithecat'; HS.PETF.on = false; }); await p.waitForTimeout(800); await shot('follower');
  // Four-piece defence: with four pieces on, damage taken is the set's guard4; the card says so.
  out.guard = await p.evaluate(() => { const o = {}; HS.SAVE.petEq = null; for (const [id, g] of Object.entries(HS.SETK.guard4)) { HS.SAVE.hero = HS.VSETS[id].hero || 'saint'; HS.SAVE.equip = {}; HS.applyGear(true); const k0 = HS.setGuard();
      for (const sl of HS.VSETS[id].slots.slice(0, 4)) { const it = HS.makeItem(sl, 4, 'X', undefined, 12); it.set = id; HS.SAVE.equip[sl] = it; } HS.applyGear(true);
      const k4 = +(HS.setGuard() / k0).toFixed(2), line = HS.VSETS[id].bonus.find((q) => q[0] === 4)[1]; if (Math.abs(k4 - g) > 0.011 || !line.includes(`TAKE ${Math.round((1 - g) * 100)}% LESS DAMAGE.`)) o[id] = [k4, g]; }
    return { sets: Object.keys(HS.SETK.guard4).length, wrong: o }; });
  for (const [hero, id] of [['saint', 'choir'], ['anchoress', 'psalter']]) { await p.evaluate(([hero, id]) => { HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.applyGear(); HS.game.state = 'play'; HS.openInventory(); const it = HS.makeItem(HS.VSETS[id].slots[0], 4, 'X', undefined, 12); it.set = id; HS.game.setPop = it; }, [hero, id]); await p.waitForTimeout(300); await check(`card-${id}`); await shot(`card-${id}`); await p.evaluate(() => { HS.game.setPop = null; HS.game.inv = null; }); }
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
