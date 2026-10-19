// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/balance.cjs [stations]
// The difficulty check: at each Station, with ten Consecrated pieces at that
// Station's item level (matched) and one Station behind, measures crossbow
// damage per second on a dummy, the Warden's health and the seconds to slay
// it, a common's health, and how many Warden blows the Saint can take.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const stations = (process.argv[2] || '1,3,5,8,11,15').split(',').map(Number);
// Profiles: bare gear; a mid-run build (Wounds of a level-12 Saint); that build in the Hundred Nails with its arms.
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
      if (prof === 'set') { for (const sl of HS.VSETS.nails.slots) { const it = HS.makeItem(sl, 4, 'X', undefined, il); it.set = 'nails'; HS.SAVE.equip[sl] = it; } for (const sl of ['bow', 'quiver']) HS.SAVE.equip[sl] = HS.armsItem('nails', sl, il); }
      HS.game.nextDiff = st - 1; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.game.run.wounds = prof === 'bare' ? {} : { wrath: 3, quick: 2, split: 1, pierce: 1, luck: 2, heavy: 1 }; HS.applyGear(true);
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
