// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round50.cjs <outDir> [WxH]
// Round 50: the Mendicant's set looks and his own 18 rites: the Rites panel
// as him, every rite cast in a crowd (damage dealt, no errors), Wounds offered.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = { rites: {} };
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r50-${n}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 9; HS.SAVE.lvl = 60; HS.SAVE.hero = 'mendicant'; HS.SAVE.mrites = {}; HS.enterTown(false); });
  await p.waitForTimeout(800);
  // The Rites panel lists his rites, one tab per slot.
  for (const [i, slot] of ['m1', 'm2', 'pen'].entries()) {
    await p.evaluate((slot) => { HS.openRites('play'); HS.game.riteFocus = slot; }, slot); await p.waitForTimeout(200); await shot(`rites-${slot}`);
    out[`problems_${slot}`] = await p.evaluate(() => HS.textProblems());
  }
  out.lists = await p.evaluate(() => ['m1', 'm2', 'pen'].map((s) => HS.riteList(s).map((r) => r.id).join(',')));
  await p.evaluate(() => { HS.game.state = 'play'; });
  // Each set's look (4 pieces).
  out.looks = await p.evaluate(() => HS.MAIN_SETS.concat(['habit']).map((id) => { HS.devSet(id, true); return HS.saintSheet(); }));
  await p.evaluate(() => { HS.devSet('nails', true); });
  await p.waitForTimeout(400); await shot('town-nails-look');
  // A crowd in Stratum I; every rite cast at it.
  await p.evaluate(() => { HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(600);
  const crowd = () => p.evaluate(() => { HS.enemies.length = 0; const P = HS.player, list = [];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, d = 40 + (k % 3) * 22; const e = HS.spawnMonster(k % 4 ? 'risen' : 'acolyte', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id }); if (!e) continue; e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; list.push(e); }
    window.__crowd = list; });
  const dealt = () => p.evaluate(() => Math.round(window.__crowd.reduce((a, e) => a + (e.maxHp - e.hp), 0)));
  for (const slot of ['m1', 'm2', 'pen']) {
    const ids = await p.evaluate((slot) => HS.riteList(slot).map((r) => r.id), slot);
    for (const id of ids) {
      await crowd();
      await p.evaluate(([slot, id]) => { HS.SAVE.mrites[slot] = id; HS.player.m1cd = HS.player.m2cd = 0; HS.player.fireCd = 99; HS.player.penance = HS.T.penance.charge; HS.player.rainT = 0; HS.player.hp = HS.player.maxHp; }, [slot, id]);
      await p.evaluate((slot) => { HS.input[slot] = true; }, slot);
      await p.waitForTimeout(slot === 'pen' ? 1500 : 700);
      out.rites[id] = await dealt();
      if (['smite', 'cinderslam', 'toll', 'tolling', 'hammer', 'chainsweep'].includes(id)) await shot(`cast-${id}`);
      await p.evaluate(() => { HS.player.rainT = 0; HS.player.fireCd = 0; });
    }
  }
  // Wounds offered for his chosen rites.
  out.wounds = await p.evaluate(() => { HS.SAVE.mrites = { m1: 'smite', m2: 'toll', pen: 'tolling' }; const W = HS.WOUNDS.filter((w) => w.rite && ['smite', 'toll', 'tolling'].includes(w.rite)).map((w) => w.id); return W; });
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; HS.enterTown(false); });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
