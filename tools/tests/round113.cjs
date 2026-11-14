// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round113.cjs <outDir> [WxH]
// Round 113: auto play's HUD button (pause and resume the pilot), SELL TO MAKE ROOM (a full bag in an auto run), the
// AUTO window with its seven or eight rows, and the Descent panel's risky line.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r113-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500);
  // The Descent panel: bare gear on a cleared Station reads as risky; strong gear does not.
  out.risk = await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.cleared = 12; HS.SAVE.autoPlay = true; HS.SAVE.equip = {}; HS.applyGear(true); HS.game.descent = { i: 8, t: 0 }; HS.game.state = 'descent'; return { mine: HS.playerSanctity(), need: HS.stationSanctity(10) }; });
  await p.waitForTimeout(300); await check('descent-risky'); await shot('descent-risky');
  await p.evaluate(() => { HS.game.descent.i = 0; for (const sl of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) HS.SAVE.equip[sl] = HS.makeItem(sl, 2, 'X', undefined, 6); HS.applyGear(true); }); await p.waitForTimeout(300); await check('descent-safe'); await shot('descent-safe');
  await p.evaluate(() => HS.beginDescent(0)); await p.waitForFunction(() => HS.game.scene === 'wound' && HS.game.state === 'play', null, { timeout: 20000 }); await p.waitForTimeout(600);
  // The HUD button pauses and resumes the pilot.
  out.btn = await p.evaluate(() => { const B = HS.autoHudBtn(); return { y: B.y, inside: B.y + B.h < HS.H }; });
  const box = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), B = HS.autoHudBtn(); return { x: r.left + (B.x + B.w / 2) * r.width / HS.W, y: r.top + (B.y + B.h / 2) * r.height / HS.H }; });
  await p.touchscreen.tap(box.x, box.y); await p.waitForTimeout(300); out.paused = await p.evaluate(() => !!HS.game.run.autoOff); await shot('hud-paused');
  out.still = await p.evaluate(async () => { const x = HS.player.x, y = HS.player.y; HS.enemies.length = 0; await new Promise((r) => setTimeout(r, 1200)); return Math.round(Math.hypot(HS.player.x - x, HS.player.y - y)); });
  await p.touchscreen.tap(box.x, box.y); await p.waitForTimeout(300); out.resumed = await p.evaluate(() => !HS.game.run.autoOff); await check('hud'); await shot('hud');
  // Sell to make room: off, a full bag leaves the piece; on, the weakest Common goes and the piece is taken. Never a rarer piece.
  out.sell = await p.evaluate(async () => { const A = HS.autoW(), R = HS.game.run; HS.SAVE.bag = []; for (let k = 0; k < 30; k++) HS.SAVE.bag.push(HS.makeItem('hood', k < 3 ? 0 : 3, 'X', undefined, 1));
    const drop = () => HS.drops.push({ kind: 'item', item: HS.makeItem('hood', 2, 'X', undefined, 1), x: HS.player.x + 4, y: HS.player.y, z: 0, vx: 0, vy: 0, vz: 0, t: 1 }), wait = () => new Promise((r) => setTimeout(r, 900));
    A.sell = false; drop(); await wait(); const off = { bag: HS.SAVE.bag.length, common: HS.SAVE.bag.filter((q) => q.ri === 0).length, left: HS.drops.filter((d) => d.kind === 'item' && !d.taken).length };
    A.sell = true; await wait(); const on = { bag: HS.SAVE.bag.length, common: HS.SAVE.bag.filter((q) => q.ri === 0).length, left: HS.drops.filter((d) => d.kind === 'item' && !d.taken).length, sold: R.autoSold };
    HS.SAVE.bag = HS.SAVE.bag.filter((q) => q.ri >= 2); while (HS.SAVE.bag.length < 30) HS.SAVE.bag.push(HS.makeItem('hood', 3, 'X', undefined, 1)); drop(); await wait(); const rare = { bag: HS.SAVE.bag.length, left: HS.drops.filter((d) => d.kind === 'item' && !d.taken).length, sold: R.autoSold }; A.sell = false; return { off, on, rare }; });
  // The AUTO window in an auto run (eight rows).
  await p.evaluate(() => { HS.game.state = 'pause'; const t = HS.pauseLayout().tiles.find((q) => q.id === 'auto'); HS.pauseTap(t.x + 4, t.y + 4); }); await p.waitForTimeout(400); await check('autowin'); await shot('autowin');
  out.win = await p.evaluate(() => { const L = HS.autoWinLayout(), A = HS.autoW(); HS.autoWinTap(L.row(6).x + 4, L.row(6).y + 4); const sell = A.sell; A.sell = false; HS.autoWinTap(L.row(7).x + 4, L.row(7).y + 4); return { rows: L.rows, sell, off: !!HS.game.run.autoOff, fits: L.y0 >= 0 && L.y0 + L.ph <= HS.H }; });
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
