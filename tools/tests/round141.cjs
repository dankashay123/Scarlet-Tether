// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round141.cjs <outDir> [WxH]
// Round 141: a bag piece's card says what wearing it does to your Sanctity (IF WORN: SANCTITY A TO B), a better
// piece raises it and a worse one lowers it, wearing it shows a toast, and the bag has no text problems.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  out.vals = await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.SAVE.equip = {}; HS.SAVE.bag = [];
    for (const s of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) HS.SAVE.equip[s] = HS.makeItem(s, 2, 'X', ['dmg'], 8);
    HS.applyGear(true); const better = HS.makeItem('hood', 3, 'BETTER', ['dmg', 'crit', 'hp'], 12), worse = HS.makeItem('hood', 0, 'WORSE', [], 2);
    HS.SAVE.bag.push(better, worse); const now = HS.playerSanctity(); return { now, better: HS.sanctIfWorn(better), worse: HS.sanctIfWorn(worse), still: HS.playerSanctity() }; });
  await p.evaluate(() => { HS.openInventory(); HS.game.inv.sel = { from: 'bag', i: 0 }; }); await p.waitForTimeout(400);
  out.card = await p.evaluate(() => { const t = JSON.stringify(HS.textAudit()); return { line: /Sanctity [0-9,]+ to [0-9,]+/i.test(t), probs: HS.textProblems() }; });
  await p.screenshot({ path: `${S}/shots/r141-ifworn.png` });
  out.toast = await p.evaluate(() => { HS.equip(HS.SAVE.bag[0]); return HS.game.toast && HS.game.toast.msg; });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r141-equip-toast.png` });
  out.ok = out.vals.better > out.vals.now && out.vals.worse < out.vals.now && out.vals.still === out.vals.now && out.card.line && !out.card.probs.length && /^SANCTITY \d[\d,]* TO \d/.test(out.toast || '');
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
