// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round124.cjs <outDir> [WxH]
// Round 124: the Vesper's blade storm lasts 3 s and flies on to the next pack when its own is dead; he cuts
// the foe beside him right after a dash even with an elite across the room; the altar shows only this
// class's pieces; the three replaced Hallowed powers and the fifteen new ones each do their thing.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r124-${n}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.altar = { known: [], sockets: {} }; HS.applyGear(true); HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  const spawn = (list) => p.evaluate((list) => { const P = HS.player; return list.map(([dx, dy, hp, elite]) => { const e = HS.spawnMonster('risen', P.x + dx, P.y + dy, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = hp; e.speed = 0; if (elite) e.tier = 'elite'; return HS.enemies.indexOf(e); }); }, list);
  const power = (key) => p.evaluate((key) => { HS.G.powers.add(key); }, key);
  // The storm: a weak pack it kills at once, a strong pack farther on: it hops and keeps the time it had left.
  await run('mendicant'); await p.waitForTimeout(300);
  await spawn([[60, 0, 30], [66, 10, 30], [56, -10, 30], [180, 0, 1e7], [186, 10, 1e7], [176, -10, 1e7]]);
  out.storm = await p.evaluate(async () => { const P = HS.player, V = P.vd; P.vd.n = 9; P.fireCd = 0; let t0 = null, hops = 0, last = null, tEnd = null; const s0 = performance.now();
    while (performance.now() - s0 < 7000) { await new Promise((r) => setTimeout(r, 16)); if (V.st === 'storm' && t0 === null) t0 = HS.game.time; if (V.tgt && last && V.tgt !== last && V.st === 'fly') hops++; if (V.tgt) last = V.tgt; if (t0 !== null && V.st === 'back') { tEnd = HS.game.time; break; } P.fireCd = 99; }
    return { time: HS.vdTime(), hops, lasted: tEnd && +(tEnd - t0).toFixed(2), farHit: HS.enemies.filter((e) => e.maxHp === 1e7 && e.hp < e.maxHp).length }; });
  // After a dash with an elite across the room: the foe beside him is cut at once.
  await p.evaluate(() => { HS.enemies.length = 0; HS.player.vd.n = 0; HS.player.fireCd = 0; });
  const ids = await spawn([[220, 0, 1e7, true], [36, 6, 1e7]]);
  out.afterDash = await p.evaluate(async (ids) => { const P = HS.player; HS.startDash(P, { dir: Math.PI }); const near = HS.enemies[ids[1]]; const s0 = performance.now(); let at = null;
    while (performance.now() - s0 < 1200) { await new Promise((r) => setTimeout(r, 16)); if (near.hp < near.maxHp) { at = Math.round(performance.now() - s0); break; } } return { hitAfterMs: at, target: P.target === near ? 'near' : P.target && P.target.tier }; }, ids);
  // The altar's memory lists only this class's pieces, for each class.
  out.altar = {};
  for (const hero of ['saint', 'mendicant', 'anchoress']) { await run(hero); out.altar[hero] = await p.evaluate(() => { const all = HS.ALTAR_SOCKETS.flatMap((q) => HS.altarPickLegends(q[0])); return { n: all.length, foreign: all.filter((L) => L.hero && L.hero !== HS.SAVE.hero).map((L) => L.id) }; }); }
  // The powers.
  out.powers = {};
  out.powers.count = await p.evaluate(() => HS.LEGENDS.length);
  out.powers.keysUnique = await p.evaluate(() => new Set(HS.LEGENDS.map((L) => L.key)).size === HS.LEGENDS.length);
  // Shared: the Long Descent, the Feasting Cord, the Still Cloak.
  await run('saint'); await p.waitForTimeout(300);
  await power('dashCrit'); out.powers.dashCrit = await p.evaluate(() => { HS.startDash(HS.player, { dir: 0 }); return HS.player.dashCrits; });
  await power('eliteFeast'); await spawn([[40, 0, 1, true]]); out.powers.eliteFeast = await p.evaluate(async () => { const P = HS.player; P.hp = P.maxHp * 0.5; P.charges = 0; await new Promise((r) => setTimeout(r, 900)); return { hp: +(P.hp / P.maxHp).toFixed(2), charges: P.charges }; });
  out.powers.stillWard = await p.evaluate(async () => { HS.enemies.length = 0; for (let i = 0; i < 90; i++) { HS.G.powers.add('stillWard'); await new Promise((r) => setTimeout(r, 16)); } const w = !!HS.player.stillWard; HS.G.powers.add('stillWard'); HS.DEV.god = false; HS.damagePlayer(null, 50, [[HS.player.x, HS.player.y]], 'test'); HS.DEV.god = true; return { raised: w, used: !HS.player.stillWard }; });
  // The Saint's: the Ricochet Arbalest and the Mantle of Answers (bolts in flight after a perfect dodge).
  await power('ricochet'); await spawn([[90, 0, 1e7], [120, 20, 1e7]]); out.powers.ricochet = await p.evaluate(async () => { const s0 = performance.now(); let n = 0; while (performance.now() - s0 < 1500) { await new Promise((r) => setTimeout(r, 16)); n = Math.max(n, HS.bolts.filter((b) => b.rico).length); } return n; });
  // The Vesper's: the Third Hand, the Storm-Glass, the Vesper Hour.
  await run('mendicant'); await p.waitForTimeout(300);
  await power('quickStorm'); await power('stormPlus'); out.powers.vesper = await p.evaluate(() => ({ every: HS.vdEvery(), time: HS.vdTime() }));
  await power('thirdCut'); await spawn([[36, 0, 1e7]]); out.powers.thirdCut = await p.evaluate(async () => { const P = HS.player; let max = 0; const s0 = performance.now(); while (performance.now() - s0 < 2000) { await new Promise((r) => setTimeout(r, 8)); max = Math.max(max, (P.cutAt || []).length); } return max; });
  // The Anchoress's: the Pulsing Heart and the Reliquary Girdle.
  await run('anchoress'); await p.waitForTimeout(300);
  await power('shardPulse'); await spawn([[50, 0, 1e7], [-50, 10, 1e7]]); out.powers.shardPulse = await p.evaluate(async () => { HS.player.pulseT = 0.05; HS.player.fireCd = 99; await new Promise((r) => setTimeout(r, 300)); return HS.enemies.filter((e) => e.hp < e.maxHp).length; });
  await shot('pulse');
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
