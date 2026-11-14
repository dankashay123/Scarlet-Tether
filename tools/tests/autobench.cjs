// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: [HERO=saint|mendicant|anchoress] [STATION=1] node tools/tests/autobench.cjs [trials] [secs]
// Round 108: how the auto play pilot fares: per trial, kills, health lost (as a share of max health; refilled when
// low so the trial goes on) and what hurt it most. Bare gear unless SET=<set id> (six pieces and arms of that set at
// the Station, Saint level 60) or GEAR=1 (plain gear at the Station). WARDEN=<id> summons that Warden at the start
// and reports the seconds to kill it (wardenT, null if it lived). NOREFILL=1 lets the pilot die (state 'dead', secs = when).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const N = +(process.argv[2] || 3), SECS = +(process.argv[3] || 60), HERO = process.env.HERO || 'saint', ST = +(process.env.STATION || 1) - 1, SET = process.env.SET || '', GEAR = !!process.env.GEAR || !!SET, WARDEN = process.env.WARDEN || '', GEARST = +(process.env.GEARST || 0), STRATUM = +(process.env.STRATUM_K || 1); // STRATUM_K=2 or 3 plays the Drowned Nave or the Ossuary Spire (round 115) // GEARST=12: gear of that Station (default: the Station played)
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  for (let k = 0; k < N; k++) {
    await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500);
    await p.evaluate(([hero, st, gear, set, gst, sk]) => { const il = gst || st + 1; HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.suspend = null; HS.SAVE.autoW = { on: true, off: 2, def: 2, util: 0 };
      if (gear) { HS.SAVE.lvl = 60; for (const sl of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) HS.SAVE.equip[sl] = HS.makeItem(sl, 2, 'X', undefined, il);
        if (set) { for (const sl of HS.VSETS[set].slots.slice(0, 6)) { const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = set; HS.SAVE.equip[sl] = it; } for (const sl of ['bow', 'quiver']) HS.SAVE.equip[sl] = HS.armsItem(set, sl, il); } }
      HS.applyGear(true); HS.SAVE.cleared = 29; HS.SAVE.autoPlay = true; HS.game.descent = { i: st, t: 0, stratum: sk }; HS.beginDescent(st); }, [HERO, ST, GEAR, SET, GEARST, STRATUM]);
    await p.waitForFunction(() => HS.game.scene === 'wound' && HS.game.state === 'play', null, { timeout: 20000 });
    const r = await p.evaluate(async ([secs, warden, refill]) => { HS.DEV.speed = 2; const P = HS.player; let wardenT = null, wd = null, wet = 0, wetStill = 0, n = 0, root = 0; if (warden) { HS.spawnWarden(warden); wd = HS.game.warden; } let lost = 0, was = P.hp, stuck = 0, lx = P.x, ly = P.y; const t0 = performance.now();
      while (performance.now() - t0 < secs * 500) { await new Promise((r) => setTimeout(r, 100)); if (HS.game.state !== 'play') { if (HS.game.state === 'dead') break; continue; } lost += Math.max(0, was - P.hp); if (refill && P.hp < P.maxHp * 0.3) P.hp = P.maxHp; was = P.hp;
        if (wd && wardenT === null && (wd.dead || !HS.game.warden)) { wardenT = Math.round(HS.game.time); break; } n++; const inPool = HS.hazards.some((hz) => hz.kind === 'pool' && Math.hypot(P.x - hz.x, (P.y - hz.y) / 0.6) < hz.r); if (inPool) { wet++; if (Math.hypot(P.x - lx, P.y - ly) < 1) wetStill++; } if ((P.rootT || 0) > 0 || (P.slowT || 0) > 0) root++; if (Math.hypot(P.x - lx, P.y - ly) < 1) stuck++; lx = P.x; ly = P.y; }
      const hurt = Object.entries(HS.game.run.hurt || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k2, v]) => `${k2} ${Math.round(v)}`);
      return { stratum: HS.game.run.stratum, wardenT, secs: Math.round(HS.game.time), kills: HS.game.kills, lostK: +(lost / P.maxHp).toFixed(1), still: stuck, samples: n, inPool: wet, inPoolStill: wetStill, rootedOrSlowed: root, pools: HS.hazards.filter((hz) => hz.kind === 'pool').map((hz) => Math.round(hz.r)).slice(0, 8), level: HS.game.run.level, goal: HS.AP.goal, state: HS.game.state, hurt }; }, [SECS, WARDEN, !process.env.NOREFILL]);
    console.log(JSON.stringify(r));
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
