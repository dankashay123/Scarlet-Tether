// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round99.cjs <outDir> [WxH]
// Round 99: NO FOE IN REACH (and every rite of every class starts its cooldown in a crowd), step trails and late pillars
// keep their rite, Rubric drops per run, holding a REFORGE stat row opens its tip, Codex attacks and Warden halos.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r99-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  // Every rite in a crowd starts its cooldown (no false NO FOE); the chain with nobody near says NO FOE IN REACH.
  out.cast = await p.evaluate(async () => { const bad = [], R = {};
    for (const hero of ['saint', 'mendicant', 'anchoress']) { HS.SAVE.hero = hero; for (const sl of ['m1', 'm2']) for (const r of HS.riteList(sl)) {
      HS.SAVE.lvl = 100; const L = { m1: HS.riteList('m1')[0].id, m2: HS.riteList('m2')[0].id, pen: HS.riteList('pen')[0].id, [sl]: r.id }; if (hero === 'saint') HS.SAVE.rites = L; else if (hero === 'mendicant') HS.SAVE.mrites = L; else HS.SAVE.arites = L;
      HS.game.nextDiff = 3; HS.newRun(); HS.tut.on = false; HS.applyGear(true); HS.DEV.god = true; for (const e of HS.enemies) e.dead = true; const P = HS.player;
      for (let k = 0; k < 6; k++) { const e = HS.spawnMonster('golem', P.x + 34 + k * 12, P.y - 10 + (k % 2) * 20, { room: HS.game.curRoom.id }); e.hp = e.maxHp = 1e9; e.spawnDelay = 0; e.state = 'move'; }
      await new Promise((q) => setTimeout(q, 120)); HS.game.toast = null; HS.game.noFoeT = 0; P[sl + 'cd'] = 0; HS.input[sl] = true; await new Promise((q) => setTimeout(q, 160));
      if (!(P[sl + 'cd'] > 0) || (HS.game.toast && /NO FOE/.test(HS.game.toast.msg))) bad.push(`${hero}:${r.id}`); } }
    HS.SAVE.hero = 'saint'; HS.SAVE.rites = { m1: 'water', m2: 'chain', pen: 'rain' }; HS.newRun(); HS.tut.on = false; for (const e of HS.enemies) e.dead = true; await new Promise((q) => setTimeout(q, 120));
    HS.game.noFoeT = 0; HS.player.m2cd = 0; HS.input.m2 = true; await new Promise((q) => setTimeout(q, 160)); R.empty = HS.game.toast && HS.game.toast.msg;
    return { bad, ...R }; });
  await shot('nofoe');
  // Ember Step's trail and the Rain's lashes carry their rite.
  out.tags = await p.evaluate(async () => { HS.SAVE.hero = 'saint'; HS.SAVE.lvl = 100; const sl = ['m1', 'm2'].find((k) => HS.riteList(k).some((r) => r.id === 'step')); HS.SAVE.rites = { m1: 'water', m2: 'chain', pen: 'rain', [sl]: 'step' }; HS.newRun(); HS.tut.on = false; HS.applyGear(true); const P = HS.player;
    P[sl + 'cd'] = 0; HS.input[sl] = true; await new Promise((q) => setTimeout(q, 900)); const tr = HS.skillFx.find((f) => f.kind === 'trail');
    P.penance = HS.T.penance.charge; HS.input.pen = true; await new Promise((q) => setTimeout(q, 900)); const la = HS.lashes[0];
    return { trail: tr ? tr.rite : 'none', lash: la ? la.rite : 'none' }; });
  // Rubric drops per run: the Warden, plus the elites and rares a map starts with.
  out.rubrics = await p.evaluate(() => { const o = {}; for (const st of [6, 12]) { let el = 0, ra = 0; for (let s = 0; s < 8; s++) { HS.game.nextDiff = st; HS.newRun(); HS.tut.on = false; for (const e of HS.enemies) if (!e.minion) { if (e.tier === 'elite') el++; else if (e.tier === 'rare') ra++; } }
    const D = HS.RUB_DROP, per = D.warden + el / 8 * D.elite + ra / 8 * D.rare; o[st] = { perRun: +per.toFixed(2), runsEach: +(1 / per).toFixed(1) }; } return o; });
  // Hold a REFORGE stat row: the tap picks the stat, the hold opens its tip.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.equip = { hood: HS.makeItem('hood', 2, 'HOLD ME', undefined, 6) }; HS.SAVE.bag = []; HS.applyGear(); HS.openForge(); HS.game.forge.tab = 0; HS.game.forge.sel = 0; });
  await p.waitForTimeout(300);
  out.hold = await p.evaluate(async () => { const c = document.querySelector('canvas').getBoundingClientRect(), kx = c.width / HS.W, ky = c.height / HS.H, r = HS.forgeGeo(HS.featLayout()).stat(1);
    HS.pointerDown(7, c.left + (r.x + 30) * kx, c.top + (r.y + 4) * ky); const picked = HS.game.forge.stat; await new Promise((q) => setTimeout(q, 700)); const tip = HS.game.statTip && HS.game.statTip.k; HS.pointerUp(7); return { picked, tip }; });
  await p.waitForTimeout(150); await shot('hold'); await check('hold');
  // The Codex: a monster's attacks, a Warden's halo (earned and not).
  out.codex = await p.evaluate(() => { HS.game.statTip = null; HS.game.forge = null; HS.game.state = 'play'; const W0 = HS.codexList(1)[0], m = HS.codexList(0).find((q) => q.id === 'mourner'); return { mon: m.lines, warden: W0.id, wlines: W0.lines.filter(Boolean) }; });
  await p.evaluate(() => { HS.codexSee('m', 'mourner', 3); HS.openCodex(0, 'pause'); const L = HS.codexLayout(); HS.game.codex.sel = L.list.findIndex((q) => q.id === 'mourner'); }); await p.waitForTimeout(250); await shot('codex-mon'); await check('codex-mon');
  await p.evaluate(() => { const id = HS.codexList(1)[0].id, H = HS.HALOS.find((q) => q.earn === id); (HS.SAVE.trophies ||= {})[id] = { n: 4, st: { 10: 95, 12: 130 } }; if (H) HS.looks().own.push(`h:${H.id}`); HS.game.codex.sec = 1; HS.game.codex.sel = 0; HS.game.codex.page = 0; });
  await p.waitForTimeout(250); await shot('codex-warden'); await check('codex-warden');
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
