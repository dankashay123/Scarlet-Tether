// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round122.cjs <outDir> [WxH]
// Round 122: the Vesper improved. His run speed against the Saint's, the lunge onto a foe just out
// of reach, the eight-frame cuts, the spin (the Whirlwind, Cinder Whirl, Wire Sweep), the throw (Fan of
// Knives), the clash (Steel Chime), venom pools; photos of each, zoomed on him.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r122-${n}.png`, clip });
  const clip = () => p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), k = r.width / HS.W, P = HS.player, sx = (P.x - HS.cam.x) * k + r.left, sy = (P.y - HS.cam.y) * k + r.top; return { x: Math.max(0, sx - 190), y: Math.max(0, sy - 150), width: 380, height: 230 }; });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  // Run speed: half a second of running right, Saint then Vesper.
  const speed = async (hero) => { await run(hero); await p.waitForTimeout(400); const x0 = await p.evaluate(() => [HS.player.x, HS.player.y]); await p.keyboard.down('d'); await p.waitForTimeout(500); await p.keyboard.up('d'); return p.evaluate((x0) => Math.round(Math.hypot(HS.player.x - x0[0], HS.player.y - x0[1])), x0); };
  out.speed = { saint: await speed('saint'), vesper: await speed('mendicant') };
  // The lunge: a foe just out of reach is reached and cut without moving the stick.
  await run('mendicant'); await p.waitForTimeout(300);
  out.lunge = await p.evaluate(async () => { const P = HS.player, d0 = HS.MELEE.reach + 40; const e = HS.spawnMonster('risen', P.x + d0, P.y, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; const x0 = P.x;
    await new Promise((r) => setTimeout(r, 700)); return { moved: Math.round(P.x - x0), hit: e.hp < e.maxHp }; });
  // The cuts: every frame of the eight seen in a fight.
  out.swing = await p.evaluate(async () => { const seen = new Set(), t0 = performance.now(); while (performance.now() - t0 < 1500) { await new Promise((r) => setTimeout(r, 8)); if (HS.player.shownAnim === 'swing') seen.add(HS.player.shownFrame); } return [...seen].sort(); });
  for (const f of [0, 1, 4]) { for (let i = 0; i < 200; i++) { await p.waitForTimeout(5); if (await p.evaluate((f) => HS.player.shownAnim === 'swing' && HS.player.shownFrame === f, f)) break; } await shot(`swing-${f}`, await clip()); }
  // A crowd for the rites.
  const crowd = () => p.evaluate(() => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const e = HS.spawnMonster('risen', P.x + Math.cos(a) * 50, P.y + Math.sin(a) * 34, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; } HS.player.fireCd = 99; });
  const cast = async (slot, id, name, wait, anim) => {
    await crowd(); await p.evaluate(([slot, id]) => { HS.SAVE.mrites[slot] = id; HS.player.m1cd = HS.player.m2cd = 0; HS.player.spinUntil = 0; HS.player.poseA = null; HS.player.penance = HS.T.penance.charge; HS.player.rainT = 0; HS.input[slot] = true; }, [slot, id]);
    let saw = false; for (let i = 0; i < 60; i++) { await p.waitForTimeout(10); if (await p.evaluate((a) => HS.player.shownAnim === a, anim)) { saw = true; break; } }
    await p.waitForTimeout(wait); await shot(name, await clip()); return saw;
  };
  out.poses = {
    whirlwind: await cast('pen', 'tolling', 'whirlwind', 400, 'spin'),
    cinderwhirl: await cast('m1', 'cinderslam', 'cinder-whirl', 60, 'spin'),
    wiresweep: await cast('m2', 'chainsweep', 'wire-sweep', 60, 'spin'),
    fan: await cast('m1', 'nailburst', 'fan-of-knives', 40, 'throw'),
    chime: await cast('m2', 'toll', 'steel-chime', 60, 'clash'),
    venom: await cast('m1', 'smite', 'venom-strike', 500, 'cast'),
  };
  out.whirlSpinning = await p.evaluate(() => (HS.player.spinUntil || 0) > 0);
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
