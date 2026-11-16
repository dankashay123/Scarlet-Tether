// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round133.cjs <outDir> [WxH]
// Round 133: a set piece's card in Pell's stall ends in TAP THE CARD FOR THE FULL SET and a tap opens the set; pet clocks
// (the White Lamb's next heal) as buff icons; the Vesper's storm icon (photo).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2000);
  // The stall: a Drowned Font hood; its card ends in the tap line; a tap on the card opens the set.
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.openShop(); const it = HS.makeItem('hood', 4, "FONT-KEEPER'S HOOD", undefined, 8); it.set = 'font'; it.price = 100; HS.SAVE.shop.items[0] = it; HS.game.shop.sel = 0; });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r133-stall-card.png` });
  out.stallText = await p.evaluate(() => HS.textProblems().length);
  const pt = await p.evaluate(() => { const L = HS.featLayout(), c = document.getElementById('screen').getBoundingClientRect(), k = c.width / HS.W; return { x: c.left + (L.card.x + L.card.w / 2) * k, y: c.top + (L.btnA.y - 22) * k }; });
  await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(250);
  out.setPop = await p.evaluate(() => !!HS.game.setPop && HS.game.setPop.set);
  await p.screenshot({ path: `${S}/shots/r133-stall-set.png` }); out.popText = await p.evaluate(() => HS.textProblems().length);
  // Pet clocks: the White Lamb equipped shows its icon with the time to its next heal.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  out.pet = await p.evaluate(async () => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = 'saint'; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0;
    HS.SAVE.petEq = { battle: ['lamb', 'bellcrow'], drop: [null, null], show: 'lamb' }; await new Promise((r) => setTimeout(r, 1200)); const L = HS.activeBuffs(); const q = L.find((x) => x.B.id === 'pet_lamb');
    return { lamb: q ? +q.left.toFixed(1) : null, crow: L.some((x) => x.B.id === 'pet_bellcrow') }; });
  await p.screenshot({ path: `${S}/shots/r133-pet-clock.png`, clip: { x: 0, y: 0, width: 300, height: 170 } });
  out.ok = out.setPop === 'font' && !out.stallText && !out.popText && out.pet.lamb > 0 && out.pet.lamb <= 4 && out.pet.crow;
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
