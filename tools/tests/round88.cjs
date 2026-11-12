// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round88.cjs <outDir> [WxH]
// Round 88: the tighter talent webs and the limit on the Talents page, two talent builds (swap in
// Vael only), the gifts of Saint levels 50, 75 and 100 (fourth passive slot, earned looks, titles).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r88-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 4).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 40; HS.SAVE.cleared = 9; HS.SAVE.talents = {}; HS.SAVE.talPages = null; HS.SAVE.talPage = 0; HS.SAVE.looks = null; });
  out.limit = await p.evaluate(() => ({ max: HS.TAL_MAX_PTS, ranks: HS.TAL_RANKS, nodes: HS.TALENT_TREES.map((T0) => T0.nodes.length) }));
  // Two builds: learn on I, swap to II (empty), learn there, swap back; no swap in a descent.
  out.pages = await p.evaluate(() => { HS.openCanonry(); HS.game.talTab = 0; const L = HS.talLayout(), tap = (r) => HS.canonryTap(r.x + 4, r.y + 4), learn = (id) => { const c = L.cell(HS.TAL_BY[id]); HS.canonryTap(c.x + c.w / 2, c.y + c.h / 2); tap(L.learn); };
    const r = {}; learn('might'); learn('might'); r.one = HS.talSpent(); HS.talPage(1, true); r.two = HS.talSpent(); r.page = HS.talPageNo(); learn('precise'); HS.talPage(0, true); r.back = [HS.tal('might'), HS.tal('precise')]; HS.talPage(1, true); r.again = [HS.tal('might'), HS.tal('precise')]; HS.talPage(0, true);
    const sc = HS.game.scene; HS.game.scene = 'wound'; HS.talPage(1, true); r.inRun = HS.talPageNo(); HS.game.scene = sc; return r; });
  await p.waitForTimeout(300); await shot('talents'); await check('talents');
  await p.evaluate(() => { HS.game.talSel = 'zealstorm'; }); await check('talents card'); await p.evaluate(() => { HS.game.talSel = 'greatbolt'; }); await check('talents locked'); await shot('talents-locked');
  // Level gifts.
  out.gifts = await p.evaluate(() => { const r = {}, at = (l) => { HS.SAVE.lvl = l; HS.SAVE.lxp = 0; HS.levelLooks(); return { title: HS.saintTitle().trim(), slot4: HS.SAVE.lvl >= HS.PASSIVE_AT[3], own: HS.looks().own.filter((q) => /gilt|d:gold/.test(q)) }; };
    r[49] = at(49); HS.gainSaintXp(HS.lvNeed(49)); r.toast = HS.game.toast && (HS.game.toast.text || HS.game.toast); r[50] = at(50); r[75] = at(75); r[100] = at(100); return r; });
  // Four passives worn and working.
  out.passives = await p.evaluate(() => { const ids = HS.PASSIVES.filter((q) => !q.stat).slice(0, 4).map((q) => q.id); HS.SAVE.passives = ids; HS.applyGear(); return ids.map((id) => !!HS.pas(id)); });
  await p.evaluate(() => { HS.openRites(); HS.game.riteFocus = 'passive'; }); await p.waitForTimeout(300); await shot('passives'); await check('passives');
  await p.evaluate(() => { HS.SAVE.lvl = 30; }); await p.waitForTimeout(150); await shot('passives-locked'); await check('passives locked'); await p.evaluate(() => { HS.SAVE.lvl = 100; });
  // The Plush stall lists the earned looks, worn and locked.
  for (const [tab, id] of [[0, 'gold'], [2, 'gilt'], [3, 'gilt']]) { await p.evaluate(([tab, id]) => { HS.openPlush(); HS.game.plush.tab = tab; HS.game.plush.sel = id; }, [tab, id]); await p.waitForTimeout(200); await check(`plush ${tab}`); if (tab === 0) await shot('plush-gold'); }
  await p.evaluate(() => { HS.SAVE.looks = null; HS.SAVE.lvl = 60; HS.openPlush(); HS.game.plush.tab = 0; HS.game.plush.sel = 'gold'; }); await p.waitForTimeout(200); await check('plush locked'); await shot('plush-locked');
  await p.evaluate(() => { HS.SAVE.lvl = 100; HS.game.state = 'pause'; }); await p.waitForTimeout(250); await check('pause title'); await shot('pause');
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
