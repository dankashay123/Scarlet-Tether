// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round130.cjs <outDir> [WxH]
// Round 130: buff icons under the Zeal block (shrine, rites, sets, talents, a passive): which show, their order,
// the clock sweep advancing, stacks, and photos per class; the low-Station lines on set cards.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  out.buffs = {};
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await run(hero); await p.waitForTimeout(300);
    out.buffs[hero] = await p.evaluate(async () => {
      const P = HS.player, t = HS.game.time;
      HS.game.buff = { kind: 'fervor', t: 20, max: 20 }; P.wardT = t + 3; P.frenzyT = t + 4; P.frenzyN = 7; P.strideT = t + 7; P.rainT = 6;
      await new Promise((r) => setTimeout(r, 100)); const a = HS.activeBuffs().map((q) => q.B.id);
      await new Promise((r) => setTimeout(r, 1200)); const L = HS.activeBuffs(), w = L.find((q) => q.B.id === 'ward');
      return { ids: a, wardSpent: w ? +(1 - w.left / w.dur).toFixed(2) : null };
    });
    await p.screenshot({ path: `${S}/shots/r130-buffs-${hero}.png`, clip: { x: 0, y: 0, width: 260, height: 150 } });
    out.buffs[hero].text = await p.evaluate(() => HS.textProblems().length);
  }
  out.buffOk = Object.values(out.buffs).every((q) => ['shrine', 'reck', 'ward', 'stride', 'frenzy'].every((id) => q.ids.includes(id)) && q.wardSpent > 0.2 && q.wardSpent < 0.8 && !q.text);
  out.cards = await p.evaluate(() => ['confessor', 'font', 'lantern'].map((id) => HS.VSETS[id].bonus.filter((q) => q[0] >= 4).map((q) => (q[1].match(/STATION VI OR LOWER: ([+-]\d+)% DAMAGE( INSTEAD)?/) || [])[1] || null)));
  out.cardsOk = JSON.stringify(out.cards) === JSON.stringify([['+80', '+25'], ['+60', '-30'], ['+150', '+25']]);
  if (globalThis.__more) await globalThis.__more(p, out);
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
