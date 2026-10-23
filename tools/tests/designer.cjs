// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/designer.cjs <outDir> [WxH]
// The layout designer (dev only): the LAYOUT button on the pause screen, fill,
// paint a road, place assets by tapping the map, move, flip, undo, every
// palette tab, export and import the code, and the whole-map picture.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2] || '/tmp/des', [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: VW, height: VH }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.addInitScript(() => localStorage.removeItem('hollow-saint-layout'));
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(2000);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'pause'; });
  await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/d0-pause.png` });
  // Tap the LAYOUT button through the real input path.
  const tap = async (gx, gy) => { const r = await p.evaluate(([gx, gy]) => { const c = document.getElementById('screen').getBoundingClientRect(); return [c.left + gx / HS.W * c.width, c.top + gy / HS.H * c.height]; }, [gx, gy]); await p.mouse.click(r[0], r[1]); await p.waitForTimeout(60); };
  const drag = async (pts) => { const c = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); return { l: r.left, t: r.top, kx: r.width / HS.W, ky: r.height / HS.H }; }); await p.mouse.move(c.l + pts[0][0] * c.kx, c.t + pts[0][1] * c.ky); await p.mouse.down(); for (const [x, y] of pts.slice(1)) await p.mouse.move(c.l + x * c.kx, c.t + y * c.ky, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(60); };
  const H = await p.evaluate(() => HS.H);
  await tap(100, H - 20);
  console.log('opened', await p.evaluate(() => HS.game.state));
  await p.screenshot({ path: `${S}/shots/d1-blank.png` });
  // Fill with grass, paint a dirt road, then place things by tapping the map.
  await p.evaluate(() => { HS.DES.cat = 5; HS.desPick(0); HS.desMenuDo(3); }); await p.waitForTimeout(100);
  await p.evaluate(() => { const A = HS.game.ask; if (A && A.yes) A.yes(); HS.game.ask = null; });
  await p.evaluate(() => { HS.DES.cat = 5; HS.desPick(2); });
  const midY = Math.round(H / 2);
  await drag([[60, midY], [200, midY], [380, midY], [500, midY]]);
  const placeAt = async (cat, i, x, y) => { await p.evaluate(([c, i]) => { HS.DES.cat = c; HS.DES.item = -1; HS.desPick(i); }, [cat, i]); await tap(x, y); };
  await placeAt(0, 1, 260, midY - 30); // the cathedral
  await placeAt(1, 0, 120, midY + 60); await placeAt(1, 1, 200, midY + 60); await placeAt(2, 0, 330, midY + 40); await placeAt(4, 0, 420, midY + 70); await placeAt(4, 2, 380, midY + 90);
  const n1 = await p.evaluate(() => HS.DES.objs.length);
  // Move the last one, flip it, undo the flip.
  await p.evaluate(() => { HS.DES.tool = 2; }); await drag([[380, midY + 85], [400, midY + 95]]);
  await p.evaluate(() => { const D = HS.DES; if (D.sel) { HS.desMenuDo; } });
  const sb = await p.evaluate(() => HS.desSelBar()[1]); if (sb) await tap(sb.x + 5, sb.y + 5);
  const flipped = await p.evaluate(() => HS.DES.sel && HS.DES.sel.fl);
  await p.screenshot({ path: `${S}/shots/d2-layout.png` });
  console.log('probs layout', JSON.stringify(await p.evaluate(() => HS.textProblems ? HS.textProblems() : [])));
  // Every palette tab.
  for (let c = 0; c < 6; c++) { await p.evaluate((c) => { HS.DES.cat = c; HS.DES.scroll = 0; }, c); await p.waitForTimeout(80); await p.screenshot({ path: `${S}/shots/d3-tab${c}.png` }); }
  // The menu.
  await p.evaluate(() => { HS.DES.menu = true; }); await p.waitForTimeout(80); await p.screenshot({ path: `${S}/shots/d4-menu.png` }); await p.evaluate(() => { HS.DES.menu = false; });
  // Export, clear, import: the layout comes back the same.
  const code = await p.evaluate(() => HS.desCode());
  const back = await p.evaluate((code) => { const before = JSON.stringify(HS.DES.objs); HS.DES.objs = []; HS.DES.g.fill('.'); const ok = HS.desLoad(code); return { ok, same: JSON.stringify(HS.DES.objs) === before }; }, code);
  // The picture downloads a PNG.
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }).catch(() => null), p.evaluate(() => HS.desPicture())]);
  let pic = null; if (dl) { await dl.saveAs(`${S}/shots/d5-picture.png`); pic = fs.statSync(`${S}/shots/d5-picture.png`).size; }
  // Exit and reopen: the work is kept.
  await p.evaluate(() => HS.desMenuDo(5)); const kept = await p.evaluate(() => { HS.openDesigner(); return HS.DES.objs.length; });
  console.log(JSON.stringify({ placed: n1, flipped, codeLen: code.length, back, pic, kept }));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
