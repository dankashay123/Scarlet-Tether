// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/setbal.cjs [secs] [station]
// Set balance: each vestment set worn whole with its arms and its own rites,
// a few 4+2 mixes, and no set at all, each in the same endless crowd at one
// Station. The Saint stands near the middle, casts every rite as it comes
// up and dashes now and then. Reports kills a second and damage taken a second.
// ENCH=id,id,... puts those enchants on the worn pieces in slot order (ENCHT=1 or 2,
// default 2), so sets can be checked with enchants on (round 40).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const secs = +(process.argv[2] || 20), station = +(process.argv[3] || 6), seeds = (process.argv[4] || '1,2').split(',').map(Number);
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean); // ONLY=none,font runs just those builds
const ENCH = (process.env.ENCH || '').split(',').filter(Boolean), ENCHT = +(process.env.ENCHT || 2);
// HERO=anchoress adds her own set (round 71). HERO=mendicant runs the same builds as the Mendicant with his own rites for each set (round 50).
const HERO = process.env.HERO || 'saint';
// Round 81: WOUNDS='{"xHalo":1}' runs every build with those Wounds; HPK=0.4 holds health at 40% (for Martyr's Fury).
const WOUNDS = JSON.parse(process.env.WOUNDS || '{}'), HPK = +(process.env.HPK || 1);
// Each class's own sets (round 72) and the rites of each set.
const RITES = HERO === 'anchoress'
  ? { none: ['svolley', 'sward', 'shattered'], reliquary: ['svolley', 'sward', 'shattered'], glass: ['shrapnel', 'splinter', 'hundredshards'], thorn: ['flight', 'shardchain', 'relicpyre'], psalter: ['consecrate', 'mending', 'reliquaryfont'], lantern: ['emberrelic', 'shardknell', 'relicjudge'] }
  : HERO === 'mendicant'
  ? { none: ['smite', 'hook', 'tolling'], iron: ['nailburst', 'shards', 'hundredblows'], road: ['charge', 'vow', 'pyre'], alms: ['smite', 'wellspring', 'deluge'], gaol: ['shackleblow', 'chainsweep', 'verdict'], bell: ['cinderslam', 'toll', 'tolling'] }
  : { none: ['water', 'chain', 'rain'], nails: ['storm', 'nailring', 'volley'], stride: ['step', 'ward', 'pilgrim'], font: ['water', 'asperse', 'font'], confessor: ['brand', 'chain', 'greatpen'], choir: ['hymn', 'censer', 'rain'] };
const SETS = Object.keys(RITES).filter((k) => k !== 'none');
const BUILDS = [['none', null, null], ...SETS.map((k) => [k, k, null]), ...SETS.map((k, i) => [`${k}4+${SETS[(i + 2) % SETS.length]}2`, k, SETS[(i + 2) % SETS.length]])];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); if (process.env.SETK) await p.evaluate((o) => Object.assign(HS.SETK, o), JSON.parse(process.env.SETK)); // SETK='{"choir":1.5}' tries other set numbers
  // PASSIVES=a,b,c,d wears passives, TALENTS='{"might":5}' learns talents, LVL sets the Saint level (round 89).
  // RUB=might (or might,swift) sockets a tier III Rubric of each kind on all three rites of every build (round 100).
  await p.evaluate(([P, T, L, RB]) => { window.__PAS = P; window.__TAL = T; window.__LVL = L; window.__RUB = RB; }, [(process.env.PASSIVES || '').split(',').filter(Boolean), JSON.parse(process.env.TALENTS || '{}'), +(process.env.LVL || 60), (process.env.RUB || '').split(',').filter(Boolean)]);
  const rows = [];
  for (const [name, main, second] of BUILDS.filter(([n]) => !ONLY.length || ONLY.includes(n))) for (const seed of seeds) {
    await p.evaluate(([st, main, second, R, seed, ENCH, ENCHT, HERO, WOUNDS, HPK]) => {
      // The same dice for every build: items, map and crowd come from one seed.
      let x = seed * 2654435761 >>> 0; Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
      window.HS_AUTOSTIG = true; HS.tut.on = false; HS.DEV.god = false; HS.SAVE.virtues = {}; HS.SAVE.altar = { known: [], sockets: {} }; HS.SAVE.passives = window.__PAS || []; HS.SAVE.talents = window.__TAL || {}; HS.SAVE.riteXp = {};
      const il = st, slots = ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'];
      HS.SAVE.equip = {}; for (const sl of slots) HS.SAVE.equip[sl] = HS.makeItem(sl, 2, 'X', undefined, il);
      if (main) {
        const ms = HS.VSETS[main].slots.slice(0, second ? 4 : 6);
        for (const sl of ms) { const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = main; HS.SAVE.equip[sl] = it; }
        if (second) { let n = 0; for (const sl of HS.VSETS[second].slots) { if (n >= 2 || ms.includes(sl)) continue; const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = second; HS.SAVE.equip[sl] = it; n++; } }
        for (const sl of ['bow', 'quiver']) HS.SAVE.equip[sl] = HS.armsItem(main, sl, il);
      }
      // Each build casts its own set's rites (the braces were missing before round 50, so every build cast the none rites).
      const r = R[main || 'none']; HS.SAVE.lvl = window.__LVL || 60; HS.SAVE.hero = HERO; HS.SAVE[HERO === 'mendicant' ? 'mrites' : HERO === 'anchoress' ? 'arites' : 'rites'] = { m1: r[0], m2: r[1], pen: r[2] };
      slots.forEach((sl, i) => { if (ENCH[i]) { HS.SAVE.equip[sl].ench = ENCH[i]; HS.SAVE.equip[sl].enchT = ENCHT; } });
      HS.SAVE.rubrics = []; HS.SAVE.rsock = {}; for (const rid of r) { HS.SAVE.rsock[rid] = []; (window.__RUB || []).forEach((k, j) => { const u = `b${rid}${k}`; HS.SAVE.rubrics.push({ u, r: rid, k, t: 3 }); HS.SAVE.rsock[rid][j] = u; }); } HS.rubBuild();
      HS.game.nextDiff = st - 1; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.game.run.wounds = WOUNDS; HS.applyGear(true);
      for (const e of HS.enemies) e.dead = true;
      // The crowd: kept at 30 around the Saint. Damage taken is counted and healed back.
      const P = HS.player, home = { x: P.x, y: P.y }, mix = ['risen', 'crawler', 'acolyte', 'flagellant', 'risen'];
      window.__S = { taken: 0, kills0: HS.game.kills, t0: HS.game.time, hp: P.maxHp, dashT: 0, rk: 0, n: 0 };
      clearInterval(window.__iv);
      window.__iv = setInterval(() => {
        const S = window.__S; if (HS.game.state !== 'play') { HS.game.state = 'play'; HS.game.stig = null; }
        if (P.hp < S.hp) S.taken += S.hp - P.hp; P.hp = P.maxHp * HPK; S.hp = P.hp; S.n++; if (P.rainT > 0) S.rk++; // share of the time in Reckoning
        const alive = HS.enemies.filter((e) => !e.dead).length;
        for (let k = alive; k < 30; k++) { const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 60, m = HS.spawnMonster(mix[k % mix.length], home.x + Math.cos(a) * d, home.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id }); if (k % 10 === 0) m.tier = 'rare'; }
        HS.input.m1 = true; HS.input.m2 = true; HS.input.pen = true;
        if ((S.dashT -= 0.05) <= 0) { S.dashT = 1.4; const a = Math.random() * Math.PI * 2; HS.input.mx = Math.cos(a); HS.input.my = Math.sin(a); HS.input.dash = true; setTimeout(() => { HS.input.mx = (home.x - P.x) / 80; HS.input.my = (home.y - P.y) / 80; }, 150); setTimeout(() => { HS.input.mx = 0; HS.input.my = 0; }, 450); }
      }, 50);
    }, [station, main, second, RITES, seed, ENCH, ENCHT, HERO, WOUNDS, HPK]);
    await p.waitForTimeout(secs * 1000);
    const m = await p.evaluate(() => { clearInterval(window.__iv); const S = window.__S, dt = HS.game.time - S.t0; return { kps: +((HS.game.kills - S.kills0) / dt).toFixed(2), takenPerS: Math.round(S.taken / dt), maxHp: HS.player.maxHp, secs: Math.round(dt), reck: +(S.rk / Math.max(1, S.n)).toFixed(2) }; });
    rows.push({ build: name, ...m });
  }
  // Average the seeds of each build.
  const avg = BUILDS.filter(([n]) => !ONLY.length || ONLY.includes(n)).map(([name]) => { const r = rows.filter((q) => q.build === name), n = r.length; return { build: name, kps: +(r.reduce((a, q) => a + q.kps, 0) / n).toFixed(2), reck: +(r.reduce((a, q) => a + q.reck, 0) / n).toFixed(2), takenPerS: Math.round(r.reduce((a, q) => a + q.takenPerS, 0) / n), maxHp: Math.round(r.reduce((a, q) => a + q.maxHp, 0) / n) }; });
  console.table(avg);
  console.log(JSON.stringify(avg));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
