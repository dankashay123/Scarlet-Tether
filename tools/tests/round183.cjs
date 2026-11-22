// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round183.cjs <outDir> [WxH]
// Round 183: Vael after the door below is shut (Odile's and Vane's lines, barks, the Crier's news, the title), the
// Vigil Roll's eleven halo stands, the Doorkeeper as a Stratum III Warden at Station XX (title, halo earned), wax
// (Candlemass) and gold (the Cardinal) blood mid-fight and at the fall, and the Saint's own fall (photos).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r183-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const calm = () => p.evaluate(() => { HS.game.dialog = null; if (HS.game.state !== 'play') HS.game.state = 'play'; HS.game.banner = null; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  // 1. Vael after the door.
  out.vael = await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 9; HS.SAVE.ending = 1; HS.SAVE.cleared = 29; HS.SAVE.crierSeen = { c: 29, v: 0, d: 0 };
    return { odile: HS.NPC_INFO.odile.lines()[0], vane: HS.NPC_INFO.vane.lines()[0], title: HS.saintTitle(), crier: HS.crierEvents(false), list: HS.doorList() }; });
  // 2. Every halo earned: eleven stands by the Vigil Roll, in three rows; nothing overlaps in town.
  await p.evaluate(() => { const K = HS.looks(); for (const H0 of HS.HALOS) if (H0.earn && !K.own.includes(`h:${H0.id}`)) K.own.push(`h:${H0.id}`); HS.persist(); HS.enterTown(false); });
  await p.waitForTimeout(1200);
  out.overlaps = await p.evaluate(() => HS.townOverlaps());
  await p.evaluate(() => { const R = HS.TOWN_ROLL; HS.player.x = R.x + 130; HS.player.y = R.y + 40; }); await calm(); await p.waitForTimeout(700); await shot('roll');
  // 3. The Doorkeeper at Station XX in Stratum III: title and halo.
  await p.evaluate(() => { const K = HS.looks(); K.own = K.own.filter((h) => h !== 'h:slate'); HS.persist(); Object.assign(HS.game, { nextDiff: 19, nextStratum: 3, nextOmens: [], nextVigil: 0, nextCell: null, nextStory: null, nextRegion: null }); HS.game.state = 'loading'; HS.game.loadT = 0; });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region);
  out.dk = await p.evaluate(async () => { HS.DEV.god = true; HS.game.run.level = 99; for (const e of HS.enemies) e.dead = true; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden('doorkeeper'); await new Promise((r) => setTimeout(r, 2200));
    const w = HS.game.warden; HS.game.dialog = null; HS.game.state = 'play'; const title = w && w.title; HS.hurtEnemy(w, w.hp + 10, false, 1, 0); await new Promise((r) => setTimeout(r, 2500)); return { title, halo: HS.looks().own.includes('h:slate') }; });
  // 4. Wax and gold: Candlemass and the Cardinal bleed, then fall.
  for (const id of ['candlemass', 'cardinal']) {
    await calm();
    await p.evaluate(async (wid) => { HS.game.warden = null; for (const e of HS.enemies) e.dead = true; HS.spawnWarden(wid); await new Promise((r) => setTimeout(r, 2200)); HS.game.dialog = null; HS.game.state = 'play'; const w = HS.game.warden; w.x = HS.player.x + 80; w.y = HS.player.y; for (let k = 0; k < 4; k++) HS.hurtEnemy(w, w.maxHp * 0.12, false, 1, 0); }, id);
    await p.waitForTimeout(900); await calm(); await shot(`${id}-bleeds`);
    await p.evaluate(() => { const w = HS.game.warden; if (w) HS.hurtEnemy(w, w.hp + 10, false, 1, 0); }); for (let i = 0; i < 24; i++) { await p.waitForTimeout(250); await calm(); } await shot(`${id}-fall`);
  }
  // 5. The Saint's own fall.
  await p.evaluate(() => { HS.DEV.god = false; HS.SAVE.god = 0; for (const e of HS.enemies) e.dead = true; HS.game.warden = null; HS.player.hp = 1; HS.damagePlayer ? HS.damagePlayer(50, HS.player.x + 10, HS.player.y) : (HS.player.hp = 0); if (HS.game.state !== 'dead') HS.die(); });
  for (const [i, ms] of [[0, 250], [1, 600], [2, 1000]]) { await p.waitForTimeout(i ? ms - [250, 600, 1000][i - 1] : ms); await shot(`saint-fall-${i}`); }
  out.dead = await p.evaluate(() => HS.game.state);
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
