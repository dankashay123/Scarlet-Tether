// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round187.cjs <outDir> [WxH]
// Round 187: the calmer region grounds (photos of the Saltreach, the moor and the Ashfields camps), the Ossuary's
// darker floor with bone props (photo), the Husk's death (ash) and the Lost Saint's (it burns away), the Hollow Saint's
// own voice decoded and played at its spawn and fall, the dev menu's stratum picker reaching the Hollow Below.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r187-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const clear = () => p.evaluate(() => { for (const e of HS.enemies) e.dead = true; HS.game.banner = null; HS.game.dialog = null; if (HS.game.state !== 'play') HS.game.state = 'play'; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 10; HS.SAVE.ending = 1; HS.SAVE.cleared = 29; HS.SAVE.lvl = 60; HS.DEV.god = true; HS.SAVE.god = 1; HS.SAVE.trackFold = true; });
  out.voice = await p.evaluate(async () => { const r = {}; for (const n of ['roar_hollowSaint', 'fall_hollowSaint']) { const buf = await (await fetch(`assets/audio/${n}.mp3`)).arrayBuffer(); const ac = new OfflineAudioContext(1, 44100, 44100); const d = await ac.decodeAudioData(buf); r[n] = Math.round(d.duration * 10) / 10; } return r; });
  // 1. The region camps.
  for (const id of ['salt', 'moor', 'ash']) {
    await p.evaluate((r) => { HS.game.state = 'play'; HS.travelRegion(r); }, id);
    await until((r) => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region === r, id); await p.waitForTimeout(700); await clear(); await p.waitForTimeout(300); await shot(`${id}`);
  }
  // 2. Stratum III's floor (bone props on it).
  await p.evaluate(() => { HS.game.state = 'play'; Object.assign(HS.game, { nextDiff: 11, nextStratum: 3, nextOmens: [], nextVigil: 0, nextCell: null, nextStory: null, nextRegion: null, nextMap: 'rooms' }); HS.game.state = 'loading'; HS.game.loadT = 0; });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region); await p.waitForTimeout(800); await clear(); await p.waitForTimeout(300); await shot('ossuary');
  // 3. The Husk's and the Lost Saint's deaths, then the Hollow Saint's voice at its spawn and fall.
  await p.evaluate(() => { HS.game.state = 'play'; Object.assign(HS.game, { nextDiff: 11, nextStratum: 4, nextOmens: [], nextVigil: 0, nextCell: null, nextStory: null, nextRegion: null, nextMap: null }); HS.game.state = 'loading'; HS.game.loadT = 0; });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.game.run.stratum === 4); await p.waitForTimeout(800);
  out.deaths = await p.evaluate(async () => { HS.game.run.level = 99; for (const e of HS.enemies) e.dead = true; const px = HS.player.x, py = HS.player.y, made = [];
    for (let i = 0; i < 4; i++) { const e = HS.spawnMonster('husk', px + 60 + i * 12, py - 10 + (i % 2) * 20, { tier: 'common' }); e.spawnDelay = 0; made.push(e); }
    const r = HS.spawnMonster('lostSaint', px - 70, py, { tier: 'rare', affixes: [] }); r.spawnDelay = 0; for (const e of [...made, r]) { e.state = 'idle'; e.rise = 0; }
    const g0 = HS.gores.length; for (const e of made) if (!e.dead) HS.hurtEnemy(e, e.hp + 5, false, 1, 0); const kinds = HS.gores.slice(g0).map((g) => g.kind);
    if (!r.dead) HS.hurtEnemy(r, r.hp + 5, false, 1, 0); await new Promise((q) => setTimeout(q, 200)); return { husk: kinds, lostDead: r.dead, crumbles: JSON.stringify((HS.falls || []).slice(-2).map((f) => Object.keys(f).filter((k) => typeof f[k] === 'string').map((k) => `${k}=${f[k]}`))) }; });
  await p.waitForTimeout(400); await shot('deaths');
  out.sounds = await p.evaluate(async () => { for (const e of HS.enemies) e.dead = true; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden('hollowSaint'); await new Promise((q) => setTimeout(q, 2400)); HS.game.dialog = null; HS.game.state = 'play';
    const w = HS.game.warden; HS.hurtEnemy(w, w.hp + 10, false, 1, 0); await new Promise((q) => setTimeout(q, 800)); return { hp: w.maxHp, type: w.type }; });
  // 4. The dev menu's stratum picker.
  await p.waitForTimeout(2500);
  out.dev = await p.evaluate(() => { HS.DEV.strat = 4; HS.openDev(); HS.DEV.tab = 3; return HS.DEV.strat; });
  await p.waitForTimeout(400); await shot('dev'); out.devProblems = await p.evaluate(() => HS.textProblems().filter((t) => !/OVERLAP: "[+\d]/.test(t))); // pickup numbers from the play screen under it are not the menu's
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
