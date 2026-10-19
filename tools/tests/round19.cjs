// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round19.cjs <outDir>
// Round 19: altar odds on every row, the pity bonus, grinding three
// Hallowed pieces into a Chrism, the burn animations, and what a Vigil pays
// (Chrism, a set piece from Vigil 12, a Hallowed Chrism from Vigil 20).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async (w, h, url) => { const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage(); p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(`http://localhost:8123/${url}`); await p.waitForTimeout(1200); return p; };
  const p = await page(844, 390, '?town');
  const fill = () => p.evaluate(() => { HS.tut.on = false; HS.SAVE.bag = []; HS.SAVE.gold = 20000; HS.SAVE.chrism = [1, 1, 1, 1]; HS.SAVE.altarPity = 0; HS.SAVE.altar = { known: ['veilFont'], sockets: {} };
    for (const id of ['stormHands', 'emberQuiver', 'saintTooth', 'veilFont', 'pallWard', 'chainHands']) { const L = HS.LEGENDS.find((q) => q.id === id); const it = HS.makeItem(L.slot, 3, L.name, undefined, 2 + (id.length % 5)); it.power = id; HS.SAVE.bag.push(it); } HS.openAltar(); });
  await fill(); await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r19-rows.png` });
  // Pity: two failures raise the next burn by 10%.
  const pity = await p.evaluate(() => { const out = { base: HS.burnChance(-1) }; for (let k = 0; k < 2; k++) { const it = HS.SAVE.bag.find((q) => !HS.SAVE.altar.known.includes(q.power)); HS.game.altarSel = it.id; HS.game.altarChrism = -1; HS.burnAtAltar(it, 0.99); HS.game.altarFx = null; } out.after2 = HS.burnChance(-1); out.pity = HS.SAVE.altarPity;
    const it = HS.SAVE.bag.find((q) => !HS.SAVE.altar.known.includes(q.power)); HS.game.altarSel = it.id; out.win = HS.burnAtAltar(it, 0.01); out.reset = HS.SAVE.altarPity; return out; });
  await p.waitForTimeout(450); await p.screenshot({ path: `${S}/shots/r19-fx-flame.png` }); await p.waitForTimeout(700); await p.screenshot({ path: `${S}/shots/r19-fx-win.png` });
  await p.waitForTimeout(2000);
  await fill(); await p.evaluate(() => { const it = HS.SAVE.bag.find((q) => q.power === 'pallWard'); HS.game.altarSel = it.id; HS.burnAtAltar(it, 0.99); });
  await p.waitForTimeout(900); await p.screenshot({ path: `${S}/shots/r19-fx-ash.png` });
  await p.waitForTimeout(2000);
  // Grind: learned pieces go first.
  await fill(); await p.waitForTimeout(100);
  const grind = await p.evaluate(() => { const n0 = HS.SAVE.bag.length, c0 = HS.SAVE.chrism.reduce((a, b) => a + b, 0); const tier = HS.grindAtAltar(0.5); return { tier, used: n0 - HS.SAVE.bag.length, chrism: HS.SAVE.chrism.reduce((a, b) => a + b, 0) - c0, learnedGone: !HS.SAVE.bag.some((q) => q.power === 'veilFont') }; });
  await p.waitForTimeout(900); await p.screenshot({ path: `${S}/shots/r19-fx-grind.png` });
  await p.waitForTimeout(2000);
  const tierSpread = await p.evaluate(() => { const n = [0, 0, 0, 0]; for (let k = 0; k < 1000; k++) { HS.SAVE.bag = []; for (let j = 0; j < 3; j++) { const it = HS.makeItem('gloves', 3, 'X', undefined, 1); it.power = 'stormHands'; HS.SAVE.bag.push(it); } n[HS.grindAtAltar()]++; } HS.game.altarFx = null; return n; });
  console.log('altar', JSON.stringify({ pity, grind, tierSpread }));
  // The Vigil panel at two sizes.
  for (const L of [6, 22]) { await p.evaluate((L) => { HS.game.state = 'play'; HS.SAVE.vigilOpen = 30; HS.SAVE.vkeys = 1; HS.openVigil(); HS.game.vigilPick.L = L; }, L); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r19-vigil-${L}.png` }); }
  // What a Vigil Warden pays at levels 6, 12 and 20.
  const pay = await p.evaluate(async () => {
    const out = {};
    for (const L of [6, 12, 20]) {
      HS.game.state = 'play'; HS.beginVigil(L); await new Promise((r) => setTimeout(r, 2600)); HS.tut.on = false;
      const sets = [], hall = []; let chrism = 0;
      for (let k = 0; k < 20; k++) { HS.drops.length = 0; HS.vigilPayout(HS.player, L); sets.push(HS.drops.some((d) => d.kind === 'item' && d.item.ri === 4 && d.item.set)); hall.push(HS.drops.some((d) => d.kind === 'chrism' && d.tier === 3)); chrism += HS.drops.filter((d) => d.kind === 'chrism').length; }
      out[L] = { set: sets.filter(Boolean).length, hallowed: hall.filter(Boolean).length, chrismPer20: chrism, n: HS.curDiff().n };
    }
    return out;
  });
  console.log('vigil pay', JSON.stringify(pay));
  await p.close();
  const q = await page(667, 375, '?town');
  await q.evaluate(() => { HS.tut.on = false; HS.SAVE.vigilOpen = 30; HS.SAVE.vkeys = 2; HS.openVigil(); HS.game.vigilPick.L = 22; }); await q.waitForTimeout(200); await q.screenshot({ path: `${S}/shots/r19-vigil-small.png` });
  await q.evaluate(() => { HS.game.state = 'play'; HS.SAVE.bag = []; HS.SAVE.gold = 900; HS.SAVE.chrism = [0, 2, 0, 0]; for (const id of ['stormHands', 'emberQuiver', 'saintTooth', 'pallWard']) { const L = HS.LEGENDS.find((x) => x.id === id); const it = HS.makeItem(L.slot, 3, L.name, undefined, 3); it.power = id; HS.SAVE.bag.push(it); } HS.openAltar(); });
  await q.waitForTimeout(200); await q.screenshot({ path: `${S}/shots/r19-altar-small.png` });
  await q.close();
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
