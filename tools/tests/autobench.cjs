// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: [HERO=saint|mendicant|anchoress] [STATION=1] node tools/tests/autobench.cjs [trials] [secs]
// Round 108: how the auto play pilot fares: per trial, kills, health lost (as a share of max health; refilled when
// low so the trial goes on) and what hurt it most. Bare gear unless SET=<set id> (six pieces and arms of that set at
// the Station, Saint level 60) or GEAR=1 (plain gear at the Station). WARDEN=<id> summons that Warden at the start
// and reports the seconds to kill it (wardenT, null if it lived). NOREFILL=1 lets the pilot die (state 'dead', secs = when).
// Round 136: SEED=n builds trial k on map seed n + k, so two sets (or two builds) run on the same maps; the fight itself
// still rolls freely, so expect some spread. Round 138: killBy and dmgBy list the top sources (a rite id, else bolt,
// blade, shard, pool, status, other).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const FOCUS = !!process.env.FOCUS; // round 185: FOCUS=1 clears the crowd every tick (the Warden's own summons stay) so the pilot fights the Warden
const N = +(process.argv[2] || 3), SECS = +(process.argv[3] || 60), HERO = process.env.HERO || 'saint', ST = +(process.env.STATION || 1) - 1, SET = process.env.SET || '', GEAR = !!process.env.GEAR || !!SET, WARDEN = process.env.WARDEN || '', GEARST = +(process.env.GEARST || 0), STRATUM = +(process.env.STRATUM_K || 1), SEED = process.env.SEED, REGION = process.env.REGION || ''; // round 177: REGION=moor|fen|ash|salt plays a HARD trip there at STATION (WARDEN= then summons it as a world boss) // STRATUM_K=2 or 3 plays the Drowned Nave or the Ossuary Spire (round 115) // GEARST=12: gear of that Station (default: the Station played)
// Round 134: SET= also equips that set's own rites (the same table as setbal.cjs); before, every set ran with the starter rites.
const RITES = HERO === 'anchoress'
  ? { none: ['svolley', 'sward', 'shattered'], reliquary: ['svolley', 'sward', 'shattered'], glass: ['shrapnel', 'splinter', 'hundredshards'], thorn: ['flight', 'shardchain', 'relicpyre'], psalter: ['consecrate', 'mending', 'reliquaryfont'], lantern: ['emberrelic', 'shardknell', 'relicjudge'] }
  : HERO === 'mendicant'
  ? { none: ['smite', 'hook', 'tolling'], iron: ['nailburst', 'shards', 'hundredblows'], road: ['charge', 'vow', 'pyre'], alms: ['smite', 'wellspring', 'deluge'], gaol: ['shackleblow', 'chainsweep', 'verdict'], bell: ['cinderslam', 'toll', 'tolling'] }
  : { none: ['water', 'chain', 'rain'], nails: ['storm', 'nailring', 'volley'], stride: ['step', 'ward', 'pilgrim'], font: ['water', 'asperse', 'font'], confessor: ['brand', 'chain', 'greatpen'], choir: ['hymn', 'censer', 'rain'] };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  for (let k = 0; k < N; k++) {
    await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500); await p.evaluate((R) => { window.__RITES = R; }, RITES);
    await p.evaluate(([hero, st, gear, set, gst, sk, seed, region]) => { const il = gst || st + 1; HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.suspend = null; HS.SAVE.autoW = { on: true, off: 2, def: 2, util: 0 };
      if (gear) { HS.SAVE.lvl = 60; for (const sl of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) HS.SAVE.equip[sl] = HS.makeItem(sl, 2, 'X', undefined, il);
        if (set) { for (const sl of HS.VSETS[set].slots.slice(0, 6)) { const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = set; HS.SAVE.equip[sl] = it; } for (const sl of ['bow', 'quiver']) HS.SAVE.equip[sl] = HS.armsItem(set, sl, il); } }
      if (set && window.__RITES && window.__RITES[set]) { const r = window.__RITES[set]; HS.SAVE[hero === 'mendicant' ? 'mrites' : hero === 'anchoress' ? 'arites' : 'rites'] = { m1: r[0], m2: r[1], pen: r[2] }; } HS.applyGear(true); HS.SAVE.cleared = 29; HS.SAVE.autoPlay = true; if (seed != null) HS.game.nextSeed = seed; if (region) { HS.SAVE.story = 6; HS.SAVE.cleared = Math.max(0, st - HS.REGION_HARD); HS.travelRegion(region, st >= HS.REGION_HARD); return; } HS.game.descent = { i: st, t: 0, stratum: sk }; HS.beginDescent(st); }, [HERO, ST, GEAR, SET, GEARST, STRATUM, SEED != null && SEED !== '' ? +SEED + k : null, REGION]);
    await p.waitForFunction(() => HS.game.scene === 'wound' && HS.game.state === 'play', null, { timeout: 20000 });
    if (REGION) await p.evaluate(async () => { HS.game.run.auto = true; HS.SAVE.worldBossT = {}; setInterval(() => { if (HS.game.dialog || HS.game.state === 'dialog') { HS.game.dialog = null; HS.game.state = 'play'; } }, 150); await new Promise((r) => setTimeout(r, 1500)); }); // round 178: keep clearing region scenes (a pilot walking past a person opened one)
    const sanct = await p.evaluate(() => ({ sanct: HS.playerSanctity(), gear: HS.gearSanctity(), might: +HS.mightParts().k.toFixed(2) })); // round 141: the build's Sanctity, to check it against how it plays
    const r = await p.evaluate(async ([secs, warden, refill, focus]) => { HS.DEV.speed = 2; const P = HS.player; let wardenT = null, wd = null, wet = 0, wetStill = 0, n = 0, root = 0; if (warden) { if (focus) for (const e of HS.enemies) e.dead = true; HS.spawnWarden(warden, { world: HS.regionRun() }); wd = HS.game.warden; } const tW = HS.game.time; let lost = 0, was = P.hp, stuck = 0, lx = P.x, ly = P.y; const t0 = performance.now();
      while (performance.now() - t0 < secs * 500) { await new Promise((r) => setTimeout(r, 100)); if (HS.game.state !== 'play') { if (HS.game.state === 'dead') break; continue; } lost += Math.max(0, was - P.hp); if (refill && P.hp < P.maxHp * 0.3) P.hp = P.maxHp; was = P.hp;
        if (focus && wd) for (const e of HS.enemies) if (e !== wd && !e.minion && !e.dead) e.dead = true;
        if (wd && wardenT === null && (wd.dead || !HS.game.warden)) { wardenT = Math.round(HS.game.time - (focus ? tW : 0)); break; } n++; const inPool = HS.hazards.some((hz) => hz.kind === 'pool' && Math.hypot(P.x - hz.x, (P.y - hz.y) / 0.6) < hz.r); if (inPool) { wet++; if (Math.hypot(P.x - lx, P.y - ly) < 1) wetStill++; } if ((P.rootT || 0) > 0 || (P.slowT || 0) > 0) root++; if (Math.hypot(P.x - lx, P.y - ly) < 1) stuck++; lx = P.x; ly = P.y; }
      const hurt = Object.entries(HS.game.run.hurt || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k2, v]) => `${k2} ${Math.round(v)}`);
      const by = (o) => Object.entries(o || {}).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k2, v]) => `${k2} ${Math.round(v)}`); return { killBy: by(HS.game.run.killBy), dmgBy: by(HS.game.run.dmgBy), seed: HS.game.run.seed, stratum: HS.game.run.stratum, wardenT, wardenLeft: wd && !wd.dead ? +(wd.hp / wd.maxHp).toFixed(2) : 0, secs: Math.round(HS.game.time), kills: HS.game.kills, lostK: +(lost / P.maxHp).toFixed(1), still: stuck, samples: n, inPool: wet, inPoolStill: wetStill, rootedOrSlowed: root, pools: HS.hazards.filter((hz) => hz.kind === 'pool').map((hz) => Math.round(hz.r)).slice(0, 8), level: HS.game.run.level, goal: HS.AP.goal, state: HS.game.state, hurt }; }, [SECS, WARDEN, !process.env.NOREFILL, FOCUS]);
    console.log(JSON.stringify({ ...sanct, ...r }));
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
