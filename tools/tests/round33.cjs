// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round33.cjs <outDir> [WxH]
// Round 33: reforge qualities (odds, ranges, colours), the VALUES tab,
// Emberstones and ingredients from Wardens, the Enchanter, and every enchant
// worn in a fight (no errors), Second Breath and Bone Ward. TEXT=large sets
// the text size first.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n) => p.screenshot({ path: `${S}/shots/r33-${n}${tag}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2000);
  if (process.env.TEXT) await p.evaluate((t) => HS.setOpt('text', t), process.env.TEXT);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 12; HS.SAVE.gold = 99999; HS.SAVE.embers = 2000;
    const it = HS.makeItem('gloves', 2, 'ASHEN GLOVES', undefined, 10); HS.SAVE.equip.gloves = it; HS.applyGear(); });
  // Reforge 1,500 times: the odds and that every value sits in its range.
  out.reforge = await p.evaluate(() => {
    HS.openForge(); const L = HS.featLayout(), c = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }; let bad = 0;
    const items = [HS.SAVE.equip.hood, HS.SAVE.equip.mantle, HS.SAVE.equip.gloves].filter(Boolean); HS.game.forge.sel = 0;
    const it = (() => { const sl = ['hood', 'mantle', 'gloves', 'girdle', 'rosary', 'seal', 'relic', 'greaves', 'bow', 'quiver']; return sl.map((s) => HS.SAVE.equip[s]).filter(Boolean)[0]; })();
    HS.game.forge.stat = it.stats.length > 1 ? 1 : 0;
    for (let k = 0; k < 1500; k++) { HS.forgeTap(L.btnA.x + 4, L.btnA.y + 4); const st = it.stats[HS.game.forge.stat]; c[st[2]]++; const [a, b] = HS.qualRange(st[0], it.ri, st[2]); if (st[1] < a || st[1] > b) bad++; }
    void items; return { pct: Object.fromEntries(Object.entries(c).map(([q, n]) => [HS.QUALITY[q].name, +(n / 15).toFixed(1)])), bad, left: HS.SAVE.embers };
  });
  await p.waitForTimeout(300); await shot('forge');
  await p.evaluate(() => { HS.game.forge.tab = 1; }); await p.waitForTimeout(200); await shot('forge-values');
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.embers = 0; HS.openForge(); }); await p.waitForTimeout(150); await shot('forge-none');
  // Warden drops: Emberstones per Station, ingredients only from Station X.
  out.mats = await p.evaluate(() => {
    const D = HS.DIFF, res = {};
    for (const i of [0, 4, 8, 9, 14]) { HS.drops.length = 0; let ing = 0, emb = 0; for (let k = 0; k < 400; k++) { HS.wardenMats({ x: 0, y: 0 }, D[i]); } for (const d of HS.drops) { if (d.kind === 'ember') emb++; if (d.kind === 'ingr') ing++; } res[D[i].rn] = { embers: emb / 400, ingrPerKill: +(ing / 400).toFixed(2) }; }
    HS.drops.length = 0; res.vigil20 = (() => { HS.wardenMats({ x: 0, y: 0 }, { n: 10, vigil: 20 }); return HS.drops.filter((d) => d.kind === 'ember').length; })(); HS.drops.length = 0;
    return res;
  });
  // The Enchanter: no ingredients, then all, then enchant a piece.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.ingr = []; HS.openEnchant(); }); await p.waitForTimeout(200); await shot('ench-empty');
  out.ench = await p.evaluate(() => {
    const a = HS.ingrs(); for (let i = 0; i < a.length; i++) a[i] = i % 4 === 0 ? 0 : 2;
    a[6] = a[7] = a[8] = 1; HS.game.ench.sel = 2; const L = HS.featLayout();
    HS.enchantTap(L.btnA.x + 4, L.btnA.y + 4); // choose a piece
    const pickMode = HS.game.ench.pick; HS.game.ench.item = 0; HS.game.ench.pick = false;
    HS.enchantTap(L.btnB.x + 4, L.btnB.y + 4);
    const it = HS.SAVE.equip.hood || Object.values(HS.SAVE.equip).filter(Boolean)[0];
    return { pickMode, ench: [HS.SAVE.equip.hood, HS.SAVE.equip.mantle, HS.SAVE.equip.gloves].filter(Boolean).map((q) => q.ench || null), worn: [...HS.G.ench], left: [a[6], a[7], a[8]] , it: !!it };
  });
  await p.waitForTimeout(200); await shot('ench');
  await p.evaluate(() => { HS.game.ench.pick = true; }); await p.waitForTimeout(150); await shot('ench-pick');
  await p.evaluate(() => { HS.game.state = 'inv'; HS.openInventory && HS.openInventory(); }); await p.waitForTimeout(250); await shot('bag');
  // Every enchant in a fight (two batches of eight), god mode, in a crowd.
  const ids = await p.evaluate(() => HS.ENCHANTS.map((E) => E.id));
  out.fight = [];
  for (const batch of [ids.slice(0, 8), ids.slice(8)]) {
    await p.evaluate((batch) => {
      const sl = ['hood', 'mantle', 'gloves', 'girdle', 'rosary', 'seal', 'relic', 'greaves', 'bow', 'quiver'];
      sl.forEach((s, i) => { const it = HS.SAVE.equip[s] || (HS.SAVE.equip[s] = HS.makeItem(s, 1, 'TEST', undefined, 10)); it.ench = batch[i] || null; });
      HS.game.nextStratum = 1; HS.game.nextDiff = 9; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.applyGear(true);
      const P = HS.player; for (let k = 0; k < 30; k++) HS.spawnMonster(k % 3 ? 'risen' : 'knight', P.x + 60 + Math.random() * 140, P.y - 60 + Math.random() * 120, { room: HS.game.curRoom && HS.game.curRoom.id });
      window.__k0 = HS.game.kills;
    }, batch);
    for (let t = 0; t < 8; t++) { await p.evaluate(() => { HS.input.m1 = true; HS.input.dash = true; }); await p.waitForTimeout(1000); }
    out.fight.push(await p.evaluate(() => ({ ench: [...HS.G.ench], kills: HS.game.kills - window.__k0, hp: Math.round(HS.player.hp) })));
    await shot(`fight-${out.fight.length}`);
  }
  // Second Breath and Bone Ward, without god mode.
  out.breath = await p.evaluate(() => {
    HS.SAVE.equip.hood.ench = 'breath'; HS.SAVE.equip.mantle.ench = 'boneward'; HS.applyGear(true); HS.DEV.god = false; HS.game.run.breath = false;
    const P = HS.player; P.wardT = 0; P.iframes = 0; const h0 = P.hp; HS.damagePlayer ? 0 : 0;
    P.hp = 5; HS.hurtPlayerRaw(9999); const after = P.hp, state = HS.game.state; HS.DEV.god = true;
    return { h0, after, state, used: HS.game.run.breath, max: P.maxHp };
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
