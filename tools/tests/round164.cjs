// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round164.cjs <outDir> [WxH]
// Round 164: the Crier's plate (DONE and progress lines), his bell on the minimap, the crossbow ghost, walkers by the fountain.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); }
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.story = HS.STORY.length; HS.SAVE.crierDay = 0; HS.SAVE.eliteKills = 10; HS.ensureQuests(); });
  const ids = await p.evaluate(() => HS.dailyIds().sort());
  // One finished, one started: the Crier should say DONE and 1 OF N.
  await p.evaluate((ids) => { const Q = HS.SAVE.q; if (ids[0]) { Q[ids[0]].st = 'done'; } if (ids[1]) { const q = Q[ids[1]]; q.c[q.g[0]] = 1; } }, ids);
  // The bell on the minimap before he calls.
  const cr = await p.evaluate(() => { const n = HS.room.npcs.find((m) => m.talk === 'crier'); return n && { x: n.x, y: n.y }; });
  console.log('crier', JSON.stringify(cr), 'dailies', ids.length);
  await p.evaluate(({ x, y }) => { HS.player.x = x + 400; HS.player.y = y; }, cr); await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/shots/bell.png` });
  await p.evaluate(({ x, y }) => { HS.player.x = x + 50; HS.player.y = y + 20; }, cr);
  const said = [];
  for (let i = 0; i < 24; i++) { await p.waitForTimeout(500); const s = await p.evaluate(() => { const n = HS.room.npcs.find((m) => m.talk === 'crier'); return n.cry && n.say ? n.say.text : null; }); if (s && !said.includes(s)) { said.push(s); await p.screenshot({ path: `${S}/shots/cry${said.length}.png` }); } }
  console.log('said', JSON.stringify(said));
  console.log('text problems', await p.evaluate(() => HS.textProblems().length));
  // Walkers by the fountain: closest pair seen over 30 s, and how often two stand within 10 px.
  const crowd = await p.evaluate(async () => { let close = 0, n = 0, min = 1e9; for (let t = 0; t < 60; t++) { await new Promise((r) => setTimeout(r, 500)); const w = HS.room.npcs.filter((m) => m.path); for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) { const d = Math.hypot(w[i].x - w[j].x, w[i].y - w[j].y); min = Math.min(min, d); n++; if (d < 10) close++; } } return { walkers: HS.room.npcs.filter((m) => m.path).length, min: Math.round(min), close, pairs: n }; });
  console.log('crowd', JSON.stringify(crowd));
  await p.evaluate(() => { HS.player.x = 720; HS.player.y = 600; }); await p.waitForTimeout(800); await p.screenshot({ path: `${S}/shots/fountain.png` });
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
