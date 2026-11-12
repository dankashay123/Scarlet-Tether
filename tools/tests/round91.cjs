// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round91.cjs <outDir> [WxH]
// Round 91: Deep Wounds beat the common Wound with the same stat; talent names under the nodes
// where a lane has room; the legendary talents' cues in a fight (the Mark, Sanctuary, Frenzy, Blood Rush, Cadence, the Cull).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r91-${n}-${VW}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  // Each pair: [deep, common] that give the same stat; the deep one's value per rank must be higher.
  out.wounds = await p.evaluate(() => { const val = (id, hero, k) => { HS.SAVE.hero = hero; HS.game.run.wounds = { [id]: 1 }; HS.applyGear(); const G = HS.G; return k === 'fire' ? 1 / HS.fireCdOf(1) : G[k] || G.hpPct; };
    const pairs = [['aSwift', 'quick', 'anchoress', 'fire'], ['mBrawler', 'quick', 'mendicant', 'fire'], ['aHunt', 'sHunter', null, 'eliteD'], ['sLitany', 'aPrayer', null, 'cdr'], ['mUnbowed', 'vigil', 'mendicant', 'hpPct']];
    const r = pairs.map(([d, c, hero, k]) => { const hd = hero || HS.WOUNDS.find((w) => w.id === d).hero, hc = hero || HS.WOUNDS.find((w) => w.id === c).hero || hd; const vd = val(d, hd, k), vc = val(c, hc, k); return { d, c, deep: +vd.toFixed(3), common: +vc.toFixed(3), ok: vd > vc }; });
    HS.SAVE.hero = 'saint'; HS.game.run.wounds = {}; HS.applyGear(); return r; });
  // Names on the talent page.
  out.named = await p.evaluate(() => { HS.tut.on = false; HS.openCanonry(); HS.game.talTab = 0; const L = HS.talLayout(); return { rh: Math.round(L.rh), named: [0, 1, 2].map((i) => HS.talNamed(L, HS.TALENT_TREES[i])) }; });
  for (const ti of [0, 1, 2]) { await p.evaluate((ti) => { HS.game.talTab = ti; HS.SAVE.talents = { might: 5, brawn: 3, vigour: 5, ritepower: 5 }; }, ti); await p.waitForTimeout(200); const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`tree ${ti}: ${pr.slice(0, 3).join('; ')}`); if (ti === 0) await shot('names'); }
  // A fight with every legendary talent: the cues show.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.lvl = 100; HS.SAVE.talents = { mark: 1, frenzy: 1, cull: 1, bloodrush: 1, cadence: 1, sanctuary: 1 }; HS.DEV.god = true; HS.applyGear();
    const P = HS.player; for (let k = 0; k < 10; k++) HS.spawnMonster(k % 2 ? 'risen' : 'crawler', P.x + 50 + (k % 5) * 18, P.y - 30 + Math.floor(k / 5) * 50, { room: HS.game.curRoom.id }); });
  await p.waitForTimeout(2500);
  const cues = await p.evaluate(() => { const P = HS.player, T = HS.game.time; P.rushT = T + 6; P.cadN = 3; P.cadT = T + 6; P.frenzyN = 25; P.frenzyT = T + 4; P.sanctT = T + 0.6; P.iframes = 0.6; HS.input.m1 = true;
    for (const e of HS.enemies) if (!e.dead) e.markT = T + 3; return { marked: HS.enemies.filter((e) => !e.dead && e.markT > T).length }; });
  await p.waitForTimeout(300); await shot('cues');
  // The Cull: a hit that leaves a foe under 10% kills it.
  out.cull = await p.evaluate(() => { const P = HS.player, e = HS.spawnMonster('risen', P.x + 40, P.y, { room: HS.game.curRoom.id }); e.spawnDelay = 0; e.state = 'move'; e.hp = e.maxHp * 0.12; HS.hurtEnemy(e, Math.ceil(e.maxHp * 0.05) / HS.G.dmgMul, false, 1, 0, 0, { share: true }); return { dead: e.dead || e.hp <= 0 }; });
  out.cues = cues;
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
