// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round177.cjs <outDir> [WxH]
// Round 177: region dailies (one of the three, on the board, the travel map and counted out there), a world boss's
// call at half health (foes of its region, a new attack) and its Codex line, weather in each region (photos), the
// opening's dialog box fitting its lines, and toasts kept clear of the quest tracker.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r177-${n}-${vw}.png` });
  const until = async (fn, n = 200, a) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  // 1. A long dialog line in a box that fits it (the Vestry's first line).
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.playScene([['odile', 'EASY. DO NOT TRY TO STAND YET. THE WATCH FOUND YOU ON THE CATHEDRAL STEPS AT DAWN: NO NAME, NO MEMORY, NOT A SCRATCH ON YOU. THE CHOIR CALLS THAT A SAINT, AND A SAINT GOES DOWN.']]); });
  await p.waitForTimeout(3500); await shot('dialog'); out.dialogProblems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.dialog = null; HS.game.state = 'play'; });
  // 2. Region dailies: a day's three, the first in a region.
  out.dailies = await p.evaluate(() => { HS.SAVE.story = 6; HS.SAVE.eliteKills = 12; HS.SAVE.cleared = 9; HS.game.dayKey = 20261121; for (const id of HS.dailyIds()) delete HS.SAVE.q[id]; HS.ensureDailies(); return HS.dailyIds().sort().map((id) => HS.qOf(id).g.slice(0, 5)); });
  out.days = await p.evaluate(() => { const seen = {}; for (let d = 1; d <= 20; d++) { HS.game.dayKey = 20261100 + d; for (const id of HS.dailyIds()) delete HS.SAVE.q[id]; HS.ensureDailies(); const q = HS.qOf(HS.dailyIds().sort()[0]); seen[q.g[0]] = (seen[q.g[0]] || 0) + 1; } return seen; });
  await p.evaluate(() => { HS.game.dayKey = 20261121; for (const id of HS.dailyIds()) delete HS.SAVE.q[id]; HS.ensureDailies(); HS.openBoard(); }); await p.waitForTimeout(400); await shot('board'); out.boardProblems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; });
  const rg = out.dailies[0][4];
  await p.evaluate(() => HS.openTravel('moor')); await p.waitForTimeout(400); await shot('travel'); out.travelProblems = await p.evaluate(() => HS.textProblems().length);
  // 3. Out there: the region daily counts kills, elites or places.
  await p.evaluate((r) => { HS.game.travel = null; HS.game.state = 'play'; HS.travelRegion(r); }, rg); await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region);
  out.count = await p.evaluate(async () => { const id = HS.dailyIds().sort()[0], q = HS.qOf(id), k = q.g[0]; HS.SAVE.god = 1; HS.DEV.god = true; HS.game.banner = null;
    if (k.startsWith('rmark_')) { for (const m of HS.room.marks.slice(0, 3)) { HS.player.x = m.x; HS.player.y = m.y + 40; HS.regionTick(); } }
    else { let n = 0; for (const e of HS.enemies) { if (e.dead || (k.startsWith('relite_') && e.tier === 'common')) continue; HS.killEnemy(e); if (++n >= 3) break; } }
    return { k, c: q.c[k] || 0 }; });
  // 4. Weather in each region at full strength.
  out.weather = {};
  for (const r of ['moor', 'fen', 'ash', 'salt']) {
    await p.evaluate((r0) => { HS.enterTown(false); HS.travelRegion(r0); }, r); await until((r0) => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === r0, 200, r);
    await p.evaluate(() => { HS.room.weatherK = 1; HS.game.banner = null; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 300) e.dead = true; }); await p.waitForTimeout(900); await shot(`weather-${r}`);
    out.weather[r] = await p.evaluate(() => ({ k: HS.weatherK(), name: HS.WEATHER[HS.room.region].name }));
  }
  // 5. A world boss's call at half health.
  out.call = await p.evaluate(async () => { HS.SAVE.worldBossT = {}; HS.game.banner = null; HS.spawnWarden('tideBishop', { world: true }); const e = HS.game.warden, atk0 = e.def.attacks.length, n0 = HS.enemies.filter((m) => !m.dead).length;
    await new Promise((r) => setTimeout(r, 1500)); e.hp = e.maxHp * 0.45; await new Promise((r) => setTimeout(r, 600));
    return { called: !!e.called, banner: HS.game.banner && HS.game.banner.text, added: e.def.attacks.length - atk0, foes: HS.enemies.filter((m) => !m.dead).length - n0, hpK: Math.round(e.maxHp) }; });
  await shot('call');
  // 6. The Codex card for a world boss.
  out.codex = await p.evaluate(() => { HS.SAVE.worldBoss = { tideBishop: 2 }; const c = HS.codexList(1).find((q) => q.id === 'tideBishop'); return { tag: c.tag, seen: c.seen, lines: c.lines.slice(0, 3) }; });
  // 7. A toast while the tracker shows: below it.
  await p.evaluate(() => { HS.enterTown(false); }); await until(() => HS.game.scene === 'town' && HS.game.state === 'play');
  await p.evaluate(() => { HS.game.banner = null; HS.game.toast = null; }); await p.waitForTimeout(300);
  await p.evaluate(() => { HS.game.toast = { msg: 'NEW QUEST: A LONG NAME FOR A QUEST. TALK TO EACH PERSON WITH A ! OVER THEM.', t: 4 }; }); await p.waitForTimeout(300); await shot('toast');
  out.toast = await p.evaluate(() => ({ track: HS.game.trackR }));
  out.logged = await p.evaluate(() => (HS.ERRS || []).map((e) => e.msg).slice(-4));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
