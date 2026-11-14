// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: [HERO=saint|mendicant|anchoress] [STATION=1] node tools/tests/autobench.cjs [trials] [secs]
// Round 108: how the auto play pilot fares: per trial, kills, health lost (as a share of max health; refilled when
// low so the trial goes on) and what hurt it most. Bare gear, so compare runs, not the absolute numbers.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const N = +(process.argv[2] || 3), SECS = +(process.argv[3] || 60), HERO = process.env.HERO || 'saint', ST = +(process.env.STATION || 1) - 1;
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  for (let k = 0; k < N; k++) {
    await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500);
    await p.evaluate(([hero, st]) => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.suspend = null; HS.applyGear(true); HS.SAVE.cleared = 29; HS.SAVE.autoPlay = true; HS.game.descent = { i: st, t: 0 }; HS.beginDescent(st); }, [HERO, ST]);
    await p.waitForFunction(() => HS.game.scene === 'wound' && HS.game.state === 'play', null, { timeout: 20000 });
    const r = await p.evaluate(async (secs) => { HS.DEV.speed = 2; const P = HS.player; let lost = 0, was = P.hp, stuck = 0, lx = P.x, ly = P.y; const t0 = performance.now();
      while (performance.now() - t0 < secs * 500) { await new Promise((r) => setTimeout(r, 100)); if (HS.game.state !== 'play') { if (HS.game.state === 'dead') break; continue; } lost += Math.max(0, was - P.hp); if (P.hp < P.maxHp * 0.3) P.hp = P.maxHp; was = P.hp;
        if (Math.hypot(P.x - lx, P.y - ly) < 1) stuck++; lx = P.x; ly = P.y; }
      const hurt = Object.entries(HS.game.run.hurt || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k2, v]) => `${k2} ${Math.round(v)}`);
      return { kills: HS.game.kills, lostK: +(lost / P.maxHp).toFixed(1), still: stuck, level: HS.game.run.level, goal: HS.AP.goal, state: HS.game.state, hurt }; }, SECS);
    console.log(JSON.stringify(r));
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
