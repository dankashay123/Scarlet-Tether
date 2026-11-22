// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round184.cjs <outDir> [WxH]
// Round 184: the Doorkeeper as the Abbey Isle's world boss at its flooded door (only once the door below is shut; its
// call at half health), rust (the Bellwright) and iron filings (the Lady of Nails), the Codex's WORDS section (a READ
// that plays the message and last words, back to the Codex), and the yard's PHASE picker for Wardens.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r184-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const calm = () => p.evaluate(() => { HS.game.dialog = null; if (HS.game.state !== 'play') HS.game.state = 'play'; HS.game.banner = null; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 9; HS.SAVE.ending = 1; HS.SAVE.cleared = 29; HS.SAVE.lvl = 60; HS.DEV.god = true; HS.SAVE.worldBossT = {}; });
  // 1. WORDS in the Codex.
  await p.evaluate(() => { HS.openCodex(7, 'play'); const K = HS.game.codex; K.sel = 8; }); await p.waitForTimeout(400); await shot('words'); out.wordsProblems = await p.evaluate(() => HS.textProblems().length);
  out.words = await p.evaluate(() => { const L = HS.codexLayout(); return { n: L.list.length, seen: L.list.filter((q) => q.seen).length }; });
  out.read = await p.evaluate(() => { const b = HS.game.codex.goBtn; if (!b) return null; HS.codexTap(b.x + 4, b.y + 4); return { state: HS.game.state, who: HS.game.dialog && HS.game.dialog.who[0] }; });
  for (let i = 0; i < 30 && (await p.evaluate(() => HS.game.state === 'dialog')); i++) { await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(120); }
  out.back = await p.evaluate(() => HS.game.state);
  // 2. The isle's door: the Doorkeeper rises, and calls at half health.
  await p.evaluate(() => { HS.game.state = 'play'; HS.travelRegion('isle'); }); await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region === 'isle');
  out.boss = await p.evaluate(async () => { HS.game.run.level = 99; const m = HS.room.marks.find((q) => q.kind === 'door'); for (const e of HS.enemies) e.dead = true; HS.player.x = m.x; HS.player.y = m.y + 60; await new Promise((r) => setTimeout(r, 3000)); HS.game.dialog = null; HS.game.state = 'play'; const w = HS.game.warden; if (!w) return null; const r = { type: w.type, world: w.world }; HS.hurtEnemy(w, w.maxHp * 0.55, false, 1, 0); await new Promise((r2) => setTimeout(r2, 400)); r.called = !!w.called; r.minions = HS.enemies.filter((e) => !e.dead && e.minion).map((e) => e.type); return r; });
  await p.waitForTimeout(600); await calm(); await shot('isle-door');
  // 3. Rust and iron.
  for (const id of ['bellwright', 'ladyOfNails']) {
    await p.evaluate(() => { HS.game.warden = null; for (const e of HS.enemies) e.dead = true; HS.enterTown(false); Object.assign(HS.game, { nextDiff: 9, nextStratum: 1, nextOmens: [], nextVigil: 0, nextCell: null, nextStory: null, nextRegion: null }); HS.game.state = 'loading'; HS.game.loadT = 0; });
    await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region);
    await p.evaluate(async (wid) => { HS.game.run.level = 99; for (const e of HS.enemies) e.dead = true; HS.spawnWarden(wid); await new Promise((r) => setTimeout(r, 2200)); HS.game.dialog = null; HS.game.state = 'play'; const w = HS.game.warden; w.x = HS.player.x + 80; w.y = HS.player.y; for (let k = 0; k < 4; k++) HS.hurtEnemy(w, w.maxHp * 0.12, false, 1, 0); }, id);
    await p.waitForTimeout(900); await calm(); await shot(`${id}-bleeds`);
    await p.evaluate(() => { const w = HS.game.warden; if (w) HS.hurtEnemy(w, w.hp + 10, false, 1, 0); }); for (let i = 0; i < 24; i++) { await p.waitForTimeout(250); await calm(); } await shot(`${id}-fall`);
  }
  // 4. The yard's PHASE picker.
  await p.evaluate(() => { HS.enterTown(false); HS.openYard(); }); await until(() => HS.game.yard && HS.game.state === 'play' && HS.game.scene === 'wound');
  await p.waitForTimeout(600);
  out.yard = await p.evaluate(() => { HS.game.state = 'yard'; HS.game.yard.tab = 3; const G0 = HS.yardGeo(); HS.yardTap(G0.death.x + 10, G0.death.y + 8); HS.yardTap(G0.death.x + 10, G0.death.y + 8); return HS.game.yard.phase; });
  await p.waitForTimeout(300); await shot('yard-phase'); out.yardProblems = await p.evaluate(() => HS.textProblems().length);
  out.yardWarden = await p.evaluate(() => { HS.game.state = 'play'; HS.yardSummon('ossuarch'); const w = HS.game.warden; return w && { phase: w.phase, hp: +(w.hp / w.maxHp).toFixed(2) }; });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
