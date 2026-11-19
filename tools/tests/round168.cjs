// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round168.cjs <outDir> [WxH]
// Round 168: elite deaths in a real fight (a pack of elites with commons, the Saint's attacks and rites going), the
// Saint bar's level-up flash in a descent, the locked stick's glow, nobody on a place's spot in Vael, long messages.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  // 1. Vael: nobody stands on a place's spot; the longest messages fit in two lines on the narrowest phone.
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); }
  out.overlaps = await p.evaluate(() => HS.townOverlaps());
  out.longest = await p.evaluate(() => { const L = [...(HS.STORY_HINT || [])]; return Math.max(...L.map((s) => HS.wrapW(s, 445 - 48).length)); });
  // 2. A descent: an elite pack and commons; kill the elites by damage while the fight goes on.
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.god = 1; HS.SAVE.lvl = 30; HS.enemies.length = 0; const x = HS.player.x + 70, y = HS.player.y;
    HS.spawnPack('golem', 'elite', x, y, 3); for (let i = 0; i < 8; i++) HS.spawnMonster('risen', x + (i % 4) * 14 - 20, y + 30 + Math.floor(i / 4) * 14, {}); });
  const keep = setInterval(() => p.evaluate(() => { if (HS.game.run) HS.game.run.pending = 0; if (HS.game.state !== 'play') HS.game.state = 'play'; HS.player.hp = HS.player.maxHp; HS.game.banner = null; }).catch(() => {}), 120);
  await p.waitForTimeout(1600);
  out.fight = await p.evaluate(async () => { const E = HS.enemies.filter((e) => !e.dead && e.tier === 'elite'), r = [];
    for (const e of E) { HS.hurtEnemy(e, e.hp + 10, false, 1, 0, 0, {}); r.push(e.dead); await new Promise((q) => setTimeout(q, 250)); }
    return { elites: E.length, killed: r.filter(Boolean).length, crumbles: HS.falls.filter((f) => f.cr).length, kinds: HS.falls.filter((f) => f.cr).map((f) => f.cr.kind) }; });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(280); await p.screenshot({ path: `${S}/shots/fight${i}.png` }); }
  // 3. The Saint bar flashes on a Saint level up.
  await p.evaluate(() => { HS.gainSaintXp(HS.lvNeed(HS.SAVE.lvl) - (HS.SAVE.lxp || 0) + 1); HS.game.toast = null; }); await p.waitForTimeout(350);
  await p.screenshot({ path: `${S}/shots/saintup.png`, clip: { x: vw * 0.25, y: vh * 0.7, width: vw * 0.5, height: vh * 0.3 } });
  out.saintUp = await p.evaluate(() => HS.game.saintUp && HS.game.saintUp.lv);
  // 4. The locked stick glows; hold it pushed.
  const k = await p.evaluate(() => innerWidth / HS.W), J = await p.evaluate(() => ({ x: HS.hud.joy.x, y: HS.hud.joy.y }));
  await p.mouse.move(J.x * k, J.y * k); await p.mouse.down(); await p.mouse.move((J.x + 40) * k, (J.y - 10) * k); await p.waitForTimeout(150);
  await p.screenshot({ path: `${S}/shots/stick.png`, clip: { x: 0, y: vh * 0.6, width: vw * 0.3, height: vh * 0.4 } }); await p.mouse.up();
  clearInterval(keep);
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
