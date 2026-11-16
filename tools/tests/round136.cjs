// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round136.cjs <outDir> [WxH]
// Round 136: the Toll bar's hold tip; NEWS from the pause screen with tabs for the last three builds (tap one, its
// notes show; no text problems on any); the buff sound as an icon appears (and not again for a buff back within 4 s);
// game.nextSeed fixes the next map.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.game.nextSeed = 4242; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(400);
  out.seed = await p.evaluate(() => HS.game.run.seed);
  const scr = (x, y) => p.evaluate(([x, y]) => { const c = document.getElementById('screen').getBoundingClientRect(), k = c.width / HS.W; return { x: c.left + x * k, y: c.top + y * k }; }, [x, y]);
  // The Toll bar's hold tip.
  const t = await p.evaluate(() => HS.HOLD_TIPS.find((r) => r.title === 'THE TOLL')); out.tollRect = !!t;
  if (t) { const q = await scr(t.x + t.w / 2, t.y + 8); await p.mouse.move(q.x, q.y); await p.mouse.down(); await p.waitForTimeout(650); out.tollTip = await p.evaluate(() => HS.game.statTip && HS.game.statTip.title); out.tipText = await p.evaluate(() => HS.textProblems().length); await p.screenshot({ path: `${S}/shots/r136-toll-tip.png` }); await p.mouse.up(); }
  await p.waitForTimeout(3300);
  // The buff sound: a ward appears (sound), goes, and comes back within 4 s (no sound).
  out.hasBuff = await p.evaluate(() => HS.AUDIO.has('buff'));
  out.snd1 = await p.evaluate(async () => { HS.AUDIO.last.buff = 0; HS.player.wardT = HS.game.time + 1; await new Promise((r) => setTimeout(r, 300)); return !!HS.AUDIO.last.buff; });
  out.snd2 = await p.evaluate(async () => { HS.player.wardT = 0; await new Promise((r) => setTimeout(r, 300)); HS.AUDIO.last.buff = 0; HS.player.wardT = HS.game.time + 1; await new Promise((r) => setTimeout(r, 300)); return !!HS.AUDIO.last.buff; });
  // NEWS from the pause screen: three tabs, each opens its build's notes.
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(300);
  const tile = await p.evaluate(() => HS.pauseLayout().tiles.find((q) => q.id === 'news'));
  const q0 = await scr(tile.x + tile.w / 2, tile.y + tile.h / 2); await p.mouse.click(q0.x, q0.y); await p.waitForTimeout(300);
  const tabs = await p.evaluate(() => HS.newsLayout().tabs.map((q) => ({ b: q.b, x: q.x, y: q.y, w: q.w, h: q.h }))); out.tabs = tabs.map((q) => q.b);
  out.pages = [];
  for (const tb of tabs) { const q = await scr(tb.x + tb.w / 2, tb.y + tb.h / 2); await p.mouse.click(q.x, q.y); await p.waitForTimeout(250);
    out.pages.push(await p.evaluate(() => [HS.game.state, HS.game.newsFor, HS.textProblems().length])); await p.screenshot({ path: `${S}/shots/r136-news-${tb.b}.png` }); }
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); out.after = await p.evaluate(() => HS.game.state);
  out.ok = out.seed === 4242 && out.tollTip === 'THE TOLL' && !out.tipText && out.hasBuff && out.snd1 && !out.snd2 && out.tabs.length === 3 && out.pages.every((g, i) => g[0] === 'news' && g[1] === out.tabs[i] && !g[2]) && out.after === 'pause';
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
