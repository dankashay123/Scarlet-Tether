// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/enchbal.cjs [secs] [station] [builds] [seeds]
// Gear: the Hundred Nails whole with its arms, every stat mythic (an endgame Saint).
// Enchant balance: the same seeded fight for every build. One enchant at a
// time at tier I and II, then two "every slot enchanted" combos at each tier.
// The crowd is dense (50 foes) so chain effects show. Then the guard phase
// (a fixed ring of foes that cannot die) measures net health lost a second.
// Reports kills a second, crowd damage taken a second and guard loss, each
// against the no-enchant build. Lower guard loss means better defence.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const secs = +(process.argv[2] || 15), station = +(process.argv[3] || 10), only = (process.argv[4] || '').split(',').filter(Boolean), seeds = (process.argv[5] || '1,2').split(',').map(Number);
// HERO=mendicant runs it as the Mendicant with his Nails rites.
const HERO = process.env.HERO || 'saint';
const IDS = ['emberwake', 'stormlink', 'hunger', 'reaper', 'breath', 'boneward', 'thorns', 'bloodlet', 'splinter', 'frostbite', 'echo', 'lastlight', 'relentless', 'phantom', 'tithe', 'ghoststep'];
const SLOTS = ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'];
const BUILDS = [['none', [], 1]];
for (const t of [1, 2]) for (const id of IDS) BUILDS.push([`${id} ${t === 1 ? 'I' : 'II'}`, [id], t]);
for (const t of [1, 2]) { BUILDS.push([`combo A ${t === 1 ? 'I' : 'II'}`, IDS.slice(0, 10), t]); BUILDS.push([`combo B ${t === 1 ? 'I' : 'II'}`, IDS.slice(6), t]); }
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  const rows = [];
  for (const [name, ench, tier] of BUILDS.filter(([n]) => !only.length || only.some((o) => n.startsWith(o)) || n === 'none')) for (const seed of seeds) {
    await p.evaluate(([st, ench, tier, SLOTS, seed, HERO]) => {
      let x = 12345 * seed; Math.random = () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; };
      window.HS_AUTOSTIG = false; HS.tut.on = false; HS.DEV.god = false; HS.SAVE.virtues = {}; HS.SAVE.altar = { known: [], sockets: {} }; HS.SAVE.passives = []; HS.SAVE.riteXp = {};
      // The same ten pieces for every build: made once, then copied.
      if (!window.__eq) {
        const eq = {}; for (const sl of SLOTS) eq[sl] = HS.makeItem(sl, 2, 'X', undefined, st);
        for (const sl of HS.VSETS.nails.slots) { const it = HS.makeItem(sl, 4, 'X', undefined, st); it.set = 'nails'; eq[sl] = it; }
        for (const sl of ['bow', 'quiver']) eq[sl] = HS.armsItem('nails', sl, st);
        for (const it of Object.values(eq)) it.stats = it.stats.map(([k]) => { const [a, b] = HS.qualRange(k, it.ri, 4); return [k, Math.round((a + b) / 2), 4]; });
        window.__eq = JSON.stringify(eq);
      }
      HS.SAVE.equip = JSON.parse(window.__eq);
      ench.forEach((id, i) => { HS.SAVE.equip[SLOTS[i]].ench = id; HS.SAVE.equip[SLOTS[i]].enchT = tier; });
      HS.SAVE.lvl = 60; HS.SAVE.hero = HERO; HS.SAVE.rites = { m1: 'storm', m2: 'nailring', pen: 'volley' }; HS.SAVE.mrites = { m1: 'nailburst', m2: 'shards', pen: 'hundredblows' };
      HS.game.nextDiff = st - 1; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.game.run.wounds = {}; HS.game.run.xpBase = 1e15; HS.applyGear(true); // no level-ups: Wounds would swamp the enchants
      for (const e of HS.enemies) e.dead = true;
      const P = HS.player, home = { x: P.x, y: P.y }, mix = ['risen', 'crawler', 'acolyte', 'flagellant', 'risen'];
      window.__S = { taken: 0, kills0: HS.game.kills, t0: HS.game.time, hp: P.maxHp, dashT: 0, minHp: 1 };
      clearInterval(window.__iv);
      window.__iv = setInterval(() => {
        const S = window.__S; if (HS.game.state !== 'play') { HS.game.state = 'play'; HS.game.stig = null; }
        if (P.hp < S.hp) S.taken += S.hp - P.hp; P.hp = P.maxHp; S.hp = P.hp; HS.game.run.breath = false;
        const alive = HS.enemies.filter((e) => !e.dead).length;
        for (let k = alive; k < 50; k++) { const a = Math.random() * Math.PI * 2, d = 70 + Math.random() * 80; HS.spawnMonster(mix[k % mix.length], home.x + Math.cos(a) * d, home.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id, tier: k % 12 === 0 ? 'rare' : undefined }); }
        HS.input.m1 = true; HS.input.m2 = true; HS.input.pen = true;
        if ((S.dashT -= 0.05) <= 0) { S.dashT = 1.4; const a = Math.random() * Math.PI * 2; HS.input.mx = Math.cos(a); HS.input.my = Math.sin(a); HS.input.dash = true; setTimeout(() => { HS.input.mx = (home.x - P.x) / 80; HS.input.my = (home.y - P.y) / 80; }, 150); setTimeout(() => { HS.input.mx = 0; HS.input.my = 0; }, 400); }
      }, 50);
    }, [station, ench, tier, SLOTS, seed, HERO]);
    await p.waitForTimeout(secs * 1000);
    const crowd = await p.evaluate(() => { clearInterval(window.__iv); const S = window.__S, dt = HS.game.time - S.t0; return { kps: +((HS.game.kills - S.kills0) / dt).toFixed(2), takenPerS: Math.round(S.taken / dt), maxHp: HS.player.maxHp }; });
    // Guard: a steady test of defence. The Saint stands still and keeps shooting;
    // twelve foes that cannot die ring it at fixed places. Health is held at 60%
    // (so Last Light and Second Breath stay out of it); net health lost a second
    // (damage taken less healing) is the measure. Round 41: replaced the
    // single-target column, which swung too much to use.
    await p.evaluate(() => {
      for (const e of HS.enemies) e.dead = true; const P = HS.player; HS.input.mx = HS.input.my = 0; HS.input.dash = false; HS.input.m1 = HS.input.m2 = HS.input.pen = false; P.dashT = 0;
      const mix = ['risen', 'crawler', 'flagellant'], home = { x: P.x, y: P.y };
      window.__ring = []; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, m = HS.spawnMonster(mix[k % 3], home.x + Math.cos(a) * 60, home.y + Math.sin(a) * 42, { room: HS.game.curRoom.id }); m.hp = m.maxHp = 1e12; m.spawnDelay = 0; m.asleep = false; window.__ring.push(m); }
      window.__G = { lost: 0, t0: HS.game.time, hp: Math.round(P.maxHp * 0.6) }; P.hp = window.__G.hp;
      window.__hold = setInterval(() => { const G = window.__G; HS.input.mx = HS.input.my = 0; P.x = home.x; P.y = home.y; if (HS.game.state !== 'play') { HS.game.state = 'play'; HS.game.stig = null; } HS.game.run.breath = false;
        G.lost += G.hp - P.hp; P.hp = G.hp = Math.round(P.maxHp * 0.6); for (const m of window.__ring) if (m.hp < m.maxHp * 0.5) m.hp = m.maxHp; }, 50);
    });
    await p.waitForTimeout(Math.round(secs * 1000 * 0.8));
    const single = await p.evaluate(() => { clearInterval(window.__hold); const G = window.__G; for (const m of window.__ring) m.dead = true; return Math.round(G.lost / (HS.game.time - G.t0)); });
    rows.push({ build: name, ...crowd, guard: single });
    console.log(name, JSON.stringify(crowd), single);
  }
  const names = [...new Set(rows.map((r) => r.build))], avg = (n, k) => { const r = rows.filter((q) => q.build === n); return r.reduce((a, q) => a + q[k], 0) / r.length; };
  const per = names.map((n) => ({ build: n, kps: +avg(n, 'kps').toFixed(2), takenPerS: Math.round(avg(n, 'takenPerS')), guard: Math.round(avg(n, 'guard')) })); rows.length = 0; rows.push(...per);
  const base = rows[0];
  console.table(rows.map((r) => ({ build: r.build, kps: r.kps, 'kills x': +(r.kps / base.kps).toFixed(2), taken: r.takenPerS, 'taken x': +(r.takenPerS / Math.max(1, base.takenPerS)).toFixed(2), guard: r.guard, 'guard x': +(r.guard / Math.max(1, base.guard)).toFixed(2) })));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
