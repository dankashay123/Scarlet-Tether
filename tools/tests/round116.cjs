// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round116.cjs <outDir> [WxH]
// Round 116: the Auto Play and Auto Wounds icons left of the minimap (grey off, green on), Auto Play turned on during a
// descent (asks first), paused again, and the pay staying reduced for the rest of the descent.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
(async () => { const [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number); const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.autoW().on = false; HS.SAVE.cleared = 3; });
  await p.waitForTimeout(400); await p.screenshot({ path: `${process.argv[2]}/shots/r116-off-${VW}.png`, clip: { x: VW / 2 - 60, y: 0, width: VW / 2 + 60, height: 140 } });
  const tapI = async (k) => { const pt = await p.evaluate((k) => { const r = document.getElementById('screen').getBoundingClientRect(), c = HS.autoIcons()[k]; return { x: r.left + c.x * r.width / HS.W, y: r.top + c.y * r.height / HS.H }; }, k); await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(300); };
  await tapI('wounds'); const w = await p.evaluate(() => HS.autoW().on);
  await tapI('play'); const asked = await p.evaluate(() => !!HS.game.ask); await p.screenshot({ path: `${process.argv[2]}/shots/r116-ask-${VW}.png` });
  await p.evaluate(() => { const A = HS.game.ask; HS.game.ask = null; A.yes(); }); await p.waitForTimeout(400);
  await p.screenshot({ path: `${process.argv[2]}/shots/r116-on-${VW}.png`, clip: { x: VW / 2 - 60, y: 0, width: VW / 2 + 60, height: 140 } });
  const g0 = await p.evaluate(() => { const n0 = HS.drops.length; HS.dropLoot(HS.player.x, HS.player.y, { gold: 200 }); const d = HS.drops.splice(n0); return d.reduce((a, q) => a + q.amount, 0) / d.length; });
  await tapI('play'); const paused = await p.evaluate(() => ({ off: HS.game.run.autoOff, auto: HS.game.run.auto }));
  const g1 = await p.evaluate(() => { const n0 = HS.drops.length; HS.dropLoot(HS.player.x, HS.player.y, { gold: 200 }); const d = HS.drops.splice(n0); return d.reduce((a, q) => a + q.amount, 0) / d.length; });
  await p.screenshot({ path: `${process.argv[2]}/shots/r116-paused-${VW}.png`, clip: { x: VW / 2 - 60, y: 0, width: VW / 2 + 60, height: 140 } });
  console.log(JSON.stringify({ w, asked, paused, goldOn: g0.toFixed(1), goldPaused: g1.toFixed(1), probs: await p.evaluate(() => HS.textProblems().slice(0, 3)) })); await b.close(); })();
