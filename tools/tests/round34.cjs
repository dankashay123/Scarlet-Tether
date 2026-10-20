// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round34.cjs <outDir> [WxH] [safe]
// Round 34: the top of the HUD. The Toll, an elite's bar, a Warden's bar,
// the Martyr's vow line and a Vigil each laid out between the HP block and
// the minimap with nothing overlapping; the streak bar under the minimap;
// crit numbers that never stack; the pause screen with many Wounds; ten maps
// in a row. `safe` fakes a safe-area inset (game px).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number), SAFE = process.argv[4] || '';
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  const tag = `${WH[0] ? `-${WH[0]}` : ''}${SAFE ? `-s${SAFE}` : ''}`, shot = (n) => p.screenshot({ path: `${S}/shots/r34-${n}${tag}.png` });
  await p.goto(`http://localhost:8123/?run${SAFE ? `&safe=${SAFE}` : ''}`); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.SAVE.cleared = 12; HS.game.nextDiff = 10; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(800);
  const out = {}, check = async (n) => { await p.waitForTimeout(200); await shot(n); out[n] = await p.evaluate(() => HS.textProblems().filter((q) => !/"[0-9,]+!?"/.test(q) && !/^OFF SCREEN: [0-9,]+!?$/.test(q))); }; // damage numbers rise behind the HUD
  // An elite with three curses and pack mates, under the Toll.
  const elite = () => p.evaluate(() => { const P = HS.player; const e = HS.spawnMonster('knight', P.x + 60, P.y, { tier: 'elite', affixes: ['hoarfrost', 'shackling', 'blighted'], room: HS.game.curRoom && HS.game.curRoom.id, name: 'SISTER MOTH THE UNBURIED' }); e.spawnDelay = 0; e.state = 'move'; e.pack = { members: [e, HS.spawnMonster('risen', P.x + 80, P.y, {}), HS.spawnMonster('risen', P.x + 90, P.y, {})] }; HS.game.focus = e; HS.game.toll.v = HS.game.toll.max * 0.51; HS.game.massacre = { n: 138, last: HS.game.time }; });
  await elite(); await check('elite');
  await p.evaluate(() => { HS.game.run.martyr = true; HS.game.focus = HS.enemies.find((e) => e.tier === 'elite' && !e.dead); HS.game.massacre = { n: 6, last: HS.game.time }; }); await check('elite-martyr');
  await p.evaluate(() => { HS.game.run.martyr = false; HS.spawnWarden('ladyOfNails'); HS.game.warden.affixes = ['hoarfrost', 'shackling', 'blighted']; }); await check('warden');
  // Crit numbers stacked on one spot.
  out.nums = await p.evaluate(() => { const e = HS.enemies.find((q) => !q.dead && q.tier === 'elite') || HS.game.warden; for (let k = 0; k < 6; k++) HS.hurtEnemy(e, 900, true, 1, 0); return 'ok'; });
  await p.waitForTimeout(120); await shot('nums');
  // The pause screen with sixteen Wounds and a logged error: nothing overlaps.
  await p.evaluate(() => { HS.game.warden = null; for (const w of HS.WOUNDS.slice(0, 16)) HS.game.run.wounds[w.id] = Math.min(w.max, 3); HS.game.run.level = 15; HS.logError('blit', new Error('The object is in an invalid state.')); HS.game.state = 'pause'; });
  await check('pause');
  // Ten maps in a row: each frees the last map's canvases (iPhone canvas memory).
  out.maps = await p.evaluate(async () => { for (let k = 0; k < 10; k++) { HS.newRun(); await new Promise((r) => setTimeout(r, 30)); } return HS.ERRS.filter((e) => !e.msg.startsWith('blit')).length; });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
