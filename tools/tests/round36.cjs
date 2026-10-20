// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round36.cjs <outDir> [WxH]
// Round 36: auto-roll aimed at one stat (odds shown, stops only on that stat
// at the quality), one ingredient back when an enchant is removed, and ITEMS
// rows that open the place each item is used.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n) => p.screenshot({ path: `${S}/shots/r36-${n}${tag}.png` });
  const probs = () => p.evaluate(() => HS.textProblems());
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 12; HS.SAVE.descents = 30; HS.SAVE.gold = 20000; HS.SAVE.embers = 20000; HS.SAVE.vkeys = 2; HS.SAVE.gifts = 1; HS.SAVE.devPts = 3;
    HS.SAVE.equip = {}; HS.SAVE.equip.hood = HS.makeItem('hood', 2, 'GRAVE HOOD', undefined, 10); HS.applyGear(); });
  // Aim at mythic DAMAGE on line 2, with the game sped up so it lands soon.
  out.auto = await p.evaluate(async () => {
    HS.game.state = 'play'; HS.openForge(); const F = HS.game.forge, L = HS.featLayout(), R = HS.autoRow(L), it = HS.SAVE.equip.hood; F.sel = 0; F.stat = 1;
    it.stats[1] = [it.stats.some((st) => st[0] === 'dmg') ? 'speed' : 'dmg', 3, 0]; if (it.stats[2] && it.stats[2][0] === 'dmg') it.stats[2][0] = 'gold';
    F.autoQ = 3; const K = HS.autoKeys(it, 1); while (F.autoKey !== 'dmg') HS.forgeTap(R.stat.x + R.stat.w - 3, R.stat.y + 4);
    const odds = HS.autoOdds(it, 1, 3, 'dmg');
    HS.forgeTap(R.go.x + 4, R.go.y + 4); const started = !!F.auto; let n = 0;
    // Drive the loop fast: pretend time passes (the real cadence is checked below).
    const t0 = performance.now(); while (F.auto && performance.now() - t0 < 15000) { F.auto.next = -1e9; HS.autoStep(F, [it]); n++; if (n > 30000) break; }
    return { keys: K.length, odds: +(1 / odds).toFixed(1), started, stopped: !F.auto, st: it.stats[1], rolls: HS.SAVE.embers ? 20000 - HS.SAVE.embers : 0 };
  });
  await p.evaluate(() => { const F = HS.game.forge; F.autoKey = 'dmg'; F.autoQ = 4; }); await p.waitForTimeout(200); await shot('forge-aim'); out['forge-aim'] = await probs();
  // Line 1 keeps its stat: the picker refuses.
  out.firstLine = await p.evaluate(() => { const F = HS.game.forge, L = HS.featLayout(), R = HS.autoRow(L); F.stat = 0; F.autoKey = null; HS.forgeTap(R.stat.x + 4, R.stat.y + 4); return { key: F.autoKey, toast: HS.game.toast && HS.game.toast.msg }; });
  // Remove an enchant: 5000 gold, one ingredient back.
  out.remove = await p.evaluate(() => {
    HS.game.state = 'play'; HS.SAVE.ingr = []; HS.ingrs(); HS.SAVE.equip.hood.ench = 'reaper'; HS.applyGear(); HS.openEnchant(); const N = HS.game.ench, L = HS.featLayout(); N.item = 0;
    const R = HS.enchRemoveBtn(L); HS.enchantTap(R.x + 4, R.y + 4); const msg = HS.game.ask && HS.game.ask.msg; const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4);
    const a = HS.ingrs(), e = HS.ENCHANTS.findIndex((q) => q.id === 'reaper');
    return { msg, ench: HS.SAVE.equip.hood.ench || null, gold: HS.SAVE.gold, back: [a[e * 3], a[e * 3 + 1], a[e * 3 + 2]], total: a.reduce((x, y) => x + y, 0) };
  });
  // ITEMS rows open their places.
  out.open = await p.evaluate(() => {
    const res = {}; const rows = HS.bagItemRows(0);
    rows.forEach((r, i) => { HS.game.state = 'play'; HS.openInventory(); HS.game.inv.tab = 1; const L = HS.invLayout(), q = HS.bagItemRect(L, i, rows.length); HS.invTap(q.x + 6, q.y + 6); res[r[1]] = HS.game.state; });
    return res;
  });
  await p.evaluate(() => { HS.game.state = 'play'; HS.openInventory(); HS.game.inv.tab = 1; }); await p.waitForTimeout(200); await shot('bag-items'); out['bag-items'] = await probs();
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
