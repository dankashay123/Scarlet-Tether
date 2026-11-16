// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round135.cjs <outDir> [WxH]
// Round 135: the WHAT'S NEW pause tile (opens this build's notes, back returns to the pause screen), the Zeal bar's hold
// tip, the stall's gold tap line; no text problems on the pause screen or the notes.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(300);
  const scr = (x, y) => p.evaluate(([x, y]) => { const c = document.getElementById('screen').getBoundingClientRect(), k = c.width / HS.W; return { x: c.left + x * k, y: c.top + y * k }; }, [x, y]);
  // The Zeal bar's hold tip.
  const z = await p.evaluate(() => HS.HOLD_TIPS.find((r) => r.title === 'ZEAL')); out.zealRect = !!z;
  if (z) { const q = await scr(z.x + z.w / 2, z.y + 4); await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.waitForTimeout(650); out.zealTip = await p.evaluate(() => HS.game.statTip && HS.game.statTip.title); await p.screenshot({ path: `${S}/shots/r135-zeal-tip.png`, clip: { x: 0, y: 0, width: 420, height: 230 } }); await p.mouse.up(); }
  await p.waitForTimeout(3300);
  // The pause screen: the WHAT'S NEW tile opens the notes, back returns to the pause screen.
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r135-pause.png` });
  out.pauseText = await p.evaluate(() => HS.textProblems().length);
  const t = await p.evaluate(() => HS.pauseLayout().tiles.find((q) => q.id === 'news')); out.tile = !!t;
  if (t) { const q = await scr(t.x + t.w / 2, t.y + t.h / 2); await p.mouse.click(q.x, q.y); await p.waitForTimeout(300);
    out.newsState = await p.evaluate(() => [HS.game.state, HS.game.newsFor]); await p.screenshot({ path: `${S}/shots/r135-news.png` }); out.newsText = await p.evaluate(() => HS.textProblems().length);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200); out.after = await p.evaluate(() => HS.game.state); }
  out.ok = out.zealTip === 'ZEAL' && out.tile && out.newsState[0] === 'news' && out.after === 'pause' && !out.pauseText && !out.newsText;
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
