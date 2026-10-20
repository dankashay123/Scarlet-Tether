// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round37.cjs <outDir> [WxH]
// Round 37: the forge's BUY tab (prices, asks before packs, gold spent) and
// every enchant's card at the Enchanter.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n, clip) => p.screenshot({ path: `${S}/shots/r37-${n}${tag}.png`, clip });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  if (process.env.TEXT) await p.evaluate((t) => HS.setOpt('text', t), process.env.TEXT);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 12; HS.SAVE.gold = 30000; HS.SAVE.embers = 5; HS.SAVE.equip = { hood: HS.makeItem('hood', 2, 'GRAVE HOOD', undefined, 10) }; HS.applyGear(); });
  // BUY tab.
  out.buy = await p.evaluate(() => {
    HS.openForge(); HS.game.forge.tab = 2; const L = HS.featLayout(); const r = (i) => HS.emberBuyRow(L, i);
    HS.forgeBuyTap(L, r(0).x + 5, r(0).y + 5); const one = { embers: HS.SAVE.embers, gold: HS.SAVE.gold };
    HS.forgeBuyTap(L, r(1).x + 5, r(1).y + 5); const asked = !!HS.game.ask; const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4);
    HS.forgeBuyTap(L, r(2).x + 5, r(2).y + 5); const poor = !HS.game.ask;
    return { one, asked, ten: { embers: HS.SAVE.embers, gold: HS.SAVE.gold }, poor, problems: HS.textProblems() };
  });
  await p.waitForTimeout(150); await shot('forge-buy');
  // Every enchant's preview.
  await p.evaluate(() => { HS.game.state = 'play'; HS.openEnchant(); HS.game.ench.item = 0; });
  out.ench = [];
  for (let i = 0; i < 16; i++) {
    const box = await p.evaluate((i) => { HS.game.ench.sel = i; const L = HS.featLayout(), vp = HS.toLocal ? null : null; void vp; return { card: L.card, problems: HS.textProblems() }; }, i);
    if (box.problems.length) out.ench.push([i, box.problems]);
    await p.waitForTimeout(650);
    const k = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { sx: r.width / HS.W, sy: r.height / HS.H, ox: r.left, oy: r.top }; });
    const c = box.card; await shot(`prev-${String(i).padStart(2, '0')}`, { x: k.ox + c.x * k.sx, y: k.oy + c.y * k.sy, width: c.w * k.sx, height: Math.min(c.h, 140) * k.sy });
  }
  await shot('enchant');
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
