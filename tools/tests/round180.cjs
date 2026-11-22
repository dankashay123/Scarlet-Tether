// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round180.cjs <outDir> [WxH]
// Round 180: the eleven deaths. Each is forced on a foe of a fitting family beside the Saint and photographed up
// close at four moments; then a crowd dies by itself (the picks it made, nothing stuck, frame time) and the floor's
// stains are photographed.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.DEV.god = true; HS.game.dialog = null; HS.game.state = 'play'; HS.game.run.level = 99; for (const e of HS.enemies) { e.dead = true; } HS.enemies.length = 0; HS.player.x += 110; });
  const k = await p.evaluate(() => innerWidth / HS.W);
  const clip = async (name, dx = 0) => { const c = await p.evaluate(() => ({ x: HS.cam.x, y: HS.cam.y, px: HS.player.x, py: HS.player.y })), cx = (c.px + dx - c.x) * k, cy = (c.py - 16 - c.y) * k; await p.screenshot({ path: `${S}/shots/r180-${name}.png`, clip: { x: Math.max(0, cx - 75 * k), y: Math.max(0, cy - 50 * k), width: 150 * k, height: 90 * k } }); };
  const FOE = { burst: 'votary', shred: 'votary', cleave: 'flagellant', pop: 'crawler', crush: 'votary', pool: 'flagellant', geyser: 'votary', bones: 'risen', ash: 'votary', ecto: 'mourner', bile: 'rat' };
  out.kinds = {};
  for (const kind of await p.evaluate(() => HS.GORE_KINDS)) {
    await p.evaluate(([kd, id]) => { HS.GORE_FORCE = kd; for (const e of HS.enemies) e.dead = true; const e = HS.spawnMonster(id, HS.player.x + 60, HS.player.y, { tier: 'common' }); e.state = 'idle'; e.spawnDelay = 0; e.t = 0; e.face = -1; }, [kind, FOE[kind]]);
    await p.waitForTimeout(120);
    await p.evaluate(() => { const e = HS.enemies.find((q) => !q.dead); if (e) HS.hurtEnemy(e, e.hp + 5, false, 1, 0); });
    const shots = [];
    for (const [i, ms] of [[0, 60], [1, 160], [2, 320], [3, 700]]) { await p.waitForTimeout(ms - (i ? [60, 160, 320, 700][i - 1] : 0)); await clip(`${kind}-${i}`, 60); }
    out.kinds[kind] = await p.evaluate(() => ({ live: HS.gores.length, last: HS.gores.length ? HS.gores[HS.gores.length - 1].kind : null }));
    await p.waitForTimeout(1500);
    await clip(`${kind}-floor`, 60);
  }
  // A crowd dies on its own: which deaths it picks, and the frame time while it does.
  await p.evaluate(() => { HS.GORE_FORCE = null; });
  out.crowd = await p.evaluate(async () => {
    const ids = ['votary', 'flagellant', 'crawler', 'risen', 'rat', 'mourner', 'acolyte'], made = [];
    for (let i = 0; i < 40; i++) { const a = i * 0.6, r = 40 + (i % 5) * 16; const e = HS.spawnMonster(ids[i % ids.length], HS.player.x + Math.cos(a) * r, HS.player.y + Math.sin(a) * r * 0.6, { tier: 'common' }); e.state = 'idle'; e.spawnDelay = 0; made.push(e); }
    await new Promise((r) => setTimeout(r, 400));
    const seen = {}, t0 = performance.now(); let frames = 0; const f0 = HS.game.frames || 0;
    for (const e of made) { if (!e.dead) HS.hurtEnemy(e, e.hp + 5, Math.random() < 0.3, Math.random() - 0.5, Math.random() - 0.5); }
    for (const g of HS.gores) seen[g.kind] = (seen[g.kind] || 0) + 1;
    await new Promise((r) => setTimeout(r, 300));
    return { seen, live: HS.gores.length, parts: HS.parts ? HS.parts.length : null };
  });
  await p.waitForTimeout(200); await clip('crowd', 0);
  await p.waitForTimeout(3200); await clip('crowd-after', 0); out.after = await p.evaluate(() => HS.gores.length);
  // Ordinary play: the pilot fights for a while; full-screen photos of the floor it leaves.
  await p.evaluate(() => { HS.game.run.auto = true; HS.DEV.god = true; });
  for (let i = 0; i < 3; i++) { await p.waitForTimeout(6000); await p.evaluate(() => { if (HS.game.state !== 'play') HS.game.state = 'play'; HS.game.banner = null; }); await p.screenshot({ path: `${S}/shots/r180-play-${i}.png` }); }
  out.play = await p.evaluate(() => ({ kills: HS.game.kills, live: HS.gores.length }));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
