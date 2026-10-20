// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round35.cjs <outDir> [WxH]
// Round 35: the bag's ITEMS and INGREDIENTS tabs; reforge asks before losing
// a legendary or mythic stat; auto-roll (3 a second, stops at its target,
// asks first on a kept roll); the Enchanter's replace, twin and remove
// warnings; Vigils to 200 with -10/+10 buttons.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n) => p.screenshot({ path: `${S}/shots/r35-${n}${tag}.png` });
  const probs = () => p.evaluate(() => HS.textProblems());
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 12; HS.SAVE.gold = 20000; HS.SAVE.embers = 3000; HS.SAVE.vkeys = 4; HS.SAVE.chrism = [3, 2, 1, 0]; HS.SAVE.devPts = 2; HS.SAVE.gifts = 1;
    const a = HS.ingrs(); for (let i = 0; i < a.length; i++) a[i] = i % 5 ? 2 : 0;
    HS.SAVE.equip.gloves = HS.makeItem('gloves', 2, 'ASHEN GLOVES', undefined, 10); HS.SAVE.equip.hood = HS.makeItem('hood', 2, 'GRAVE HOOD', undefined, 10); HS.applyGear(); });
  // The bag's tabs.
  for (const [i, n] of [[1, 'bag-items'], [2, 'bag-ingredients']]) { await p.evaluate((i) => { HS.openInventory(); HS.game.inv.tab = i; }, i); await p.waitForTimeout(200); await shot(n); out[n] = await probs(); }
  out.tabTap = await p.evaluate(() => { HS.game.state = 'play'; HS.openInventory(); const L = HS.invLayout(); const t = HS.invTabs(L)[2]; HS.invTap(t.x + 4, t.y + 4); return HS.game.inv.tab; });
  // Reforge: a legendary stat asks first; YES rerolls it.
  out.reforge = await p.evaluate(() => {
    HS.game.state = 'play'; HS.openForge(); const F = HS.game.forge, L = HS.featLayout(), it = HS.SAVE.equip.hood; F.sel = 0; F.stat = 1;
    const items = [HS.SAVE.equip.hood, HS.SAVE.equip.gloves]; void items;
    const target = [HS.SAVE.equip.hood, HS.SAVE.equip.gloves].find((q) => q === HS.forgeItemsFor && 0) || null; void target;
    const cur = () => { const list = ['hood', 'mantle', 'gloves', 'girdle', 'rosary', 'seal', 'relic', 'greaves', 'bow', 'quiver'].map((s) => HS.SAVE.equip[s]).filter(Boolean); return list[F.sel]; };
    const piece = cur(); piece.stats[1] = [piece.stats[1][0], 20, 3];
    const e0 = HS.SAVE.embers; HS.forgeTap(L.btnA.x + 4, L.btnA.y + 4);
    const asked = !!HS.game.ask, spentBefore = e0 - HS.SAVE.embers;
    const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4);
    return { asked, spentBefore, spentAfter: e0 - HS.SAVE.embers, askGone: !HS.game.ask, q: piece.stats[1][2] };
  });
  await p.evaluate(() => { const piece = ['hood', 'mantle', 'gloves'].map((s) => HS.SAVE.equip[s]).filter(Boolean)[0]; piece.stats[1] = [piece.stats[1][0], 30, 4]; const L = HS.featLayout(); HS.forgeTap(L.btnA.x + 4, L.btnA.y + 4); });
  await p.waitForTimeout(150); await shot('forge-ask'); out['forge-ask'] = await probs();
  await p.evaluate(() => { HS.game.ask = null; });
  // Auto-roll to EPIC: about three rolls a second, stops on epic or better.
  out.auto = await p.evaluate(async () => {
    const F = HS.game.forge, L = HS.featLayout(), R = HS.autoRow(L), piece = ['hood', 'mantle', 'gloves'].map((s) => HS.SAVE.equip[s]).filter(Boolean)[0];
    piece.stats[1] = [piece.stats[1][0], 3, 0]; F.autoQ = 2; HS.forgeTap(R.go.x + 4, R.go.y + 4);
    const t0 = performance.now(); let n = 0; while (HS.game.forge.auto && performance.now() - t0 < 20000) { n = HS.game.forge.auto.n; await new Promise((r) => setTimeout(r, 100)); }
    const secs = (performance.now() - t0) / 1000;
    return { stopped: !HS.game.forge.auto, q: piece.stats[1][2], rolls: n + 1, perSec: +((n + 1) / secs).toFixed(2) };
  });
  out.autoMythicAsk = await p.evaluate(() => { const F = HS.game.forge, L = HS.featLayout(), R = HS.autoRow(L), piece = ['hood', 'mantle', 'gloves'].map((s) => HS.SAVE.equip[s]).filter(Boolean)[0]; piece.stats[1] = [piece.stats[1][0], 30, 4]; F.autoQ = 4; HS.forgeTap(R.go.x + 4, R.go.y + 4); const asked = !!HS.game.ask; HS.game.ask = null; return { asked, running: !!F.auto }; });
  await p.evaluate(() => { const F = HS.game.forge, L = HS.featLayout(), R = HS.autoRow(L), piece = ['hood', 'mantle', 'gloves'].map((s) => HS.SAVE.equip[s]).filter(Boolean)[0]; piece.stats[1] = [piece.stats[1][0], 3, 0]; F.autoQ = 4; HS.forgeTap(R.go.x + 4, R.go.y + 4); });
  await p.waitForTimeout(1200); await shot('forge-auto'); out['forge-auto'] = await probs();
  out.stop = await p.evaluate(() => { const L = HS.featLayout(), R = HS.autoRow(L); HS.forgeTap(R.go.x + 4, R.go.y + 4); return !HS.game.forge.auto; });
  // The Enchanter: replace and twin warnings, then remove for 5000 gold.
  out.ench = await p.evaluate(() => {
    HS.game.state = 'play'; HS.openEnchant(); const N = HS.game.ench, L = HS.featLayout(), a = HS.ingrs(); for (let i = 0; i < a.length; i++) a[i] = 3;
    const list = ['hood', 'mantle', 'gloves', 'girdle', 'rosary', 'seal', 'relic', 'greaves', 'bow', 'quiver'].map((s) => HS.SAVE.equip[s]).filter(Boolean);
    list[0].ench = 'hunger'; list[1].ench = 'reaper'; HS.applyGear();
    N.item = 0; N.sel = 3; HS.enchantTap(L.btnB.x + 4, L.btnB.y + 4); const msg = HS.game.ask && HS.game.ask.msg; const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4);
    const after = list[0].ench;
    const R = HS.enchRemoveBtn(L), g0 = HS.SAVE.gold; HS.enchantTap(R.x + 4, R.y + 4); const msg2 = HS.game.ask && HS.game.ask.msg;
    return { msg, after, msg2, list: list.map((q) => q.ench), g0 };
  });
  await p.waitForTimeout(150); await shot('ench-remove-ask'); out['ench-ask'] = await probs();
  out.remove = await p.evaluate(() => { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); const list = ['hood', 'mantle', 'gloves'].map((s) => HS.SAVE.equip[s]).filter(Boolean); return { ench: list[0].ench || null, gold: HS.SAVE.gold }; });
  await p.waitForTimeout(150); await shot('ench-after');
  // Vigils to 200.
  out.vigil = await p.evaluate(() => {
    HS.SAVE.vigilOpen = HS.VIGIL_MAX; HS.game.state = 'play'; HS.openVigil(); const L = HS.descentLayout(), J = HS.vigilJumps(L), P = HS.game.vigilPick; P.L = 1;
    HS.vigilTap(J.up.x, J.up.y); const up = P.L; HS.vigilTap(J.down.x, J.down.y); const down = P.L; P.L = 200;
    const d = HS.vigilDiff(200), d30 = HS.vigilDiff(30), d100 = HS.vigilDiff(100);
    return { up, down, max: HS.VIGIL_MAX, hp30: Math.round(d30.hp), hp100: Math.round(d100.hp), hp200: Math.round(d.hp), dmg200: Math.round(d.dmg), dens200: d.dens };
  });
  await p.waitForTimeout(150); await shot('vigil-200'); out['vigil'] = { ...out.vigil, text: await probs() };
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
