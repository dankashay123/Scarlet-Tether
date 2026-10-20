// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/dev.cjs <outDir> [WxH]
// The dev menu: opens from pause, every tab renders, and its buttons work
// (sets, items, forge and enchants, descend, summon a Warden, spawn,
// toggles), and every button label fits.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'], p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
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
  const shotTab = async (i, n) => { await tab(i); await p.waitForTimeout(120); await p.screenshot({ path: `${S}/shots/d${i + 1}-${n}.png` }); };
  // Every tab renders, with no label run past its cell.
  for (const [i, n] of ['hero', 'gear', 'forge', 'world', 'town', 'debug'].entries()) await shotTab(i, n);
  // GEAR: a whole set worn with its arms, items at a rarity, the bag.
  await tab(1);
  await press('< ', 1); await press('WEAR SET + ARMS'); log.push('worn skin ' + await p.evaluate(() => `${HS.G.skin} arms ${HS.SAVE.equip.bow && HS.SAVE.equip.bow.wset}`));
  await press('SET TO BAG'); log.push('sets in bag ' + await p.evaluate(() => HS.SAVE.bag.filter((it) => it.set).length));
  await press('CLEAR BAG'); await press('ADD 5'); log.push('items ' + await p.evaluate(() => HS.SAVE.bag.map((it) => it.ri).join('')));
  await press('LESSER VOW'); log.push('vow ' + await p.evaluate(() => HS.SAVE.bag.some((it) => it.power === 'vow')));
  // HERO
  await tab(0); await press('GOD MODE'); await press('MAX RITE RANKS'); log.push('god ' + await p.evaluate(() => `${HS.DEV.god} rank ${HS.riteRank('water')}`));
  // FORGE: Emberstones, a forced mythic reforge, an enchant on every worn piece.
  await tab(2); await press('+50'); await press('< NEXT ROLL', -1);
  log.push('forge ' + await p.evaluate(() => { HS.openForge(); const L = HS.featLayout(); HS.forgeTap(L.btnA.x + 4, L.btnA.y + 4); const it = HS.SAVE.equip.hood || Object.values(HS.SAVE.equip)[0]; HS.openDev(); return `embers ${HS.SAVE.embers} q ${JSON.stringify(Object.values(HS.SAVE.equip).filter(Boolean)[0].stats.map((st) => st[2]))}`; }));
  await press('< ', 1); await press('PUT ON'); log.push('ench ' + await p.evaluate(() => [...HS.G.ench].join(',')));
  await press('WORN TO TIER II'); log.push('tier ' + await p.evaluate(() => JSON.stringify([...HS.G.ench])));
  await press('+1 OF EACH'); log.push('ingr ' + await p.evaluate(() => HS.ingrs().reduce((a, n) => a + n, 0)));
  await p.screenshot({ path: `${S}/shots/d3b-forge-used.png` });
  // WORLD: descend to Station III, summon a Warden, spawn foes, reveal.
  await tab(3);
  await press('< STATION', 1); await press('< STATION', 1); await press('DESCEND'); await p.waitForTimeout(2600);
  log.push('run ' + await p.evaluate(() => JSON.stringify({ scene: HS.game.scene, diff: HS.game.run.diff, state: HS.game.state })));
  await p.evaluate(() => { HS.tut.on = false; HS.openDev(); }); await p.waitForTimeout(100);
  await press('SPAWN 10'); await press('REVEAL MAP'); await press('< ', 1);
  await p.screenshot({ path: `${S}/shots/d4b-world-run.png` });
  await press('SUMMON'); await p.waitForTimeout(500);
  log.push('warden ' + await p.evaluate(() => HS.game.warden && HS.game.warden.type));
  await p.evaluate(() => HS.openDev());
  await tab(0); await press('+5 LEVELS'); await press('ALL SKILL WOUNDS');
  log.push('hero ' + await p.evaluate(() => JSON.stringify({ lvl: HS.game.run.level, wounds: Object.keys(HS.game.run.wounds).length })));
  await tab(2); await press('WARDEN DROPS'); log.push('drops ' + await p.evaluate(() => HS.drops.filter((d) => d.kind === 'ember').length));
  // TOWN and DEBUG
  await tab(4); await press('ALL STATIONS'); await press('+3 BLOODROSE KEYS'); log.push('keys ' + await p.evaluate(() => HS.SAVE.vkeys));
  await tab(5); await press('FPS'); await press('PROFILE'); await press('HITBOXES'); await press('< SPEED', 1);
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/d6b-debug-on.png` });
  log.push('debug ' + await p.evaluate(() => JSON.stringify({ fps: HS.DEV.fps, boxes: HS.DEV.boxes, speed: HS.DEV.speed })));
  // Every button label fits its button.
  log.push('overflow ' + await p.evaluate(() => { const bad = []; for (let t = 0; t < 6; t++) { HS.DEV.tab = t; for (const c of HS.devCells(HS.devLayout())) if (!c.it.lab && HS.textW(c.it.t) > c.w - 6) bad.push(c.it.t); } return JSON.stringify(bad); }));
  await p.evaluate(() => HS.closeDev()); await p.waitForTimeout(500); await p.screenshot({ path: `${S}/shots/d7-boxes.png` });
  console.log(log.join('\n'));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
