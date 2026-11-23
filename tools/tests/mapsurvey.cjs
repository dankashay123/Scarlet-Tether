// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/mapsurvey.cjs <outDir> [what] [WxH]
// Round 187: photographs for a look over the maps. `what` is regions, story or both (default): each open-world
// region at its camp and every landmark; each story chapter's map at a few of its zones (foes cleared, the HUD
// left on), so props that blend into the ground or walls are easy to spot.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WHAT = process.argv[3] || 'both', [vw, vh] = (process.argv[4] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/map-${n}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const clear = () => p.evaluate(() => { for (const e of HS.enemies) e.dead = true; HS.game.banner = null; HS.game.dialog = null; if (HS.game.state !== 'play') HS.game.state = 'play'; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 10; HS.SAVE.ending = 1; HS.SAVE.cleared = 29; HS.SAVE.lvl = 60; HS.DEV.god = true; HS.SAVE.god = 1; HS.SAVE.trackFold = true; });
  if (WHAT !== 'story') for (const id of (process.env.ONLY || 'moor,fen,ash,salt,isle').split(',')) {
    await p.evaluate((r) => { HS.game.state = 'play'; HS.travelRegion(r); }, id);
    await until((r) => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region === r, id); await p.waitForTimeout(600);
    await clear(); await p.waitForTimeout(400); await shot(`${id}-camp`);
    const marks = await p.evaluate(() => HS.room.marks.map((m) => [m.kind, m.x, m.y]));
    for (const [k, x, y] of marks) { await p.evaluate(([x, y]) => { HS.player.x = x; HS.player.y = y + 50; }, [x, y]); await p.waitForTimeout(500); await clear(); await p.waitForTimeout(300); await shot(`${id}-${k}`); }
  }
  if (WHAT !== 'regions') for (let k = 0; k < 10; k++) {
    await p.evaluate((c) => { HS.game.state = 'play'; HS.enterTown(false); }, k);
    await until(() => HS.game.scene === 'town' && HS.game.state === 'play');
    await p.evaluate((c) => { HS.SAVE.story = c; HS.ensureQuests(); const q = HS.qOf(`story${c}`); if (q) { q.st = 'active'; q.step = 0; } const C = HS.STORY[c]; Object.assign(HS.game, { nextStory: c, nextStratum: C.stratum, nextMap: C.map, nextSeed: C.seed, nextDiff: 0, nextOmens: [], nextMartyr: false, nextAuto: false, nextVigil: 0, nextCell: null, nextRegion: null }); HS.game.state = 'loading'; HS.game.loadT = 0; }, k); // the chapter's dungeon, as its door opens it
    await until((c) => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.game.run && HS.game.run.story === c && !HS.room.region, k, 120);
    if (!(await p.evaluate(() => HS.game.scene === 'wound' && !HS.room.region))) { console.log('chapter', k + 1, 'did not load'); continue; }
    await p.waitForTimeout(600);
    const zs = await p.evaluate(() => { const R = HS.room.rooms; return [0, Math.floor(R.length / 3), Math.floor(R.length * 2 / 3), R.length - 1].map((i) => R[i]).filter(Boolean).map((r) => [r.cx * 16 + 8, r.cy * 16 + 8]); });
    for (let i = 0; i < zs.length; i++) { await p.evaluate(([x, y]) => { HS.player.x = x; HS.player.y = y; }, zs[i]); await p.waitForTimeout(500); await clear(); await p.waitForTimeout(300); await shot(`ch${k + 1}-${i}`); }
  }
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
