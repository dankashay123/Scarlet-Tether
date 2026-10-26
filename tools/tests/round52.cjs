// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round52.cjs <outDir> [WxH]
// Round 52: Ember Step's landing burst (and its twist), the Last Confessor's
// four pieces binding every 6th hit, and the Confessor's card at a small phone.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r52-${n}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = 'saint'; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(500);
  const wear = (id, n) => p.evaluate(([id, n]) => { HS.SAVE.equip = {}; HS.VSETS[id].slots.slice(0, n).forEach((sl) => { const it = HS.makeItem(sl, 4, 'X', undefined, 3); it.set = id; HS.SAVE.equip[sl] = it; }); HS.applyGear(true); }, [id, n]);
  const ring = () => p.evaluate(() => { HS.enemies.length = 0; const P = HS.player, list = []; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const e = HS.spawnMonster('risen', P.x + 150 + Math.cos(a) * 30, P.y + Math.sin(a) * 22, { room: HS.game.curRoom.id }); if (e) { e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; list.push(e); } } window.__ring = list; });
  const dealt = () => p.evaluate(() => Math.round(window.__ring.reduce((a, e) => a + e.maxHp - e.hp, 0)));
  // Ember Step aimed at a knot of foes: the landing burst hits them all.
  for (const [tag, n] of [['plain', 0], ['twist', 6]]) {
    if (n) await wear('stride', n); else await p.evaluate(() => { HS.SAVE.equip = {}; HS.applyGear(true); });
    await ring();
    await p.evaluate(() => { HS.SAVE.rites = { ...(HS.SAVE.rites || {}), m1: 'step' }; HS.player.m1cd = 0; HS.player.fireCd = 99; HS.castM1 ? HS.castM1({ a: 0, f: 1 }) : (HS.input.m1 = true); });
    await p.waitForTimeout(250); if (tag === 'plain') await shot('step-burst');
    await p.waitForTimeout(700);
    out[`step_${tag}`] = { dealt: await dealt(), hit: await p.evaluate(() => window.__ring.filter((e) => e.hp < e.maxHp).length) };
  }
  // The Last Confessor at 4: every 6th bolt binds.
  await wear('confessor', 4); await ring();
  await p.evaluate(() => { HS.player.fireCd = 0; HS.player.confN = 0; for (const e of window.__ring) e.bound = 0; HS.player.x = window.__ring[0].x - 120; });
  await p.waitForTimeout(4000);
  out.confessor4 = await p.evaluate(() => ({ hits: HS.player.confN, bound: window.__ring.filter((e) => e.bound > 0).length }));
  // Its card in the bag.
  await wear('confessor', 6);
  await p.evaluate(() => { HS.enemies.length = 0; HS.openInventory(); HS.game.inv.sel = { from: 'equip', slot: 'hood' }; }); await p.waitForTimeout(1200);
  await shot('confessor-card'); out.problems = await p.evaluate(() => HS.textProblems());
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.equip = {}; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
