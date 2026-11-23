// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round185.cjs <outDir> [WxH]
// Round 185: chapter 10 (THE HOLLOW BELOW: offered after chapter 9, played through to the Hollow Saint, its fight,
// phase and death, the outro), Stratum IV opened by it (a descent there, its Warden list), Station Wardens' phase
// cries, the Codex world boss card (last killed), the travel map with both of the Abbey Isle's world bosses.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r185-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const closeDialog = async () => { const seen = []; for (let i = 0; i < 80 && (await p.evaluate(() => HS.game.state === 'dialog')); i++) { seen.push(await p.evaluate(() => HS.game.dialog && HS.game.dialog.who[HS.game.dialog.i])); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(140); } return [...new Set(seen)]; };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 9; HS.SAVE.cleared = 29; HS.SAVE.ending = 1; HS.SAVE.eliteKills = 12; HS.SAVE.lvl = 60; HS.SAVE.god = 1; HS.DEV.god = true; HS.ensureQuests(); });
  out.before = await p.evaluate(() => ({ offered: HS.qOf('story9') && HS.qOf('story9').st, s4: HS.strataOpen(4) }));
  await p.evaluate(() => HS.openStory(9, 'play')); await p.waitForTimeout(400); await shot('story'); out.storyProblems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; HS.talk('odile'); }); await p.waitForTimeout(200); out.intro = await closeDialog();
  await p.evaluate(() => { HS.game.state = 'play'; HS.beginStory(9, false); }); await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.game.run && HS.game.run.story === 9);
  await p.waitForTimeout(900); await shot('hollow-room');
  out.run = await p.evaluate(() => { HS.game.run.level = 99; return { story: HS.game.run.story, stratum: HS.game.run.stratum }; });
  await p.evaluate(() => { HS.enemies.length = 0; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden(); const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 30; }); await p.waitForTimeout(700); await shot('finale');
  await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 10; }); await p.waitForTimeout(400); await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!HS.game.warden)); i++) { await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(100); }
  await p.waitForTimeout(900); await shot('entrance'); out.spawnLines = await closeDialog();
  out.warden = await p.evaluate(() => HS.game.warden && { type: HS.game.warden.type, title: HS.game.warden.title, scale: HS.game.warden.scaleK });
  await p.evaluate(() => { const e = HS.game.warden; e.x = HS.player.x + 100; e.y = HS.player.y; });
  for (let i = 0; i < 3; i++) { await p.waitForTimeout(2000); await p.evaluate(() => { if (HS.game.state !== 'play') { HS.game.dialog = null; HS.game.state = 'play'; } }); await shot(`fight-${i}`); }
  await p.evaluate(() => { for (const [k, n] of HS.STORY[9].goals) if (k !== 'read' && k !== 'warden') HS.questBump(k, n); const e = HS.game.warden; if (e) e.hp = e.maxHp * 0.45; }); await p.waitForTimeout(700); out.phaseSay = await p.evaluate(() => HS.bossSay && HS.bossSay.text); await shot('phase');
  await p.evaluate(() => { const e = HS.game.warden; if (e) HS.hurtEnemy(e, e.hp + 10, false, 1, 0); }); await p.waitForTimeout(900); await shot('dying'); await p.waitForTimeout(1800);
  for (let i = 0; i < 30 && (await p.evaluate(() => HS.game.state === 'stig')); i++) { await p.evaluate(() => { HS.game.state = 'play'; }); await p.waitForTimeout(300); }
  out.death = await closeDialog(); await p.waitForTimeout(1500); await shot('mess');
  await p.evaluate(() => HS.finishDescent()); await p.waitForTimeout(1600); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(1500); await closeDialog();
  await until(() => HS.game.scene === 'town' && HS.game.state === 'play');
  await p.evaluate(() => HS.talk('odile')); await p.waitForTimeout(200); out.outro = await closeDialog();
  for (let i = 0; i < 20 && (await p.evaluate(() => HS.game.state !== 'play')); i++) { await p.evaluate(() => { if (HS.game.state === 'recap') HS.game.state = 'play'; }); await p.waitForTimeout(200); await closeDialog(); }
  out.done = await p.evaluate(() => ({ story: HS.SAVE.story, q: HS.qOf('story9').st, s4: HS.strataOpen(4) }));
  // Stratum IV at Station XII: the Descent panel, the room, a Warden and its phase cry.
  await p.evaluate(() => { HS.game.state = 'play'; HS.startDescent ? HS.startDescent() : null; }); await p.waitForTimeout(300);
  if (await p.evaluate(() => HS.game.state === 'descent')) { await p.evaluate(() => { HS.game.descent.i = 11; HS.game.descent.stratum = 4; }); await p.waitForTimeout(300); await shot('descent-panel'); out.descProblems = await p.evaluate(() => HS.textProblems().length); }
  await p.evaluate(() => { Object.assign(HS.game, { nextDiff: 11, nextStratum: 4, nextOmens: [], nextVigil: 0, nextCell: null, nextStory: null, nextRegion: null }); HS.game.state = 'loading'; HS.game.loadT = 0; });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region); await p.waitForTimeout(1200); await shot('stratum4');
  out.s4 = await p.evaluate(async () => { const r = { stratum: HS.game.run.stratum, foes: [...new Set(HS.enemies.map((e) => e.type))] }; HS.game.run.level = 99; for (const e of HS.enemies) e.dead = true; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden(); await new Promise((q) => setTimeout(q, 2400)); HS.game.dialog = null; HS.game.state = 'play'; const w = HS.game.warden; r.warden = w && w.type; if (w) { w.x = HS.player.x + 90; w.y = HS.player.y; w.hp = w.maxHp * 0.6; } await new Promise((q) => setTimeout(q, 300)); r.say = HS.bossSay && HS.bossSay.text; return r; });
  await p.waitForTimeout(300); await shot('station-roar');
  // The Codex world boss card and the travel map.
  await p.evaluate(() => { HS.game.bossSay = null; for (const e of HS.enemies) e.dead = true; HS.game.warden = null; HS.SAVE.worldBoss = { ossuarch: 2, doorkeeper: 1 }; HS.SAVE.worldBossT = { ossuarch: Date.now() - 3 * 3600e3, doorkeeper: Date.now() - 5 * 60e3 }; HS.openCodex(1, 'play'); const K = HS.game.codex, L = HS.codexLayout(); K.sel = L.list.findIndex((q) => q.id === 'ossuarch'); K.page = Math.floor(K.sel / L.per); });
  await p.waitForTimeout(400); await shot('codex-ossuarch'); out.codex = await p.evaluate(() => HS.codexList(1).find((q) => q.id === 'ossuarch').lines.join(' | ')); out.codexProblems = await p.evaluate(() => HS.textProblems());
  await p.evaluate(() => { HS.game.state = 'play'; HS.enterTown(false); }); await until(() => HS.game.scene === 'town' && HS.game.state === 'play');
  await p.evaluate(() => { HS.SAVE.worldBossT = { ossuarch: Date.now() - 3 * 3600e3, doorkeeper: Date.now() - 5 * 60e3 }; HS.openTravel('salt'); }); await p.waitForTimeout(500); await shot('travel'); out.travelProblems = await p.evaluate(() => HS.textProblems().length);
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
