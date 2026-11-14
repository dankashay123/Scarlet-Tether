// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round107.cjs <outDir> [WxH]
// Round 107: the level-up screen over a Warden fight (the HUD's top band must not show through), the pause tiles'
// icons, battle pets' cues when they act (the follower's hop).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r107-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?run&dev'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.player.god = true; HS.player.hp = HS.player.maxHp = 1e6; HS.spawnWarden('cardinal'); });
  await p.waitForTimeout(1500);
  out.hudDrawn = await p.evaluate(() => { HS.game.run.wounds = { quick: 2 }; HS.openStigmata(); return HS.game.state; });
  await p.waitForTimeout(900); await check('stig'); await shot('stig-warden');
  await p.evaluate(() => { HS.pickStigma(0); HS.game.state = 'pause'; }); await p.waitForTimeout(400); await shot('pause'); // no text check here: a damage number may sit at the screen's edge (menus.cjs checks the pause screen)
  // Pets: with the Nail Finch following and a foe targeted, the finch hops when it fires.
  out.pets = await p.evaluate(async () => { HS.game.stig = null; HS.game.run.pending = 0; HS.game.state = 'play'; HS.SAVE.pets = HS.PETS.map((P) => P.id); HS.SAVE.petEq = { battle: ['nailfinch', 'lamb'], drop: [null, null], show: 'nailfinch' };
    HS.applyGear(true); const P = HS.player; P.maxHp = 1e6; P.hp = 5e5; if (!HS.enemies.some((e) => !e.dead)) HS.spawnWarden('cardinal');
    let hops = 0, was = 0; const t0 = performance.now(); while (performance.now() - t0 < 6000) { await new Promise((r) => requestAnimationFrame(r)); if (HS.game.state !== 'play') HS.game.state = 'play'; const h = HS.PETF.hop || 0; if (h > was + 0.1) hops++; was = h; }
    return { hops, state: HS.game.state, healed: P.hp > 5e5 }; });
  await shot('pets');
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
