// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round186.cjs <outDir> [WxH]
// Round 186: Stratum IV's own foes (the Husk, the Lost Saint: spawned, photographed, killed), the Hollow Saint's own
// model as the Stratum's Warden at Station XII (fight, phase cry, its fall, its halo earned), the Vigil Roll's twelve
// stands, the tracker's (LOOK) line on the wreck step and the wreck's ! in the Saltreach, Our Lady of Nails' numbers.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r186-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const calm = () => p.evaluate(() => { HS.game.dialog = null; if (HS.game.state !== 'play') HS.game.state = 'play'; HS.game.banner = null; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 10; HS.SAVE.ending = 1; HS.SAVE.cleared = 29; HS.SAVE.lvl = 60; HS.DEV.god = true; HS.SAVE.god = 1; HS.ensureQuests(); });
  out.lady = await p.evaluate(() => ({ hp: HS.MON.ladyOfNails.hp }));
  // 1. Stratum IV at Station XII: its own foes.
  await p.evaluate(() => { Object.assign(HS.game, { nextDiff: 11, nextStratum: 4, nextOmens: [], nextVigil: 0, nextCell: null, nextStory: null, nextRegion: null }); HS.game.state = 'loading'; HS.game.loadT = 0; });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region); await p.waitForTimeout(800);
  out.pool = await p.evaluate(() => { const c = {}; for (const e of HS.enemies) c[e.type] = (c[e.type] || 0) + 1; return c; });
  await p.evaluate(() => { HS.game.run.level = 99; for (const e of HS.enemies) e.dead = true; const px = HS.player.x, py = HS.player.y;
    for (let i = 0; i < 4; i++) { const e = HS.spawnMonster('husk', px + 50 + i * 14, py - 16 + (i % 2) * 24, { tier: 'common' }); e.spawnDelay = 0; }
    const r = HS.spawnMonster('lostSaint', px - 70, py, { tier: 'rare', affixes: [] }); r.spawnDelay = 0; });
  await p.waitForTimeout(1600); await calm(); await shot('foes');
  out.foes = await p.evaluate(() => HS.enemies.filter((e) => !e.dead).map((e) => e.type));
  await p.evaluate(() => { for (const e of HS.enemies) if (!e.dead) HS.hurtEnemy(e, e.hp + 5, false, 1, 0); }); await p.waitForTimeout(400); await shot('foes-die');
  // 2. The Hollow Saint as the Warden: its model, a phase cry, its fall and halo.
  out.warden = await p.evaluate(async () => { for (const e of HS.enemies) e.dead = true; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden('hollowSaint'); await new Promise((r) => setTimeout(r, 2400)); HS.game.dialog = null; HS.game.state = 'play'; const w = HS.game.warden; w.x = HS.player.x + 90; w.y = HS.player.y; return { type: w.type, title: w.title, sheet: w.def.sheet, walk: w.def.walk }; });
  for (let i = 0; i < 2; i++) { await p.waitForTimeout(1800); await calm(); await shot(`hollow-${i}`); }
  out.say = await p.evaluate(async () => { const w = HS.game.warden; w.hp = w.maxHp * 0.6; await new Promise((r) => setTimeout(r, 300)); return HS.bossSay && HS.bossSay.text; });
  await shot('hollow-phase');
  await p.evaluate(() => { const w = HS.game.warden; HS.hurtEnemy(w, w.hp + 10, false, 1, 0); });
  for (const ms of [500, 1200, 2600]) { await p.waitForTimeout(ms === 500 ? 500 : ms - (ms === 1200 ? 500 : 1200)); await calm(); await shot(`hollow-fall-${ms}`); }
  for (let i = 0; i < 20 && (await p.evaluate(() => HS.game.state === 'stig')); i++) { await p.evaluate(() => { HS.game.state = 'play'; }); await p.waitForTimeout(200); }
  out.halo = await p.evaluate(() => HS.looks().own.includes('h:ink'));
  // 3. The Vigil Roll with twelve stands (every halo earned).
  await p.evaluate(() => { const K = HS.looks(); for (const H0 of HS.HALOS) if (H0.earn && !K.own.includes(`h:${H0.id}`)) K.own.push(`h:${H0.id}`); HS.persist(); HS.enterTown(false); });
  await until(() => HS.game.scene === 'town' && HS.game.state === 'play'); await p.waitForTimeout(800);
  out.overlaps = await p.evaluate(() => HS.townOverlaps());
  await p.evaluate(() => { const R = HS.TOWN_ROLL; HS.player.x = R.x + 130; HS.player.y = R.y + 50; }); await calm(); await p.waitForTimeout(700); await shot('roll');
  // 4. Chapter 6 with the wreck's lore read before: the tracker's (LOOK) line and the ! at the wreck.
  await p.evaluate(() => { HS.SAVE.story = 5; HS.SAVE.lore = { s_wreck: 1 }; const q = HS.qOf('story5') || (HS.ensureQuests(), HS.qOf('story5')); q.st = 'active'; q.step = 0; q.c = { cass: 1, lanternfolk: 1 }; HS.travelRegion('salt'); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region === 'salt'); await p.waitForTimeout(800);
  await p.evaluate(() => { const i = HS.room.interact.find((q) => q.lore === 's_wreck'); for (const e of HS.enemies) e.dead = true; HS.player.x = i.x + 40; HS.player.y = i.y + 20; HS.game.banner = null; });
  await p.waitForTimeout(1500); await calm(); await shot('wreck');
  out.wreck = await p.evaluate(() => ({ spots: HS.loreStepSpots().map((i) => i.lore), pins: HS.questTargets().filter((t) => t.lore).length }));
  out.trackProblems = await p.evaluate(() => HS.textProblems());
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
