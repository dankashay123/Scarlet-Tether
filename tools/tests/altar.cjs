// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/altar.cjs <outDir>
// The Ashen Altar: price, 30% success (round 18) and Chrism; Chrism drops;
// Hallowed drop rates; run levels capped at 15 and paced to the map.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1000);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.bag = []; HS.SAVE.gold = 5000; HS.SAVE.chrism = [2, 1, 1, 1]; HS.SAVE.altar = { known: [], sockets: {} };
    for (const id of ['stormHands', 'emberQuiver', 'saintTooth', 'veilFont', 'pallWard', 'chainHands', 'judgeSeal']) { const L = HS.LEGENDS.find((q) => q.id === id); const it = HS.makeItem(L.slot, 3, L.name, undefined, 1 + Math.floor(Math.random() * 6)); it.power = id; HS.SAVE.bag.push(it); }
    HS.openAltar(); });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/a1-altar.png` });
  // Tap a piece to read it, choose a Consecrated Chrism.
  await p.evaluate(() => { const G = HS.altarGeo(HS.featLayout()); HS.altarTap(G.row(1).x + 20, G.row(1).y + 8); HS.altarTap(G.chip(2).x + 4, G.chip(2).y + 4); });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/a2-read.png` });
  const r = await p.evaluate(() => {
    const out = { chance: [HS.burnChance(-1), HS.burnChance(0), HS.burnChance(1), HS.burnChance(2), HS.burnChance(3)] };
    const it = HS.SAVE.bag.find((q) => q.id === HS.game.altarSel), g0 = HS.SAVE.gold, cost = HS.burnCost(it);
    HS.game.altarChrism = 0; out.failed = HS.burnAtAltar(it, 0.99) === false; out.paid = g0 - HS.SAVE.gold === cost; out.chrismUsed = HS.SAVE.chrism[0] === 1; out.gone = !HS.SAVE.bag.includes(it); out.learned = HS.SAVE.altar.known.length;
    const it2 = HS.SAVE.bag[0]; HS.game.altarSel = it2.id; HS.game.altarChrism = -1; out.win = HS.burnAtAltar(it2, 0.1); out.learned2 = HS.SAVE.altar.known.length;
    HS.SAVE.gold = 0; const it3 = HS.SAVE.bag[0]; out.broke = HS.burnAtAltar(it3, 0) === undefined && HS.SAVE.bag.includes(it3);
    return out;
  });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/a3-after.png` });
  console.log('altar', JSON.stringify(r));
  // Drop rates: Hallowed share of rolled items, by source.
  const rates = await p.evaluate(() => { const f = (boost) => { let h = 0; for (let k = 0; k < 20000; k++) if (HS.rollItem(boost, 5).ri === 3) h++; return (h / 200).toFixed(2) + '%'; }; return { common: f(0), elite: f(1.5), warden: f(2), elite10: f(1.5 + 1.26) }; });
  console.log('hallowed share', JSON.stringify(rates));
  // Levels: a full run of kills reaches 15 at about 75% of the map, never past it.
  const lv = await p.evaluate(() => {
    HS.game.nextDiff = 2; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; window.HS_AUTOSTIG = true;
    const foes = HS.enemies.filter((e) => !e.dead), marks = {}; let n = 0;
    for (const e of foes) { HS.killEnemy(e, 0, 0); n++; const L = HS.game.run.level; if (!marks[L]) marks[L] = Math.round(100 * n / foes.length) + '%'; }
    return { foes: foes.length, base: +HS.game.run.xpBase.toFixed(1), level: HS.game.run.level, at: marks, need: [1, 5, 10, 14].map((l) => HS.xpNeed(l)) };
  });
  console.log('levels', JSON.stringify(lv));
  await p.waitForTimeout(500);
  // A Chrism drop on the floor.
  await p.evaluate(() => { HS.game.state = 'play'; const P = HS.player; for (const e of HS.enemies) e.dead = true; HS.SAVE.chrism = [0, 0, 0, 0]; for (let t = 0; t < 4; t++) HS.drops.push({ kind: 'chrism', tier: t, x: P.x + 30 + t * 14, y: P.y + 20, z: 0, vx: 0, vy: 0, vz: 0, t: 1 }); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/a4-chrism.png` });
  await p.evaluate(() => { const P = HS.player; for (const d of HS.drops) if (d.kind === 'chrism') { d.x = P.x; d.y = P.y; } });
  await p.waitForTimeout(500);
  console.log('state', await p.evaluate(() => JSON.stringify({ st: HS.game.state, sc: HS.game.scene, d: HS.drops.filter((d) => d.kind === 'chrism').length })));
  console.log('picked chrism', JSON.stringify(await p.evaluate(() => HS.SAVE.chrism)));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
