// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/<name>.cjs <outDir>   (screenshots go to <outDir>/shots/)
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  p.on('console', (m) => console.log('LOG', m.text())); p.on('pageerror', (e) => console.log('ERR', String(e.stack || e).slice(0, 600)));
  await p.goto('http://localhost:8123/' + (process.argv[2] || '?town')); await p.waitForTimeout(1500); console.log(await p.evaluate(() => document.body.innerText.slice(0, 300) + ' state=' + HS.game.state + ' player=' + !!HS.player)); await b.close();
})();
