// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round106.cjs <outDir> [WxH]
// Round 106: the Training Yard's SETS tab (each set's best from any build, the worn set lit, bars, empty state), the
// Penitent's Stride's softer guard (setGuard and its card), setbal.cjs's WARDEN mode is run by hand (see CLAUDE.md).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r106-${n}-${VW}.png` });
  const check = async (n) => { const pr = (await p.evaluate(() => HS.textProblems())).filter((q) => !/^(OFF SCREEN: \d+|[A-Z]+ [\d.]*:? ?"\d+!?" \/ "\d+!?")$/.test(q)); /* damage numbers from the yard behind the panel */ if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  for (const hero of ['saint', 'anchoress']) {
    await p.evaluate((hero) => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.yardBest = {}; HS.SAVE.yardTest = {}; HS.SAVE.yardTest60 = {}; HS.applyGear(); HS.openYard(); }, hero);
    await p.waitForTimeout(3500); // the yard loads like a descent
    await p.evaluate(() => { HS.game.banner = null; HS.game.yard.attack = false; HS.game.yard.tab = HS.YARD_SETS; HS.game.state = 'yard'; }); await p.waitForTimeout(1500); // the arrival banner and old numbers fade await p.waitForTimeout(250); await check(`sets-empty-${hero}`); if (hero === 'saint') await shot('sets-empty');
    out[hero] = await p.evaluate((hero) => { const sets = [...HS.mySets(), HS.starterSet()], sfx = hero === 'saint' ? '' : `:${hero}`, B = HS.SAVE.yardBest, T = (HS.SAVE.yardTest ||= {});
      sets.forEach((id, i) => { B[`${id}:a,b,c${sfx}`] = 1000 * (i + 1); if (i % 2) B[`${id}:d,e,f${sfx}`] = 1500 * (i + 1); if (i === 0) T[`${id}:a,b,c${sfx}`] = 900; });
      B['nails:a,b,c:mendicant'] = 999999; // another class's record must not count
      return HS.yardSets().map((r) => `${r.id}:${r.best}/${r.tests.join('/')}:${r.builds}`); }, hero);
    await p.waitForTimeout(250); await check(`sets-${hero}`); await shot(`sets-${hero}`);
  }
  // The Stride's guard after a perfect dodge, and its card line.
  out.stride = await p.evaluate(() => { HS.SAVE.hero = 'saint'; HS.SAVE.equip = {}; for (const sl of HS.VSETS.stride.slots.slice(0, 4)) { const it = HS.makeItem(sl, 4, 'X', undefined, 12); it.set = 'stride'; HS.SAVE.equip[sl] = it; } HS.applyGear(true);
    const P = HS.player; P.guardT = 0; const k0 = HS.setGuard(); P.guardT = HS.game.time + 2; const k1 = HS.setGuard(); P.guardT = 0;
    return { k: +(k1 / k0).toFixed(2), card: HS.VSETS.stride.bonus.find((q) => q[0] === 4)[1] }; });
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
