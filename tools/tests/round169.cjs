// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round169.cjs <outDir> [WxH]
// Round 169: the board's daily count on the town minimap and map, the Saint level summary back in Vael (a few levels,
// many levels, its buttons), the stick's rim and held ring on a bright floor, and every rare and elite of three packs
// killed at once dying its own way (no old fall-overs once the cap filled).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const k = async () => p.evaluate(() => innerWidth / HS.W);
  const tap = async (x, y) => { const K = await k(); await p.mouse.click(x * K, y * K); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog' || HS.game.state === 'news'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); }
  // 1. The board's dailies on the minimap (one of three done) and on the town map.
  out.board = await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 5; HS.SAVE.eliteKills = 12; HS.SAVE.cleared = Math.max(HS.SAVE.cleared ?? -1, 4); HS.ensureDailies(); const ids = HS.dailyIds().sort(), q = HS.qOf(ids[0]); q.c[q.g[0]] = q.g[1]; HS.game.state = 'play'; HS.game.toast = null; return ids.length; });
  await p.waitForTimeout(300);
  const M = await p.evaluate(() => HS.hud.minimap), K0 = await k();
  await p.screenshot({ path: `${S}/shots/board-mini.png`, clip: { x: (M.x - 4) * K0, y: (M.y - 4) * K0, width: (M.w + 8) * K0, height: (M.h + 8) * K0 } });
  out.boardTag = await p.evaluate(() => HS.game.boardTag && HS.game.boardTag.s);
  await p.evaluate(() => { HS.game.state = 'map'; }); await p.waitForTimeout(200);
  await p.screenshot({ path: `${S}/shots/board-map.png` });
  out.mapText = await p.evaluate(() => HS.textProblems().length);
  out.mapLine = await p.evaluate(() => HS.textAudit().flat().map((q) => q.s).find((s) => /^\d\/\d$/.test(s)) || null);
  await p.evaluate(() => { HS.game.state = 'play'; });
  // 2. The Saint level summary after a descent: three levels (a rite, a passive slot, a rite), then a long climb.
  for (const [from, to, tag] of [[8, 11, 'few'], [1, 52, 'many']]) {
    await p.evaluate(([from, to]) => { HS.SAVE.lvl = to; HS.SAVE.lxp = 0; HS.game.news = null; HS.game.lvStart = from; HS.enterTown(false); HS.game.toast = null; }, [from, to]);
    for (let i = 0; i < 30 && await p.evaluate(() => HS.game.state !== 'saintlv'); i++) await p.waitForTimeout(100);
    await p.waitForTimeout(600);
    out[`lv_${tag}`] = await p.evaluate(() => ({ state: HS.game.state, rows: HS.game.lvUp && HS.game.lvUp.rows.map((r) => `${r.lv} ${r.text}`), text: HS.textProblems() }));
    await p.screenshot({ path: `${S}/shots/saintlv-${tag}-${vw}.png` });
  }
  // A tap outside the card closes it.
  out.outside = await p.evaluate(() => { const st0 = HS.game.state; HS.onTap(3, 3); return { before: st0, after: HS.game.state, gone: HS.game.lvUp === null }; });
  // A fresh summary: its TALENTS button (found from the text log) opens the talents page.
  await p.evaluate(() => { HS.SAVE.lvl = 14; HS.game.lvStart = 12; HS.game.news = null; HS.enterTown(false); });
  for (let i = 0; i < 30 && await p.evaluate(() => HS.game.state !== 'saintlv'); i++) await p.waitForTimeout(100);
  const at = await p.evaluate(() => { const q = HS.textAudit().flat().find((t) => /^talents$/i.test(t.s)); return q && { x: q.x + q.w / 2, y: q.y + 4 }; });
  if (at) { await tap(at.x, at.y); await p.waitForTimeout(250); }
  out.talentsOpened = await p.evaluate(() => HS.game.state);
  await p.screenshot({ path: `${S}/shots/saintlv-talents.png` });
  await p.evaluate(() => { HS.game.state = 'play'; });
  // 3. The stick on the market's cobbles: idle, then held.
  await p.evaluate(() => { const S0 = HS.SITES.find((t) => t.id === 'board'); HS.player.x = S0.x - 120; HS.player.y = HS.room.top * 16 + S0.dy + 60; HS.game.toast = null; }); await p.waitForTimeout(400);
  const J = await p.evaluate(() => ({ x: HS.hud.joy.x, y: HS.hud.joy.y })), K1 = await k();
  await p.screenshot({ path: `${S}/shots/stick-idle.png`, clip: { x: 0, y: vh * 0.55, width: vw * 0.3, height: vh * 0.45 } });
  await p.mouse.move(J.x * K1, J.y * K1); await p.mouse.down(); await p.mouse.move((J.x + 30) * K1, (J.y - 12) * K1); await p.waitForTimeout(150);
  await p.screenshot({ path: `${S}/shots/stick-held.png`, clip: { x: 0, y: vh * 0.55, width: vw * 0.3, height: vh * 0.45 } }); await p.mouse.up();
  // 4. Three rare packs and an elite pack killed within two seconds: every rare and elite crumbles.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.god = 1; HS.SAVE.lvl = 30; HS.enemies.length = 0; const x = HS.player.x + 80, y = HS.player.y;
    HS.spawnPack('risen', 'rare', x, y - 30, 2); HS.spawnPack('knight', 'rare', x + 40, y, 2); HS.spawnPack('crawler', 'rare', x, y + 30, 2); HS.spawnPack('golem', 'elite', x + 60, y + 10, 2); });
  const keep = setInterval(() => p.evaluate(() => { if (HS.game.run) HS.game.run.pending = 0; if (HS.game.state !== 'play') HS.game.state = 'play'; HS.player.hp = HS.player.maxHp; HS.game.banner = null; if (HS.player) HS.player.fireCd = 9; }).catch(() => {}), 120);
  await p.waitForTimeout(1800);
  out.packs = await p.evaluate(async () => { const E = HS.enemies.filter((e) => !e.dead && (e.tier === 'rare' || e.tier === 'elite' || e.elite) && !e.minion); const mine = new Set(E);
    for (const e of E) { HS.hurtEnemy(e, e.hp + 10, false, 1, 0, 0, {}); await new Promise((q) => setTimeout(q, 110)); }
    const cr = HS.falls.filter((f) => f.cr && mine.has(f.e)).length; return { named: E.length, crumbled: cr, oldFalls: HS.falls.filter((f) => !f.cr && !f.wd && mine.has(f.e)).length }; });
  for (let i = 0; i < 3; i++) { await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/packs${i}.png` }); }
  clearInterval(keep);
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
