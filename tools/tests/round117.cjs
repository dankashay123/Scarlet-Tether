// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round117.cjs <outDir> [WxH]
// Round 117: premium skins. Every sheet and weapon anim exists for all three classes, the shop's SKINS tab (buy, wear,
// take off, not enough Indulgences), and each skin worn in a fight by each class (photos).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r117-${n}-${VW}.png`, clip });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?run&dev'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.pskins = []; HS.SAVE.pskin = null; HS.SAVE.indul = 0; });
  out.missing = await p.evaluate(() => { const m = []; for (const P of HS.PSKINS) { for (const h of ['saint', 'mendicant', 'anchoress']) if (!HS.SPR[`${h}_${P.id}`] || !HS.SPR[`${h}_${P.id}`].anims.idle) m.push(`${h}_${P.id}`);
    for (const [sh, a] of [['weapon', `xbow_${P.id}`], ['fx', `bolt_${P.id}`], ['fx', `crystal_${P.id}`], ['fx', `crystalbolt_${P.id}`]]) if (!HS.SPR[sh].anims[a]) m.push(a); } return m; });
  // The shop: no Indulgences, then buy, wear, take off.
  out.shop = await p.evaluate(() => { HS.openStore(3, 'play'); const L = HS.featLayout ? HS.featLayout() : null; return { state: HS.game.state, tab: HS.game.store.tab }; });
  await p.waitForTimeout(400); await check('shop'); await shot('shop');
  out.buy = await p.evaluate(() => { const L = HS.featLayout(), tapB = () => HS.storeTap(L.btnB.x + 4, L.btnB.y + 4), tapA = () => HS.storeTap(L.btnA.x + 4, L.btnA.y + 4), o = {};
    tapB(); o.poor = { asked: !!HS.game.ask, toast: HS.game.toast && HS.game.toast.msg.slice(0, 22) }; HS.SAVE.indul = 2000; tapB(); o.asked = !!HS.game.ask; const A = HS.game.ask; HS.game.ask = null; A.yes();
    o.owned = HS.pskinsOwned().slice(); o.worn = HS.pskin(); o.left = HS.SAVE.indul; tapA(); o.off = HS.pskin(); tapB(); o.on = HS.pskin(); return o; });
  await p.waitForTimeout(400); await check('shop-owned'); await shot('shop-owned');
  await p.evaluate(() => { HS.game.store.sel = 2; }); await p.waitForTimeout(300); await check('shop-psy'); await shot('shop-psy');
  // Each skin in a fight, for each class.
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await p.evaluate((h) => { HS.game.create = null; HS.SAVE.hero = h; HS.SAVE.pskins = HS.PSKINS.map((P) => P.id); HS.game.state = 'play'; HS.DEV.god = true; HS.autoW().on = true; HS.game.stig = null; HS.game.run.pending = 0; HS.game.run.level = 15; HS.enemies.length = 0; HS.applyGear(true); }, hero);
    for (const id of await p.evaluate(() => HS.PSKINS.map((P) => P.id))) {
      await p.evaluate((id) => { HS.SAVE.pskin = id; const P = HS.player; HS.game.state = 'play'; HS.enemies.length = 0; for (let k = 0; k < 3; k++) { const e = HS.spawnMonster('golem', P.x + 95, P.y - 30 + k * 30); if (e) { e.hp = e.maxHp = 1e7; } } }, id);
      await p.waitForTimeout(900); await shot(`${hero}-${id}`, { x: VW / 2 - 110, y: VH / 2 - 110, width: 260, height: 190 });
    }
    out[hero] = await p.evaluate(() => ({ sheet: HS.saintSheet ? HS.saintSheet() : null, skin: HS.pskin() }));
  }
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
