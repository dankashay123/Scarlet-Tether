// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/balance.cjs [stations]
// The difficulty check: at each Station, with ten Consecrated pieces at that
// Station's item level (matched) and one Station behind, measures crossbow
// damage per second on a dummy, the Warden's health and the seconds to slay
// it, a common's health, and how many Warden blows the Saint can take.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const stations = (process.argv[2] || '1,3,5,8,11,15').split(',').map(Number);
// Profiles: bare gear; a mid-run build (Wounds of a level-12 Saint); that build in the Hundred Nails with its arms;
// mythic (that set with every stat mythic); chase (mythic plus tier II damage enchants);
// max (chase plus an enchant on every slot, 59 talent points (Saint level 60), altar powers, passives, more Wounds).
const profiles = (process.argv[3] || 'bare,run,set').split(',');
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1000);
  const rows = [];
  for (const prof of profiles) for (const st of stations) for (const lag of [0, 1, 2]) {
    const il = Math.max(1, st - lag);
    const r = await p.evaluate(([st, il, prof]) => {
      window.HS_AUTOSTIG = true; HS.tut.on = false; HS.DEV.god = true; HS.SAVE.virtues = {}; HS.SAVE.altar = { known: [], sockets: {} };
      HS.SAVE.equip = {}; for (const sl of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) { const it = HS.makeItem(sl, 2, 'X', undefined, il); HS.SAVE.equip[sl] = it; }
      if (prof !== 'bare' && prof !== 'run') { for (const sl of HS.VSETS.nails.slots) { const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = 'nails'; HS.SAVE.equip[sl] = it; } for (const sl of ['bow', 'quiver']) HS.SAVE.equip[sl] = HS.armsItem('nails', sl, il); }
      // mythic: every stat at mid mythic. chase: that plus tier II Phantom Volley, Reaper's Mark and Stormlink.
      if (prof === 'mythic' || prof === 'chase') for (const it of Object.values(HS.SAVE.equip)) it.stats = it.stats.map(([k]) => { const [a, b] = HS.qualRange(k, it.ri, 4); return [k, Math.round((a + b) / 2), 4]; });
      if (prof === 'chase' || prof === 'max') [['hood', 'phantom'], ['mantle', 'reaper'], ['gloves', 'stormlink']].forEach(([sl, id]) => { if (HS.SAVE.equip[sl]) { HS.SAVE.equip[sl].ench = id; HS.SAVE.equip[sl].enchT = 2; } });
      // max: a fully farmed account: mythic set, tier II enchants on every slot, 59 talent points (Saint level 60), three altar powers, three passives.
      if (prof === 'max') {
        for (const it of Object.values(HS.SAVE.equip)) it.stats = it.stats.map(([k]) => { const [a, b] = HS.qualRange(k, it.ri, 4); return [k, Math.round((a + b) / 2), 4]; });
        const ids = ['phantom', 'reaper', 'stormlink', 'hunger', 'frostbite', 'bloodlet', 'boneward', 'thorns', 'lastlight', 'tithe'];
        Object.values(HS.SAVE.equip).forEach((it, i) => { it.ench = ids[i % ids.length]; it.enchT = 2; });
        HS.SAVE.altar = { known: ['seal', 'gloves', 'bow'], sockets: { 0: 'seal', 1: 'gloves', 2: 'bow' } };
        HS.SAVE.lvl = 60; HS.SAVE.talents = { might: 5, precise: 5, quick: 5, execute: 3, heavy: 3, pierce: 1, zeal: 3, bane: 3, greatbolt: 1, vigour: 5, warding: 5, mend: 3, feet: 3, quickdash: 3, devout: 5, ritepower: 5, piety: 1 }; HS.SAVE.censerDev = true; HS.SAVE.passives = ['headsman', 'hide', 'devout'];
      } else { HS.SAVE.passives = [null, null, null]; HS.SAVE.talents = {}; }
      HS.game.nextDiff = st - 1; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.game.run.wounds = prof === 'bare' ? {} : prof === 'max' ? { wrath: 5, quick: 3, split: 2, pierce: 2, luck: 3, heavy: 2 } : { wrath: 3, quick: 2, split: 1, pierce: 1, luck: 2, heavy: 1 }; HS.applyGear(true);
      for (const e of HS.enemies) e.dead = true;
      const P = HS.player, d = HS.spawnMonster('risen', P.x + 70, P.y, { room: HS.game.curRoom.id }); d.hp = d.maxHp = 1e12; d.state = 'move'; d.spawnDelay = 0; d.bound = 1e9; d.asleep = false;
      window.__dummy = d; window.__t0 = HS.game.time;
      return { maxHp: P.maxHp, sanct: HS.G.power };
    }, [st, il, prof]);
    await p.waitForTimeout(6000);
    const m = await p.evaluate(([st]) => {
      const d = window.__dummy, dt = HS.game.time - window.__t0, dps = (d.maxHp - d.hp) / dt;
      const P = HS.player, c = HS.spawnMonster('risen', P.x - 200, P.y, { room: HS.game.curRoom.id });
      HS.spawnWarden('bellwright'); const w = HS.game.warden, wa = HS.MON.bellwright.attacks[0];
      const blow = wa.dmg * w.dmgK * HS.curDiff().dmg * HS.G.armorK;
      const res = { dps: Math.round(dps), wardenHp: Math.round(w.maxHp), ttk: Math.round(w.maxHp / dps), commonHp: Math.round(c.maxHp), commonHits: +(c.maxHp / (dps * 0.38)).toFixed(1), blowsToDie: +(P.maxHp / blow).toFixed(1) };
      for (const e of HS.enemies) e.dead = true; HS.game.warden = null;
      return res;
    }, [st]);
    rows.push({ prof, station: st, gearIl: il, ...r, ...m });
  }
  console.table(rows);
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
