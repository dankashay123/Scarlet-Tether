// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/stig.cjs <outDir>
// Levels up, picks Stigmata, then wakes every big miracle in a crowd.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(800);
  await p.evaluate(() => { HS.player.hp = HS.player.maxHp = 99999; HS.gainXp(30); });
  await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/s0-levelup.png` });
  await p.waitForTimeout(1200);
  console.log('state', await p.evaluate(() => [HS.game.state, HS.game.run.level, HS.game.run.pending]));
  await p.screenshot({ path: `${S}/shots/s1-cards.png` });
  const r = await p.evaluate(() => HS.stigLayout()[1]);
  const box = await p.evaluate(() => { const q = document.getElementById('screen').getBoundingClientRect(); return { l: q.left, t: q.top, k: q.width / HS.W }; });
  await p.mouse.click(box.l + (r.x + r.w / 2) * box.k, box.t + (r.y + r.h / 2) * box.k); await p.waitForTimeout(200);
  console.log('after pick', await p.evaluate(() => [HS.game.state, JSON.stringify(HS.game.run.wounds), HS.game.run.pending]));
  // Every miracle at once, in a crowd.
  await p.evaluate(() => { const g = HS.game; g.run.pending = 0; g.state = 'play'; g.run.wounds = { crescent: 3, pillar: 3, orbit: 3, arc: 3, nova: 3, choir: 2, split: 3, censer2: 2, luck: 5 };
    const r = g.curRoom; for (let i = 0; i < 24; i++) HS.spawnMonster('risen', HS.player.x + Math.cos(i) * (40 + i * 4), HS.player.y + Math.sin(i) * (30 + i * 3), { room: r.id }); });
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(650); await p.keyboard.press('Space'); await p.screenshot({ path: `${S}/shots/s${2 + i}-skills.png` }); }
  console.log('fx', await p.evaluate(() => HS.skillFx.map((f) => f.kind).join(',')), 'kills', await p.evaluate(() => HS.game.kills));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
