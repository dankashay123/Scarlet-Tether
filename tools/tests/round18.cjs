// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round18.cjs <outDir>
// Round 18: the Rites panel's slot tabs at three phone sizes, the Vigil
// inside the Descent panel and its Bloodrose Keys (drop, beam, pickup,
// spent on entry), and the game held upright (always landscape, taps mapped).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const errs = [];
  const page = async (w, h, url) => { const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage(); p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(`http://localhost:8123/${url}`); await p.waitForTimeout(1200); return p; };
  // Rites panel at three sizes, Reckoning tab open.
  for (const [w, h] of [[932, 430], [844, 390], [667, 375]]) {
    const p = await page(w, h, '?run');
    await p.evaluate(() => { HS.tut.on = false; HS.SAVE.lvl = 60; HS.openRites('play'); const t = HS.riteLayout().tab(2); HS.ritesTap(t.x + 5, t.y + 5); const c = HS.riteLayout().card(2, 1); HS.ritesTap(c.x + 5, c.y + 5); });
    await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r18-rites-${w}.png` });
    console.log('rites', w, await p.evaluate(() => JSON.stringify({ focus: HS.game.riteFocus, pen: HS.riteOf('pen').id })));
    await p.close();
  }
  // The Vigil from the Descent panel: no key, then a key.
  const p = await page(844, 390, '?town');
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.vkeys = 0; HS.SAVE.cleared = 9; HS.startDescent(); });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r18-descent.png` });
  await p.evaluate(() => { const L = HS.descentLayout(); HS.descentTap(L.vig.x + 5, L.vig.y + 5); });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/r18-vigil.png` });
  const noKey = await p.evaluate(() => { const L = HS.descentLayout(); HS.vigilTap(L.go.x + 5, L.go.y + 5); return HS.game.state; });
  const back = await p.evaluate(() => { const L = HS.descentLayout(); HS.vigilTap(L.vig.x + 5, L.vig.y + 5); const st = HS.game.state; HS.descentTap(L.vig.x + 5, L.vig.y + 5); return st; });
  const went = await p.evaluate(() => { HS.SAVE.vkeys = 2; const L = HS.descentLayout(); HS.vigilTap(L.go.x + 5, L.go.y + 5); return { state: HS.game.state, keys: HS.SAVE.vkeys }; });
  console.log('vigil', JSON.stringify({ noKey, back, went }));
  await p.waitForTimeout(2500);
  // Keys from Wardens of Station X: about half of them.
  const drop = await p.evaluate(() => {
    HS.game.state = 'play'; HS.game.nextDiff = 9; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false;
    let n = 0; for (let k = 0; k < 400; k++) { const before = HS.drops.length; HS.dropVkey(HS.player); if (HS.drops.length > before) n++; }
    for (const d of [...HS.drops]) if (d.kind === 'vkey') HS.drops.splice(HS.drops.indexOf(d), 1);
    const low = (() => { HS.game.run.diff = 8; let m = 0; for (let k = 0; k < 200; k++) { const b0 = HS.drops.length; HS.dropVkey(HS.player); if (HS.drops.length > b0) m++; } return m; })();
    HS.game.run.diff = 9; for (const e of HS.enemies) e.dead = true; const P = HS.player;
    HS.drops.push({ kind: 'vkey', x: P.x + 60, y: P.y, z: 0, vx: 0, vy: 0, vz: 0, t: 2 });
    return { rate: n / 400, belowX: low };
  });
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/r18-key.png` });
  await p.evaluate(() => { const P = HS.player; for (const d of HS.drops) if (d.kind === 'vkey') { d.x = P.x; d.y = P.y; } });
  await p.waitForTimeout(500);
  console.log('keys', JSON.stringify({ ...drop, held: await p.evaluate(() => HS.SAVE.vkeys) }));
  await p.close();
  // Held upright: the game still draws landscape, and taps land right.
  const q = await page(390, 844, '?town');
  const up = await q.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); const [x, y] = HS.toLocal(r.left + r.width - 10, r.top + 10); return { portrait: HS.PORTRAIT, W: HS.W, H: HS.H, topRightTap: [Math.round(x), Math.round(y)], rot: document.getElementById('screen').style.transform, rotate: !!document.getElementById('rotate') }; });
  await q.screenshot({ path: `${S}/shots/r18-upright.png` });
  console.log('upright', JSON.stringify(up));
  await q.close();
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
