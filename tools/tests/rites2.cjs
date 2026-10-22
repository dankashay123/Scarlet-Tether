// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/rites2.cjs <outDir>
// The Rites panel and every rite: picks each one, casts it in a crowd, and
// checks its effect (pools, bolts, binds, burns, ward, Reckoning kinds).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1000);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e7; HS.DEV.god = true; });
  await p.evaluate(() => HS.openRites('play')); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/t0-panel.png` });
  const log = [];
  for (const [slot, ci] of [['m1', 0], ['m2', 1], ['pen', 2]]) {
    for (let i = 0; i < 4; i++) {
      await p.evaluate(([ci, i]) => { HS.SAVE.lvl = 60; HS.openRites('play'); HS.game.riteFocus = ['m1', 'm2', 'pen'][ci]; const b = HS.riteLayout().card(ci, i); HS.ritesTap(b.x + 5, b.y + 5); HS.game.state = 'play'; }, [ci, i]);
      const id = await p.evaluate((slot) => HS.riteOf(slot).id, slot);
      await p.evaluate(() => { const P = HS.player, r = HS.game.curRoom; for (const e of HS.enemies) if (Math.hypot(e.x - P.x, e.y - P.y) < 300) e.dead = true; for (let k = 0; k < 8; k++) HS.spawnMonster('risen', P.x + 50 + (k % 4) * 14, P.y - 20 + Math.floor(k / 4) * 30, { room: r && r.id }); });
      await p.waitForTimeout(1400); // let them rise from the floor
      const before = await p.evaluate(() => ({ bolts: HS.bolts.length }));
      await p.evaluate((slot) => { const P = HS.player; P.m1cd = 0; P.m2cd = 0; P.rainT = 0; P.penance = 999; if (slot === 'pen') HS.input.pen = true; else HS.input[slot] = true; }, slot);
      await p.waitForTimeout(450);
      const st = await p.evaluate(() => ({ pools: HS.pools.length, follow: HS.pools.some((q) => q.follow), bolts: HS.bolts.length, bound: HS.enemies.filter((e) => !e.dead && e.bound > 0).length, burn: HS.enemies.filter((e) => !e.dead && e.burn > 0).length, ward: (HS.player.wardT || 0) > HS.game.time, dash: HS.player.dashT > 0 || HS.skillFx.some((f) => f.kind === 'trail'), wave: HS.skillFx.some((f) => f.kind === 'wave'), rain: HS.player.rainT > 0, kind: HS.player.penKind, pillar: HS.skillFx.some((f) => f.kind === 'pillar'), cd: +HS.player.m1cd.toFixed(1) + '/' + HS.player.m2cd.toFixed(1) }));
      log.push(`${slot} ${id} ${JSON.stringify(st)}`);
      if (i === 1 || i === 2) await p.screenshot({ path: `${S}/shots/t-${slot}-${id}.png` });
      await p.waitForTimeout(1200);
    }
  }
  console.log(log.join('\n'));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
