// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round39.cjs <outDir> [WxH]
// Round 39: REMORSEFUL reflect is a share of the Saint's health (never a
// one-shot, at most 5% a second); Splinter's bolts do not splinter again;
// Stations run to XXX (Descent panel, bands, item levels, unlocks).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n) => p.screenshot({ path: `${S}/shots/r39-${n}${tag}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  // Reflect: hit a REMORSEFUL elite 200 times with huge damage at Station XV.
  out.reflect = await p.evaluate(async () => {
    HS.tut.on = false; HS.DEV.god = false; HS.game.nextDiff = 14; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.state = 'play';
    for (const e of HS.enemies) e.dead = true;
    const P = HS.player; P.hp = P.maxHp; const e = HS.spawnMonster('knight', P.x + 60, P.y, { tier: 'elite', affixes: ['penitent'], room: HS.game.curRoom.id }); e.hp = e.maxHp = 1e15; e.spawnDelay = 0; e.state = 'move'; e.bound = 1e9;
    let worst = 0, last = P.hp; const t0 = HS.game.time;
    for (let k = 0; k < 40; k++) { for (let j = 0; j < 5; j++) HS.hurtEnemy(e, 5e6, true, 1, 0); await new Promise((r) => setTimeout(r, 100)); worst = Math.max(worst, last - P.hp); last = P.hp; }
    return { maxHp: P.maxHp, lost: Math.round(P.maxHp - P.hp), secs: +(HS.game.time - t0).toFixed(1), worstStep: Math.round(worst), alive: P.hp > 0 };
  });
  // Stations to XXX.
  out.stations = await p.evaluate(() => ({ n: HS.DIFF.length, last: HS.DIFF[29].name, band: HS.DIFF[29].band, bands: [...new Set(HS.DIFF.map((d) => d.band))], aff: HS.DIFF.map((d) => d.aff).join(''), hp30: Math.round(HS.DIFF[29].hp), hp15: Math.round(HS.DIFF[14].hp) }));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  out.panel = await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.cleared = 28; HS.startDescent(); HS.game.descent.i = 29; return { open: HS.game.descent && 1, problems: HS.textProblems() }; });
  await p.waitForTimeout(250); await shot('descent-xxx');
  out.il = await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.cleared = 29; const it = HS.makeItem('hood', 2, 'X', undefined, 30); return { sanct: HS.itemSanctity(it), best: HS.SAVE.cleared }; });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
