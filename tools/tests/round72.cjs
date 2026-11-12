// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round72.cjs <outDir> [WxH]
// Round 72: each class's own sets. For each class: only its own sets drop, a
// look per set, the gift and cells panels list its sets, set cards, an old
// save's Saint-set pieces migrating; then the forge's ALL LINES list, merged
// hit numbers, the Anchoress's raise frames and the proc lines.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r72-${n}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await p.evaluate((hero) => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 12; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.bag = []; HS.enterTown(false); HS.applyGear(); }, hero);
    out[hero] = await p.evaluate(() => {
      const seen = {}; for (let k = 0; k < 3000; k++) { const it = HS.rollItem(4, 8); const id = it.set || it.wset; if (id) seen[id] = (seen[id] || 0) + 1; }
      const low = {}; for (let k = 0; k < 400; k++) { const it = HS.rollItem(4, 2); if (it.set) low[it.set] = 1; }
      const mine = HS.mySets(), looks = mine.concat([HS.starterSet()]).map((id) => { HS.devSet(id, true); return HS.saintSheet(); });
      return { sets: mine, dropped: Object.keys(seen).sort(), foreign: Object.keys(seen).filter((k) => !mine.includes(k)), starter: Object.keys(low), looks };
    });
    for (const id of await p.evaluate(() => HS.mySets())) { await p.evaluate((id) => HS.devSet(id, true), id); await p.waitForTimeout(120); await shot(`${hero}-${id}`); }
    await p.evaluate(() => { HS.openGift(); }); await p.waitForTimeout(250); await shot(`${hero}-gift`); out[hero].giftProblems = await p.evaluate(() => HS.textProblems());
    await p.evaluate(() => { HS.game.state = 'play'; HS.openCells(); }); await p.waitForTimeout(250); await shot(`${hero}-cells`); out[hero].cellProblems = await p.evaluate(() => HS.textProblems());
    await p.evaluate(() => { HS.game.state = 'play'; HS.devSet(HS.mySets()[1], true); HS.openInventory(); HS.game.inv.sel = { from: 'equip', slot: HS.VSETS[HS.mySets()[1]].slots[0] }; }); await p.waitForTimeout(400); await shot(`${hero}-card`);
    await p.evaluate(() => { HS.game.state = 'play'; HS.openRites('play'); HS.game.riteFocus = 'm1'; }); await p.waitForTimeout(250); await shot(`${hero}-rites`); out[hero].riteSets = await p.evaluate(() => [...new Set(HS.riteList('m1').concat(HS.riteList('m2'), HS.riteList('pen')).map((r) => r.set))].sort());
    await p.evaluate(() => { HS.game.state = 'play'; });
  }
  // An old Mendicant save with Saint-set pieces turns them into his own sets.
  out.migrate = await p.evaluate(() => {
    HS.SAVE.hero = 'mendicant'; HS.SAVE.setsV = 0; HS.SAVE.equip = {}; HS.SAVE.bag = [];
    const a = HS.makeItem('hood', 4, "NAILBEARER'S COWL", undefined, 6); a.set = 'nails'; const c = HS.makeItem('bow', 4, "THE NAILWRIGHT'S ARBALEST", undefined, 6); c.wset = 'nails'; c.set = false;
    HS.SAVE.bag.push(a, c); HS.SAVE.cells = { choir: true }; HS.migrateSets(); return { a: [a.set, a.name], c: [c.wset, c.name], cells: HS.SAVE.cells };
  });
  // The forge's ALL LINES list.
  await p.evaluate(() => { HS.SAVE.hero = 'anchoress'; HS.enterTown(false); HS.openForge(); HS.game.forge.tab = 1; HS.game.forge.list = true; }); await p.waitForTimeout(250); await shot('forge-all-lines'); out.listProblems = await p.evaluate(() => HS.textProblems());
  // A fight: merged numbers, procs, the raise frames.
  await p.evaluate(() => { HS.game.forge.list = false; HS.game.state = 'play'; HS.devSet('glass', true); const it = HS.SAVE.equip.hood; it.ult = [['tempest', 400], ['reaper', 14]]; it.adv = [['echo', 10]]; HS.applyGear();
    HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 4; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(700);
  await p.evaluate(() => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const e = HS.spawnMonster(k % 3 ? 'risen' : 'acolyte', P.x + Math.cos(a) * 70, P.y + Math.sin(a) * 45, { room: HS.game.curRoom.id }); if (e) { e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.awake = true; } } });
  await p.waitForTimeout(1500); await shot('anchoress-fight');
  out.fight = await p.evaluate(() => ({ tempN: HS.player.tempN || 0, raise: !!HS.player.raiseT, kills: HS.game.kills }));
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
