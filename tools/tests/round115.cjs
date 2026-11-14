// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round115.cjs <outDir> [WxH]
// Round 115: the HUD buttons' new look (reliefs in a gold bezel, rite icons get the bezel laid over them), the pause
// tiles in the same style, the pilot no longer going for health orbs, and Auto Sell's line on an auto run's tally.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r115-${n}-${VW}.png`, clip });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500);
  out.sprites = await p.evaluate(() => ['dash', 'pause', 'bag', 'talk', 'descend', 'use', 'lock', 'bezel40', 'bezel44'].filter((k) => !HS.SPR.ui.anims[k]));
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.cleared = 5; HS.SAVE.autoPlay = true; HS.game.descent = { i: 0, t: 0 }; HS.beginDescent(0); });
  await p.waitForFunction(() => HS.game.scene === 'wound' && HS.game.state === 'play', null, { timeout: 20000 }); await p.waitForTimeout(500);
  await p.evaluate(() => { HS.game.run.autoOff = true; HS.player.m2cd = 4; }); await p.waitForTimeout(300); await check('hud'); await shot('hud');
  await shot('hud-buttons', { x: VW - 240, y: VH - 200, width: 240, height: 200 });
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(400); await check('pause'); await shot('pause');
  // The pilot, hurt, with a health orb far off and none near: it keeps to the fight and the path, never the orb.
  out.orb = await p.evaluate(async () => { HS.game.state = 'play'; HS.game.run.autoOff = false; const P = HS.player; HS.DEV.god = true; P.hp = P.maxHp * 0.2;
    HS.drops.push({ kind: 'globe', x: P.x + 600, y: P.y, z: 0, vx: 0, vy: 0, vz: 0, t: 1 }); const goals = new Set(); const t0 = performance.now();
    while (performance.now() - t0 < 3000) { await new Promise((r) => setTimeout(r, 100)); P.hp = P.maxHp * 0.2; goals.add(HS.AP.goal); } HS.DEV.god = false; return [...goals]; });
  // An auto run's tally with Auto Sell at work.
  out.tally = await p.evaluate(() => { const R = HS.game.run; R.autoOff = true; R.autoSold = 7; R.autoSoldGold = 105; HS.finishDescent(); return HS.game.receipt.auto; });
  await p.waitForTimeout(2600); await shot('tally'); // no text check: damage numbers from the fight behind the card overlap
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
