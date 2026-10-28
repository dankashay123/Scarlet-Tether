// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round53.cjs <outDir> [WxH]
// Round 53: the Mendicant's own card text and reach, the set card popup on a
// small phone, the Undercroft's dust and draughts, and Zeal by Station.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r53-${n}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero, st) => p.evaluate(([hero, st]) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = st; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, [hero, st]);
  // Zeal per kill by Station.
  out.zeal = {};
  for (const st of [1, 3, 6, 12]) { await run('saint', st); out.zeal[st] = await p.evaluate(() => +HS.zealDeep().toFixed(2)); }
  // The Mendicant reads mace lines, not crossbow lines.
  await run('mendicant', 2);
  out.text = await p.evaluate(() => ['BOLTS PIERCE ONE MORE FOE.', 'THE CROSSBOW FIRES ONE MORE NAIL.', 'BOLTS SLOW FOES BY 20%.'].map(HS.heroText));
  out.crossbowLeft = await p.evaluate(() => HS.LEGENDS.map((L) => HS.heroText(L.text || '')).concat(HS.TALENT_TREES.flatMap((t) => t.list || t.talents || []).map((x) => HS.heroText(x.text || ''))).filter((s) => /CROSSBOW|\bBOLTS?\b/.test(s)).length);
  // A set card with every bonus: the low tiers fold into a tap line on a small phone.
  await p.evaluate(() => { HS.SAVE.equip = {}; HS.VSETS.choir.slots.forEach((sl) => { const it = HS.makeItem(sl, 4, 'X', undefined, 3); it.set = 'choir'; HS.SAVE.equip[sl] = it; }); HS.applyGear(true); HS.openInventory(); HS.game.inv.sel = { from: 'equip', slot: HS.VSETS.choir.slots[0] }; });
  await p.waitForTimeout(400); await shot('set-card');
  out.setTap = await p.evaluate(() => !!HS.game.inv.setTap);
  if (out.setTap) {
    await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), t = HS.game.inv.setTap, X = r.left + (t.x + t.w / 2) / HS.W * r.width, Y = r.top + (t.y + t.h / 2) / HS.H * r.height; HS.pointerDown(3, X, Y); HS.pointerUp(3); });
    await p.waitForTimeout(300); await shot('set-popup');
    out.popup = await p.evaluate(() => ({ open: !!HS.game.setPop, lines: HS.game.setPop ? HS.setPopLayout().ls.length : 0 }));
    out.problems = await p.evaluate(() => HS.textProblems());
    await p.evaluate(() => { HS.pointerDown(3, 5, 5); HS.pointerUp(3); }); await p.waitForTimeout(200);
    out.closed = await p.evaluate(() => !HS.game.setPop);
  }
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.equip = {}; HS.applyGear(true); });
  // The Undercroft: dust sifting down and a draught bending the flames.
  await run('saint', 2);
  await p.waitForTimeout(4000);
  await p.evaluate(() => { HS.game.draft = { t: 0, max: 3, dir: 1, next: 20 }; });
  await p.waitForTimeout(1300); await shot('undercroft-draught');
  out.ambience = await p.evaluate(() => ({ dust: HS.dustCols.length, draft: +HS.draftK().toFixed(2) }));
  // The Mendicant's blow at work.
  await run('mendicant', 2);
  out.fight = await p.evaluate(async () => { const P = HS.player, list = [];
    for (let k = 0; k < 5; k++) { const e = HS.spawnMonster('risen', P.x + 30 + (k % 2) * 8, P.y - 20 + k * 10, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e6; list.push(e); }
    await new Promise((r) => setTimeout(r, 1800)); return { hit: list.filter((e) => e.hp < e.maxHp).length }; });
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(60); if (await p.evaluate(() => HS.swingT > 0.12 && HS.swingT < 0.2)) break; }
  await shot('mendicant-swing');
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
