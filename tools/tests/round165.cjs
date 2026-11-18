// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round165.cjs <outDir> [WxH]
// Round 165: the Crier's news (a stratum, a Station, a Vigil record), check marks in the quest log and on the board,
// a Warden settling, the crossbow ghost behind a tall prop, the town minimap at a small phone.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
const out = {};
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); }
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.story = HS.STORY.length; HS.SAVE.eliteKills = 10; HS.ensureQuests(); HS.SAVE.crierDay = 0; HS.SAVE.name = 'MARA'; });
  // News: Station III's Warden killed (opens the Drowned Nave) and a Vigil record since the Crier last called.
  await p.evaluate(() => { HS.SAVE.crierSeen = { c: 1, v: 3 }; HS.SAVE.cleared = 2; HS.SAVE.vigilBest = 7; const Q = HS.SAVE.q, ids = HS.dailyIds().sort(); Q[ids[0]].st = 'done'; });
  out.pending = await p.evaluate(() => HS.crierEvents(false));
  out.bell = await p.evaluate(() => !!HS.crierNews());
  const cr = await p.evaluate(() => { const n = HS.room.npcs.find((m) => m.talk === 'crier'); return { x: n.x, y: n.y }; });
  await p.evaluate(({ x, y }) => { HS.player.x = x + 50; HS.player.y = y + 20; }, cr);
  const said = [];
  for (let i = 0; i < 40 && said.length < 12; i++) { await p.waitForTimeout(450); const s = await p.evaluate(() => { const n = HS.room.npcs.find((m) => m.talk === 'crier'); return n.cry && n.say ? n.say.text : null; }); if (s && !said.includes(s)) { said.push(s); if (said.length <= 3) await p.screenshot({ path: `${S}/shots/news${said.length}.png` }); } if (!s && said.length) break; }
  out.said = said; out.after = await p.evaluate(() => ({ pending: HS.crierEvents(false).length, bell: !!HS.crierNews(), seen: HS.SAVE.crierSeen }));
  out.textNews = await p.evaluate(() => HS.textProblems().length);
  // Check marks: the quest log and the board.
  await p.evaluate(() => { HS.openStory(null, 'play', 1); }); await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/log.png` });
  out.logText = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; HS.openBoard(); }); await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/board.png` });
  out.boardText = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; });
  // The town minimap at this size, with pins and the bell.
  await p.evaluate(() => { HS.SAVE.crierDay = 0; HS.SAVE.cleared = 5; const n = HS.room.npcs.find((m) => m.talk === 'crier'); n.cry = null; HS.player.x = n.x > 700 ? 380 : 1100; HS.player.y = 560; }); await p.waitForTimeout(500);
  out.bellAgain = await p.evaluate(() => !!HS.crierNews());
  await p.screenshot({ path: `${S}/shots/minimap.png`, clip: { x: vw * 0.6, y: 0, width: vw * 0.4, height: vh * 0.45 } });
  // A dungeon: the crossbow behind the tallest prop.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500);
  out.ghost = await p.evaluate(async () => {
    HS.tut.on = false; HS.SAVE.god = 1; for (const e of HS.enemies) { e.dead = true; e.hp = 0; } HS.enemies.length = 0;
    const hOf = (q) => { const A = HS.SPR[q.sheet || 'props'] && HS.SPR[q.sheet || 'props'].anims[q.anim || q.kind]; return A ? A[(q.frame || 0) % A.length].h : 0; };
    const q = HS.room.props.filter((q) => hOf(q) >= 48).sort((a, b) => hOf(b) - hOf(a))[0]; if (!q) return null;
    HS.player.x = q.x + 26; HS.player.y = q.y - 12; HS.player.face = 1; HS.input.mx = 0; HS.input.my = 0;
    await new Promise((r) => setTimeout(r, 900));
    return { prop: q.anim || q.kind, h: hOf(q), bow: { x: Math.round(HS.player.xb.x), y: Math.round(HS.player.xb.y) }, foot: { x: q.x, y: q.y } };
  });
  await p.screenshot({ path: `${S}/shots/ghost.png` });
  // A Warden: kill it and catch the moment its remains settle.
  out.settle = await p.evaluate(async () => {
    HS.SAVE.god = 1; HS.player.x = HS.room.pw / 2; const id = Object.keys(HS.MON).find((k) => HS.MON[k].warden && !HS.MON[k].stratum);
    const e = HS.spawnMonster(id, HS.player.x + 60, HS.player.y); if (!e) return null; e.state = 'move'; e.spawnDelay = 0;
    await new Promise((r) => setTimeout(r, 300)); HS.killEnemy(e);
    const n = HS.SPR[e.def.sheet].anims[e.def.die].length, at = n * HS.WDIE.step * 1000;
    await new Promise((r) => setTimeout(r, at - 60)); const q0 = HS.pfx.filter((f) => f.kind === 'quake').length;
    await new Promise((r) => setTimeout(r, 160)); return { id, quakes: HS.pfx.filter((f) => f.kind === 'quake').length - q0, shake: HS.game.shake };
  });
  await p.waitForTimeout(80); await p.screenshot({ path: `${S}/shots/settle.png` });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
