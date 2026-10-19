// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/perf.cjs [secs]
// A dense crowd under split, piercing, arcing bolts: frame time and the
// slowest systems (HS.PROF). Watch for spikes when many foes are hit at once.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const secs = +(process.argv[2] || 8);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run&prof'); await p.waitForTimeout(1000);
  await p.evaluate(() => {
    window.HS_AUTOSTIG = true; HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e7;
    Object.assign(HS.game.run.wounds, { split: 3, pierce: 3, arc: 3, heavy: 2, luck: 5, quick: 3, orbit: 3, nova: 2, choir: 2 });
    HS.applyGear();
    window.__ft = []; let last = performance.now();
    window.__cv = 0; const ce = document.createElement.bind(document); document.createElement = (t) => { if (t === 'canvas') { window.__cv++; const k = (new Error().stack.split('\n')[2] || '').trim().split(' ')[1]; (window.__cvw = window.__cvw || {})[k] = (window.__cvw[k] || 0) + 1; } return ce(t); };
    window.__t0 = [HS.game.time, HS.game.real];
    const tick = () => { const t = performance.now(); window.__ft.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  });
  for (let s = 0; s < secs * 4; s++) {
    await p.evaluate((s) => {
      const P = HS.player, r = HS.game.curRoom;
      if (HS.game.state === 'stig') { HS.game.run.pending = 0; HS.game.state = 'play'; }
      const near = HS.enemies.filter((e) => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 160).length;
      for (let i = near; i < 45; i++) HS.spawnMonster(['risen', 'crawler', 'rat', 'acolyte'][i % 4], P.x + 50 + Math.random() * 70, P.y + (Math.random() - 0.5) * 70, { room: r && r.id });
      P.m1cd = 0; P.m2cd = 0; HS.input.m1 = true; HS.input.m2 = true; if (s % 6 === 0) HS.input.dash = true;
    }, s);
    await p.waitForTimeout(250);
  }
  const r = await p.evaluate(() => { const f = window.__ft.slice(10).sort((a, b) => a - b); const q = (x) => f[Math.floor(f.length * x)].toFixed(1); return { frames: f.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: f[f.length - 1].toFixed(1), prof: Object.fromEntries(Object.entries(HS.PROF).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => [k, +(v / 50).toFixed(2)])), kills: HS.game.kills, canvases: window.__cv, cvFrom: window.__cvw, frozen: +(1 - (HS.game.time - window.__t0[0]) / (HS.game.real - window.__t0[1])).toFixed(2) }; });
  console.log(JSON.stringify(r));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
