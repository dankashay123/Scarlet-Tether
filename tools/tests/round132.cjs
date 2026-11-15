// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round132.cjs <outDir> [WxH]
// Round 132: more buff icons (the Still Cloak's ward and the Long Descent's crits as held icons, the Vesper's storm with
// its time left), a new icon fading in, and a hold tip on the streak plate.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  // Held buffs: the Still Cloak's ward and the Long Descent's three crits.
  await run('saint'); await p.waitForTimeout(300);
  out.held = await p.evaluate(async () => { const P = HS.player; HS.G.powers.add('dashCrit'); HS.G.powers.add('stillWard'); P.dashCrits = 3; P.stillWard = true; P.stillT = 2;
    await new Promise((r) => setTimeout(r, 60)); const early = HS.activeBuffs().map((q) => ({ id: q.B.id, held: !!q.held, age: +(HS.game.real - q.t0).toFixed(2) }));
    await new Promise((r) => setTimeout(r, 400)); return { early, ids: HS.activeBuffs().map((q) => q.B.id) }; });
  await p.screenshot({ path: `${S}/shots/r132-held.png`, clip: { x: 0, y: 0, width: 300, height: 170 } });
  // The Vesper's storm with its time left.
  await run('mendicant'); await p.waitForTimeout(300);
  out.storm = await p.evaluate(async () => { const P = HS.player, e = HS.spawnMonster('risen', P.x + 60, P.y, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; const V = P.vd; V.st = 'storm'; V.t = 1; V.tgt = e; V.cx = e.x; V.cy = e.y; await new Promise((r) => setTimeout(r, 120)); const q = HS.activeBuffs().find((x) => x.B.id === 'storm'); return q ? { left: +q.left.toFixed(2) } : null; });
  await p.screenshot({ path: `${S}/shots/r132-storm.png`, clip: { x: 0, y: 0, width: 300, height: 170 } });
  // Hold the streak plate.
  const pos = await p.evaluate(async () => { HS.game.massacre = { n: 6, last: HS.game.time + 30 }; await new Promise((r) => setTimeout(r, 120)); const q = HS.HOLD_TIPS.find((r) => r.title === 'KILL STREAK'); if (!q) return null; const c = document.getElementById('screen').getBoundingClientRect(), k = c.width / HS.W; return { x: c.left + (q.x + q.w / 2) * k, y: c.top + (q.y + q.h / 2) * k }; });
  if (pos) { await p.mouse.move(pos.x, pos.y); await p.mouse.down(); await p.waitForTimeout(650); out.plateTip = await p.evaluate(() => HS.game.statTip && HS.game.statTip.title); await p.screenshot({ path: `${S}/shots/r132-streak-tip.png`, clip: { x: 0, y: 0, width: 420, height: 220 } }); await p.mouse.up(); }
  out.text = await p.evaluate(() => HS.textProblems().length);
  out.ok = ['still', 'dashcrit'].every((id) => out.held.ids.includes(id)) && out.held.early.every((q) => q.held && q.age < 0.25) && out.storm && out.storm.left > 1 && out.plateTip === 'KILL STREAK';
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
