// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/punish.cjs <outDir>
// Round 16 monster attacks: each new kind (snipe, blight, nova, barrage,
// homing, the Sentence) fires at the Saint; then a dash must cleanse a
// Sentence, and standing still under one must hurt. Then the Censer: its
// icon in the bag, its panel, deeds unlocking upgrades, and their effects.
// Last, level-up Wounds: only those of the chosen rites are offered.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1000);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.player.hp = HS.player.maxHp = 1e6; });
  const seen = {};
  for (const [id, kind] of [['acolyte', 'aim'], ['mourner', 'pool'], ['knight', 'circle'], ['bellringer', 'circle'], ['cherub', 'home'], ['bishop', 'sentence'], ['lantern', 'aim'], ['titan', 'circle']]) {
    await p.evaluate((id) => {
      const P = HS.player; for (const e of HS.enemies) e.dead = true; HS.hazards.length = 0;
      const e = HS.spawnMonster(id, P.x + 50, P.y, { room: HS.game.curRoom.id }); e.spawnDelay = 0; e.state = 'move';
      const i = e.def.attacks.length - 1; e.cds = e.cds.map((c, j) => j === i ? 0 : 99); e.cds[i] = 0; window.__e = e;
    }, id);
    let got = false;
    for (let k = 0; k < 12 && !got; k++) {
      await p.waitForTimeout(150);
      got = await p.evaluate((kind) => kind === 'sentence' ? !!HS.player.sentence : kind === 'home' ? HS.shots.some((s) => s.home) : HS.hazards.some((h) => h.kind === kind), kind);
    }
    seen[id] = got;
    await p.screenshot({ path: `${S}/shots/p-${id}.png` });
  }
  // The Sentence: wait it out (hurts), then cleanse one with a dash.
  const hurt = await p.evaluate(async () => { const P = HS.player; for (const e of HS.enemies) e.dead = true; HS.hazards.length = 0; HS.shots.length = 0; P.hp = P.maxHp; P.sentence = { t: 0.3, max: 2, dmg: 40, r: 40, src: {} }; await new Promise((r) => setTimeout(r, 600)); return P.maxHp - P.hp; });
  const cleansed = await p.evaluate(async () => { const P = HS.player; P.hp = P.maxHp; P.charges = 2; P.sentence = { t: 1.5, max: 2, dmg: 40, r: 40, src: {} }; HS.input.dash = true; await new Promise((r) => setTimeout(r, 300)); return !P.sentence; });
  console.log('attacks', JSON.stringify(seen), 'sentence hurt', hurt, 'cleansed', cleansed);
  // The Censer.
  await p.evaluate(() => { HS.SAVE.life = { kills: 1240, perfects: 30 }; HS.SAVE.deaths = 6; HS.SAVE.censerGot = []; HS.SAVE.censerDev = false; HS.game.state = 'play'; HS.player.hp = HS.player.maxHp = 1e6; HS.bumpBounty('shrines'); HS.openInventory(); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/c-inv.png` });
  await p.evaluate(() => { const C = HS.invLayout().censer; HS.invTap ? HS.invTap(C.x, C.y) : HS.openCenser('inv'); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/c-panel.png` });
  const lit = await p.evaluate(() => HS.CENSER_UP.filter((u) => HS.censerUp(u.id)).map((u) => u.id).join(','));
  const st0 = await p.evaluate(() => JSON.stringify(HS.censerStats()));
  await p.evaluate(() => { HS.SAVE.censerDev = true; }); await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/c-all.png` });
  const st1 = await p.evaluate(() => JSON.stringify(HS.censerStats()));
  await p.evaluate(() => { HS.game.state = 'play'; HS.game.inv = null; const P = HS.player; for (let k = 0; k < 12; k++) HS.spawnMonster('risen', P.x + Math.cos(k) * 30, P.y + Math.sin(k) * 20, { room: HS.game.curRoom.id }); });
  await p.waitForTimeout(2500); await p.screenshot({ path: `${S}/shots/c-fight.png` });
  await p.evaluate(() => { HS.SAVE.censerDev = false; });
  console.log('censer lit', lit, 'stats', st0, '->', st1);
  // Rite Wounds follow the chosen rites.
  const offered = await p.evaluate(() => {
    HS.SAVE.rites = { m1: 'storm', m2: 'ward', pen: 'volley' }; HS.game.state = 'play'; HS.game.run.wounds = {};
    const seen = new Set(); for (let k = 0; k < 400; k++) for (const w of HS.rollStigmata()) if (w.rite) seen.add(w.id);
    return [...seen].sort().join(',');
  });
  await p.evaluate(() => { window.HS_AUTOSTIG = false; HS.game.run.wounds = {}; HS.game.stig = { cards: HS.WOUNDS.filter((w) => ['riteStorm', 'riteWard', 'riteVolley'].includes(w.id)), t: 1 }; HS.game.state = 'stig'; });
  await p.waitForTimeout(400); await p.screenshot({ path: `${S}/shots/w-rites.png` });
  await p.evaluate(() => { HS.pickStigma(0); window.HS_AUTOSTIG = true; });
  console.log('rite wounds offered', offered, 'storm rank', await p.evaluate(() => HS.game.run.wounds.riteStorm));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
