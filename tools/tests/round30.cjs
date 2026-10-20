// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round30.cjs <outDir> [WxH]
// Round 30: crit numbers by size, the Zeal step flash, the HP shake on a big
// hit, and the text size setting (settings panel and HUD at large).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  const tag = WH[0] ? `-${WH[0]}` : '', out = {};
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(600);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.DEV.god = true; });
  // Crits: plain, 3x and 6x the recent plain hit, beside some plain hits.
  await p.evaluate(() => { const P = HS.player; window.__M = [0, 1, 2, 3, 4].map((i) => { const m = HS.spawnMonster('risen', P.x - 70 + i * 35, P.y - 30); m.hp = m.maxHp = 1e6; return m; }); });
  await p.waitForTimeout(2000);
  out.crits = await p.evaluate(() => {
    const M = window.__M;
    for (let i = 0; i < 40; i++) HS.hurtEnemy(M[0], 10, false, 1, 0, 0);
    HS.hurtEnemy(M[1], 12, false, 1, 0, 0); HS.hurtEnemy(M[2], 15, true, 1, 0, 0); HS.hurtEnemy(M[3], 40, true, 1, 0, 0); HS.hurtEnemy(M[4], 90, true, 1, 0, 0);
    return HS.game.avgHit;
  });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r30-crits${tag}.png` });
  // The Zeal step flash, and a big hit on the Saint.
  await p.evaluate(() => { HS.DEV.god = false; HS.game.fervor = 52; HS.hurtPlayerRaw(HS.player.maxHp * 0.15); });
  await p.waitForTimeout(120); await p.screenshot({ path: `${S}/shots/r30-flash${tag}.png` });
  out.flash = await p.evaluate(() => ({ tier: HS.game.zTier, shake: HS.game.hpShakeT > 0, flash: HS.game.zFlashT > 0 }));
  // Text size: the settings panel and the HUD at large.
  await p.evaluate(() => { HS.setOpt('text', 'large'); HS.game.state = 'settings'; });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r30-settings-large${tag}.png` });
  out.k = await p.evaluate(() => HS.TEXT_K);
  await p.evaluate(() => { HS.game.state = 'play'; HS.player.hp = HS.player.maxHp; });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r30-hud-large${tag}.png` });
  await p.evaluate(() => { HS.openInventory(); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r30-inv-large${tag}.png` });
  await p.evaluate(() => { HS.game.state = 'play'; HS.setOpt('text', 'small'); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r30-hud-small${tag}.png` });
  await p.evaluate(() => HS.setOpt('text', 'normal'));
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5)); await b.close();
})();
