// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round179.cjs <outDir> [WxH]
// Round 179: weather over the darkness in every region (photos), the rain loop and thunder, the pilot walking to the
// day's cache and unfound landmarks, the Codex lore page by region, and chapter 7 (THE FLOODED UNDERCROFT): locked
// before the ending, offered after it, played through (Hew, Ansel, the cloister's rule, the door, the Organist).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r179-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const inRegion = (r) => until((r0) => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region === r0, r);
  const calm = () => p.evaluate(() => { HS.game.banner = null; HS.game.toast = null; HS.game.dialog = null; if (HS.game.state === 'dialog') HS.game.state = 'play'; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 320) e.dead = true; });
  const closeDialog = async () => { const seen = []; for (let i = 0; i < 80 && (await p.evaluate(() => HS.game.state === 'dialog')); i++) { seen.push(await p.evaluate(() => HS.game.dialog && HS.game.dialog.who[HS.game.dialog.i])); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(140); } return [...new Set(seen)]; };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(200); // unlock audio
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 6; HS.SAVE.cleared = 29; HS.SAVE.ending = 0; HS.SAVE.eliteKills = 12; HS.SAVE.lvl = 60; HS.SAVE.god = 1; HS.DEV.god = true; HS.ensureQuests(); });
  // 1. Chapter 7 waits for the ending.
  out.before = await p.evaluate(() => ({ offered: !!HS.qOf('story6'), open: HS.storyOpenN(6) }));
  await p.evaluate(() => HS.openStory(6, 'play')); await p.waitForTimeout(400); await shot('story-locked'); out.storyProblems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.ending = 1; HS.ensureQuests(); });
  out.after = await p.evaluate(() => ({ offered: HS.qOf('story6') && HS.qOf('story6').st, open: HS.storyOpenN(6) }));
  await p.evaluate(() => HS.openStory(6, 'play')); await p.waitForTimeout(400); await shot('story-open');
  await p.evaluate(() => { HS.game.state = 'play'; HS.talk('odile'); }); await p.waitForTimeout(200); out.intro = await closeDialog();
  out.taken = await p.evaluate(() => HS.qOf('story6').st);
  // 2. Out to the isle: Hew, Ansel, the cloister's rule, then the door.
  await p.evaluate(() => HS.travelRegion('isle')); await inRegion('isle');
  out.isle = await p.evaluate(() => ({ story: HS.game.run.story, ansel: HS.room.npcs.some((n) => n.talk === 'ansel'), hard: !!HS.game.run.hard }));
  out.doorEarly = await p.evaluate(() => { HS.game.toast = null; HS.room.interact.find((i) => i.label === 'ENTER').use(); return HS.game.toast && HS.game.toast.msg; });
  for (const who of ['hew', 'ansel']) { await p.evaluate((w) => { const n = HS.room.npcs.find((m) => m.talk === w); HS.player.x = n.x + 26; HS.player.y = n.y + 4; }, who); await calm(); await p.waitForTimeout(500); if (who === 'ansel') await shot('ansel'); await p.evaluate((w) => HS.regionTalk(w), who); await p.waitForTimeout(150); out[`talk_${who}`] = await closeDialog(); }
  await p.evaluate(() => { const it = HS.room.interact.find((i) => i.lore === 'i_cloister'); HS.player.x = it.x; HS.player.y = it.y + 6; HS.game.state = 'play'; const L = HS.REGION_LORE.isle.find((q) => q.id === 'i_cloister'); HS.readLore(L); }); await p.waitForTimeout(150); await closeDialog();
  out.steps = await p.evaluate(() => HS.qOf('story6').c);
  await p.evaluate(() => { const m = HS.room.marks.find((q) => q.kind === 'door'); HS.player.x = m.x; HS.player.y = m.y + 40; HS.room.interact.find((i) => i.label === 'ENTER').use(); });
  await until(() => HS.game.scene === 'wound' && !HS.room.region && HS.game.state === 'play'); await p.waitForTimeout(800);
  out.run = await p.evaluate(() => ({ story: HS.game.run.story, stratum: HS.game.run.stratum, find: !!HS.storyFind }));
  await p.evaluate(() => { HS.enemies.length = 0; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden(); const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 30; }); await p.waitForTimeout(700); await shot('finale');
  await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 10; }); await p.waitForTimeout(400);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!HS.game.warden)); i++) { await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(100); }
  await p.waitForTimeout(800); await shot('organist'); await closeDialog();
  out.warden = await p.evaluate(() => HS.game.warden && HS.game.warden.type);
  await p.evaluate(() => { for (const [k, n] of HS.STORY[6].goals) if (k !== 'read' && k !== 'warden') HS.questBump(k, n); const e = HS.game.warden; if (e) HS.hurtEnemy(e, e.hp + 10); }); await p.waitForTimeout(2400);
  for (let i = 0; i < 30 && (await p.evaluate(() => HS.game.state === 'stig')); i++) { await p.evaluate(() => { HS.game.state = 'play'; }); await p.waitForTimeout(300); }
  out.death = await closeDialog();
  out.step = await p.evaluate(() => HS.qOf('story6').step);
  await p.evaluate(() => HS.finishDescent()); await p.waitForTimeout(1600); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(1500); await closeDialog();
  await until(() => HS.game.scene === 'town' && HS.game.state === 'play');
  await p.evaluate(() => HS.talk('odile')); await p.waitForTimeout(200); out.outro = await closeDialog();
  for (let i = 0; i < 20 && (await p.evaluate(() => HS.game.state !== 'play')); i++) { await p.evaluate(() => { if (HS.game.state === 'recap') HS.game.state = 'play'; }); await p.waitForTimeout(200); await closeDialog(); }
  out.done = await p.evaluate(() => ({ story: HS.SAVE.story, q: HS.qOf('story6').st }));
  // 3. Weather in each region, over the darkness; the rain loop and thunder.
  out.weather = {};
  for (const r of ['moor', 'fen', 'ash', 'salt', 'isle']) {
    await p.evaluate((r0) => { HS.game.state = 'play'; HS.travelRegion(r0); }, r); await inRegion(r);
    await calm(); await p.evaluate(() => { HS.room.weatherK = 1; }); await p.waitForTimeout(900); await shot(`weather-${r}`);
    out.weather[r] = await p.evaluate(() => ({ rain: HS.AUDIO.tracks.amb_rain ? +(HS.AUDIO.tracks.amb_rain.lv || 0).toFixed(2) : 0 }));
  }
  await p.evaluate(() => { HS.travelRegion('moor'); }); await inRegion('moor'); await calm();
  await p.evaluate(() => { HS.room.stormK = 1; HS.room.boltT = 0; }); await p.waitForTimeout(2500); await shot('storm-moor');
  out.storm = await p.evaluate(() => ({ rain: HS.AUDIO.tracks.amb_rain && HS.AUDIO.tracks.amb_rain.lv, on: HS.AUDIO.tracks.amb_rain && HS.AUDIO.tracks.amb_rain.on }));
  await p.evaluate(() => { HS.travelRegion('ash'); }); await inRegion('ash'); await calm(); await p.evaluate(() => { HS.room.stormK = 1; }); await p.waitForTimeout(800);
  out.embers = await p.evaluate(() => HS.AUDIO.tracks.amb_embers && HS.AUDIO.tracks.amb_embers.lv);
  // 4. The pilot: to the cache first, then the nearest landmark not found.
  out.pilot = await p.evaluate(async () => { HS.game.run.auto = true; HS.SAVE.cacheDay = {}; for (const e of HS.enemies) e.dead = true; const g0 = HS.autoRegionGoal(), c = HS.room.cacheAt; const toCache = !!g0 && Math.hypot(g0.x - c.x, g0.y - c.y) < 20;
    const found0 = HS.room.marks.filter((m) => m.found).length; await new Promise((r) => setTimeout(r, 14000)); return { toCache, cacheDone: HS.cacheDone(HS.room.region), found0, found: HS.room.marks.filter((m) => m.found).length, goal: HS.AP && HS.AP.goal }; });
  await p.evaluate(() => { HS.game.run.auto = false; });
  // 5. The Codex: lore by region, a row each.
  await p.evaluate(() => { HS.enterTown(false); HS.SAVE.lore = { m_circle: 1, m_tor: 1, f_dam: 1, a_pit: 1, i_bells: 1, i_cloister: 1, s_huts: 1 }; HS.openCodex(6, 'play'); }); await p.waitForTimeout(600); await shot('codex');
  out.codexProblems = await p.evaluate(() => HS.textProblems().length);
  out.codexRows = await p.evaluate(() => { const L = HS.codexLayout(); return { cols: L.cols, per: L.per, pages: L.pages, firstIsle: L.list.findIndex((q) => q.rg === 'isle') }; });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
