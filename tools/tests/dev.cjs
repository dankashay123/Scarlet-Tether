// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/dev.cjs <outDir>
// The dev menu: opens from pause, every tab renders, and its buttons work
// (sets into the bag, wear a set, descend, summon a Warden, spawn, toggles).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1000);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.bag = []; HS.SAVE.equip = {}; HS.applyGear(true); HS.game.state = 'pause'; });
  // Tap the DEV button on the pause screen.
  const vp = p.viewportSize();
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(150); await p.screenshot({ path: `${S}/shots/d0-pause.png` });
  await p.evaluate(() => HS.openDev()); await p.waitForTimeout(150);
  // Press a button by its label (dir -1/1 for "< X >" buttons).
  const press = (label, dir = 1) => p.evaluate(([label, dir]) => {
    const c = HS.devCells(HS.devLayout()).find((q) => !q.it.lab && q.it.t.startsWith(label)); if (!c) return `missing ${label}`;
    HS.devTap(dir < 0 ? c.x + 2 : c.x + c.w - 2, c.y + 5); return 'ok';
  }, [label, dir]);
  const tab = (i) => p.evaluate((i) => { const L = HS.devLayout(); HS.devTap(L.x0 + 12 + i * L.tabW + 5, L.tabY + 5); }, i);
  const log = [];
  // SETS
  await tab(0); await p.waitForTimeout(100); await p.screenshot({ path: `${S}/shots/d1-sets.png` });
  const bag0 = await p.evaluate(() => HS.SAVE.bag.length);
  for (let k = 0; k < 5; k++) { const r = await p.evaluate((k) => { const cs = HS.devCells(HS.devLayout()).filter((q) => q.it.t === 'BAG 6'); HS.devTap(cs[k].x + 5, cs[k].y + 5); return HS.SAVE.bag.filter((it) => it.set).length; }, k); log.push(`bag after set ${k}: ${r}`); }
  log.push('sets in bag ' + await p.evaluate(() => JSON.stringify(HS.SAVE.bag.reduce((a, it) => { a[it.set] = (a[it.set] || 0) + 1; return a; }, {}))));
  await press('CLEAR BAG');
  await p.evaluate(() => { const cs = HS.devCells(HS.devLayout()).filter((q) => q.it.t === 'WEAR 6'); HS.devTap(cs[3].x + 5, cs[3].y + 5); });
  log.push('worn skin ' + await p.evaluate(() => HS.G.skin));
  await press('LESSER VOW'); log.push('vow ' + await p.evaluate(() => HS.SAVE.bag.some((it) => it.power === 'vow')));
  // ITEMS
  await tab(1); await p.waitForTimeout(100);
  await press('< ', -1); await press('ADD 5'); log.push('items ' + await p.evaluate(() => HS.SAVE.bag.map((it) => it.ri).join('')));
  await p.screenshot({ path: `${S}/shots/d2-items.png` });
  // HERO
  await tab(2); await p.waitForTimeout(100); await press('GOD MODE'); log.push('god ' + await p.evaluate(() => HS.DEV.god));
  await p.screenshot({ path: `${S}/shots/d3-hero.png` });
  // WORLD: descend to Station III, summon a Warden, spawn foes, reveal.
  await tab(3); await p.waitForTimeout(100);
  await press('< STATION', 1); await press('< STATION', 1); await press('DESCEND'); await p.waitForTimeout(2600);
  log.push('run ' + await p.evaluate(() => JSON.stringify({ scene: HS.game.scene, diff: HS.game.run.diff, state: HS.game.state })));
  await p.evaluate(() => { HS.tut.on = false; HS.openDev(); }); await p.waitForTimeout(100);
  await press('SPAWN 10'); await press('REVEAL MAP'); await press('< ', 1);
  await p.screenshot({ path: `${S}/shots/d4-world.png` });
  await press('SUMMON WARDEN'); await p.waitForTimeout(500);
  log.push('warden ' + await p.evaluate(() => HS.game.warden && HS.game.warden.type));
  await p.evaluate(() => HS.openDev());
  // HERO in a run: levels and wounds.
  await tab(2); await press('+5 LEVELS'); await press('ALL SKILL WOUNDS');
  log.push('hero ' + await p.evaluate(() => JSON.stringify({ lvl: HS.game.run.level, wounds: Object.keys(HS.game.run.wounds).length })));
  // UNLOCK and DEBUG
  await tab(4); await press('ALL STATIONS'); await p.screenshot({ path: `${S}/shots/d5-unlock.png` });
  await tab(5); await press('FPS'); await press('PROFILE'); await press('HITBOXES'); await press('< SPEED', 1);
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/d6-debug.png` });
  log.push('debug ' + await p.evaluate(() => JSON.stringify({ fps: HS.DEV.fps, boxes: HS.DEV.boxes, speed: HS.DEV.speed })));
  await p.evaluate(() => HS.closeDev()); await p.waitForTimeout(500); await p.screenshot({ path: `${S}/shots/d7-boxes.png` });
  console.log(log.join('\n'));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
