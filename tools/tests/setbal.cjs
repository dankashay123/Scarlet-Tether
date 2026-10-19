// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/setbal.cjs [secs] [station]
// Set balance: each vestment set worn whole with its arms and its own rites,
// a few 4+2 mixes, and no set at all, each in the same endless crowd at one
// Station. The Saint stands near the middle, casts every rite as it comes
// up and dashes now and then. Reports kills a second and damage taken a second.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const secs = +(process.argv[2] || 20), station = +(process.argv[3] || 6), seeds = (process.argv[4] || '1,2').split(',').map(Number);
const RITES = { nails: ['storm', 'nailring', 'volley'], stride: ['step', 'ward', 'pilgrim'], font: ['water', 'asperse', 'font'], confessor: ['brand', 'chain', 'greatpen'], choir: ['hymn', 'censer', 'rain'] };
const BUILDS = [
  ['none', null, null], ['nails', 'nails', null], ['stride', 'stride', null], ['font', 'font', null], ['confessor', 'confessor', null], ['choir', 'choir', null],
  ['nails4+font2', 'nails', 'font'], ['stride4+choir2', 'stride', 'choir'], ['font4+confessor2', 'font', 'confessor'], ['confessor4+nails2', 'confessor', 'nails'], ['choir4+stride2', 'choir', 'stride'],
];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  const rows = [];
  for (const [name, main, second] of BUILDS) for (const seed of seeds) {
    await p.evaluate(([st, main, second, R, seed]) => {
      // The same dice for every build: items, map and crowd come from one seed.
      let x = seed * 2654435761 >>> 0; Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
      window.HS_AUTOSTIG = true; HS.tut.on = false; HS.DEV.god = false; HS.SAVE.virtues = {}; HS.SAVE.altar = { known: [], sockets: {} }; HS.SAVE.passives = []; HS.SAVE.riteXp = {};
      const il = st, slots = ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'];
      HS.SAVE.equip = {}; for (const sl of slots) HS.SAVE.equip[sl] = HS.makeItem(sl, 2, 'X', undefined, il);
      if (main) {
        const ms = HS.VSETS[main].slots.slice(0, second ? 4 : 6);
        for (const sl of ms) { const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = main; HS.SAVE.equip[sl] = it; }
        if (second) { let n = 0; for (const sl of HS.VSETS[second].slots) { if (n >= 2 || ms.includes(sl)) continue; const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = second; HS.SAVE.equip[sl] = it; n++; } }
        for (const sl of ['bow', 'quiver']) HS.SAVE.equip[sl] = HS.armsItem(main, sl, il);
        HS.SAVE.rites = { m1: R[main][0], m2: R[main][1], pen: R[main][2] };
      } else HS.SAVE.rites = { m1: 'water', m2: 'chain', pen: 'rain' };
      HS.game.nextDiff = st - 1; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.game.run.wounds = {}; HS.applyGear(true);
      for (const e of HS.enemies) e.dead = true;
      // The crowd: kept at 30 around the Saint. Damage taken is counted and healed back.
      const P = HS.player, home = { x: P.x, y: P.y }, mix = ['risen', 'crawler', 'acolyte', 'flagellant', 'risen'];
      window.__S = { taken: 0, kills0: HS.game.kills, t0: HS.game.time, hp: P.maxHp, dashT: 0 };
      clearInterval(window.__iv);
      window.__iv = setInterval(() => {
        const S = window.__S; if (HS.game.state !== 'play') { HS.game.state = 'play'; HS.game.stig = null; }
        if (P.hp < S.hp) S.taken += S.hp - P.hp; P.hp = P.maxHp; S.hp = P.hp;
        const alive = HS.enemies.filter((e) => !e.dead).length;
        for (let k = alive; k < 30; k++) { const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 60, m = HS.spawnMonster(mix[k % mix.length], home.x + Math.cos(a) * d, home.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id }); if (k % 10 === 0) m.tier = 'rare'; }
        HS.input.m1 = true; HS.input.m2 = true; HS.input.pen = true;
        if ((S.dashT -= 0.05) <= 0) { S.dashT = 1.4; const a = Math.random() * Math.PI * 2; HS.input.mx = Math.cos(a); HS.input.my = Math.sin(a); HS.input.dash = true; setTimeout(() => { HS.input.mx = (home.x - P.x) / 80; HS.input.my = (home.y - P.y) / 80; }, 150); setTimeout(() => { HS.input.mx = 0; HS.input.my = 0; }, 450); }
      }, 50);
    }, [station, main, second, RITES, seed]);
    await p.waitForTimeout(secs * 1000);
    const m = await p.evaluate(() => { clearInterval(window.__iv); const S = window.__S, dt = HS.game.time - S.t0; return { kps: +((HS.game.kills - S.kills0) / dt).toFixed(2), takenPerS: Math.round(S.taken / dt), maxHp: HS.player.maxHp, secs: Math.round(dt) }; });
    rows.push({ build: name, ...m });
  }
  // Average the seeds of each build.
  const avg = BUILDS.map(([name]) => { const r = rows.filter((q) => q.build === name), n = r.length; return { build: name, kps: +(r.reduce((a, q) => a + q.kps, 0) / n).toFixed(2), takenPerS: Math.round(r.reduce((a, q) => a + q.takenPerS, 0) / n), maxHp: Math.round(r.reduce((a, q) => a + q.maxHp, 0) / n) }; });
  console.table(avg);
  console.log(JSON.stringify(avg));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
