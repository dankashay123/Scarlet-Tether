// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round86.cjs <outDir> [WxH]
// Round 86: the Codex's NEW marks (pause tile, tab, cell; cleared once the page has been shown),
// the reroll count on the level-up screen, and the Canonry's unlearned and locked nodes.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r86-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 4).join('; ')}`); };
  const tap = async (x, y) => { const k = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { l: c.left, t: c.top, kx: c.width / HS.W, ky: c.height / HS.H }; }); await p.touchscreen.tap(k.l + x * k.kx, k.t + y * k.ky); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.codex = null; HS.SAVE.codexNew = null; HS.applyGear();
    HS.game.nextStratum = 1; HS.game.nextDiff = 6; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(400);
  // An old save's first look starts with no marks; first kills add them, a second kill does not.
  out.start = await p.evaluate(() => { HS.SAVE.codex = null; HS.SAVE.codexNew = null; HS.codexList(0); return Object.keys(HS.codexNew()).length; });
  out.kills = await p.evaluate(() => { const P = HS.player; for (const id of ['risen', 'risen', 'crawler']) { const e = HS.spawnMonster(id, P.x + 30, P.y, { room: HS.game.curRoom.id }); HS.killEnemy(e, 1, 0); }
    HS.codexSee('w', HS.codexList(4)[0].id); return Object.keys(HS.codexNew()).sort(); });
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(250); await shot('pause'); await check('pause');
  // The Codex tile opens the first section with news; the cell and the tab carry a dot.
  const t = await p.evaluate(() => HS.pauseLayout().tiles.find((q) => q.id === 'codex')); await tap(t.x + t.w / 2, t.y + t.h / 2); await p.waitForTimeout(250);
  out.openSec = await p.evaluate(() => HS.game.codex.sec); await shot('codex'); await check('codex');
  // Leaving the section clears the marks shown on its page; the Wounds section still has one.
  const tab = await p.evaluate(() => HS.codexLayout().tab(4)); await tap(tab.x + 20, tab.y + 10); await p.waitForTimeout(200);
  out.afterTab = await p.evaluate(() => Object.keys(HS.codexNew()));
  await shot('codex-wounds');
  const L = await p.evaluate(() => HS.codexLayout()); await tap(L.close.x, L.close.y); await p.waitForTimeout(200);
  out.afterClose = await p.evaluate(() => Object.keys(HS.codexNew()).length);
  // The reroll count.
  out.reroll = [];
  await p.evaluate(() => { HS.game.state = 'play'; HS.game.run.gold = 99999; HS.game.run.pending = 1; HS.openStigmata(); }); await p.waitForTimeout(500);
  for (let i = 0; i < 3; i++) { out.reroll.push(await p.evaluate(() => HS.rerollCost())); if (i === 2) { await shot('reroll'); await check('reroll'); } const B = await p.evaluate(() => HS.stigButtons()); await tap(B.reroll.x + 30, B.reroll.y + 10); await p.waitForTimeout(500); }
  // The Canonry: a few learned, the rest open or locked.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.talents = { might: 3, precise: 2 }; HS.openCanonry(); }); await p.waitForTimeout(400); await shot('canonry'); await check('canonry');
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
