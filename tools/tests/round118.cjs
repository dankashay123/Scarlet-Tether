// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round118.cjs <outDir> [WxH]
// Round 118: the Vesper (the melee class, now an assassin with two blades). The
// create screen card, two cuts per attack and how often they land, lighter
// knockback (foes stay in reach), the six-frame swing, photos mid-cut, the text
// (no mace left in what the class reads, old saved mace names read as blades),
// the bag with blade icons.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r118-${n}.png`, clip });
  // The create screen with the Vesper's card picked.
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(1500);
  await p.evaluate(() => HS.onTap(10, 10)); await p.waitForTimeout(300);
  await p.evaluate(() => { HS.game.create.name = 'NOX'; const L = HS.createLayout(); HS.onTap(L.cards[1].x + 20, L.cards[1].y + 20); }); await p.waitForTimeout(400); await shot('create');
  out.createProblems = await p.evaluate(() => HS.textProblems());
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero, st) => p.evaluate(([hero, st]) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = st; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, [hero, st]);
  await run('mendicant', 2);
  out.name = await p.evaluate(() => HS.HEROES[HS.heroId()].name);
  // Every string the class reads for weapon Wounds, talents and Hallowed: no mace or crossbow left.
  out.maceLeft = await p.evaluate(() => {
    const T = [...HS.WOUNDS.map((w) => [w.name, typeof w.text === 'function' ? w.text(0) : w.text]).flat(), ...HS.LEGENDS.flatMap((L) => [L.name, L.text || ''])].map((s) => HS.heroText(String(s || '')));
    return T.filter((s) => /\bMACE|CROSSBOW|\bSWING\b/.test(s));
  });
  // A pinned crowd in front: count cuts and hits over 3 s.
  out.fight = await p.evaluate(async () => { const P = HS.player, list = [];
    for (let k = 0; k < 4; k++) { const e = HS.spawnMonster('risen', P.x + 26 + (k % 2) * 8, P.y - 12 + k * 8, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; list.push(e); }
    let cuts = 0, last = null; const t0 = performance.now();
    while (performance.now() - t0 < 3000) { await new Promise((r) => setTimeout(r, 16)); const c = P.cutAt && P.cutAt[P.cutAt.length - 1]; if (c && c !== last) { last = c; cuts += c.dir === 1 ? 1 : 0; } }
    const d = list.map((e) => Math.hypot(e.x - P.x, e.y - P.y));
    return { hit: list.filter((e) => e.hp < e.maxHp).length, attacks: cuts, perSec: +(cuts / 3).toFixed(1), farthest: Math.round(Math.max(...d)), dmg: Math.round(list.reduce((a, e) => a + e.maxHp - e.hp, 0)) };
  });
  // Photos mid-cut: the front blade, then the back blade, zoomed on the Vesper.
  const clip = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), k = r.width / HS.W, P = HS.player, sx = (P.x - HS.cam.x) * k + r.left, sy = (P.y - HS.cam.y) * k + r.top; return { x: Math.max(0, sx - 110), y: Math.max(0, sy - 110), width: 220, height: 150 }; });
  const frames = new Set();
  for (const [want, n] of [[1, 'cut-front'], [3, 'cut-back'], [2, 'cut-mid']]) {
    for (let i = 0; i < 80; i++) { await p.waitForTimeout(8); const f = await p.evaluate(() => HS.player.shownAnim === 'swing' ? HS.player.shownFrame : -1); if (f >= 0) frames.add(f); if (f === want) break; }
    await shot(n, clip);
  }
  for (let i = 0; i < 120; i++) { await p.waitForTimeout(8); frames.add(await p.evaluate(() => HS.player.shownAnim === 'swing' ? HS.player.shownFrame : -1)); }
  out.swingFrames = [...frames].filter((f) => f >= 0).sort();
  await shot('fight');
  // A set's colour on the cuts (the Cracked Bell).
  await p.evaluate(() => HS.devSet('bell', true)); await p.waitForTimeout(600);
  for (let i = 0; i < 80; i++) { await p.waitForTimeout(8); if (await p.evaluate(() => HS.player.shownAnim === 'swing' && HS.player.shownFrame === 1)) break; }
  await shot('cut-bell', clip);
  // The bag: blade icons and names for the arms.
  await p.evaluate(() => { HS.enemies.length = 0; }); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.game.state = 'play'; HS.openInventory(); }); await p.waitForTimeout(500); await shot('bag');
  out.arms = await p.evaluate(() => ["THE BEGGAR KING'S MACE", "THE WAYFARER'S CUDGEL", "THE GAOLER'S BAR", 'THE BELL-CLAPPER', "THE NAILWRIGHT'S ARBALEST"].map((name) => HS.nm({ name })));
  out.bagProblems = await p.evaluate(() => HS.textProblems());
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
