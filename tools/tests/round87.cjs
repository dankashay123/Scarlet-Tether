// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round87.cjs <outDir> [WxH]
// Round 87: Saint level 100, a talent point per Station cleared (I to XX), the three talent webs
// (columns, links, four legendary ends each), old points handed back, every node's card.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r87-${n}-${VW}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; });
  // Points: levels and Stations.
  out.pts = await p.evaluate(() => { const r = []; HS.SAVE.talents = {}; HS.SAVE.lvl = 1; HS.SAVE.cleared = -1; r.push(HS.talPts()); HS.SAVE.cleared = 4; r.push(HS.talPts()); HS.SAVE.cleared = 29; r.push(HS.talPts()); HS.SAVE.lvl = 100; r.push(HS.talPts()); return r; });
  out.max = await p.evaluate(() => HS.MAX_SAINT);
  // The data: every node has an icon, a text, a place of its own; links point left; four legends a tree.
  out.data = await p.evaluate(() => HS.TALENT_TREES.map((T0) => { const seen = new Set(); let bad = 0, ranks = 0;
    for (const t of T0.nodes) { const k = `${t.c},${t.r}`; if (seen.has(k)) bad++; seen.add(k); ranks += t.max; if (!t.text(1)) bad++; for (const id of t.f || []) if (!HS.TAL_BY[id] || HS.TAL_BY[id].c >= t.c || HS.TAL_BY[id].tree !== t.tree) bad++; }
    return { nodes: T0.nodes.length, ranks, legends: T0.nodes.filter((t) => t.legend).length, bad }; }));
  // The owner's rule: the points can never fill every talent, nor reach every legendary talent.
  out.cap = await p.evaluate(() => { HS.SAVE.lvl = HS.MAX_SAINT; HS.SAVE.cleared = 29; HS.SAVE.talents = {}; const pts = HS.talPts(), ranks = HS.TALENT_TREES.flatMap((T0) => T0.nodes).reduce((a, t) => a + t.max, 0);
    // The cheapest way to hold all twelve legendary talents: each one's cheapest chain, shared nodes counted once.
    const need = new Set(), cost = (t) => t.max + (t.f ? Math.min(...t.f.map((id) => cost(HS.TAL_BY[id]))) : 0), walk = (t) => { need.add(t.id); if (t.f) walk(HS.TAL_BY[t.f.slice().sort((x, y) => cost(HS.TAL_BY[x]) - cost(HS.TAL_BY[y]))[0]]); };
    for (const T0 of HS.TALENT_TREES) for (const t of T0.nodes) if (t.legend) walk(t);
    const legends = [...need].reduce((a, id) => a + HS.TAL_BY[id].max, 0); return { pts, ranks, legends, ok: ranks >= pts * 1.4 && legends > pts }; });
  if (!out.cap.ok) errs.push('TALENT CAP: the points can fill too much of the trees ' + JSON.stringify(out.cap));
  // Learning: a locked node refuses; a chain learned to its end takes the legendary talent.
  out.learn = await p.evaluate(() => { HS.SAVE.talents = {}; HS.openCanonry(); HS.game.talTab = 0; const L = HS.talLayout(), tapN = (id) => { const c = L.cell(HS.TAL_BY[id]); HS.canonryTap(c.x + c.w / 2, c.y + c.h / 2); HS.canonryTap(L.learn.x + 4, L.learn.y + 4); };
    const r = {}; tapN('greatbolt'); r.locked = HS.tal('greatbolt'); tapN('brawn'); r.unlinked = HS.tal('brawn');
    for (const id of ['might', 'brawn', 'precise', 'heavy', 'keen', 'force', 'ruin', 'brutal']) for (let i = 0; i < 5; i++) tapN(id);
    tapN('greatbolt'); r.legend = HS.tal('greatbolt'); r.spent = HS.talSpent(); r.dmg = HS.ts('dmg'); return r; });
  await p.waitForTimeout(300); await shot('offence');
  // Every tree, with every card opened once (text problems on any of them).
  for (let ti = 0; ti < 3; ti++) {
    const ids = await p.evaluate((ti) => { HS.game.talTab = ti; HS.game.talSel = null; return HS.TALENT_TREES[ti].nodes.map((t) => t.id); }, ti);
    for (const id of ids) { const pr = await p.evaluate((id) => { HS.game.talSel = id; return HS.textProblems(); }, id); if (pr.length) probs.push(`${id}: ${pr.slice(0, 2).join('; ')}`); }
    await p.evaluate(() => { HS.game.talSel = null; }); await p.waitForTimeout(150); if (ti) await shot(['', 'defence', 'rites'][ti]);
  }
  // All learned, and a legend's card.
  await p.evaluate(() => { HS.game.talTab = 0; for (const T0 of HS.TALENT_TREES) for (const t of T0.nodes) HS.SAVE.talents[t.id] = t.max; HS.game.talSel = 'cull'; HS.applyGear(); }); await p.waitForTimeout(200); await shot('full');
  out.full = await p.evaluate(() => ({ spent: HS.talSpent(), charges: HS.G.charges }));
  // The other classes read the same web in their own words.
  out.words = await p.evaluate(() => { const was = HS.SAVE.hero; const r = {}; for (const h of ['mendicant', 'anchoress']) { HS.SAVE.hero = h; r[h] = [HS.heroText(HS.TAL_BY.quick.text(1)), HS.heroText(HS.TAL_BY.greatbolt.text(1))]; } HS.SAVE.hero = was; return r; });
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
