// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round110.cjs <outDir> [WxH]
// Round 110: Auto Wounds' STOP FOR A STIGMA and REROLL A WEAK DRAW, the AUTO window's new rows, the pause screen
// (no HUD under it, held Wounds as tiles that open the Wounds page), the tally of an auto play run, and the Hundred
// Nails split bug (bolts must not multiply without end in a crowd).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r110-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?run&dev'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.enemies.length = 0; HS.SAVE.autoW = { on: true, off: 2, def: 0, util: 0, stop: true, reroll: false }; });
  // Stop for a Stigma: levels pass by themselves until a Stigma card is offered, then the screen opens.
  out.stop = await p.evaluate(async () => { let n = 0; for (let k = 0; k < 60 && HS.game.state === 'play'; k++) { HS.game.run.wounds = {}; HS.game.run.pending = 1; HS.openStigmata(); n++; } return { opened: HS.game.state, after: n, stigma: HS.game.stig ? HS.game.stig.cards.some((c) => c.r >= 2) : false }; });
  await p.evaluate(() => { HS.pickStigma(0); });
  // Reroll a weak draw: with only defence rated and enough gold, a draw with no defence card is paid for once.
  out.reroll = await p.evaluate(() => { const A = HS.autoW(); Object.assign(A, { off: 0, def: 2, util: 0, stop: false, reroll: true }); const R = HS.game.run; R.gold = 1e6; let paid = 0, tries = 0; for (let k = 0; k < 40; k++) { R.wounds = {}; R.pending = 1; const g = R.gold; HS.openStigmata(); tries++; if (R.gold < g) paid++; }
    R.gold = 0; let broke = 0; for (let k = 0; k < 20; k++) { R.wounds = {}; R.pending = 1; HS.openStigmata(); if (R.gold < 0) broke++; } A.reroll = false; return { tries, paid, broke, state: HS.game.state }; });
  // The AUTO window with its two new rows.
  await p.evaluate(() => { HS.game.run.wounds = { wrath: 3, vigil: 2, crescent: 1, swift: 1, quick: 2 }; HS.applyGear(); HS.game.state = 'pause'; });
  await p.waitForTimeout(400); await check('pause'); await shot('pause');
  out.pause = await p.evaluate(() => { const T = HS.game.pauseWounds || [], q = T[1]; HS.pauseTap(q.x + 3, q.y + 3); return { tiles: T.length, state: HS.game.state, sel: HS.game.woundWin && HS.game.woundWin.sel }; });
  await p.evaluate(() => { HS.game.state = 'pause'; const t = HS.pauseLayout().tiles.find((q) => q.id === 'auto'); HS.pauseTap(t.x + 4, t.y + 4); }); await p.waitForTimeout(400); await check('autowin'); await shot('autowin');
  out.win = await p.evaluate(() => { const L = HS.autoWinLayout(), A = HS.autoW(); HS.autoWinTap(L.row(4).x + 4, L.row(4).y + 4); HS.autoWinTap(L.row(5).x + 4, L.row(5).y + 4); const o = { stop: A.stop, reroll: A.reroll, fits: L.y0 >= 0 && L.y0 + L.ph <= HS.H }; A.stop = false; A.reroll = false; HS.game.state = 'play'; return o; });
  // The Hundred Nails at two pieces in a crowd: the bolt count stays sane.
  out.nails = await p.evaluate(async () => { HS.SAVE.autoW.on = true; HS.DEV.god = true; for (const sl of HS.VSETS.nails.slots.slice(0, 6)) { const it = HS.makeItem(sl, 4, 'X', undefined, 1); it.set = 'nails'; HS.SAVE.equip[sl] = it; } HS.applyGear(true);
    for (let k = 0; k < 220; k++) { const a = Math.random() * 6.28, d = 30 + Math.random() * 150; HS.spawnMonster('risen', HS.player.x + Math.cos(a) * d, HS.player.y + Math.sin(a) * d * 0.7); }
    let peak = 0; const t0 = performance.now(); while (performance.now() - t0 < 12000) { await new Promise((r) => setTimeout(r, 100)); peak = Math.max(peak, HS.bolts.length); if (HS.game.state !== 'play') HS.game.state = 'play'; } HS.DEV.god = false; return { peak, kills: HS.game.kills }; });
  // The tally of an auto play run.
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.cleared = 5; HS.SAVE.autoPlay = true; HS.game.descent = { i: 0, t: 0 }; HS.beginDescent(0); });
  await p.waitForFunction(() => HS.game.scene === 'wound' && HS.game.state === 'play', null, { timeout: 20000 }); await p.waitForTimeout(400);
  out.tally = await p.evaluate(() => { HS.game.run.autoOff = true; HS.dropLoot(HS.player.x, HS.player.y, { gold: 200, item: 8 }); const R = HS.game.run, o = { gold: Math.round(R.autoGold), gear: +R.autoGear.toFixed(1) }; HS.finishDescent(); return { ...o, state: HS.game.state, auto: HS.game.receipt.auto }; });
  await p.waitForTimeout(2600); await check('tally'); await shot('tally');
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
