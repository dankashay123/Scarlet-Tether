// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round82.cjs <outDir> [WxH]
// Round 82: tapping a held Wound tile shows its card, each reroll in one level costs
// half as much again (and the price resets next level), the sacrifice animation
// (seven tiles breaking, then the mythic card), no text problems at each step.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r82-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 4).join('; ')}`); };
  // Tap at a game-space point.
  const tap = async (x, y) => { const k = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { l: c.left, t: c.top, kx: c.width / HS.W, ky: c.height / HS.H }; }); await p.touchscreen.tap(k.l + x * k.kx, k.t + y * k.ky); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await p.evaluate((hero) => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.applyGear();
      HS.game.nextStratum = 1; HS.game.nextDiff = 5; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; window.HS_AUTOSTIG = false;
      const R = HS.game.run; R.gold = 50000; R.pending = 2; R.wounds = { wrath: 3, luck: 2, swift: 1, vigil: 2, fervent: 1, letting: 2, heavy: 1, crescent: 1, xHalo: 1 }; HS.applyGear(); HS.openStigmata(); }, hero);
    await p.waitForTimeout(700);
    // A held tile opens its card; a second tap closes it.
    const tiles = await p.evaluate(() => HS.heldTiles().map((q) => ({ x: q.x + q.s / 2, y: q.y + q.s / 2, id: q.w.id, n: q.n })));
    const o = out[hero] = { tiles: tiles.length, peeks: [] };
    for (const t of [tiles[0], tiles[1], tiles[tiles.length - 1]]) {
      await tap(t.x, t.y); await p.waitForTimeout(350);
      o.peeks.push(await p.evaluate(() => HS.game.stig.peek && HS.game.stig.peek.w.id) === t.id);
      await check(`${hero} peek ${t.id}`); if (t === tiles[1]) await shot(`peek-${hero}`);
      await tap(200, 150); await p.waitForTimeout(150);
      o.closed = await p.evaluate(() => !HS.game.stig.peek && HS.game.state === 'stig');
    }
    // Rerolls: 1, 1.5, 2.25 times the base; back to the base on the next level.
    o.costs = []; for (let k = 0; k < 3; k++) { o.costs.push(await p.evaluate(() => HS.rerollCost())); await p.evaluate(() => HS.rerollWounds()); }
    await p.waitForTimeout(300); await shot(`reroll-${hero}`); await check(`${hero} reroll`);
    o.gold = await p.evaluate(() => HS.game.run.gold);
    await p.evaluate(() => { HS.game.stig.t = 1; HS.pickStigma(0); HS.openStigmata(); }); await p.waitForTimeout(300);
    o.next = await p.evaluate(() => HS.rerollCost());
    // The sacrifice: the animation, then the card.
    await p.evaluate(() => { HS.game.stig.t = 1; HS.sacrificeWounds(); });
    await p.waitForTimeout(450); o.playing = await p.evaluate(() => !!HS.game.stig.sac); await shot(`sac-${hero}`);
    await tap(200, 150); o.tapIgnored = await p.evaluate(() => HS.game.state === 'stig');
    await p.waitForTimeout(1300); o.done = await p.evaluate(() => !HS.game.stig.sac && !!HS.game.stig.reveal); await shot(`card-${hero}`); await check(`${hero} card`);
    await tap(200, 150); await p.waitForTimeout(200); o.back = await p.evaluate(() => HS.game.state);
  }
  console.log(JSON.stringify(out));
  console.log(probs.length ? `text problems ${probs.length}\n${probs.join('\n')}` : 'text problems 0');
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
