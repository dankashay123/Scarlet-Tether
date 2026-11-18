// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round166.cjs <outDir> [WxH]
// Round 166: elites rise out of the floor while they spawn; each elite death kind (heap, melt, fade, burst, shatter,
// burn) photographed through its death, with the remains resting and then gone.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.god = 1; HS.enemies.length = 0; });
  const W = await p.evaluate(() => ({ W: HS.W, H: HS.H })), k = vw / W.W;
  const crop = async (name, wx, wy) => { const c = await p.evaluate(([x, y]) => ({ x: x - HS.cam.x, y: y - HS.cam.y }), [wx, wy]); const w = 150, h = 120; await p.screenshot({ path: `${S}/shots/${name}.png`, clip: { x: Math.max(0, (c.x - w / 2) * k), y: Math.max(0, (c.y - h + 30) * k), width: w * k, height: h * k } }); };
  const kinds = [['gravewarden', 'heap'], ['colossus', 'melt'], ['seraph', 'fade'], ['rat', 'burst'], ['golem', 'shatter'], ['abbess', 'burn']];
  out.kinds = [];
  const play = setInterval(() => p.evaluate(() => { if (HS.game.run) HS.game.run.pending = 0; if (HS.game.state !== 'play') HS.game.state = 'play'; HS.player.hp = HS.player.maxHp; HS.drops.length = 0; HS.game.banner = null; HS.game.toast = null; HS.player.fireCd = 9; }).catch(() => {}), 100);
  for (const [type, want] of kinds) {
    const at = await p.evaluate((type) => { HS.enemies.length = 0; const x = HS.player.x + 60, y = HS.player.y; const e = HS.spawnMonster(type, x, y, { tier: 'elite', affixes: [] }); e.speed = 0; e.hp = e.maxHp = 1e9; HS.game.__e = e; return { x, y, state: e.state }; }, type);
    if (type === 'golem') { await p.waitForTimeout(450); await crop('rise', at.x, at.y); }
    await p.waitForTimeout(1300);
    const r = await p.evaluate(() => { const e = HS.game.__e; e.x = HS.player.x + 60; e.y = HS.player.y; e.speed = 0; HS.killEnemy(e, 1, 0); const f = HS.falls.find((q) => q.e === e); return { kind: f && f.cr && f.cr.kind, cells: f && f.cr && f.cr.cells.length, x: e.x, y: e.y }; });
    for (const [ms, tag] of [[300, 'a'], [700, 'b'], [2400, 'c']]) { await p.waitForTimeout(ms - (tag === 'a' ? 0 : tag === 'b' ? 300 : 700)); await crop(`die-${want}-${tag}`, r.x, r.y); }
    const left = await p.evaluate(() => { const f = HS.falls.find((q) => q.cr && q.e === HS.game.__e); return f ? f.cr.cells.filter((c) => c.on).length : 0; });
    out.kinds.push({ type, want, ...r, ok: r.kind === want, left });
    await p.waitForTimeout(8000); // rest and fade
    out.kinds[out.kinds.length - 1].gone = await p.evaluate(() => !HS.falls.some((q) => q.cr && q.e === HS.game.__e));
  }
  clearInterval(play);
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
