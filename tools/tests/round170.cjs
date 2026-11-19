// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round170.cjs <outDir> [WxH]
// Round 170: the Hollow Moor (dev only): the region builds (size, zones, landmarks, the camp's Waystone, no Toll),
// photos of the camp, a landmark, the stone circle, the barrow door and the map; walking to a landmark finds it;
// RETURN takes you home without clearing a Station. Also the chapter recap card, the Saint bar's tip, the town map's
// tabs and a person with a quest mark winning the button over a place's.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r170-${n}-${vw}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 5; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.lvl = 20; });
  // 1. The moor.
  const t0 = Date.now();
  await p.evaluate(() => { HS.game.nextRegion = 'moor'; HS.game.nextDiff = 0; HS.game.nextStratum = 1; HS.game.state = 'loading'; HS.game.loadT = 0; });
  for (let i = 0; i < 80 && !(await p.evaluate(() => HS.game.scene === 'wound' && HS.game.state === 'play')); i++) await p.waitForTimeout(100);
  out.buildMs = Date.now() - t0;
  out.moor = await p.evaluate(() => ({ region: HS.room.region, name: HS.room.name, w: HS.room.w, h: HS.room.h, zones: HS.room.rooms.length, floor: HS.room.solid.reduce((a, r) => a + r.filter((v) => !v).length, 0), marks: HS.room.marks.map((m) => m.kind), toll: HS.game.toll, foes: HS.enemies.length, props: HS.room.props.length, ret: HS.room.interact.filter((q) => q.label === 'RETURN').length }));
  await p.evaluate(() => { HS.SAVE.god = 1; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 500) e.dead = true; HS.game.banner = null; });
  await p.waitForTimeout(2400); await shot('camp');
  // Each landmark: stand by it, let it be found, photograph it.
  for (const k of ['circle', 'wagons', 'barrows', 'gibbet', 'tor', 'cairns', 'door']) {
    const ok = await p.evaluate((k) => { const m = HS.room.marks.find((q) => q.kind === k); if (!m) return false; HS.player.x = m.x; HS.player.y = m.y + (k === 'door' ? 12 : 40); for (const e of HS.enemies) if (Math.hypot(e.x - m.x, e.y - m.y) < 400) e.dead = true; return true; }, k);
    if (!ok) continue; await p.waitForTimeout(900); await shot(`mark-${k}`);
  }
  out.found = await p.evaluate(() => HS.room.marks.filter((m) => m.found).length);
  out.doorButton = await p.evaluate(() => HS.interact && HS.interact.label);
  await p.evaluate(() => { HS.game.banner = null; HS.game.state = 'map'; }); await p.waitForTimeout(300); await shot('map'); await p.evaluate(() => { HS.game.state = 'play'; });
  // A fight on the moor.
  await p.evaluate(() => { const r = HS.room.rooms.find((q) => q.type === 'combat' && q.mark == null); HS.player.x = (r.cx + 0.5) * 16; HS.player.y = (r.cy + 0.5) * 16; for (let i = 0; i < 8; i++) HS.spawnMonster('risen', HS.player.x + 60 + (i % 4) * 14, HS.player.y - 20 + (i >> 2) * 20, {}); });
  await p.waitForTimeout(1800); await shot('fight');
  // RETURN at the camp: home, no Station cleared, no descent counted.
  const before = await p.evaluate(() => ({ c: HS.SAVE.cleared ?? -1, d: HS.SAVE.descents || 0 }));
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'RETURN'); HS.player.x = it.x; HS.player.y = it.y; });
  await p.waitForTimeout(300); out.returnButton = await p.evaluate(() => HS.interact && HS.interact.label);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(1600);
  out.afterReturn = await p.evaluate((b0) => ({ state: HS.game.state, cleared: (HS.SAVE.cleared ?? -1) === b0.c, descents: (HS.SAVE.descents || 0) === b0.d }), before);
  await p.mouse.click(400, 200); await p.waitForTimeout(1500); out.scene = await p.evaluate(() => HS.game.scene);
  // 2. The chapter recap card (a chapter handed in) and the Saint bar's tip.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.cleared = -1; HS.SAVE.story = 1; const q = HS.qOf('story1') || (HS.SAVE.q.story1 = { st: 'active', step: 1, c: {} }); q.st = 'active'; q.step = 1; HS.game.chRecap = { k: 1, time: 312, kills: 284 }; HS.storyTurnIn(1); });
  await p.waitForTimeout(700); out.recap = await p.evaluate(() => ({ state: HS.game.state, problems: HS.textProblems() })); await shot('recap');
  await p.evaluate(() => { const L = HS.chRecapLayout(), b = L.B.find((q) => q.k === 'go'); HS.onTap(b.x + 4, b.y + 4); });
  await p.waitForTimeout(400); out.wentTo = await p.evaluate(() => { const g = HS.STORY[2].giver, n = HS.room.npcs.find((m) => (m.talk || m.npc) === g); return n ? { state: HS.game.state, d: Math.round(Math.hypot(n.x - HS.player.x, n.y - HS.player.y)), button: HS.interact && HS.interact.label } : { scene: HS.game.scene, state: HS.game.state, npcs: HS.room.npcs.length }; });
  await shot('went');
  // 3. The Saint bar's tip names what the next levels open.
  out.tip = await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.lvl = 12; HS.textAudit(); const t = HS.HOLD_TIPS.concat(HS.BUFF_TIPS || []).find((q) => q.title === 'SAINT LEVEL'); return t && t.text; });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
