// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round26.cjs <outDir> [WxH]
// Round 26: a rite for every set in every slot (six new ones), rite ranks,
// six-piece rite twists, aiming Judgement and the Great Font, and the
// recap after a death.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const ctx = await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {};
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(800);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.DEV.god = true; });
  // Every slot holds one rite per set.
  out.perSet = await p.evaluate(() => Object.fromEntries(Object.entries({ m1: 0, m2: 0, pen: 0 }).map(([k]) => [k, [...new Set(Object.values(HS.RITE_BY).filter((r) => Object.keys(HS.RITE_BY).length && r && HS.RITE_BY[r.id] === r).filter((r) => ({ m1: ['water', 'wave', 'storm', 'step', 'brand', 'hymn'], m2: ['chain', 'shackle', 'censer', 'ward', 'nailring', 'asperse'], pen: ['rain', 'pillars', 'font', 'volley', 'pilgrim', 'greatpen'] })[k].includes(r.id)).map((r) => r.set))].sort().join(',')])));
  // The Rites panel, each tab.
  for (const [i, slot] of ['m1', 'm2', 'pen'].entries()) {
    await p.evaluate(([slot, id]) => { HS.SAVE.rites = { ...(HS.SAVE.rites || {}), [slot]: id }; HS.openRites('play'); HS.game.riteFocus = slot; }, [slot, ['brand', 'nailring', 'greatpen'][i]]);
    await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r26-rites-${slot}${tag}.png` });
  }
  await p.evaluate(() => { HS.game.state = 'play'; });
  // Cast each new rite in a crowd.
  out.casts = {};
  for (const [slot, id] of [['m1', 'brand'], ['m1', 'hymn'], ['m2', 'nailring'], ['m2', 'asperse'], ['pen', 'pilgrim'], ['pen', 'greatpen']]) {
    out.casts[id] = await p.evaluate(async ([slot, id]) => {
      const P = HS.player; HS.SAVE.rites = { ...(HS.SAVE.rites || {}), [slot]: id };
      for (let k = 0; k < 8; k++) HS.spawnMonster('risen', P.x + 50 + k * 10, P.y + (k % 3 - 1) * 20);
      const bolts0 = HS.bolts.length, hp0 = (P.hp = Math.round(P.maxHp * 0.5));
      if (slot === 'pen') { P.penance = 999; P.rainT = 0; } else P[`${slot}cd`] = 0;
      HS.input[slot] = true; await new Promise((r) => setTimeout(r, 900));
      const bound = HS.enemies.filter((e) => !e.dead && e.bound > 0).length, judged = HS.enemies.filter((e) => e.judgedT > HS.game.time).length;
      const res = { cd: slot === 'pen' ? P.rainT > 0 : P[`${slot}cd`] > 0, bound, judged, bolts: HS.bolts.length - bolts0, healed: P.hp > hp0, charges: P.charges };
      P.rainT = 0; return res;
    }, [slot, id]);
    if (id === 'hymn' || id === 'greatpen') await p.screenshot({ path: `${S}/shots/r26-cast-${id}${tag}.png` });
  }
  // Ranks: 15 casts take Iron Brand to rank 2; its cooldown drops 5%.
  out.rank = await p.evaluate(() => { HS.SAVE.riteXp = { brand: 14 }; const r0 = HS.riteRank('brand'); HS.bumpRite('brand'); return { r0, r1: HS.riteRank('brand') }; });
  // A twist: six pieces of the Hundred Nails, Crown of Nails fires twice.
  out.twist = await p.evaluate(async () => {
    HS.devSet('nails', true); const P = HS.player; HS.SAVE.rites.m2 = 'nailring'; P.m2cd = 0; HS.bolts.length = 0;
    HS.input.m2 = true; await new Promise((r) => setTimeout(r, 120)); const a = HS.bolts.length; await new Promise((r) => setTimeout(r, 400));
    return { on: HS.twist('nailring'), first: a, after: HS.bolts.length };
  });
  // Aim Judgement at a spot.
  await p.evaluate(() => { HS.SAVE.rites.pen = 'pillars'; HS.player.penance = 999; HS.player.rainT = 0; const r = document.getElementById('screen').getBoundingClientRect(), B = HS.hud.pen, cx = (x) => r.left + x / HS.W * r.width, cy = (y) => r.top + y / HS.H * r.height; HS.pointerDown(9, cx(B.x), cy(B.y)); HS.pointerMove(9, cx(B.x - 30), cy(B.y - 20)); });
  await p.waitForTimeout(150); await p.screenshot({ path: `${S}/shots/r26-aim-pillars${tag}.png` });
  out.aimPillars = await p.evaluate(async () => { HS.pointerUp(9); await new Promise((r) => setTimeout(r, 300)); return { on: HS.player.rainT > 0, aim: !!HS.player.penAim }; });
  // The Great Font placed on the floor.
  out.aimFont = await p.evaluate(async () => {
    const P = HS.player; P.rainT = 0; HS.SAVE.rites.pen = 'font'; P.penance = 999;
    const r = document.getElementById('screen').getBoundingClientRect(), B = HS.hud.pen, cx = (x) => r.left + x / HS.W * r.width, cy = (y) => r.top + y / HS.H * r.height;
    HS.pointerDown(9, cx(B.x), cy(B.y)); HS.pointerMove(9, cx(B.x - 40), cy(B.y)); HS.pointerUp(9);
    await new Promise((r) => setTimeout(r, 400)); const pl = HS.pools.find((q) => q.follow);
    return pl ? { dx: Math.round(pl.x - P.x), dy: Math.round(pl.y - P.y) } : null;
  });
  await p.screenshot({ path: `${S}/shots/r26-font-placed${tag}.png` });
  // A death: the recap beside the receipt.
  out.recap = await p.evaluate(async () => {
    const P = HS.player; P.rainT = 0; HS.DEV.god = false;
    const m = HS.enemies.find((e) => !e.dead) || HS.spawnMonster('risen', P.x + 30, P.y);
    HS.noteHurt({ type: 'flagellant' }, 'lunge', 60); HS.noteHurt({ type: 'bishop' }, 'circle', 25); HS.noteHurt({}, 'pool', 15);
    P.hp = 1; HS.hurtPlayerRaw(999, '#fff', 'shot', m); await new Promise((r) => setTimeout(r, 200));
    return HS.game.receipt.recap;
  });
  await p.waitForTimeout(2200); await p.screenshot({ path: `${S}/shots/r26-recap${tag}.png` });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
