// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round55.cjs <outDir> [WxH]
// Round 55: the Mendicant's own Wound cards (mace icon, blow names), his arms
// in the bag (mace and satchel icons, names), the other saint marked in town
// and on the town map, and SWITCH SAINT on the pause screen.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r55-${n}.png` });
  const words = () => p.evaluate(() => HS.textProblems().filter((q) => /[A-Z]{2}/.test(q.replace(/^[A-Z ]+:/, ''))));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.hero = 'saint'; HS.SAVE.cleared = 9; HS.enterTown(false); HS.game.state = 'play'; });
  await p.waitForTimeout(800);
  // The other saint, marked in the close.
  await p.evaluate(() => { const n = HS.room.npcs.find((q) => q.hero); HS.player.x = n.x - 70; HS.player.y = n.y + 10; }); await p.waitForTimeout(1200); await shot('town-marker');
  await p.evaluate(() => { HS.game.state = 'map'; }); await p.waitForTimeout(300); await shot('town-map');
  // SWITCH SAINT on the pause screen asks, then switches.
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(300); await shot('pause-switch');
  out.pauseProblems = await words();
  out.switch = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), W = HS.W, H = HS.H, B = { x: Math.round(W / 2 - 55), y: H - 56, w: 110, h: 20 };
    HS.pointerDown(4, r.left + (B.x + 50) / W * r.width, r.top + (B.y + 10) / H * r.height); HS.pointerUp(4); const asked = !!HS.game.ask; const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); return { asked, hero: HS.heroId(), state: HS.game.state }; });
  await p.waitForTimeout(1200);
  // His Wound cards: a mace, not a crossbow; blows, not nails.
  out.wounds = await p.evaluate(() => ['wrath', 'quick', 'split', 'pierce', 'heavy'].map((id) => { const w = HS.WOUNDS.find((q) => q.id === id); return `${HS.heroText(w.name)}: ${HS.heroText(w.text(1))}`; }));
  await p.evaluate(() => { window.HS_AUTOSTIG = false; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(600);
  await p.evaluate(() => { HS.game.state = 'stig'; HS.game.stig = { cards: ['wrath', 'heavy', 'split'].map((id) => HS.WOUNDS.find((q) => q.id === id)), t: 1 }; }); await p.waitForTimeout(300); await shot('wounds');
  out.stigProblems = await words();
  await p.evaluate(() => { HS.game.stig = null; HS.game.state = 'play'; });
  // His arms in the bag: the Font's mace and satchel, the Penitent's Prod, plain ones.
  await p.evaluate(() => { HS.SAVE.equip = {}; HS.SAVE.equip.bow = HS.armsItem('font', 'bow', 3); HS.SAVE.equip.quiver = HS.armsItem('font', 'quiver', 3);
    const L = HS.LEGENDS.find((q) => q.id === 'heavyBow'), prod = HS.makeItem('bow', 3, L.name, undefined, 3); prod.legend = HS.LEGENDS.indexOf(L); prod.power = L.id;
    HS.SAVE.bag = [prod, HS.makeItem('bow', 1, 'X', undefined, 3), HS.makeItem('quiver', 1, 'X', undefined, 3)]; HS.applyGear(true); HS.openInventory(); HS.game.inv.sel = { from: 'equip', slot: 'bow' }; });
  await p.waitForTimeout(400); await shot('bag-arms');
  out.arms = await p.evaluate(() => [HS.SAVE.equip.bow, HS.SAVE.equip.quiver, ...HS.SAVE.bag].map((it) => HS.heroText(it.name)));
  out.bagProblems = await words();
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.equip = {}; HS.SAVE.bag = []; HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
