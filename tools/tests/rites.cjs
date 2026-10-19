// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/rites.cjs [seconds]
// Fires both rites on the same frame over and over in a crowd and checks
// that the frame loop never stops (an error in update or render freezes it).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const secs = +(process.argv[2] || 40);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(800); await p.evaluate(() => { window.HS_AUTOSTIG = true; });
  await p.evaluate(() => { HS.player.hp = HS.player.maxHp = 99999; HS.tut.on = false; });
  const kinds = Object.keys((await p.evaluate(() => Object.fromEntries(Object.entries(HS.MON).filter(([, d]) => d.tier !== 'imp').map(([k]) => [k, 1])))));
  let stalls = 0;
  for (let s = 0; s < secs * 4 && !errs.length; s++) {
    const before = await p.evaluate(() => HS.game.real);
    await p.evaluate((kinds) => {
      const g = HS.game, r = g.curRoom;
      if (g.state === 'stig') { g.run.pending = 0; g.state = 'play'; }
      if (g.state !== 'play') return;
      if (HS.enemies.filter((e) => !e.dead && Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 200).length < 14) for (let i = 0; i < 4; i++) { const k = kinds[Math.floor(Math.random() * kinds.length)]; HS.spawnMonster(k, HS.player.x + (Math.random() - 0.5) * 160, HS.player.y + (Math.random() - 0.5) * 100, { room: r && r.id, tier: Math.random() < 0.3 ? 'rare' : undefined }); }
      HS.player.m1cd = 0; HS.player.m2cd = 0; HS.input.m1 = true; HS.input.m2 = true;
      for (const e of HS.enemies) if (Math.random() < 0.15) e.hp = Math.min(e.hp, 3);
    }, kinds);
    await p.waitForTimeout(250);
    const after = await p.evaluate(() => HS.game.real);
    if (after === before) stalls++;
  }
  // Break a monster's update and another's drawing: the game must keep running.
  const t0 = await p.evaluate(() => { const [a, b] = HS.enemies.filter((e) => !e.dead).sort((p, q) => Math.hypot(p.x - HS.player.x, p.y - HS.player.y) - Math.hypot(q.x - HS.player.x, q.y - HS.player.y)); if (a) a.cds = null; if (b) b.def = { ...b.def, sheet: 'missing' }; return HS.game.real; });
  await p.waitForTimeout(1500);
  const t1 = await p.evaluate(() => HS.game.real);
  console.log('after injected faults: still running', t1 > t0 + 0.3, 'logged', await p.evaluate(() => HS.ERRS.map((e) => e.msg).join(' ; ')));
  const injected = (e) => /cds|missing|anims|null \(reading 'length'\)/.test(e);
  console.log('kills', await p.evaluate(() => HS.game.kills), 'stalls', stalls, 'state', await p.evaluate(() => HS.game.state));
  const real = errs.filter((e) => !injected(e)); console.log('errors', real.length, real.slice(0, 3)); await b.close();
})();
