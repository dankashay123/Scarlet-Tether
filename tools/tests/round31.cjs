// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round31.cjs <outDir> [WxH]
// Round 31: the low-health edge and kill streak, the Training Yard (panel,
// dummy damage, summons, no death, leave), Stratum III (a run, its monsters,
// both Wardens, its music) and the Vigil Roll with ten halos.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n) => p.screenshot({ path: `${S}/shots/r31-${n}${tag}.png` });
  // Low health and a streak.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(600);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.player.hp = HS.player.maxHp * 0.12; HS.game.massacre = { n: 7, last: HS.game.time }; });
  await p.waitForTimeout(150); await shot('lowhp-streak');
  // The Training Yard.
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 6; const Y = HS.SITES.find((q) => q.id === 'yard'); HS.player.x = Y.x - 30; HS.player.y = HS.room.top * 16 + Y.dy + 30; });
  await p.mouse.click(300, 200); await p.waitForTimeout(700); await shot('town-yard');
  await p.evaluate(() => HS.openYard()); await p.waitForTimeout(3500);
  out.yard = await p.evaluate(() => ({ state: HS.game.state, yard: !!HS.yard, dummy: !!(HS.yard && HS.yard.dummy) }));
  await p.evaluate(() => { HS.game.state = 'play'; HS.input.m1 = true; }); await p.waitForTimeout(4000);
  out.dps = await p.evaluate(() => ({ dps: HS.yardDps(), total: Math.round(HS.yard.total) }));
  await shot('yard-dummy');
  await p.evaluate(() => { HS.game.state = 'yard'; HS.yard.tab = 1; }); await p.waitForTimeout(250); await shot('yard-panel');
  await p.evaluate(() => { HS.yard.tab = 3; }); await p.waitForTimeout(150); await shot('yard-panel-wardens');
  out.summon = await p.evaluate(async () => {
    HS.game.state = 'play'; HS.yardSummon('abbot'); HS.yardSummon('gleaner'); await new Promise((r) => setTimeout(r, 2500));
    const n = HS.enemies.filter((e) => !e.dead && e.type !== 'dummy').length; const g0 = HS.SAVE.gold, d0 = HS.SAVE.deaths;
    HS.player.hp = 1; HS.hurtPlayerRaw(999); await new Promise((r) => setTimeout(r, 300));
    return { n, alive: HS.player.hp > 0, state: HS.game.state, deaths: HS.SAVE.deaths - d0, gold: HS.SAVE.gold - g0 };
  });
  await shot('yard-fight');
  await p.evaluate(() => { HS.yardSummon('ashWidow'); }); await p.waitForTimeout(2500); await shot('yard-warden');
  out.leave = await p.evaluate(async () => { const G = HS.yardGeo(); HS.game.state = 'yard'; HS.yardTap(G.btn(3).x + 4, G.btn(3).y + 4); await new Promise((r) => setTimeout(r, 400)); return { scene: HS.game.scene, yard: !!HS.yard }; });
  // Stratum III: a descent at Station VII.
  await p.evaluate(() => { HS.SAVE.cleared = 6; HS.startDescent(); HS.game.descent.i = 6; HS.game.descent.stratum = 3; }); await p.waitForTimeout(250); await shot('descent-ossuary');
  out.open = await p.evaluate(() => [1, 2, 3].map((k) => HS.strataOpen(k)));
  await p.evaluate(() => { HS.game.state = 'play'; HS.game.nextStratum = 3; HS.game.nextDiff = 6; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(2500); await shot('ossuary-start');
  out.run = await p.evaluate(() => ({ stratum: HS.game.run.stratum, name: HS.room.name, foes: [...new Set(HS.enemies.map((e) => e.type))], music: Object.entries(HS.AUDIO.tracks).filter(([, t]) => t.on).map(([k]) => k) }));
  await p.evaluate(() => { const P = HS.player; for (const id of ['gleaner', 'cinderMoth', 'abbot']) HS.spawnMonster(id, P.x + 60, P.y + (id === 'abbot' ? -30 : 20)); }); await p.waitForTimeout(2200); await shot('ossuary-foes');
  for (const id of ['ossuarch', 'ashWidow']) {
    out[id] = await p.evaluate(async (id) => { HS.DEV.god = true; for (const e of HS.enemies) e.dead = true; HS.game.warden = null; HS.spawnWarden(id); await new Promise((r) => setTimeout(r, 2600)); return { warden: HS.game.warden && HS.game.warden.type, music: Object.entries(HS.AUDIO.tracks).filter(([, t]) => t.on).map(([k]) => k) }; }, id);
    await shot(`warden-${id}`);
  }
  // Ten halos on the Vigil Roll.
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; const K = HS.looks(); for (const H0 of HS.EARNED) K.own.push(`h:${H0.id}`); HS.openRoll(); });
  await p.waitForTimeout(300); await shot('roll');
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
