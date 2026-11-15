// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round121.cjs <outDir> [WxH]
// Round 121: the Vesper's rites as an assassin's (names, no friar words left,
// the Rites panel per slot, a cast of the falling blades), the dagger pips on
// the HUD (filling, flashing when ready), his pets (Shadow Hound, Night Raven)
// in the bag's PETS tab, his Hallowed pieces (new names, old saved names, icons).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r121-${n}.png`, clip });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = 'mendicant'; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(500);
  // Names and text: no friar words in any of his rites, their Wounds or his Hallowed pieces.
  out.rites = await p.evaluate(() => ['m1', 'm2', 'pen'].map((sl) => HS.riteList(sl).map((r) => r.name).join(', ')));
  out.friar = await p.evaluate(() => {
    const ids = new Set(['m1', 'm2', 'pen'].flatMap((sl) => HS.riteList(sl).map((r) => r.id)));
    const T = [...['m1', 'm2', 'pen'].flatMap((sl) => HS.riteList(sl).flatMap((r) => [r.name, r.text])), ...HS.WOUNDS.filter((w) => ids.has(w.rite)).flatMap((w) => [w.name, w.text(0)]), ...HS.LEGENDS.filter((L) => L.hero === 'mendicant').flatMap((L) => [L.name, L.text])];
    return T.map((t) => HS.heroText(t)).filter((t) => /\bBELL|HAMMER|MACE|SMITE|PENITENT|NAILS?\b|SHACKLE|UNDERTOW|TOLL|HOLY POOL|IRON (HOOK|VERDICT|SHARDS)/.test(t));
  });
  for (const sl of ['m1', 'm2', 'pen']) { await p.evaluate((sl) => { HS.openRites('play'); HS.game.riteFocus = sl; }, sl); await p.waitForTimeout(300); await shot(`rites-${sl}`); }
  out.ritesProblems = await p.evaluate(() => HS.textProblems());
  // The pips: 7 of 10, then ready (flashing).
  await p.evaluate(() => { HS.game.state = 'play'; HS.player.vd.n = 7; HS.player.fireCd = 99; }); await p.waitForTimeout(300);
  await shot('pips-7', { x: 0, y: 0, width: 300, height: 140 });
  out.hudProblems = await p.evaluate(() => HS.textProblems());
  await p.evaluate(() => { HS.player.vd.n = 10; }); await p.waitForTimeout(200); await shot('pips-ready', { x: 0, y: 0, width: 300, height: 140 });
  // Blades From Above in a crowd: the great dagger mid-fall.
  await p.evaluate(() => { const P = HS.player; for (let k = 0; k < 6; k++) { const e = HS.spawnMonster('risen', P.x + 60 + (k % 3) * 14, P.y - 20 + Math.floor(k / 3) * 20, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; } HS.SAVE.mrites.pen = 'hammer'; HS.player.penance = HS.T.penance.charge; HS.input.pen = true; });
  for (let i = 0; i < 100; i++) { await p.waitForTimeout(10); if (await p.evaluate(() => HS.skillFx.some((f) => f.kind === 'pillar' && f.rite === 'hammer' && f.t > 0.08 && f.t < 0.2))) break; }
  await shot('blades-from-above');
  // Pets: the bag's PETS tab.
  await p.evaluate(() => { HS.enemies.length = 0; HS.SAVE.pets = HS.PETS.map((P) => P.id); HS.SAVE.petEq = null; HS.openInventory(); HS.game.inv.tab = 4; }); await p.waitForTimeout(500); await shot('pets');
  out.pets = await p.evaluate(() => HS.PETS.filter((P) => P.hero === 'mendicant').map((P) => P.name));
  out.petsProblems = await p.evaluate(() => HS.textProblems());
  // Hallowed: his seven in the bag, and old saved names said as the new ones.
  await p.evaluate(() => { HS.SAVE.bag = HS.LEGENDS.filter((L) => L.hero === 'mendicant').map((L) => { const it = HS.makeItem(L.slot, 3, L.name, undefined, 6); it.legend = HS.LEGENDS.indexOf(L); it.power = L.id; return it; }); HS.openInventory(); HS.game.inv.tab = 0; }); await p.waitForTimeout(500); await shot('hallowed');
  out.oldHallowed = await p.evaluate(() => ["THE PENITENT'S GAUNTLETS", "THE BELLRINGER'S STOLE", 'THE SEVENTH BELL-HAMMER', 'BEADS OF IRON SHARDS'].map((name) => HS.nm({ name })));
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
