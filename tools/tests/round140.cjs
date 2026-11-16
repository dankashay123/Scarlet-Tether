// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round140.cjs <outDir> [WxH]
// Round 140: Sanctity counts Might (rolls, sets, enchants, powers, talents, passives, Rubrics, the Calling), not only
// item levels. Per class: a plain build, a set build and a full build at Stations VI, XII and XX against the need;
// gear Sanctity still sets damage (G.power); the bag's Sanctity breakdown card and the Descent panel (no text problems).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; });
  const build = (hero, il, prof) => p.evaluate(([hero, il, prof]) => { const sl = ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'];
    HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.lvl = 60; HS.SAVE.passives = []; HS.SAVE.talents = {};
    for (const s of sl) HS.SAVE.equip[s] = HS.makeItem(s, 2, 'X', ['dmg', 'crit'], il);
    if (prof !== 'plain') { const set = HS.mySets()[0]; for (const s of HS.VSETS[set].slots.slice(0, 6)) { const it = HS.makeItem(s, 4, 'X', ['dmg', 'crit', 'hp'], il); it.set = set; HS.SAVE.equip[s] = it; } for (const s of ['bow', 'quiver']) HS.SAVE.equip[s] = HS.armsItem(set, s, il); }
    if (prof === 'full') { const ids = HS.myEnch().slice(0, 2); const E = Object.values(HS.SAVE.equip); ids.forEach((i, k) => { E[k].ench = HS.ENCHANTS[i].id; E[k].enchT = 2; }); HS.SAVE.passives = HS.PASSIVES.filter((q) => !q.need).slice(0, 4).map((q) => q.id); HS.SAVE.talents = { dmg: 5 }; }
    HS.applyGear(true); return { gear: HS.gearSanctity(), sanct: HS.playerSanctity(), need: HS.stationNeed(il - 1), power: HS.G.power, might: +HS.mightParts().k.toFixed(2) }; }, [hero, il, prof]);
  out.table = {};
  for (const hero of ['saint', 'mendicant', 'anchoress']) for (const il of [6, 12, 20]) for (const prof of ['plain', 'set', 'full']) { const r = await build(hero, il, prof); out.table[`${hero} ${il} ${prof}`] = `${r.sanct}/${r.need} (gear ${r.gear}, might ${r.might})`;
    if (Math.abs(r.power - r.gear / 10) > 0.01) out.powerBad = true; }
  // The bag: tap Sanctity for its breakdown.
  await build('saint', 12, 'full');
  await p.evaluate(() => { HS.openInventory(); }); await p.waitForTimeout(400);
  const t = await p.evaluate(() => { const r = (HS.game.inv.tipR || []).find((q) => q.k === 'sanct'); return r ? { x: r.x + r.w / 2, y: r.y + r.h / 2 } : null; });
  out.tipRect = !!t;
  if (t) { const c = await p.evaluate(([x, y]) => { const e = document.getElementById('screen').getBoundingClientRect(), k = e.width / HS.W; return { x: e.left + x * k, y: e.top + y * k }; }, [t.x, t.y]); await p.mouse.click(c.x, c.y); await p.waitForTimeout(300);
    out.tip = await p.evaluate(() => HS.game.statTip && HS.game.statTip.k); out.tipText = await p.evaluate(() => HS.textProblems()); await p.screenshot({ path: `${S}/shots/r140-sanct-tip.png` }); }
  await p.evaluate(() => { HS.game.statTip = null; HS.game.state = 'play'; HS.SAVE.cleared = 20; HS.game.descent = { i: 11, t: 0 }; HS.game.state = 'descent'; }); await p.waitForTimeout(300);
  out.descText = await p.evaluate(() => HS.textProblems()); await p.screenshot({ path: `${S}/shots/r140-descent.png` });
  out.ok = !out.powerBad && out.tip === 'sanct' && !out.tipText.length && !out.descText.length;
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
