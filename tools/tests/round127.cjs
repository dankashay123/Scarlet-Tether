// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round127.cjs <outDir> [WxH]
// Round 127: the Carnage bonus as a small plate under the Zeal bar (no full-width banner), per class; no text problems.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r127-${n}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  out.carnage = {};
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await run(hero); await p.waitForTimeout(300);
    // A 14-kill streak that has just ended pays the bonus.
    out.carnage[hero] = await p.evaluate(async () => { HS.game.banner = null; HS.game.massacre = { n: 14, last: HS.game.time - 2 }; await new Promise((r) => setTimeout(r, 120)); return { note: !!HS.game.carnageNote, banner: !!HS.game.banner }; });
    await p.waitForTimeout(300); await shot(`carnage-${hero}`);
    out.carnage[hero].text = await p.evaluate(() => HS.textProblems());
  }
  out.carnageOk = Object.values(out.carnage).every((c) => c.note && !c.banner && !c.text.length);
  if (globalThis.__more) await globalThis.__more(p, out, { run, shot });
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
