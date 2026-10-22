// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round27.cjs <outDir> [WxH]
// Round 27: the Reliquary's horde (waves of 20-30, 100 kills), passives
// (the tab, slots by Devotion, the dash nail), brighter rite effects,
// rarity-coloured bag cells with a star on set pieces, lower drop rates.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const ctx = await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {};
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(800);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.DEV.god = true; });
  // The Reliquary: one wave of 20-30 at once, 100 to kill.
  out.relic = await p.evaluate(async () => {
    const P = HS.player, rel = { x: P.x + 40, y: P.y, frame: 0 }; for (const e of HS.enemies) if (Math.hypot(e.x - P.x, e.y - P.y) < 400) e.dead = true;
    HS.startReliquary(rel); await new Promise((r) => setTimeout(r, 400));
    const n = HS.enemies.filter((e) => e.relic && !e.dead).length; return { need: HS.game.event.need, wave: n, time: HS.game.event.t | 0 };
  });
  await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/shots/r27-relic${tag}.png` });
  await p.evaluate(() => { for (const e of HS.enemies) if (e.relic) e.dead = true; HS.game.event = null; });
  // Passives: the tab, then Answering Nail on.
  await p.evaluate(() => { HS.SAVE.lvl = 12; HS.SAVE.passives = ['answer', 'hide', null]; HS.openRites('play'); HS.game.riteFocus = 'passive'; HS.game.passSel = 'answer'; });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r27-passives${tag}.png` });
  out.pass = await p.evaluate(async () => {
    HS.game.state = 'play'; HS.applyGear(); const P = HS.player;
    const m = HS.spawnMonster('risen', P.x + 120, P.y, {}); m.hp = m.maxHp = 1e6; await new Promise((r) => setTimeout(r, 1200));
    HS.bolts.length = 0; HS.input.mx = 0; HS.input.my = 1; HS.input.dash = true; await new Promise((r) => setTimeout(r, 60));
    const nail = HS.bolts.find((q) => q.dmgK === 0.75);
    return { slot3Open: HS.saintLv() >= 25, answer: HS.pas('answer'), hide: HS.pas('hide'), nail: !!nail };
  });
  // Brighter casts: the Ward's shield and a Reckoning's aura.
  await p.evaluate(() => { const P = HS.player; HS.SAVE.lvl = 60; HS.SAVE.rites = { m1: 'water', m2: 'ward', pen: 'rain' }; P.m2cd = 0; HS.input.m2 = true; P.penance = 999; P.rainT = 0; HS.input.pen = true; });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r27-cast${tag}.png` });
  // The bag: one of each rarity and a set piece.
  await p.evaluate(() => {
    HS.SAVE.bag = []; for (let ri = 0; ri < 4; ri++) for (const sl of ['hood', 'gloves', 'seal']) HS.SAVE.bag.push(HS.makeItem(sl, ri, 'X', undefined, 5));
    for (const sl of ['mantle', 'girdle', 'relic']) { const it = HS.makeItem(sl, 4, 'X', undefined, 5); it.set = 'font'; HS.SAVE.bag.push(it); }
    HS.SAVE.bag.push(HS.armsItem('choir', 'bow', 5)); HS.openInventory();
  });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r27-bag${tag}.png` });
  out.drop = await p.evaluate(() => ({ ...HS.DROP, wardenItems: HS.WARDEN.items }));
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
