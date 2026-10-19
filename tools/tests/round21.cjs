// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round21.cjs <outDir>
// Round 21: the new-build notice for a returning Saint (and not for a new
// one), the altar's memory (tap a socket, read a power, set it, empty it),
// and the iron, silver and crimson window frames.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13 landscape'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(2200);
  const fresh = await p.evaluate(() => HS.game.state);
  // A returning Saint on an older build.
  await p.evaluate(() => { localStorage.setItem('hollow-saint', JSON.stringify({ ...HS.SAVE, seenBuild: '1.0', descents: 4, tutDone: true })); });
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; }); await p.waitForTimeout(1200);
  const news = await p.evaluate(() => ({ state: HS.game.state, build: HS.BUILD, seen: HS.SAVE.seenBuild }));
  await p.screenshot({ path: `${S}/shots/r21-news.png` });
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const after = await p.evaluate(() => HS.game.state);
  // The altar's memory.
  const pick = await p.evaluate(() => {
    HS.SAVE.altar = { known: ['stormHands', 'pallWard', 'saintTooth'], sockets: {} }; HS.applyGear(); HS.game.state = 'play'; HS.openAltar();
    const b = HS.altarSock(HS.featLayout(), 0); HS.altarTap(b.x + 20, b.y + b.h / 2);
    const open = !!HS.game.altarPick, G = HS.altarPickGeo(), list = HS.altarPickLegends('vest'), j = list.findIndex((q) => q.id === 'pallWard');
    HS.altarTap(G.cell(j).x + 4, G.cell(j).y + 4); const sel = HS.game.altarPick.sel;
    HS.altarTap(G.set.x + 5, G.set.y + 5); const set = HS.SAVE.altar.sockets.vest, power = HS.G.powers.has('wardLong');
    HS.altarTap(G.clear.x + 5, G.clear.y + 5); const cleared = HS.SAVE.altar.sockets.vest;
    const locked = list.findIndex((q) => !HS.SAVE.altar.known.includes(q.id)); HS.altarTap(G.cell(locked).x + 4, G.cell(locked).y + 4); HS.altarTap(G.set.x + 5, G.set.y + 5);
    return { open, sel, set, power, cleared, lockedNotSet: !HS.SAVE.altar.sockets.vest, n: list.length };
  });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r21-memory.png` });
  await p.evaluate(() => { HS.altarTap(1, 1); }); await p.waitForTimeout(150);
  const closed = await p.evaluate(() => ({ pick: HS.game.altarPick, state: HS.game.state }));
  console.log('news', JSON.stringify({ fresh, news, after }), 'memory', JSON.stringify(pick), 'closed', JSON.stringify(closed));
  for (const [n, f] of [['forge', () => HS.openForge()], ['canonry', () => HS.openCanonry()], ['vigil', () => HS.openVigil()]]) { await p.evaluate(() => { HS.game.state = 'play'; HS.game.altarPick = null; }); await p.evaluate(f); await p.waitForTimeout(200); await p.screenshot({ path: `${S}/shots/r21-${n}.png` }); }
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
