// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round123.cjs <outDir> [WxH]
// Round 123: the Vesper spins as the dagger storm launches, flurries during the Thousand Cuts, the Red
// Hour marks bound foes with an hourglass; each premium skin's own crossbow, daggers and shards in play
// (one photo per skin and class).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r123-${n}.png`, clip });
  const clip = () => p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), k = r.width / HS.W, P = HS.player, sx = (P.x - HS.cam.x) * k + r.left, sy = (P.y - HS.cam.y) * k + r.top; return { x: Math.max(0, sx - 170), y: Math.max(0, sy - 150), width: 340, height: 210 }; });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  const crowd = (d = 60) => p.evaluate((d) => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const e = HS.spawnMonster('risen', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; } }, d);
  await run('mendicant'); await p.waitForTimeout(300);
  // The storm's launch: he spins, then throws.
  await crowd(); out.launch = await p.evaluate(async () => { const P = HS.player, seen = new Set(); P.vd.n = 9; const t0 = performance.now(); while (performance.now() - t0 < 1500) { await new Promise((r) => setTimeout(r, 8)); if (P.vd.st !== 'rest' || seen.size) seen.add(P.shownAnim); if (P.vd.st === 'storm') break; } return [...seen]; });
  // The Thousand Cuts: the flurry pose while it lasts.
  await crowd(40);
  await p.evaluate(() => { (HS.SAVE.mrites ||= {}).pen = 'hundredblows'; HS.player.penance = HS.T.penance.charge; HS.player.rainT = 0; HS.player.spinUntil = 0; HS.input.pen = true; });
  out.flurry = await p.evaluate(async () => { const seen = new Set(), t0 = performance.now(); while (performance.now() - t0 < 1500) { await new Promise((r) => setTimeout(r, 8)); if (HS.player.shownAnim === 'flurry') seen.add(HS.player.shownFrame); } return [...seen].sort(); });
  await shot('thousand-cuts', await clip());
  // The Red Hour: hourglasses over bound foes.
  await p.evaluate(() => { HS.player.rainT = 0; }); await crowd(70);
  await p.evaluate(() => { HS.SAVE.mrites.pen = 'verdict'; HS.player.penance = HS.T.penance.charge; HS.player.fireCd = 99; HS.input.pen = true; });
  await p.waitForTimeout(1800);
  out.redHour = await p.evaluate(() => ({ on: HS.player.penRite, bound: HS.enemies.filter((e) => e.bound > 0).length }));
  await shot('red-hour', await clip());
  await p.evaluate(() => { HS.player.rainT = 0; HS.enemies.length = 0; });
  // Premium skins: each class in each skin, with a crowd so the weapons show in use.
  out.skins = [];
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await run(hero); await p.waitForTimeout(300);
    for (const id of ['enlightened', 'void', 'psychedelic', 'dread', 'radiant', 'divine', 'demonic']) {
      await p.evaluate((id) => { HS.SAVE.pskins = HS.PSKINS.map((k) => k.id); HS.SAVE.pskin = id; }, id); await crowd(110);
      await p.waitForTimeout(700); await shot(`${hero}-${id}`, await clip());
      out.skins.push(await p.evaluate(() => HS.pskin()));
    }
    await p.evaluate(() => { HS.SAVE.pskin = null; });
  }
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
