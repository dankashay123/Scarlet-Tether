// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round14.cjs <outDir>
// Penitent Cells (panel, a cell run, absolution, banners), set-coloured rites,
// the Drowned Nave props, the settings panel, the Warden's fall.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1000);
  const log = [];
  const wear = (id) => p.evaluate((id) => { HS.SAVE.equip = {}; for (const sl of HS.VSETS[id].slots) { const it = HS.makeItem(sl, 4, 'X', undefined, 6); it.set = id; HS.SAVE.equip[sl] = it; } HS.applyGear(true); }, id);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.SAVE.cleared = 4; HS.SAVE.cells = {}; HS.SAVE.bag = []; });
  // Settings panel.
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(150); await p.screenshot({ path: `${S}/shots/r1-pause.png` });
  await p.evaluate(() => { HS.game.state = 'settings'; const L = HS.setLayout(); const b = L.row(0); HS.settingsTap(b.x + b.w - 3, b.y + 5); }); await p.waitForTimeout(150);
  await p.screenshot({ path: `${S}/shots/r2-settings.png` });
  log.push('fx ' + await p.evaluate(() => HS.opt('fx')));
  await p.evaluate(() => { HS.setOpt('fx', 'full'); HS.game.state = 'play'; });
  // Cells: panel, then the confessor cell with that set worn.
  await wear('confessor');
  await p.evaluate(() => HS.openCells()); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r3-cells.png` });
  await p.evaluate(() => { const r = HS.cellRow(HS.featLayout(), 3); HS.cellsTap(r.x + r.w - 30, r.y + 10); }); await p.waitForTimeout(2600);
  log.push('cell ' + await p.evaluate(() => JSON.stringify({ name: HS.room.name, cell: HS.cell && HS.cell.id, toll: !!HS.game.toll })));
  await p.evaluate(() => { HS.player.hp = HS.player.maxHp = 1e7; }); await p.waitForTimeout(4500);
  log.push('cell waves ' + await p.evaluate(() => JSON.stringify({ foes: HS.enemies.filter((e) => !e.dead && e.cell).length, kills: HS.cell.kills, t: Math.round(HS.cell.t) })));
  await p.evaluate(() => { HS.player.m1cd = 0; HS.player.m2cd = 0; HS.input.m1 = true; HS.input.m2 = true; }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/shots/r4-cell.png` });
  await p.evaluate(() => { HS.cell.kills = HS.CELLS[HS.cell.id].goal; }); await p.waitForTimeout(3600);
  log.push('absolved ' + await p.evaluate(() => JSON.stringify({ cells: HS.SAVE.cells, state: HS.game.state, arms: [...HS.SAVE.bag, ...Object.values(HS.SAVE.equip)].filter((it) => it && it.wset).map((it) => it.slot) })));
  // Banners in town.
  await p.evaluate(() => { HS.SAVE.cells = { nails: true, stride: true, font: true, confessor: true, choir: true }; HS.enterTown(); }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${S}/shots/r5-banners.png` });
  // Rite colours per skin.
  for (const id of ['stride', 'confessor']) {
    await wear(id);
    await p.evaluate(() => { HS.game.nextDiff = 0; HS.game.nextStratum = 1; HS.newRun(); HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e7; const P = HS.player; for (let i = 0; i < 6; i++) HS.spawnMonster('risen', P.x + 50 + i * 6, P.y + (i % 3) * 10 - 10, { room: HS.game.curRoom.id }); });
    await p.waitForTimeout(500);
    await p.evaluate(() => { HS.player.m1cd = 0; HS.player.m2cd = 0; HS.input.m1 = true; HS.input.m2 = true; }); await p.waitForTimeout(700);
    await p.screenshot({ path: `${S}/shots/r6-rites-${id}.png` });
  }
  // Drowned Nave props.
  await p.evaluate(() => { HS.game.nextDiff = 0; HS.game.nextStratum = 2; HS.newRun(); HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e7; });
  log.push('nave ' + await p.evaluate(() => JSON.stringify({ organ: HS.room.props.filter((q) => q.anim === 'organ').length, sunk: HS.room.props.filter((q) => q.anim === 'sunkpew').length, kelp: HS.room.decals.filter((d) => d.kind === 'kelp').length })));
  for (const [i, r] of (await p.evaluate(() => HS.room.rooms.slice(0, 3).map((q) => [q.cx, q.cy]))).entries()) {
    await p.evaluate(([cx, cy]) => { HS.player.x = (cx + 0.5) * 16; HS.player.y = (cy + 1.5) * 16; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 300) e.dead = true; }, r);
    await p.waitForTimeout(500); await p.screenshot({ path: `${S}/shots/r7-nave${i}.png` });
  }
  // The Warden's fall.
  await p.evaluate(() => { HS.spawnWarden('bellwright'); }); await p.waitForTimeout(400);
  await p.evaluate(() => HS.killEnemy(HS.game.warden, 1, 0)); await p.waitForTimeout(250);
  log.push('fall ' + await p.evaluate(() => JSON.stringify({ slowmo: +HS.game.slowmo.toFixed(2), coins: HS.drops.filter((d) => d.kind === 'gold').length })));
  await p.screenshot({ path: `${S}/shots/r8-fall.png` });
  console.log(log.join('\n'));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
