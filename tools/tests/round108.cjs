// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round108.cjs <outDir> [WxH]   (FULL=0 skips the whole auto descent)
// Round 108: auto Wounds (kinds, weights, the level-up button, the pause window) and auto play (the Descent panel's
// button, locked on a Station not cleared, reduced gold and Saint XP, the pilot fighting, a whole descent to the tally).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r108-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?run&dev'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.autoW = null; HS.SAVE.autoPlay = false; });
  // Wound kinds and weights.
  out.kinds = await p.evaluate(() => { const ids = new Set(HS.WOUNDS.map((w) => w.id)), bad = [...HS.WOUND_KIND.def, ...HS.WOUND_KIND.util].filter((id) => !ids.has(id));
    const W = (id) => HS.WOUNDS.find((w) => w.id === id), cards = [W('wrath'), W('vigil'), W('crescent'), W('swift')], A = HS.autoW(), pick = (o) => { Object.assign(A, o); return cards[HS.autoWoundPick(cards)].id; };
    return { bad, def: pick({ off: 0, def: 2, util: 0 }), util: pick({ off: 0, def: 0, util: 2 }), off: pick({ off: 2, def: 0, util: 0 }), even: pick({ off: 1, def: 1, util: 1 }) }; });
  // The level-up screen with auto off: the AUTO PICK button; tapping it turns auto on and takes a Wound.
  await p.evaluate(() => { HS.player.god = true; HS.game.run.pending = 1; HS.openStigmata(); }); await p.waitForTimeout(700); await check('stig'); await shot('stig');
  out.autoBtn = await p.evaluate(() => { const B = HS.stigButtons().auto; HS.stigTap(B.x + 4, B.y + 4); return { on: HS.autoW().on, state: HS.game.state, wounds: Object.values(HS.game.run.wounds).reduce((a, n) => a + n, 0), toast: HS.game.toast && HS.game.toast.msg }; });
  // With auto on a level never opens the screen.
  out.autoLevel = await p.evaluate(async () => { HS.game.run.pending = 2; HS.game.stigAt = 0; await new Promise((r) => setTimeout(r, 1200)); return { state: HS.game.state, wounds: Object.values(HS.game.run.wounds).reduce((a, n) => a + n, 0), pending: HS.game.run.pending }; });
  // The pause window.
  await p.evaluate(() => { HS.game.state = 'pause'; const t = HS.pauseLayout().tiles.find((q) => q.id === 'auto'); HS.pauseTap(t.x + 4, t.y + 4); }); await p.waitForTimeout(400); await check('autowin'); await shot('autowin');
  out.win = await p.evaluate(() => { const L = HS.autoWinLayout(), A = HS.autoW(), was = A.def; HS.autoWinTap(L.row(2).x + L.row(2).w - 6, L.row(2).y + 4); const up = A.def; HS.autoWinTap(L.row(0).x + 4, L.row(0).y + 4); const off = A.on; HS.autoWinTap(L.done.x + 4, L.done.y + 4); return { was, up, off, state: HS.game.state }; });
  // The Descent panel in town.
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1800);
  out.panel = await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.autoPlay = false; HS.SAVE.cleared = -1; HS.game.descent = { i: 0, t: 0 }; HS.game.state = 'descent';
    const L = HS.descentLayout(), tap = () => HS.descentTap(L.auto.x + 4, L.auto.y + 4); tap(); const locked = !HS.SAVE.autoPlay; HS.SAVE.cleared = 2; tap(); return { locked, on: HS.SAVE.autoPlay, w: [L.omen.w, L.auto.w] }; });
  await p.waitForTimeout(300); await check('descent'); await shot('descent');
  // An auto run: flagged, pays a quarter of the gold and half the Saint XP, and the pilot fights.
  await p.evaluate(() => HS.beginDescent(0)); await p.waitForFunction(() => HS.game.scene === 'wound' && HS.game.state === 'play', null, { timeout: 20000 }); await p.waitForTimeout(500);
  out.pay = await p.evaluate(() => { const R = HS.game.run, mean = () => { const n0 = HS.drops.length; HS.dropLoot(HS.player.x, HS.player.y, { gold: 300 }); const d = HS.drops.splice(n0); return d.reduce((a, q) => a + q.amount, 0) / d.length; };
    const a = mean(); R.auto = false; const m = mean(); R.auto = true; HS.SAVE.lvl = 50; HS.SAVE.lxp = 0; HS.gainSaintXp(100); return { auto: R.auto, goldK: +(a / m).toFixed(2), xp: HS.SAVE.lxp }; });
  out.pilot = await p.evaluate(async () => { const x0 = HS.player.x, y0 = HS.player.y; let far = 0; const t0 = performance.now(), hp0 = HS.player.hp; let lost = 0, was = hp0;
    while (performance.now() - t0 < 30000) { await new Promise((r) => setTimeout(r, 200)); far = Math.max(far, Math.hypot(HS.player.x - x0, HS.player.y - y0)); lost += Math.max(0, was - HS.player.hp); was = HS.player.hp; if (HS.player.hp < HS.player.maxHp * 0.3) was = HS.player.hp = HS.player.maxHp; if (HS.game.state !== 'play' && HS.game.state !== 'pause') break; }
    return { far: Math.round(far), hpLost: Math.round(lost), maxHp: HS.player.maxHp, kills: HS.game.kills, state: HS.game.state, wounds: Object.values(HS.game.run.wounds).reduce((a, n) => a + n, 0) }; });
  await shot('autorun'); // no text check: damage numbers overlap in a fight
  if (process.env.FULL !== '0') { // the whole descent at three times the speed (god mode: this checks the pilot finds its way, not survival)
    out.full = await p.evaluate(async () => { HS.DEV.speed = 3; HS.DEV.god = true; const t0 = performance.now(); let warden = false;
      while (performance.now() - t0 < 420000) { await new Promise((r) => setTimeout(r, 500)); HS.player.hp = HS.player.maxHp; if (HS.game.warden) warden = true; if (HS.game.state === 'tally' || HS.game.scene === 'town') break; }
      HS.DEV.speed = 1; HS.DEV.god = false; return { secs: Math.round((performance.now() - t0) / 1000), state: HS.game.state, scene: HS.game.scene, kills: HS.game.kills, warden, toll: HS.game.toll && Math.round(100 * HS.game.toll.v / HS.game.toll.max), left: HS.enemies.filter((e) => !e.dead).length, dropsLeft: HS.drops.filter((d) => !d.taken && d.kind !== 'globe').length, runGold: HS.game.run.gold, goal: HS.AP.goal, at: [Math.round(HS.player.x), Math.round(HS.player.y)] }; });
    await shot('end');
  }
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
