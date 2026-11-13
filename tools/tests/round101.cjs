// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round101.cjs <outDir> [WxH]
// Round 101: the execute sound and dagger art are gone, the tutorial's rite steps ask to walk up to a foe when none is near,
// the set balance numbers (six-piece damage and guard6 in setGuard, four-piece texts from fourOf), every set card fits.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r101-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  out.gone = await p.evaluate(() => ({ sound: HS.AUDIO && HS.AUDIO.has ? HS.AUDIO.has('execute') : 'n/a', uiDagger: !!HS.SPR.ui.anims.dagger, fxDagger: !!HS.SPR.fx.anims.dagger }));
  // The tutorial: alone, the first rite's step asks to walk up; with a foe beside the Saint it says tap.
  out.tut = await p.evaluate(async () => { HS.SAVE.hero = 'saint'; HS.SAVE.lvl = 1; HS.SAVE.rites = {}; HS.game.nextDiff = 1; HS.newRun(); HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play';
    Object.assign(HS.tut, { on: true, step: 6, t: 0, flags: { moved: 0 } }); for (const e of HS.enemies) e.dead = true; await new Promise((q) => setTimeout(q, 100)); const alone = HS.tutText(HS.tutStep());
    const P = HS.player, e = HS.spawnMonster('risen', P.x + 60, P.y, { room: HS.game.curRoom.id }); e.spawnDelay = 0; e.state = 'move'; await new Promise((q) => setTimeout(q, 100)); const near = HS.tutText(HS.tutStep());
    return { alone, near }; });
  await p.evaluate(() => { for (const e of HS.enemies) e.dead = true; }); await p.waitForTimeout(300); await shot('tut-alone');
  // The numbers: every set has a six-piece multiplier; the guarded sets take less with six pieces on.
  out.bal = await p.evaluate(() => { const K = HS.SETK, o = { six: Object.keys(K.six).length, guard: {} }; HS.tut.on = false;
    for (const [id, g] of Object.entries(K.guard6)) { HS.SAVE.hero = HS.VSETS[id].hero || 'saint'; HS.SAVE.equip = {}; for (const sl of HS.VSETS[id].slots) { const it = HS.makeItem(sl, 4, 'X', undefined, 12); it.set = id; HS.SAVE.equip[sl] = it; } HS.applyGear(true); const k6 = HS.setGuard();
      const sl = HS.VSETS[id].slots[0]; delete HS.SAVE.equip[sl]; HS.applyGear(true); o.guard[id] = +(k6 / HS.setGuard()).toFixed(2); }
    o.four = Object.fromEntries(['stride', 'confessor', 'iron', 'alms', 'glass', 'nails'].map((id) => [id, HS.fourOf(id)])); return o; });
  // Every class's set cards at this size.
  for (const hero of ['saint', 'mendicant', 'anchoress']) { await p.evaluate((hero) => { HS.SAVE.hero = hero; HS.game.state = 'play'; HS.openInventory(); HS.game.setPop = HS.mySets()[0]; }, hero); await p.waitForTimeout(300); await check(`setcard-${hero}`); await shot(`setcard-${hero}`); await p.evaluate(() => { HS.game.setPop = null; }); }
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
