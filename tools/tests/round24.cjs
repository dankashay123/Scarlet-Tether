// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round24.cjs <outDir> [WxH]
// Round 24: music per place (Vael's chant and the choir by the cathedral,
// each stratum), the Warden's roar, sting and fall, monster death voices,
// and the Plush stall's bolt trails, dash trails and earned Warden halos.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const dev = devices['iPhone 13 landscape'];
  const ctx = await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {};
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.SAVE.gold = 9000; HS.SAVE.deaths = 6; });
  await p.mouse.click(300, 200); await p.waitForTimeout(3000);
  const want = ['music_town', 'amb_choir', 'music_undercroft', 'music_nave', 'sting_warden', 'die_bone0', 'die_spirit1', 'die_cleric0', 'roar_charnelKing', 'fall_organist'];
  out.audio = await p.evaluate((w) => ({ n: Object.keys(HS.AUDIO.buf).length, missing: w.filter((k) => !k.startsWith('music') && !k.startsWith('amb') && !HS.AUDIO.has(k)) }), want);
  // Walk to the cathedral doors: the choir rises, the organ falls.
  out.choir = await p.evaluate(async () => {
    const T = HS.AUDIO.tracks, D = HS.room.interact.find((q) => q.door), A = HS.SITES.find((q) => q.id === 'stall');
    HS.player.x = A.x; HS.player.y = HS.room.top * 16 + A.dy + 30; await new Promise((r) => setTimeout(r, 800));
    const far = { c: T.amb_choir && T.amb_choir.lv, m: T.music_town && T.music_town.lv };
    HS.player.x = D.x; HS.player.y = D.y + 20; await new Promise((r) => setTimeout(r, 800));
    return { far, near: { c: T.amb_choir.lv, m: T.music_town.lv, on: T.amb_choir.on }, sync: Math.abs(T.amb_choir.el.currentTime - T.music_town.el.currentTime) };
  });
  // The Plush stall's new tabs.
  await p.evaluate(() => { HS.openPlush(); const G = HS.plushGeo(); HS.plushTap(G.tabs[1].x + 4, G.tabs[1].y + 4); const i = HS.PLUSH_TABS[1].list.findIndex((q) => q.earn === 'charnelKing'); const r = HS.plushGeo().row(i); HS.plushTap(r.x + 4, r.y + 4); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r24-plush-halos${tag}.png` });
  out.trail = await p.evaluate(() => { let G = HS.plushGeo(); HS.plushTap(G.tabs[2].x + 4, G.tabs[2].y + 4); G = HS.plushGeo(); const i = HS.TRAILS.findIndex((q) => q.id === 'verdant'), r = G.row(i); HS.plushTap(r.x + 4, r.y + 4); HS.plushTap(G.btn.x + 4, G.btn.y + 4); return { bolt: HS.looks().bolt, fx: HS.boltFx().trail }; });
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/r24-plush-bolts${tag}.png` });
  out.dash = await p.evaluate(() => { let G = HS.plushGeo(); HS.plushTap(G.tabs[3].x + 4, G.tabs[3].y + 4); G = HS.plushGeo(); const i = HS.DASHES.findIndex((q) => q.id === 'rose'), r = G.row(i); HS.plushTap(r.x + 4, r.y + 4); HS.plushTap(G.btn.x + 4, G.btn.y + 4); return HS.looks().dash; });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r24-plush-dash${tag}.png` });
  // A descent at Station X: the Undercroft's music, a Warden slain gives its halo.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(800);
  out.run = await p.evaluate(async () => {
    window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.game.run.df = HS.DIFF[9];
    HS.game.music = null; await new Promise((r) => setTimeout(r, 400));
    const music = Object.entries(HS.AUDIO.tracks).filter(([, t]) => t.on).map(([k]) => k);
    HS.spawnWarden('charnelKing'); const w = HS.game.warden; await new Promise((r) => setTimeout(r, 300));
    HS.killEnemy(w, 0, 0); await new Promise((r) => setTimeout(r, 2200));
    return { music, earned: HS.looks().own.includes('h:blood') };
  });
  await p.evaluate(() => { HS.game.stig = null; HS.game.state = 'play'; HS.game.banner = null; const K = HS.looks(); K.halo = 'blood'; });
  await p.waitForTimeout(300); await p.evaluate(() => { HS.input.dash = true; });
  await p.waitForTimeout(90); await p.screenshot({ path: `${S}/shots/r24-run-look${tag}.png` });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
