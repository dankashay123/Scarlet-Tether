// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/floor.cjs <outDir>
// A descent the new way: a packed random map, the minimap filling in, the
// Toll filling to bring the Warden, the Warden slain, the Waystone home.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(900);
  await p.evaluate(() => { HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e6; HS.game.stigAt = 1e9; });
  console.log('map', await p.evaluate(() => JSON.stringify({ rooms: HS.room.rooms.length, w: HS.room.w, h: HS.room.h, foes: HS.enemies.length, asleep: HS.enemies.filter((e) => e.asleep).length, toll: HS.game.toll, types: HS.room.rooms.map((r) => r.type).join(',') })));
  await p.screenshot({ path: `${S}/shots/t1-start.png` });
  // Walk through every room in turn (teleport hops), letting the fights run.
  const ids = await p.evaluate(() => HS.room.rooms.map((r) => r.id));
  // Walk the corridors between rooms in small steps so the map fills in the
  // way it does in play.
  for (const id of ids.slice(0, 6)) {
    const [tx, ty] = await p.evaluate((id) => { const r = HS.room.rooms[id]; return [(r.cx + 0.5) * 16, (r.cy + 1.5) * 16]; }, id);
    for (let k = 0; k < 12; k++) { await p.evaluate(([tx, ty]) => { const P = HS.player; P.x += (tx - P.x) * 0.25; P.y += (ty - P.y) * 0.25; }, [tx, ty]); await p.waitForTimeout(90); }
    await p.waitForTimeout(700);
  }
  await p.screenshot({ path: `${S}/shots/t2-fight.png` });
  console.log('after walk', await p.evaluate(() => JSON.stringify({ kills: HS.game.kills, toll: HS.game.toll, awake: HS.enemies.filter((e) => !e.asleep && !e.dead).length, seen: HS.room.seen.reduce((a, v) => a + v, 0) })));
  await p.keyboard.press('KeyM'); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/t3-map.png` }); await p.keyboard.press('KeyM');
  // Fill the Toll: the Warden comes.
  await p.evaluate(() => { const t = HS.game.toll; t.v = t.max - 1; const e = HS.enemies.find((q) => !q.dead && !q.illusion && q.type !== 'imp'); HS.killEnemy(e, 1, 0); });
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/t4-warden.png` });
  await p.waitForTimeout(2500); await p.screenshot({ path: `${S}/shots/t5-warden-fight.png` });
  console.log('warden', await p.evaluate(() => { const w = HS.game.warden; return w ? JSON.stringify({ name: w.name, title: w.title, hp: w.hp, attacks: w.def.attacks.map((a) => a.type) }) : 'none'; }));
  // Bring it to each phase, then slay it.
  for (const k of [0.6, 0.3]) { await p.evaluate((k) => { const w = HS.game.warden; w.hp = w.maxHp * k; }, k); await p.waitForTimeout(800); }
  await p.screenshot({ path: `${S}/shots/t6-phase.png` });
  await p.evaluate(() => { const w = HS.game.warden; HS.killEnemy(w, 1, 0); });
  await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/shots/t7-slain.png` });
  console.log('after', await p.evaluate(() => JSON.stringify({ waystone: !!HS.game.waystone, cleared: HS.SAVE.cleared, drops: HS.drops.length })));
  await p.evaluate(() => { HS.game.run.pending = 0; if (HS.game.state === 'stig') HS.game.state = 'play'; const w = HS.game.waystone; HS.player.x = w.x; HS.player.y = w.y + 6; }); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
  await p.screenshot({ path: `${S}/shots/t8-tally.png` });
  console.log('state', await p.evaluate(() => HS.game.state));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
