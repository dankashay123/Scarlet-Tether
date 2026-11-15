// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round129.cjs <outDir>
// Round 129: the low-Station set factor (SETK.low / low6): full at Station VI and below, fading by XII, none at XII;
// 4-5 pieces read SETK.low, six pieces SETK.low6. setbal's STRATUM= option is checked by running it, not here.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  out.k = await p.evaluate(() => {
    const R = {}, foe = { boss: false, burn: 0 };
    const wear = (id, n, other) => { HS.SAVE.equip = {}; HS.VSETS[id].slots.slice(0, n).forEach((sl) => { const it = HS.makeItem(sl, 4, 'X', undefined, 12); it.set = id; HS.SAVE.equip[sl] = it; });
      if (other) { let m = 0; for (const sl of HS.VSETS[other].slots) { if (m >= 2 || HS.SAVE.equip[sl]) continue; const it = HS.makeItem(sl, 4, 'X', undefined, 12); it.set = other; HS.SAVE.equip[sl] = it; m++; } } HS.applyGear(true); };
    const at = (st) => { HS.game.run.df = null; HS.game.run.diff = st - 1; return +HS.setFoeK(foe, 'bolt').toFixed(3); };
    HS.SAVE.hero = 'saint';
    wear('stride', 6); R.stride6 = { VI: at(6), IX: at(9), XII: at(12), III: at(3) };
    wear('stride', 4, 'confessor'); R.stride4 = { VI: at(6), XII: at(12) };
    wear('font', 6); R.font6 = { VI: at(6), XII: at(12) };
    return R;
  });
  const k = out.k, near = (a, b) => Math.abs(a - b) < 0.02;
  out.ok = near(k.stride6.VI, 1.7) && near(k.stride6.XII, 1) && k.stride6.IX > 1.1 && k.stride6.IX < 1.6 && near(k.stride6.III, 1.7) && near(k.stride4.VI, 1.5) && near(k.stride4.XII, 1) && near(k.font6.VI / k.font6.XII, 0.7);
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
