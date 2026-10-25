// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round49.cjs <outDir> [WxH]
// Round 49: the Warden blow cap, yard records part two (60 s test, delete one
// build, the yard best on the Rites panel), the Drowned Nave's drops and
// wading ripples, and the Mendicant (the second playable saint).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r49-${n}.png` });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1200);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.cleared = 9; HS.SAVE.lvl = 60; });

  // The Warden blow cap: a huge hit from a Warden takes 40% of health at most.
  await p.evaluate(() => { HS.game.nextStratum = 1; HS.game.nextDiff = 12; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.enemies.length = 0; });
  await p.waitForTimeout(400);
  out.cap = await p.evaluate(() => { HS.spawnWarden('bellwright'); const w = HS.game.warden, P = HS.player; HS.DEV.god = false; P.hp = P.maxHp; P.iframes = 0; P.dashStart = -99;
    HS.damagePlayer(w, 1e6, [[P.x, P.y]], 'test'); const share = +((P.maxHp - P.hp) / P.maxHp).toFixed(2); P.hp = P.maxHp; HS.DEV.god = true; return { share }; });

  // Yard records: three builds, a 60 s test button, delete one build.
  await p.evaluate(() => { HS.SAVE.yardBest = { 'nails:storm,chain,volley': 18400, 'font:water,asperse,font': 9100, 'mixed:water,chain,rain': 2300, all: 18400 }; HS.SAVE.yardTest = { 'nails:storm,chain,volley': 15200, all: 15200 }; HS.SAVE.yardTest60 = { 'nails:storm,chain,volley': 14100, all: 14100 }; HS.enterTown(false); });
  await p.waitForTimeout(800);
  await p.evaluate(() => HS.openYard()); await p.waitForTimeout(3500);
  await p.evaluate(() => { const d = HS.yard.dummy; HS.player.x = d.x - 320; HS.player.y = d.y; }); await p.waitForTimeout(3000);
  await p.evaluate(() => { HS.game.state = 'yard'; HS.yard.tab = 4; }); await p.waitForTimeout(250); await shot('records');
  out.problems = await p.evaluate(() => HS.textProblems());
  out.del = await p.evaluate(() => { const G = HS.yardGeo(); const r = G.rec(2); HS.yardTap(r.x + 20, r.y + 5); const sel = HS.yard.recSel; HS.yardTap(G.btn(2).x + 4, G.btn(2).y + 4); const asked = !!HS.game.ask; return { sel, asked }; });
  await p.waitForTimeout(200); await shot('records-delete-ask');
  out.del2 = await p.evaluate(() => { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); return { rows: HS.yardRecords().length, keys: HS.yardRecords().map((r) => r.k) }; });
  out.t60 = await p.evaluate(() => { const G = HS.yardGeo(); HS.yardTap(G.btn(1).x + 4, G.btn(1).y + 4); return HS.yard.test && HS.yard.test.len; });
  await p.evaluate(() => { HS.yard.test = null; HS.game.state = 'play'; });
  // The Rites panel shows this build's yard best.
  await p.evaluate(() => { HS.SAVE.yardBest[HS.yardKey()] = 4321; HS.openRites('play'); HS.game.riteFocus = 'm1'; }); await p.waitForTimeout(250); await shot('rites-yardbest');
  await p.evaluate(() => { HS.game.state = 'play'; });

  // The Drowned Nave: drops, rings and wading ripples.
  await p.evaluate(() => { HS.game.nextYard = false; HS.game.nextStratum = 2; HS.game.nextDiff = 4; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(600);
  out.water = await p.evaluate(() => { const w = [...HS.room.water][0]; if (!w) return false; const [x, y] = w.split(',').map(Number); HS.player.x = (x + 0.5) * 16; HS.player.y = (y + 0.5) * 16; HS.enemies.length = 0; return true; });
  for (let i = 0; i < 12; i++) { await p.evaluate(() => { HS.player.x += 3; }); await p.waitForTimeout(60); }
  await p.waitForTimeout(400); await shot('nave-drips');
  out.drips = await p.evaluate(() => ({ drips: HS.drips.length, ripples: HS.ripples.length }));

  // The Mendicant: the other saint waits by the cathedral; switching asks first.
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; HS.enterTown(false); HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const n = HS.room.npcs.find((q) => q.hero); HS.player.x = n.x - 22; HS.player.y = n.y + 4; }); await p.waitForTimeout(1200); await shot('town-mendicant');
  out.switch = await p.evaluate(() => { HS.askHero(); const asked = !!HS.game.ask; const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); return { asked, hero: HS.heroId(), sheet: HS.saintSheet() }; });
  await p.waitForTimeout(1500); await shot('town-as-mendicant');
  out.overlaps = await p.evaluate(() => HS.townOverlaps());
  // A fight in Stratum I: swings, the arc, damage on several foes at once.
  await p.evaluate(() => { HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(600);
  out.fight = await p.evaluate(async () => { HS.enemies.length = 0; const P = HS.player, list = [];
    for (let k = 0; k < 5; k++) { const e = HS.spawnMonster('risen', P.x + 30 + (k % 2) * 8, P.y - 20 + k * 10, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e6; list.push(e); }
    await new Promise((r) => setTimeout(r, 1800)); return { hit: list.filter((e) => e.hp < e.maxHp).length, xb: !!P.xb, bolts: HS.bolts.length }; });
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(60); if (await p.evaluate(() => HS.swingT > 0.12 && HS.swingT < 0.2)) break; }
  await shot('mendicant-swing');
  // The yard: the dummy counts the mace; records keep the hero apart.
  await p.evaluate(() => { HS.enterTown(false); HS.openYard(); }); await p.waitForTimeout(3500);
  await p.evaluate(() => { const d = HS.yard.dummy; HS.player.x = d.x - 30; HS.player.y = d.y; }); await p.waitForTimeout(4500);
  out.yard = await p.evaluate(() => ({ dps: HS.yardDps(), key: HS.yardKey() }));
  await shot('mendicant-yard');
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; HS.game.yard = null; HS.enterTown(false); });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
