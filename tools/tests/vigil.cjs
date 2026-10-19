// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/vigil.cjs <outDir>
// Density by Station, the Bleeding Vigil (panel, candle, Warden, rising), the
// Weeping Reliquary, the Shrine of Judgement and omens on the descent panel.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1000);
  // Density: monsters on a Station I map against a Station XV map.
  console.log('density', await p.evaluate(() => { HS.tut.on = false; const out = []; for (const d of [0, 7, 14]) { const n = []; for (let k = 0; k < 3; k++) { HS.game.nextDiff = d; HS.game.nextOmens = []; HS.newRun(); n.push(HS.enemies.length); } out.push(`${d + 1}:${Math.round(n.reduce((a, v) => a + v) / 3)}`); } return out.join(' '); }));
  // The Vigil panel at the town site.
  await p.evaluate(() => { HS.enterTown(); HS.SAVE.cleared = 3; HS.SAVE.vigilOpen = 6; HS.openSite(HS.SITES.find((s) => s.id === 'vigil')); });
  await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/v1-panel.png` });
  // A Vigil at level 6.
  await p.evaluate(() => HS.beginVigil(6)); await p.waitForTimeout(2600);
  await p.evaluate(() => { HS.player.hp = HS.player.maxHp = 1e7; HS.game.stigAt = 1e9; });
  console.log('vigil run', await p.evaluate(() => JSON.stringify({ state: HS.game.state, foes: HS.enemies.length, toll: HS.game.toll.max, hp: HS.enemies[0] && HS.enemies[0].maxHp })));
  // Walk a little so the fights start, then photograph the candle HUD.
  const [tx, ty] = await p.evaluate(() => { const r = HS.room.rooms.find((q) => q.type !== 'start'); return [(r.cx + 0.5) * 16, (r.cy + 1.5) * 16]; });
  for (let k = 0; k < 10; k++) { await p.evaluate(([tx, ty]) => { const P = HS.player; P.x += (tx - P.x) * 0.25; P.y += (ty - P.y) * 0.25; }, [tx, ty]); await p.waitForTimeout(90); }
  await p.waitForTimeout(1500); await p.screenshot({ path: `${S}/shots/v2-candle.png` });
  console.log('gear dropped in vigil', await p.evaluate(() => HS.drops.filter((d) => d.kind === 'item').length), 'knells', await p.evaluate(() => HS.drops.filter((d) => d.kind === 'knell').length));
  // Fill the Toll, slay the Warden with time left: the Vigil rises.
  await p.evaluate(() => { const t = HS.game.toll; t.v = t.max - 1; const e = HS.enemies.find((q) => !q.dead && !q.illusion && q.type !== 'imp'); HS.killEnemy(e, 1, 0); });
  await p.waitForTimeout(500); await p.evaluate(() => HS.killEnemy(HS.game.warden, 1, 0)); await p.waitForTimeout(800);
  await p.screenshot({ path: `${S}/shots/v3-kept.png` });
  console.log('vigil after', await p.evaluate(() => JSON.stringify({ open: HS.SAVE.vigilOpen, best: HS.SAVE.vigilBest, items: HS.drops.filter((d) => d.kind === 'item').map((d) => d.item.il).join(',') })));
  // A Station run: the Reliquary and the Shrine of Judgement.
  await p.evaluate(() => { HS.game.nextDiff = 0; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false; HS.game.stigAt = 1e9; HS.player.hp = HS.player.maxHp = 1e7; });
  const rel = await p.evaluate(() => { const p0 = HS.room.props.find((q) => q.reliquary); if (!p0) return null; HS.player.x = p0.x; HS.player.y = p0.y + 8; return true; });
  await p.waitForTimeout(400); await p.keyboard.press('KeyE'); await p.waitForTimeout(4000);
  await p.screenshot({ path: `${S}/shots/v4-reliquary.png` });
  console.log('reliquary', rel, await p.evaluate(() => JSON.stringify(HS.game.event && { kills: HS.game.event.kills, t: Math.round(HS.game.event.t) })));
  await p.evaluate(() => { HS.useShrine({ x: HS.player.x, y: HS.player.y, shrineKind: 'judgement' }); }); await p.waitForTimeout(700);
  await p.screenshot({ path: `${S}/shots/v5-judgement.png` });
  // Omens on the descent panel.
  await p.evaluate(() => { HS.enterTown(); HS.startDescent(); HS.descent.omens = ['restless', 'wrath']; }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/shots/v6-omens.png` });
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
