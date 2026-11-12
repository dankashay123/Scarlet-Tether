// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round80.cjs <outDir> [WxH]
// Round 80: the new class Wounds, the level-up screen's REROLL (10% of the
// run's gold) and SACRIFICE (7 ranks for a mythic Wound), the mythic reveal,
// and every new Wound at work in a fight for each class.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r80-${n}-${VW}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await p.evaluate((hero) => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.applyGear();
      HS.game.nextStratum = 1; HS.game.nextDiff = 3; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; window.HS_AUTOSTIG = false; }, hero);
    await p.waitForTimeout(500);
    // Cards offered: the class's own new ones show up, mythic never does.
    out[hero] = await p.evaluate((hero) => { const seen = new Set(); let mythic = 0; HS.game.run.wounds = {};
      for (let k = 0; k < 400; k++) for (const w of HS.rollStigmata()) { seen.add(w.id); if (w.mythic) mythic++; }
      const own = HS.WOUNDS.filter((w) => w.hero === hero && !w.mythic).map((w) => w.id);
      return { own: own.length, ownSeen: own.filter((id) => seen.has(id)).length, mythicOffered: mythic, mythicPool: HS.mythicPool().map((w) => w.id) }; }, hero);
    // Reroll: costs 10% of the run's gold, the account's gold is untouched.
    out[hero].reroll = await p.evaluate(() => { const R = HS.game.run; R.gold = 1000; HS.SAVE.gold = 5000; R.pending = 1; HS.openStigmata(); HS.game.stig.t = 1; const before = HS.game.stig.cards.map((c) => c.id).join(); const cost = HS.rerollCost(); HS.rerollWounds(); return { cost, gold: R.gold, account: HS.SAVE.gold, changed: HS.game.stig.cards.map((c) => c.id).join() !== before }; });
    await p.waitForTimeout(400); await shot(`cards-${hero}`); { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${hero} cards: ${pr.slice(0, 4).join('; ')}`); }
    // Sacrifice: 9 ranks held, 7 go, one mythic comes; the question first.
    out[hero].sac = await p.evaluate(() => { const R = HS.game.run; R.wounds = { wrath: 3, luck: 3, swift: 2, vigil: 1 }; HS.applyGear(); HS.game.stig.t = 1; const held = HS.woundRanks(); const pend = R.pending; HS.askSacrifice(); const asked = !!HS.game.ask; return { held, asked, pend }; });
    await p.waitForTimeout(250); await shot(`ask-${hero}`);
    out[hero].sac2 = await p.evaluate(() => { const y = HS.game.ask.yes; HS.game.ask = null; y(); const R = HS.game.run; const myth = Object.keys(R.wounds).filter((id) => HS.WOUNDS.find((w) => w.id === id).mythic); return { left: HS.woundRanks(), myth, pending: R.pending, reveal: !!HS.game.stig.reveal }; });
    await p.waitForTimeout(500); await shot(`mythic-${hero}`); { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${hero} reveal: ${pr.slice(0, 4).join('; ')}`); }
    await p.evaluate(() => { HS.pickStigma(0); });
    // Every new Wound and every mythic at once, in a crowd.
    await p.evaluate((hero) => { const R = HS.game.run; R.wounds = {}; for (const w of HS.WOUNDS) if ((w.hero === hero || (!w.hero && w.mythic)) && (w.id.length && (w.mythic || /^[sma][A-Z]/.test(w.id)))) R.wounds[w.id] = w.max; HS.applyGear(); HS.player.hp = HS.player.maxHp;
      HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const e = HS.spawnMonster(k % 5 ? 'risen' : 'acolyte', P.x + Math.cos(a) * 70, P.y + Math.sin(a) * 50, { room: HS.game.curRoom.id }); if (e) { e.state = 'move'; e.spawnDelay = 0; } } }, hero);
    await p.waitForTimeout(2500); await shot(`fight-${hero}`);
    out[hero].fight = await p.evaluate(() => ({ kills: HS.game.kills, foes: HS.enemies.filter((e) => !e.dead).length, hp: Math.round(HS.player.hp), maxHp: HS.player.maxHp, shards: HS.isAnch && HS.isAnch() ? HS.shards.length : undefined }));
  }
  console.log(JSON.stringify(out));
  console.log(probs.length ? `text problems ${probs.length}\n${probs.join('\n')}` : 'text problems 0');
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
