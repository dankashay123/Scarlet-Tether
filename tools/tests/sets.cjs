// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/sets.cjs <outDir>
// The vestment sets: Odile's Gift, each set's skin and card, and each set's
// bonuses in a fight.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1000);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.SAVE.cleared = 5; HS.SAVE.gifts = 1; HS.SAVE.bag = []; });
  // Odile's Gift: take two pieces of the Drowned Font.
  await p.evaluate(() => HS.openGift()); await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/g1-gift.png` });
  await p.evaluate(() => { const r = HS.giftRow(HS.featLayout(), 2); HS.giftTap(r.x + r.w - 30, r.y + 10); }); await p.waitForTimeout(200);
  console.log('gift', await p.evaluate(() => JSON.stringify({ gifts: HS.SAVE.gifts, got: [...HS.SAVE.bag, ...Object.values(HS.SAVE.equip)].filter((it) => it && it.set === 'font').map((it) => it.slot) })));
  for (const id of ['nails', 'stride', 'font', 'confessor', 'choir']) {
    // Wear the whole set.
    await p.evaluate((id) => {
      HS.game.state = 'play'; HS.SAVE.equip = {}; HS.SAVE.bag = [];
      for (const sl of HS.VSETS[id].slots) { const it = HS.makeItem(sl, 4, `${HS.VSETS[id].piece} ${sl.toUpperCase()}`, undefined, 6); it.set = id; it.isNew = false; HS.SAVE.equip[sl] = it; }
      HS.applyGear(true);
    }, id);
    const info = await p.evaluate((id) => JSON.stringify({ skin: HS.G.skin, sheet: HS.saintSheet(), n: HS.G.sets[id], charges: HS.G.charges }), id);
    await p.evaluate(() => { HS.openInventory(); HS.game.inv.sel = { from: 'equip', slot: Object.keys(HS.SAVE.equip)[0] }; }); await p.waitForTimeout(250);
    await p.screenshot({ path: `${S}/shots/s-${id}-card.png` });
    // Fight with it.
    await p.evaluate(() => { HS.game.state = 'play'; HS.game.nextDiff = 4; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e6; });
    await p.waitForTimeout(300);
    const seen = {};
    for (let k = 0; k < 16; k++) {
      await p.evaluate((k) => {
        const P = HS.player, r = HS.game.curRoom;
        if (HS.game.state === 'stig') { HS.game.run.pending = 0; HS.game.state = 'play'; }
        if (HS.enemies.filter((e) => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 150).length < 10) for (let i = 0; i < 5; i++) HS.spawnMonster(['risen', 'acolyte', 'crawler', 'flagellant'][i % 4], P.x + 40 + Math.random() * 60, P.y + (Math.random() - 0.5) * 60, { room: r && r.id });
        P.m1cd = 0; P.m2cd = 0; HS.input.m1 = true; HS.input.m2 = true; if (k % 3 === 0) { HS.input.dash = true; HS.input.mx = k % 2 ? 1 : -1; } else HS.input.mx = 0;
        if (k === 4) { P.penance = 999; HS.input.pen = true; HS.game.fervor = 100; }
      }, k);
      await p.waitForTimeout(250);
      const st = await p.evaluate(() => ({ nails: HS.player.nails || 0, stride: (HS.player.strideT || 0) > HS.game.time, pool: !!HS.player.inPool, bound: HS.game.boundN || 0, rain: HS.player.rainT > 0, fervor: Math.round(HS.game.fervor), guard: +HS.setGuard().toFixed(2), trail: HS.skillFx.some((f) => f.kind === 'trail') }));
      for (const [key, v] of Object.entries(st)) if (v && v !== 1) seen[key] = Math.max(seen[key] || 0, +v);
      if (k === 6) await p.screenshot({ path: `${S}/shots/s-${id}-fight.png` });
    }
    console.log(id, info, JSON.stringify(seen));
    await p.evaluate(() => HS.enterTown()); await p.waitForTimeout(300);
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
