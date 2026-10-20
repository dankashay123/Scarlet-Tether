// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round32.cjs <outDir> [WxH]
// Round 32: the Ossuary's own props (skull shelves, heaps, the cairn, bone
// benches, strewn bones) and the Training Yard's best damage a second.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {}, shot = (n) => p.screenshot({ path: `${S}/shots/r32-${n}${tag}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  // Three Ossuary maps: count the new props; one Undercroft map must have none.
  out.props = await p.evaluate(() => {
    const count = (k) => { HS.SAVE.cleared = 8; HS.game.nextStratum = k; HS.game.nextDiff = 6; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); const c = {}; for (const q of HS.room.props) if (['boneshelf', 'skullheap', 'cairn', 'bonepew'].includes(q.anim)) c[q.anim] = (c[q.anim] || 0) + 1; return c; };
    return { oss: [count(3), count(3), count(3)], under: count(1) };
  });
  await p.evaluate(() => { HS.SAVE.cleared = 8; HS.game.nextStratum = 3; HS.game.nextDiff = 6; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0;
    const q = HS.room.props.find((q) => q.anim === 'boneshelf'); HS.player.x = q.x; HS.player.y = q.y + 90; });
  await p.waitForTimeout(600); await shot('ossuary-shelves');
  // The yard: hit the dummy, stop, and a best is kept for this build.
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.cleared = 6; HS.SAVE.yardBest = { all: 0 }; HS.openYard(); }); await p.waitForTimeout(3500);
  await p.evaluate(() => { HS.game.state = 'play'; HS.input.m1 = true; }); await p.waitForTimeout(4500);
  out.during = await p.evaluate(() => ({ dps: HS.yardDps(), best: { ...HS.SAVE.yardBest }, key: HS.yardKey() }));
  await p.evaluate(() => { HS.input.m1 = false; HS.DEV.noAttack = true; const P = HS.player; P.x -= 400; }); await p.waitForTimeout(6500);
  out.after = await p.evaluate(() => ({ best: { ...HS.SAVE.yardBest }, toast: HS.game.toast && HS.game.toast.msg }));
  await p.evaluate(() => { HS.game.state = 'yard'; }); await p.waitForTimeout(250); await shot('yard-panel');
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
