// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round25.cjs <outDir> [WxH]
// Round 25: the Warden's battle music, sound settings (voices, monster
// cries), the Scrying Pool's wagers, Martyrdom's vow and the cracked halo,
// and the Vigil Roll with its halo stands.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const dev = devices['iPhone 13 landscape'];
  const ctx = await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {};
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; Object.assign(HS.SAVE, { gold: 9000, deaths: 6, descents: 12, cleared: 5 }); });
  await p.mouse.click(300, 200); await p.waitForTimeout(800);
  // Settings: music, sounds, voices, monster cries.
  out.opts = await p.evaluate(() => { HS.game.state = 'settings'; HS.setOpt('voices', 1); HS.setOpt('cries', 'fewer'); return { voices: HS.opt('voices'), cries: HS.opt('cries'), bus: HS.AUDIO.voiceBus && +HS.AUDIO.voiceBus.gain.value.toFixed(2), rows: HS.setOptRows.length }; });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r25-settings${tag}.png` });
  await p.evaluate(() => { HS.setOpt('voices', 3); HS.setOpt('cries', 'all'); HS.game.state = 'play'; });
  // The Scrying Pool: pick Station V, wager 500 that the Warden falls.
  await p.evaluate(() => { HS.openPool(); const P = HS.game.pool; P.i = 4; P.s = 3; P.mark = 1; });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r25-pool${tag}.png` });
  out.odds = await p.evaluate(() => [0, 4, 5, 6].map((i) => [0, 1, 2].map((m) => HS.wagerOdds(i, m))));
  out.wager = await p.evaluate(() => { const G = HS.poolGeo(), g0 = HS.SAVE.gold; HS.poolTap(G.go.x + 4, G.go.y + 4); return { w: HS.SAVE.wager, paid: g0 - HS.SAVE.gold }; });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r25-pool-wager${tag}.png` });
  await p.evaluate(() => { HS.game.state = 'play'; });
  // Martyrdom: take the vow.
  await p.evaluate(() => { HS.openMartyr(); const G = HS.martyrGeo(); HS.martyrTap(G.go.x + 4, G.go.y + 4); });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r25-martyr${tag}.png` });
  out.vow = await p.evaluate(() => HS.SAVE.vow);
  // The descent panel shows the vow and the wager.
  await p.evaluate(() => { HS.game.state = 'play'; HS.startDescent(); HS.game.descent.i = 4; });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r25-descent${tag}.png` });
  await p.evaluate(() => { HS.game.state = 'play'; });
  // The Vigil Roll: some kept Vigils and a few earned halos.
  await p.evaluate(() => { HS.rollVigil(12, 271); HS.rollVigil(9, 402); HS.rollVigil(14, 95); const K = HS.looks(); K.own.push('h:bone', 'h:blood', 'h:teal'); HS.openRoll(); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r25-roll${tag}.png` });
  await p.evaluate(() => { HS.game.state = 'play'; HS.enterTown(); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; const R = HS.SITES.find((q) => q.id === 'roll'); HS.player.x = R.x - 40; HS.player.y = HS.room.top * 16 + R.dy + 40; });
  await p.waitForTimeout(800); await p.screenshot({ path: `${S}/shots/r25-town-roll${tag}.png` });
  // A descent at Station V under the vow: the Warden's music, then the stratum's again.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(800);
  out.run = await p.evaluate(async () => {
    window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play';
    const R = HS.game.run; R.diff = 4; R.martyr = true; HS.SAVE.wager = { diff: 4, mark: 1, stake: 500, k: 2.1 }; const g0 = HS.SAVE.gold || 0;
    HS.game.music = null; await new Promise((r) => setTimeout(r, 400));
    const on = () => Object.entries(HS.AUDIO.tracks).filter(([, t]) => t.on).map(([k]) => k);
    const before = on();
    HS.spawnWarden('bellwright'); await new Promise((r) => setTimeout(r, 500)); const during = on();
    HS.killEnemy(HS.game.warden, 0, 0); await new Promise((r) => setTimeout(r, 2200)); const after = on();
    HS.game.stig = null; HS.game.state = 'play';
    const gold0 = R.gold; HS.drops.push({ kind: 'gold', amount: 10, x: HS.player.x, y: HS.player.y, z: 0, vx: 0, vy: 0, vz: 0, t: 1 }); await new Promise((r) => setTimeout(r, 300));
    HS.finishDescent();
    return { before, during, after, reach: R.reach, doubled: R.gold - gold0, pool: HS.game.receipt.pool, gold: (HS.SAVE.gold || 0) - g0, kept: HS.SAVE.vowsKept };
  });
  await p.waitForTimeout(2000); await p.screenshot({ path: `${S}/shots/r25-tally${tag}.png` });
  // A martyr's fall with the Toll half rung: all is lost, the cracked halo is earned.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(800);
  out.fall = await p.evaluate(async () => {
    window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play';
    const R = HS.game.run; R.martyr = true; R.gold = 400; HS.game.toll.v = HS.game.toll.max * 0.6;
    HS.player.hp = 1; HS.hurtPlayerRaw(999);
    await new Promise((r) => setTimeout(r, 300));
    return { tithe: R.tithe, gold: R.gold, cracked: HS.looks().own.includes('h:cracked'), fallen: HS.SAVE.vowsFallen };
  });
  await p.waitForTimeout(2500); await p.screenshot({ path: `${S}/shots/r25-fall${tag}.png` });
  // The Saint wears the cracked halo.
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.looks().halo = 'cracked'; HS.openPlush(); const G = HS.plushGeo(); HS.plushTap(G.tabs[1].x + 4, G.tabs[1].y + 4); const i = HS.PLUSH_TABS[1].list.findIndex((q) => q.id === 'cracked'); const r = HS.plushGeo().row(i); HS.plushTap(r.x + 4, r.y + 4); });
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/r25-plush-cracked${tag}.png` });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
