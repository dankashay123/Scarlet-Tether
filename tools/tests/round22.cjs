// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round22.cjs <outDir> [WxH]
// Round 22: every Hallowed piece has its own icon. Fills the bag with one of
// each, shows the bag, the altar list, the altar's memory and a ground drop.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const ctx = await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  const tag = WH[0] ? `-${WH[0]}` : '';
  const info = await p.evaluate(() => {
    HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play';
    HS.SAVE.bag = []; HS.SAVE.gold = 9999;
    for (const L of HS.LEGENDS) { const it = HS.makeItem(L.slot, 3, L.name, undefined, 3); it.power = L.id; HS.SAVE.bag.push(it); }
    HS.SAVE.altar = { known: HS.LEGENDS.filter((_, i) => i % 3).map((L) => L.id), sockets: { vest: 'pallWard' } }; HS.applyGear();
    return { n: HS.SAVE.bag.length, legends: HS.LEGENDS.length };
  });
  const shots = [['inv', () => HS.openInventory()], ['altar', () => HS.openAltar()], ['pick-vest', () => { HS.openAltar(); HS.openAltarPick('vest'); }], ['pick-arms', () => { HS.openAltar(); HS.openAltarPick('arms'); }], ['pick-relic', () => { HS.openAltar(); HS.openAltarPick('relic'); }]];
  for (const [name, fn] of shots) {
    const ok = await p.evaluate(`(() => { try { HS.game.state = 'play'; HS.game.altarPick = null; (${fn})(); return true; } catch (e) { return String(e); } })()`);
    if (ok !== true) errs.push(`${name}: ${ok}`);
    await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/r22-${name}${tag}.png` });
  }
  console.log(JSON.stringify(info));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
