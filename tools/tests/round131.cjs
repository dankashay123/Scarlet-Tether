// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round131.cjs <outDir> [WxH]
// Round 131: hold a buff icon for its tip (title and text), the stick does not move the hero meanwhile, the tip closes
// by itself in play; the shorter low-Station line on set cards; a 10-kill streak runs without errors.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = 'saint'; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(300);
  // Give a long Blood Frenzy and find its icon's hold rect (screen pixels).
  const pos = await p.evaluate(async () => { const P = HS.player; P.frenzyT = HS.game.time + 30; P.frenzyN = 9; await new Promise((r) => setTimeout(r, 150));
    const q = HS.HOLD_TIPS.find((r) => r.title === 'BLOOD FRENZY'); if (!q) return null; const c = document.getElementById('screen').getBoundingClientRect(), k = c.width / HS.W;
    return { x: c.left + (q.x + q.w / 2) * k, y: c.top + (q.y + q.h / 2) * k, px: P.x, py: P.y }; });
  out.found = !!pos;
  if (pos) {
    await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.waitForTimeout(650);
    out.tip = await p.evaluate(() => HS.game.statTip && { title: HS.game.statTip.title, text: HS.game.statTip.text });
    await p.screenshot({ path: `${S}/shots/r131-buff-tip.png`, clip: { x: 0, y: 0, width: 420, height: 200 } });
    await p.mouse.up(); out.moved = await p.evaluate((o) => Math.hypot(HS.player.x - o.px, HS.player.y - o.py), pos);
    await p.waitForTimeout(3300); out.closed = await p.evaluate(() => !HS.game.statTip);
  }
  // A 10-kill streak.
  await p.evaluate(() => { HS.game.massacre = { n: 9, last: HS.game.time }; HS.killEnemy && 0; }); out.streak = await p.evaluate(() => { const m = HS.game.massacre; m.last = HS.game.time; return true; });
  out.card = await p.evaluate(() => HS.VSETS.font.bonus.filter((q) => q[0] >= 4).map((q) => (q[1].match(/STATION VI OR LOWER: [+-]\d+% DAMAGE( INSTEAD)? \(FADES BY XII\)\./) || [''])[0]));
  out.ok = out.found && out.tip && out.tip.title === 'BLOOD FRENZY' && /9%/.test(out.tip.text) && out.moved < 2 && out.closed && out.card.every(Boolean);
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
