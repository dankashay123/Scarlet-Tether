// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round73.cjs <outDir> [WxH]
// Round 73: the Anchoress's crystal shards in a ring over her head (town,
// fight, Shard Ward, Reliquary Nova), and the level-up cards each class can be
// offered: only its own Wounds and those of the rites it has equipped.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r73-${n}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.lvl = 60; HS.SAVE.hero = 'anchoress'; HS.SAVE.equip = {}; HS.SAVE.arites = {}; HS.enterTown(false); HS.applyGear(); });
  await p.waitForTimeout(900); await shot('town-ring');
  out.ring = await p.evaluate(() => HS.shards.map((s) => [Math.round(s.x - HS.player.x), Math.round(s.y - s.z - HS.player.y), !!s.up]));
  await p.evaluate(() => { HS.game.nextStratum = 1; HS.game.nextDiff = 3; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(600);
  const crowd = () => p.evaluate(() => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const e = HS.spawnMonster('risen', P.x + Math.cos(a) * 90, P.y + Math.sin(a) * 60, { room: HS.game.curRoom.id }); if (e) { e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.awake = true; } } });
  await crowd(); await p.waitForTimeout(700); await shot('fight-ring');
  for (const [slot, id] of [['m2', 'sward'], ['m1', 'snova']]) { await crowd(); await p.evaluate(([slot, id]) => { HS.SAVE.arites[slot] = id; HS.player.m1cd = HS.player.m2cd = 0; HS.input[slot] = true; }, [slot, id]); await p.waitForTimeout(350); await shot(`cast-${id}`); }
  // Level-up cards: roll many times per class with each rite equipped in turn.
  out.cards = await p.evaluate(() => {
    const res = {};
    for (const hero of ['saint', 'mendicant', 'anchoress']) {
      HS.SAVE.hero = hero; const save = HS.riteSave(); const bad = new Set(), seen = new Set();
      for (let r = 0; r < 6; r++) {
        for (const sl of ['m1', 'm2', 'pen']) { const L = HS.riteList(sl); save[sl] = L[r % L.length].id; }
        const on = new Set(['m1', 'm2', 'pen'].map((sl) => HS.riteOf(sl).id));
        HS.game.run.wounds = {};
        for (let k = 0; k < 120; k++) for (const w of HS.rollStigmata()) { seen.add(w.id); if ((w.rite && !on.has(w.rite)) || (w.hero && w.hero !== hero)) bad.add(w.id); }
      }
      res[hero] = { bad: [...bad], own: [...seen].filter((id) => HS.WOUNDS.find((w) => w.id === id).hero), count: seen.size };
    }
    return res;
  });
  await p.evaluate(() => { HS.SAVE.hero = 'anchoress'; window.HS_AUTOSTIG = false; HS.openStigmata(); }); await p.waitForTimeout(400); await shot('cards-anchoress');
  out.cardProblems = await p.evaluate(() => HS.textProblems());
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
