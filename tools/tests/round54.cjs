// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round54.cjs <outDir> [WxH]
// Round 54: the Drowned Font's pools spread (more for the Saint than the
// Mendicant), Font 4 + Confessor 2 pools bind, the Font's card at a small
// phone, and the Mendicant's wind-up.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r54-${n}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 6; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  const wear = (pairs) => p.evaluate((pairs) => { HS.SAVE.equip = {}; for (const [id, n] of pairs) HS.VSETS[id].slots.filter((sl) => !HS.SAVE.equip[sl]).slice(0, n).forEach((sl) => { const it = HS.makeItem(sl, 4, 'X', undefined, 6); it.set = id; HS.SAVE.equip[sl] = it; }); HS.applyGear(true); }, pairs);
  // Pool radius two seconds after it lands, by hero and pieces worn.
  const grow = () => p.evaluate(async () => { HS.pools.length = 0; HS.pools.push({ x: HS.player.x + 60, y: HS.player.y, r: 30, t: 0 }); await new Promise((r) => setTimeout(r, 2000)); return +(HS.pools[0] ? HS.pools[0].r / 30 : 0).toFixed(2); });
  out.grow = {};
  for (const hero of ['saint', 'mendicant']) { await run(hero); for (const n of [0, 4, 6]) { await wear(n ? [['font', n]] : []); out.grow[`${hero}${n}`] = await grow(); } }
  // Font 4 + Confessor 2: a foe that wades into a pool is bound, then keeps losing health.
  await run('saint'); await wear([['font', 4], ['confessor', 2]]);
  out.bind = await p.evaluate(async () => { const P = HS.player, e = HS.spawnMonster('risen', P.x + 80, P.y, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e5; e.speed = 0; HS.player.fireCd = 99;
    HS.pools.length = 0; HS.pools.push({ x: e.x, y: e.y, r: 30, t: 0 }); await new Promise((r) => setTimeout(r, 300)); const bound = e.bound > 0; HS.pools.length = 0; const h0 = e.hp; await new Promise((r) => setTimeout(r, 600)); return { bound, lostWhileBound: Math.round(h0 - e.hp) }; });
  await shot('font-confessor-pool');
  // The Font's card: every bonus in the popup.
  await wear([['font', 6]]);
  await p.evaluate(() => { HS.enemies.length = 0; HS.openInventory(); HS.game.inv.sel = { from: 'equip', slot: HS.VSETS.font.slots[0] }; }); await p.waitForTimeout(400);
  if (await p.evaluate(() => !!HS.game.inv.setTap)) { await p.evaluate(() => { HS.game.setPop = HS.game.inv.setTap.it; }); await p.waitForTimeout(200); }
  await shot('font-card'); out.problems = await p.evaluate(() => HS.textProblems().filter((q) => /[A-Z]{2}/.test(q.replace(/^[A-Z ]+:/, ''))));  // words only: damage numbers behind the bag are not the card's
  await p.evaluate(() => { HS.game.setPop = null; HS.game.state = 'play'; HS.SAVE.equip = {}; HS.applyGear(true); });
  // The Mendicant's wind-up frame.
  await run('mendicant');
  await p.evaluate(() => { const P = HS.player; const e = HS.spawnMonster('risen', P.x + 30, P.y, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e6; e.speed = 0; });
  for (let i = 0; i < 60; i++) { await p.waitForTimeout(10); const t = await p.evaluate(() => HS.MELEE.swing - HS.swingT); if (t > 0.04 && t < 0.075) break; }
  await shot('mendicant-windup');
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
