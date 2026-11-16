// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round134.cjs <outDir> [WxH]
// Round 134: the BUFF ICONS setting (all, no pets, off), pets on a soft disc, the settings page's text, and the title
// screen saying UPDATED TO BUILD N after an update.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  out.modes = await p.evaluate(async () => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.hero = 'mendicant'; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0;
    HS.SAVE.petEq = { battle: ['lamb', 'bellcrow'], drop: [null, null], show: 'bellcrow' }; const P = HS.player; P.frenzyT = HS.game.time + 30; P.frenzyN = 4;
    const ids = () => HS.activeBuffs().map((q) => q.B.id).sort().join(',');
    const R = {}; for (const m of ['all', 'nopets', 'off']) { HS.setOpt('buffs', m); await new Promise((r) => setTimeout(r, 300)); R[m] = ids(); } HS.setOpt('buffs', 'all'); return R; });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r134-pets.png`, clip: { x: 0, y: 0, width: 300, height: 170 } });
  // The settings page, controls section.
  await p.evaluate(() => { HS.game.state = 'settings'; HS.game.setSec = 2; }); await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/r134-settings.png` });
  out.setText = await p.evaluate(() => HS.textProblems().length);
  // The title after an update: an older seenBuild, then a reload.
  const p2 = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage(); p2.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const old = String(+(await p.evaluate(() => HS.BUILD)) - 1);
  await p2.addInitScript((old) => { if (sessionStorage.getItem('r134')) return; sessionStorage.setItem('r134', '1'); localStorage.setItem('hollow-saint', JSON.stringify({ seenBuild: old, descents: 3, tutorialDone: true })); }, old);
  await p2.goto('http://localhost:8123/'); await p2.waitForTimeout(2000); const pg = p2;
  out.news = await pg.evaluate(() => HS.NEWS); await pg.evaluate(() => { HS.game.news = null; }); await pg.waitForTimeout(200); await pg.screenshot({ path: `${S}/shots/r134-title.png`, clip: { x: 0, y: 0, width: 300, height: 60 } });
  out.ok = /pet_lamb/.test(out.modes.all) && !/pet_/.test(out.modes.nopets) && /frenzy/.test(out.modes.nopets) && out.modes.off === '' && !out.setText && !!out.news;
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
