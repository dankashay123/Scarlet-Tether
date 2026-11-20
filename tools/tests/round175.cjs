// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round175.cjs <outDir> [WxH]
// Round 175: the travel map at the gates (four regions, GO), the belfry bells' keepers, tide pools and the chapel's
// lamp on the coast, gulls perched on the boats, hares on the moor, Osanne's lantern in a descent, and the ending
// when the Warden of Station XXX falls.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r175-${n}-${vw}.png` });
  const until = async (fn, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn)); i++) await p.waitForTimeout(100); };
  const closeDlg = async (where) => { let n = 0; for (let i = 0; i < 30 && await p.evaluate(() => HS.game.state === 'dialog' || HS.game.state === 'stig'); i++) { if (where && n++ === 1) await shot(where); await p.evaluate(() => { if (HS.game.state === 'stig') HS.pickStigma(0); }); await p.mouse.click(400, 200); await p.waitForTimeout(150); } return n; };
  const clear = () => p.evaluate(() => { for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 500) e.dead = true; HS.game.banner = null; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 6; HS.SAVE.cleared = 3; HS.SAVE.lvl = 40; HS.game.state = 'play'; HS.ensureQuests(); HS.SAVE.god = 1; HS.DEV.god = true; HS.SAVE.lore = { m_circle: 1, f_dam: 1, f_village: 1 }; });
  // 1. The travel map from the Pilgrims' Gate.
  await p.evaluate(() => { const g = HS.room.interact.find((q) => q.label === 'LEAVE VAEL'); HS.player.x = g.x; HS.player.y = g.y; }); await p.waitForTimeout(400); await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
  out.travel = await p.evaluate(() => ({ state: HS.game.state, problems: HS.textProblems().length })); await shot('travel');
  await p.evaluate(() => { const L = HS.travelLayout(), R = L.card(3); HS.travelTap(R.x + 10, R.y + 10); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'salt');
  // 2. The coast: tide pools, the lamp, gulls on the boats.
  out.salt = await p.evaluate(() => ({ tides: HS.room.tides.length, lamp: !!HS.room.lamp, gulls: (HS.room.crows || []).filter((c) => c.gull).length, tide: Math.round(HS.tideK() * 100) }));
  await clear();
  await p.evaluate(() => { const t = HS.room.tides[0]; if (t) { HS.player.x = t.x + 40; HS.player.y = t.y + 30; } }); await p.waitForTimeout(800); await shot('tide');
  await p.evaluate(() => { const L0 = HS.room.lamp; HS.player.x = L0.x - 40; HS.player.y = L0.y + 200; }); await clear(); await p.waitForTimeout(1000); await shot('lamp');
  await p.evaluate(() => { const g = HS.room.crows.find((c) => c.gull); if (g) { HS.player.x = g.hx + 140; HS.player.y = g.hy + 90; } }); await clear(); await p.waitForTimeout(800); await shot('gulls');
  out.gullsAfter = await p.evaluate(() => (HS.room.crows || []).filter((c) => c.gull).length);
  // 3. The moor's hares.
  await p.evaluate(() => { HS.enterTown(false); HS.travelRegion('moor'); }); await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'moor');
  out.hares = await p.evaluate(() => HS.room.critters.filter((c) => c.kind === 'hare').length);
  await p.evaluate(() => { const c = HS.room.critters[0]; HS.player.x = c.x + 70; HS.player.y = c.y + 20; }); await clear(); await p.waitForTimeout(700); await shot('hare');
  // 4. The belfry's bells call their keepers.
  await p.evaluate(() => { HS.enterTown(false); HS.SAVE.story = 4; const q = HS.qOf('story4') || (HS.SAVE.q.story4 = { st: 'active', step: 0, c: {} }); q.st = 'active'; q.step = 0; q.c = {}; HS.beginStory(4, false); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !!HS.storyFind);
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'SILENCE'); HS.player.x = it.x; HS.player.y = it.y; for (const e of HS.enemies) if (Math.hypot(e.x - it.x, e.y - it.y) < 500) e.dead = true; }); await p.waitForTimeout(400);
  const n0 = await p.evaluate(() => HS.enemies.filter((e) => !e.dead).length); await p.keyboard.press('KeyE'); await p.waitForTimeout(900);
  out.keeper = await p.evaluate((n0) => ({ born: HS.enemies.filter((e) => !e.dead).length - n0, rare: HS.enemies.filter((e) => !e.dead && e.type === 'bellringer').length }), n0); await shot('keeper');
  // 5. Osanne's lantern in a descent, and the ending at Station XXX.
  await p.evaluate(() => { HS.enterTown(false); HS.SAVE.story = 6; HS.SAVE.cleared = 29; HS.SAVE.ending = 0; Object.assign(HS.game, { nextDiff: 29, nextStratum: 1, nextOmens: [], nextVigil: 0, nextCell: null, nextStory: null, nextRegion: null }); HS.game.state = 'loading'; HS.game.loadT = 0; });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region);
  out.lantern = await p.evaluate(() => HS.lanternLit()); await clear(); await p.waitForTimeout(600); await shot('lantern');
  await p.evaluate(() => { HS.spawnWarden(); }); await p.waitForTimeout(600); await closeDlg();
  await p.evaluate(() => { const w = HS.game.warden; if (w) HS.killEnemy(w, 0, 0); }); await p.waitForTimeout(800);
  await until(() => HS.game.state === 'dialog', 120);
  out.ending = await p.evaluate(() => ({ saved: HS.SAVE.ending, dialog: HS.game.state === 'dialog' }));
  out.endingLines = await closeDlg('ending');
  out.logged = await p.evaluate(() => (HS.ERRS || []).map((e) => e.msg).slice(-4));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
