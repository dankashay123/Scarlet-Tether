// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round38.cjs <outDir> [WxH]
// Round 38: ingredient pity (chance climbs per dry Warden, resets on a drop),
// enchant tier II (upgrade asks, spends a second set, stronger values), and
// the enchant card over the bag (from INGREDIENTS and from a worn piece).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n) => p.screenshot({ path: `${S}/shots/r38-${n}${tag}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  if (process.env.TEXT) await p.evaluate((t) => HS.setOpt('text', t), process.env.TEXT);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 12; HS.SAVE.gold = 20000; HS.SAVE.equip = { hood: HS.makeItem('hood', 2, 'GRAVE HOOD', undefined, 10) }; HS.applyGear(); });
  // Pity: 400 Warden kills at Station XI; dry streaks and chances.
  out.pity = await p.evaluate(() => {
    HS.SAVE.ingrDry = 0; const D = HS.DIFF[10]; let maxDry = 0, got = 0, dry = 0; const c0 = HS.ingrChance();
    for (let k = 0; k < 400; k++) { HS.drops.length = 0; HS.wardenMats({ x: 0, y: 0 }, D); const n = HS.drops.filter((d) => d.kind === 'ingr').length; got += n; maxDry = Math.max(maxDry, HS.SAVE.ingrDry); }
    HS.SAVE.ingrDry = 6; const c6 = HS.ingrChance(); HS.SAVE.ingrDry = 99; const cMax = HS.ingrChance(); HS.SAVE.ingrDry = 0; HS.drops.length = 0;
    return { perWarden: +(got / 400).toFixed(2), maxDry, c0, c6, cMax };
  });
  // Tier II: enchant, then upgrade with a second set.
  out.tier = await p.evaluate(() => {
    HS.openEnchant(); const N = HS.game.ench, L = HS.featLayout(), a = HS.ingrs(); for (let i = 0; i < a.length; i++) a[i] = 0; const e = HS.ENCHANTS.findIndex((q) => q.id === 'hunger');
    a[e * 3] = a[e * 3 + 1] = a[e * 3 + 2] = 2; N.item = 0; N.sel = e;
    HS.enchantTap(L.btnB.x + 4, L.btnB.y + 4); const t1 = HS.enchT('hunger');
    HS.enchantTap(L.btnB.x + 4, L.btnB.y + 4); const asked = HS.game.ask && HS.game.ask.msg; const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4);
    return { t1, asked, t2: HS.enchT('hunger'), left: [a[e * 3], a[e * 3 + 1], a[e * 3 + 2]], piece: HS.SAVE.equip.hood.enchT };
  });
  await p.waitForTimeout(200); await shot('enchanter-tier2'); out.tierText = await p.evaluate(() => HS.textProblems());
  // The enchant card from the bag: INGREDIENTS tab, then the worn piece.
  out.pop = await p.evaluate(() => {
    HS.game.state = 'play'; HS.openInventory(); HS.game.inv.tab = 2; const L = HS.invLayout(), cw = Math.floor((L.pw - 24 - 9) / 4);
    HS.invTap(L.x0 + 12 + 1 * (cw + 3) + 8, L.y0 + 40); const a = HS.game.enchPop && HS.game.enchPop.id; const t = HS.textProblems(); return { a, t };
  });
  await p.waitForTimeout(700); await shot('pop-ingredients');
  out.pop2 = await p.evaluate(() => {
    HS.onTap ? 0 : 0; HS.game.enchPop = null; HS.game.inv.tab = 0; HS.game.inv.sel = { from: 'equip', slot: 'hood' }; const L = HS.invLayout(); HS.invTap(L.card.x + 10, L.card.y + 20);
    return { id: HS.game.enchPop && HS.game.enchPop.id, tier: HS.game.enchPop && HS.game.enchPop.tier, t: HS.textProblems() };
  });
  await p.waitForTimeout(700); await shot('pop-worn');
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
