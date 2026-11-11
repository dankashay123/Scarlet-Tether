// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round71.cjs <outDir> [WxH]
// Round 71: the Anchoress, her shards and her 18 rites: the Rites panel
// as him, every rite cast in a crowd (damage dealt, no errors), Wounds offered.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = { rites: {} };
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r71-${n}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 9; HS.SAVE.lvl = 60; HS.SAVE.hero = 'anchoress'; HS.SAVE.arites = {}; HS.enterTown(false); });
  await p.waitForTimeout(800);
  // The Rites panel lists his rites, one tab per slot.
  for (const [i, slot] of ['m1', 'm2', 'pen'].entries()) {
    await p.evaluate((slot) => { HS.openRites('play'); HS.game.riteFocus = slot; }, slot); await p.waitForTimeout(200); await shot(`rites-${slot}`);
    out[`problems_${slot}`] = await p.evaluate(() => HS.textProblems());
  }
  out.lists = await p.evaluate(() => ['m1', 'm2', 'pen'].map((s) => HS.riteList(s).map((r) => r.id).join(',')));
  await p.evaluate(() => { HS.game.state = 'play'; });
  // Each set's look (4 pieces).
  out.looks = await p.evaluate(() => HS.heroSets().map((id) => { HS.devSet(id, true); return HS.saintSheet(); }));
  await p.evaluate(() => { HS.devSet('reliquary', true); });
  await p.waitForTimeout(400); await shot('town-reliquary-look');
  // A crowd in Stratum I; every rite cast at it.
  await p.evaluate(() => { HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(600);
  const crowd = () => p.evaluate(() => { HS.enemies.length = 0; const P = HS.player, list = [];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, d = 40 + (k % 3) * 22; const e = HS.spawnMonster(k % 4 ? 'risen' : 'acolyte', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id }); if (!e) continue; e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; list.push(e); }
    window.__crowd = list; });
  const dealt = () => p.evaluate(() => Math.round(window.__crowd.reduce((a, e) => a + (e.maxHp - e.hp), 0)));
  for (const slot of ['m1', 'm2', 'pen']) {
    const ids = await p.evaluate((slot) => HS.riteList(slot).map((r) => r.id), slot);
    for (const id of ids) {
      await crowd();
      await p.evaluate(([slot, id]) => { HS.SAVE.arites[slot] = id; HS.player.m1cd = HS.player.m2cd = 0; HS.player.fireCd = 99; HS.player.penance = HS.T.penance.charge; HS.player.rainT = 0; HS.player.hp = HS.player.maxHp; }, [slot, id]);
      await p.evaluate((slot) => { HS.input[slot] = true; }, slot);
      await p.waitForTimeout(slot === 'pen' ? 1500 : 700);
      out.rites[id] = await dealt();
      if (['svolley', 'consecrate', 'sward', 'shardchain', 'shattered', 'cathedral', 'relicjudge', 'snova'].includes(id)) await shot(`cast-${id}`);
      await p.evaluate(() => { HS.player.rainT = 0; HS.player.fireCd = 0; });
    }
  }
  // Wounds offered for his chosen rites.
  out.shards = await p.evaluate(() => [HS.shardCount(), (HS.shards || []).length]);
  await crowd(); await p.evaluate(() => { HS.player.fireCd = 0; }); await p.waitForTimeout(900); await shot('shards-fire');
  await p.evaluate(() => { HS.devSet('reliquary', true); }); await crowd(); await p.waitForTimeout(900); await shot('shards-set'); out.shardsSet = await p.evaluate(() => HS.shardCount());
  out.wounds = await p.evaluate(() => HS.WOUNDS.filter((w) => w.rite && HS.ARITES.m1.concat(HS.ARITES.m2, HS.ARITES.pen).some((r) => r.id === w.rite)).length);
  // Affixes: drop rates (Graven on rare+ only, Beatified never), then cut lines at the forge.
  out.drops = await p.evaluate(() => { let n = 0, adv = 0, two = 0, ult = 0, low = 0; for (let k = 0; k < 4000; k++) { const it = HS.rollItem(3, 6); n++; if (it.adv) { adv++; if (it.adv.length > 1) two++; if (it.ri < 2) low++; } if (it.ult) ult++; } return { n, adv, two, ult, low }; });
  await p.evaluate(() => { HS.enterTown(false); HS.game.state = 'play'; HS.SAVE.embers = 200; HS.SAVE.gold = 100000; HS.SAVE.tears = 2; HS.applyGear(); });
  const before = await p.evaluate(() => ({ dmgMul: HS.G.dmgMul, charges: HS.G.charges, shards: HS.shardCount() }));
  await p.evaluate(() => { HS.openForge(); HS.game.forge.tab = 1; HS.game.forge.sel = 0; }); await p.waitForTimeout(200); await shot('forge-affix-empty');
  const tapBtn = (i) => p.evaluate((i) => { const L = HS.featLayout(), r = HS.affixGeo(L).rows[i]; HS.affixTap(L, [...['hood', 'mantle', 'gloves', 'girdle', 'rosary', 'seal', 'relic', 'greaves', 'bow', 'quiver'].map((s) => HS.SAVE.equip[s]).filter(Boolean), ...HS.SAVE.bag], r.btn.x + 4, r.btn.y + 4); if (HS.game.ask) HS.askTap(HS.askLayout().yes.x + 4, HS.askLayout().yes.y + 4); }, i);
  for (const i of [0, 1, 2, 3]) { await tapBtn(i); await p.waitForTimeout(80); }
  out.cut = await p.evaluate(() => { const it = HS.SAVE.equip[Object.keys(HS.SAVE.equip).find((k) => HS.SAVE.equip[k])]; return { adv: it.adv, ult: it.ult, embers: HS.SAVE.embers, gold: HS.SAVE.gold, tears: HS.SAVE.tears }; });
  out.after = await p.evaluate(() => ({ dmgMul: HS.G.dmgMul, charges: HS.G.charges, shards: HS.shardCount() }));
  out.before = before;
  await p.waitForTimeout(300); await shot('forge-affix-cut');
  out.problemsAffix = await p.evaluate(() => HS.textProblems());
  // A third Beatified line with no Tear left is refused.
  await tapBtn(3); out.tearsLeft = await p.evaluate(() => HS.SAVE.tears);
  await p.evaluate(() => { HS.game.state = 'play'; HS.openInventory(); const it = HS.SAVE.equip[Object.keys(HS.SAVE.equip).find((k) => HS.SAVE.equip[k])]; HS.game.inv.sel = { from: 'equip', slot: it.slot }; }); await p.waitForTimeout(300); await shot('bag-affix-card');
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; HS.enterTown(false); });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
