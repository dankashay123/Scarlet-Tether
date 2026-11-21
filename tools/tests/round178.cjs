// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round178.cjs <outDir> [WxH]
// Round 178: the Abbey Isle (the ferry from the Saltreach after the ending, its camp, landmarks, lore, the Ossuarch,
// the flooded door), the day's cache (opens once, pays toward the region's daily), storms (thunder on the moor, fog on
// the fen, embers in the Ashfields, the high tide on the coast; the Crier's line) and the travel map's weather and marks.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r178-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const inRegion = (r) => until((r0) => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region === r0, r);
  const calm = () => p.evaluate(() => { HS.game.banner = null; HS.game.toast = null; HS.game.dialog = null; if (HS.game.state === 'dialog') HS.game.state = 'play'; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 320) e.dead = true; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 6; HS.SAVE.cleared = 29; HS.SAVE.eliteKills = 12; HS.SAVE.lvl = 60; HS.SAVE.god = 1; HS.DEV.god = true; HS.game.dayKey = 20261122; for (const id of HS.dailyIds()) delete HS.SAVE.q[id]; HS.ensureDailies(); });
  // 1. The travel map: weather pictures, the storm, the daily's mark.
  out.storm = await p.evaluate(() => HS.stormOf());
  await p.evaluate(() => HS.openTravel('moor')); await p.waitForTimeout(400); await shot('travel'); out.travelProblems = await p.evaluate(() => HS.textProblems().length);
  // 2. The ferry: no SAIL before the ending, SAIL after it.
  await p.evaluate(() => { HS.game.travel = null; HS.game.state = 'play'; HS.SAVE.ending = 0; HS.travelRegion('salt'); }); await inRegion('salt');
  out.sailBefore = await p.evaluate(() => HS.room.interact.some((i) => i.label === 'SAIL'));
  await p.evaluate(() => { HS.SAVE.ending = 1; HS.enterTown(false); HS.travelRegion('salt'); }); await inRegion('salt');
  out.sailAfter = await p.evaluate(() => HS.room.interact.some((i) => i.label === 'SAIL'));
  await p.evaluate(() => HS.room.interact.find((i) => i.label === 'SAIL').use()); await inRegion('isle');
  out.isle = await p.evaluate(() => ({ name: HS.room.name, marks: HS.room.marks.map((m) => m.kind), lore: HS.room.interact.filter((i) => i.lore).length, hew: HS.room.npcs.some((n) => n.talk === 'hew'), foes: HS.enemies.length, hard: !!HS.game.run.hard, cache: !!HS.room.cacheAt }));
  await calm(); await p.waitForTimeout(600); await shot('isle-camp');
  for (const k of ['abbey', 'cloister', 'graves', 'bells', 'cells', 'needles', 'door']) {
    await p.evaluate((k0) => { const m = HS.room.marks.find((q) => q.kind === k0); HS.player.x = m.x; HS.player.y = m.y + 70; HS.SAVE.worldBossT = { ossuarch: Date.now() }; }, k); await calm(); await p.waitForTimeout(700); await shot(`isle-${k}`);
  }
  out.doorText = await p.evaluate(() => { const m = HS.room.marks.find((q) => q.kind === 'door'); const it = HS.room.interact.find((i) => i.label === 'ENTER'); HS.game.toast = null; it.use(); return HS.game.toast && HS.game.toast.msg; });
  out.boss = await p.evaluate(async () => { HS.SAVE.worldBossT = {}; const m = HS.room.marks.find((q) => q.kind === 'abbey'); HS.player.x = m.x + 200; HS.player.y = m.y + 200; m.found = false; HS.game.warden = null; await new Promise((r) => setTimeout(r, 300)); HS.player.x = m.x; HS.player.y = m.y + 60; await new Promise((r) => setTimeout(r, 2600)); const w = HS.game.warden; return w ? { type: w.type, world: w.world } : null; });
  await p.waitForTimeout(800); await shot('isle-boss');
  // 3. The day's cache: opens once and pays toward the region's daily.
  out.cache = await p.evaluate(() => { const q = HS.qOf(HS.dailyIds().sort()[0]); const rg = HS.room.region; q.g[4] = rg; q.g[0] = `rkill_${rg}`; q.c = {}; const it = HS.room.interact.find((i) => i.label === 'OPEN' && Math.hypot(i.x - HS.room.cacheAt.x, i.y - HS.room.cacheAt.y) < 10); it.use(); const c1 = q.c[q.g[0]] || 0, t1 = HS.game.toast && HS.game.toast.msg; it.use(); return { c1, t1, t2: HS.game.toast && HS.game.toast.msg, done: HS.cacheDone(rg) }; });
  // 4. Storms.
  out.storms = {};
  for (const r of ['moor', 'fen', 'ash', 'salt']) {
    await p.evaluate((r0) => { HS.enterTown(false); HS.travelRegion(r0); }, r); await inRegion(r); await calm();
    out.storms[r] = await p.evaluate(async (r0) => { HS.room.stormK = 1; const P = HS.player, fo = []; for (let k = 0; k < 5; k++) { const e = HS.spawnMonster('risen', P.x + 80 + k * 20, P.y + (k % 2 ? 30 : -30), {}); e.maxHp *= 40; e.hp = e.maxHp; fo.push(e); }
      await new Promise((r) => setTimeout(r, 9000)); return { seen: !!HS.room.stormSeen, now: HS.stormNow(), bolts: HS.room.boltT ? 1 : 0, embers: HS.room.emberT ? 1 : 0, tide: r0 === 'salt' ? HS.tideK() : null }; }, r);
    await shot(`storm-${r}`);
  }
  // 5. The Crier's storm line.
  out.crier = await p.evaluate(() => { HS.enterTown(false); const st = HS.stormOf(); return st ? `AND A STORM ON ${HS.REGIONS[st].name} TODAY: ${HS.WEATHER[st].storm}!` : null; });
  out.logged = await p.evaluate(() => (HS.ERRS || []).map((e) => e.msg).slice(-4));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
