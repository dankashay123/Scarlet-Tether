// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round119.cjs <outDir> [WxH]
// Round 119: the Vesper's floating daggers and their blade storm (every 10th
// attack they fly to the nearest pack, an elite first, and hit 10 times a second
// for 2 s), the daggers' looks per premium skin and set, his re-themed sets
// (names, cards, old piece names), photos of each set's look.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r119-${n}.png`, clip });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (st) => p.evaluate((st) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = 'mendicant'; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = st; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, st);
  await run(2);
  // Daggers hover by him at rest.
  await p.waitForTimeout(400);
  out.rest = await p.evaluate(() => ({ st: HS.player.vd && HS.player.vd.st, n: HS.player.vd && HS.player.vd.d.length }));
  // A pack of four close by and one elite farther off: the storm goes to the elite.
  out.storm = await p.evaluate(async () => {
    const P = HS.player, pack = [];
    for (let k = 0; k < 4; k++) { const e = HS.spawnMonster('risen', P.x + 30 + (k % 2) * 10, P.y - 10 + k * 7, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; pack.push(e); }
    const el = HS.spawnMonster('risen', P.x - 120, P.y + 20, { room: HS.game.curRoom.id }); el.tier = 'elite'; el.state = 'move'; el.spawnDelay = 0; el.asleep = false; el.hp = el.maxHp = 1e7; el.speed = 0;
    const V = P.vd; V.n = 9;
    let launched = null, hp0 = el.hp, t0 = performance.now(), sawStorm = false;
    while (performance.now() - t0 < 4500) { await new Promise((r) => setTimeout(r, 16)); if (!launched && V.st === 'fly') launched = V.tgt === el ? 'elite' : 'other'; if (V.st === 'storm') sawStorm = true; if (sawStorm && V.st !== 'storm') break; }
    return { launched, sawStorm, ticks: V.tick, eliteHit: el.hp < hp0, after: V.st };
  });
  // Photos: rest with a skin, mid-flight and mid-storm on a crowd.
  const clip = () => p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), k = r.width / HS.W, P = HS.player, sx = (P.x - HS.cam.x) * k + r.left, sy = (P.y - HS.cam.y) * k + r.top; return { x: Math.max(0, sx - 200), y: Math.max(0, sy - 140), width: 400, height: 220 }; });
  await p.evaluate(() => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 6; k++) { const e = HS.spawnMonster('risen', P.x + 90 + (k % 3) * 12, P.y - 14 + Math.floor(k / 3) * 16, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; } HS.player.vd.n = 9; HS.player.vd.st = 'rest'; });
  for (let i = 0; i < 300; i++) { await p.waitForTimeout(10); if (await p.evaluate(() => HS.player.vd.st === 'fly')) break; }
  await p.waitForTimeout(60); await shot('fly', await clip());
  for (let i = 0; i < 300; i++) { await p.waitForTimeout(10); if (await p.evaluate(() => HS.player.vd.st === 'storm' && HS.player.vd.t > 0.6)) break; }
  await shot('storm', await clip());
  // Every look has its dagger anim.
  out.looks = await p.evaluate(() => [...HS.PSKINS.map((k) => k.id), 'rags', 'iron', 'road', 'alms', 'gaol', 'bell'].filter((k) => !HS.SPR.fx.anims[`vdagger_${k}`]));
  // Premium skins on him: the sheet, the daggers' look, a photo at rest.
  out.pskins = [];
  for (const id of ['void', 'demonic', 'psychedelic']) {
    await p.evaluate((id) => { HS.enemies.length = 0; HS.SAVE.pskins = HS.PSKINS.map((k) => k.id); HS.SAVE.pskin = id; HS.player.vd.st = 'rest'; HS.player.vd.n = 6; }, id); await p.waitForTimeout(500);
    out.pskins.push(await p.evaluate(() => [HS.pskin(), HS.saintSheet(), HS.vdAnim()].join(' ')));
    await shot(`skin-${id}`, await clip());
  }
  await p.evaluate(() => { HS.SAVE.pskin = null; });
  // His sets: names, card text, the dagger look and a photo of each.
  out.sets = [];
  for (const id of ['iron', 'road', 'alms', 'gaol', 'bell']) {
    await p.evaluate((id) => { HS.devSet(id, true); }, id); await p.waitForTimeout(500);
    out.sets.push(await p.evaluate((id) => `${HS.VSETS[id].name} | ${HS.saintSheet()} | ${HS.vdAnim()}`, id));
    await shot(`set-${id}`, await clip());
  }
  out.oldNames = await p.evaluate(() => ["BEGGAR KING'S HOOD", "ALMSGIVER'S MANTLE", "GAOLER'S GLOVES", "BELL-RINGER'S ROSARY", "WANDERER'S GREAVES", 'RAGGED SEAL', "THE SATCHEL OF KEYS"].map((name) => HS.nm({ name })));
  out.setText = await p.evaluate(() => ['iron', 'road', 'alms', 'gaol', 'bell'].flatMap((id) => HS.VSETS[id].bonus.map((x) => x[1])).filter((t) => /ALMS|FETTER|BELL|\bRINGS\b|BEGGAR|GAOL/.test(t)));
  await p.evaluate(() => { HS.openInventory(); }); await p.waitForTimeout(500); await shot('bag');
  out.bagProblems = await p.evaluate(() => HS.textProblems());
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
