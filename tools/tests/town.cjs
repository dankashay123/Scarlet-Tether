// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/<name>.cjs <outDir>   (screenshots go to <outDir>/shots/)
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town&fps'); await p.waitForTimeout(1200);
  // Close the wake dialog.
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); } await p.evaluate(() => { HS.tut.on = false; });
  // One stop in each district (round 43: the town is one square).
  const stops = await p.evaluate(() => HS.DISTRICTS.map(([, x0, y0, x1, y1]) => [Math.round((x0 + x1) / 2), Math.round(y1 - 24)]));
  for (const [i, [x, y]] of stops.entries()) {
    await p.evaluate(([x, y]) => { HS.player.x = x; HS.player.y = y; }, [x, y]);
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${S}/shots/v${i}.png` });
  }
  // The south road, then the full town map.
  await p.evaluate(() => { HS.player.x = HS.CATHEDRAL_X; HS.player.y = 990; }); await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/shots/v-south.png` });
  await p.evaluate(() => { HS.game.state = 'map'; }); await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/v-map.png` });
  console.log('town', await p.evaluate(() => JSON.stringify({ w: HS.room.pw, h: HS.room.ph })));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
