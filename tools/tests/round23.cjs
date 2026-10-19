// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round23.cjs <outDir> [WxH]
// Round 23: the Plush stall (buy and wear a dye and a halo, the Saint and
// portrait recoloured), set piece icons in the bag, Hallowed twinkles on the
// ground, and every sound decoded (with the fire loop near the altar).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const dev = devices['iPhone 13 landscape'];
  const ctx = await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  const tag = WH[0] ? `-${WH[0]}` : '';
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.SAVE.gold = 5000; HS.SAVE.deaths = 6; });
  await p.mouse.click(300, 200); await p.waitForTimeout(2500);
  const out = {};
  out.audio = await p.evaluate(() => Object.keys(HS.AUDIO.buf).length);
  // The Plush stall.
  out.open = await p.evaluate(() => { HS.openSite(HS.SITES.find((q) => q.id === 'plush')); return HS.game.state; });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r23-plush-robes${tag}.png` });
  out.buy = await p.evaluate(() => {
    const G = HS.plushGeo(), tapIn = (r) => HS.plushTap(r.x + 4, r.y + 4);
    const i = HS.DYES.findIndex((q) => q.id === 'violet'); tapIn(G.row(i)); const g0 = HS.SAVE.gold; tapIn(G.btn);
    const dye = HS.looks().dye, paid = g0 - HS.SAVE.gold;
    tapIn(G.tabs[1]); const j = HS.HALOS.findIndex((q) => q.id === 'holy'); tapIn(G.row(j)); return { dye, paid, sel: HS.game.plush.sel };
  });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r23-plush-halos${tag}.png` });
  out.halo = await p.evaluate(() => { const G = HS.plushGeo(); HS.plushTap(G.btn.x + 4, G.btn.y + 4); HS.game.state = 'play'; return { halo: HS.looks().halo, sheet: HS.saintSheet() }; });
  // Walk the Saint to the altar: the fire loop should rise.
  out.fire = await p.evaluate(async () => { const A = HS.SITES.find((q) => q.id === 'altar'); HS.player.x = A.x + 30; HS.player.y = HS.room.top * 16 + A.dy + 20; await new Promise((r) => setTimeout(r, 900)); const t = HS.AUDIO.tracks.amb_fire; return t ? { on: t.on, lv: t.lv } : null; });
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/r23-town-look${tag}.png` });
  // Set pieces in the bag, Hallowed on the ground.
  await p.evaluate(() => {
    HS.SAVE.bag = [];
    for (const id of ['habit', 'nails', 'stride', 'font', 'confessor', 'choir']) for (const slot of ['hood', 'gloves', 'greaves']) { const it = HS.makeItem(slot, 4, 'X', undefined, 6); it.set = id; HS.SAVE.bag.push(it); }
    for (const id of ['nails', 'font']) { HS.SAVE.bag.push(HS.armsItem(id, 'bow', 6)); HS.SAVE.bag.push(HS.armsItem(id, 'quiver', 6)); }
    for (const L of HS.LEGENDS.slice(0, 6)) { const it = HS.makeItem(L.slot, 3, L.name, undefined, 3); it.power = L.id; HS.SAVE.bag.push(it); }
    HS.openInventory();
  });
  await p.waitForTimeout(500); await p.screenshot({ path: `${S}/shots/r23-bag-sets${tag}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; for (const e of HS.enemies) e.hp = 0; });
  await p.waitForTimeout(300);
  await p.evaluate(() => { HS.game.state = 'play'; for (let k = 0; k < 4; k++) { const L = HS.LEGENDS[k * 5], it = HS.makeItem(L.slot, 3, L.name, undefined, 3); it.power = L.id; HS.drops.push({ kind: 'item', item: it, x: HS.player.x - 60 + k * 40, y: HS.player.y + 40, z: 0, vx: 0, vy: 0, vz: 0, t: 0 }); } });
  await p.waitForTimeout(700); await p.screenshot({ path: `${S}/shots/r23-ground${tag}.png` });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
