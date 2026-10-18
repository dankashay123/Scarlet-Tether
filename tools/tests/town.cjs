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
  const stops = [2340, 2030, 1690, 1365, 990, 620, 230];
  for (const [i, x] of stops.entries()) {
    await p.evaluate((x) => { HS.player.x = HS.townX(x); HS.player.y = HS.room.top * 16 + 90; }, x);
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${S}/shots/v${i}.png` });
  }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
