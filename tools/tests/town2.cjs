// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/town2.cjs <outDir>
// The town features: Pell's curio stall, the Ember Forge, the Canonry.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1000);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.descents = 3; HS.SAVE.cleared = 2; HS.SAVE.gold = 9000; HS.SAVE.shop = null; });
  // Shop: buy the first piece.
  await p.evaluate(() => HS.openShop()); await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/s1-shop.png` });
  const before = await p.evaluate(() => [HS.SAVE.gold, HS.SAVE.bag.length + Object.values(HS.SAVE.equip).filter(Boolean).length]);
  await p.evaluate(() => { const L = HS.featLayout(); HS.shopTap(L.btnA.x + 5, L.btnA.y + 5); }); await p.waitForTimeout(200);
  const after = await p.evaluate(() => [HS.SAVE.gold, HS.SAVE.bag.length + Object.values(HS.SAVE.equip).filter(Boolean).length, HS.SAVE.shop.items.map((i) => `${i.ri}:${i.il}:${i.price}${i.sold ? 'S' : ''}`).join(' ')]);
  console.log('shop', JSON.stringify(before), JSON.stringify(after));
  await p.screenshot({ path: `${S}/shots/s2-bought.png` });
  // Forge: reforge stat 1, then temper.
  await p.evaluate(() => { HS.game.state = 'play'; HS.openForge(); }); await p.waitForTimeout(250);
  const it0 = await p.evaluate(() => JSON.stringify([HS.game.forge.sel, (() => { const it = [...Object.values(HS.SAVE.equip).filter(Boolean), ...HS.SAVE.bag][0]; return it && { il: it.il, stats: it.stats }; })()]));
  await p.evaluate(() => { const L = HS.featLayout(); HS.forgeTap(L.btnA.x + 5, L.btnA.y + 5); HS.forgeTap(L.btnB.x + 5, L.btnB.y + 5); }); await p.waitForTimeout(250);
  const it1 = await p.evaluate(() => { const it = [...['hood', 'mantle', 'gloves', 'girdle', 'rosary', 'seal', 'relic', 'greaves'].map((s) => HS.SAVE.equip[s]).filter(Boolean), ...HS.SAVE.bag][0]; return it && JSON.stringify({ il: it.il, stats: it.stats, reforged: it.reforged }); });
  console.log('forge', it0, '->', it1, 'gold', await p.evaluate(() => HS.SAVE.gold));
  await p.screenshot({ path: `${S}/shots/s3-forge.png` });
  // Canonry: gain Devotion, spend a point on Might.
  await p.evaluate(() => { HS.game.state = 'play'; HS.gainSaintXp(20000); HS.openCanonry(); }); await p.waitForTimeout(200);
  await p.evaluate(() => { const L = HS.talLayout(), r = L.cell(0, 0, 2); HS.canonryTap(r.x + 4, r.y + 4); HS.canonryTap(L.learn.x + 4, L.learn.y + 4); }); await p.waitForTimeout(200);
  console.log('canonry', await p.evaluate(() => JSON.stringify({ lvl: HS.saintLv(), pts: HS.talPts(), might: HS.tal('might'), dmg: HS.G.dmg })));
  await p.screenshot({ path: `${S}/shots/s4-canonry.png` });
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
