// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round51.cjs <outDir> [WxH]
// Round 51: drag to aim the Mendicant's rites (preview and cast direction),
// his seven Hallowed pieces (drops follow the hero, icons, powers at work).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const p = await (await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev)).newPage();
  const errs = [], out = { aim: {} }; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r51-${n}.png` });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2000); await p.mouse.click(300, 200); await p.waitForTimeout(600);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = 'mendicant'; HS.SAVE.mrites = {}; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; });
  await p.waitForTimeout(600);
  const hold = (k, dx, dy) => p.evaluate(([k, dx, dy]) => {
    const r = document.getElementById('screen').getBoundingClientRect(), B = HS.hud[k], cx = (x) => r.left + x / HS.W * r.width, cy = (y) => r.top + y / HS.H * r.height;
    HS.player.m1cd = 0; HS.player.m2cd = 0; HS.player.penance = HS.T.penance.charge; HS.player.rainT = 0;
    HS.pointerDown(7, cx(B.x), cy(B.y)); HS.pointerMove(7, cx(B.x + dx), cy(B.y + dy));
    return !!HS.game.aim && HS.game.aim.on;
  }, [k, dx, dy]);
  // A few foes around so the hook has someone to hook.
  await p.evaluate(() => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const e = HS.spawnMonster('risen', P.x + Math.cos(a) * 90, P.y + Math.sin(a) * 60, { room: HS.game.curRoom.id }); if (e) { e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; } } });
  for (const [k, id, dx, dy] of [['m1', 'smite', 40, 0], ['m1', 'nailburst', 0, -40], ['m1', 'shackleblow', -40, 0], ['m1', 'charge', 30, 30], ['m2', 'hook', -30, -30], ['pen', 'hammer', 40, -20], ['pen', 'deluge', -40, 20]]) {
    await p.evaluate(([k, id]) => { HS.SAVE.mrites[k] = id; }, [k, id]);
    const aiming = await hold(k, dx, dy);
    await p.waitForTimeout(120); await shot(`aim-${id}`);
    const b0 = await p.evaluate(() => ({ x: HS.player.x, y: HS.player.y }));
    await p.evaluate(() => HS.pointerUp(7)); await p.waitForTimeout(350);
    out.aim[id] = await p.evaluate(([k, dx, dy, b0]) => { const P = HS.player, a = Math.atan2(dy, dx), cast = k === 'pen' ? P.rainT > 0 : (k === 'm1' ? P.m1cd : P.m2cd) > 0;
      const faced = k === 'm1' && id !== 'charge' ? +Math.abs(Math.atan2(Math.sin(P.swingA - a), Math.cos(P.swingA - a))).toFixed(2) : null;
      return { aiming: true, cast, faced, moved: Math.round(Math.hypot(P.x - b0.x, P.y - b0.y)), penAim: !!P.penAim }; }, [k, dx, dy, b0]);
    out.aim[id].aiming = aiming;
    await p.evaluate(() => { HS.player.rainT = 0; }); await p.waitForTimeout(300);
  }
  // His Hallowed pieces drop only for him; the Saint's own pieces only for the Saint.
  out.drops = await p.evaluate(() => { const seen = new Set(); for (let i = 0; i < 4000; i++) { const it = HS.rollItem(6, 6); if (it.ri === 3) seen.add(it.legend || it.name); } const names = [...seen].join('|');
    return { his: HS.LEGENDS.filter((L) => L.hero === 'mendicant' && names.includes(L.name)).length, saints: HS.LEGENDS.filter((L) => L.hero === 'saint' && names.includes(L.name)).length }; });
  // Two powers at work: the Bellringer's Stole doubles Bell Toll's Zeal; the Gauntlets widen Smite.
  out.toll = await p.evaluate(() => { const gain = () => { HS.game.fervor = 0; HS.SAVE.mrites.m2 = 'toll'; HS.player.m2cd = 0; HS.input.m2 = true; }; gain(); return null; });
  await p.waitForTimeout(300);
  const z0 = await p.evaluate(() => HS.game.fervor);
  await p.evaluate(() => { HS.G.powers.add('loudToll'); HS.game.fervor = 0; HS.player.m2cd = 0; HS.input.m2 = true; });
  await p.waitForTimeout(300);
  out.toll = { plain: Math.round(z0), stole: Math.round(await p.evaluate(() => HS.game.fervor)) };
  // The bag with all seven of his pieces.
  await p.evaluate(() => { HS.SAVE.bag = HS.LEGENDS.filter((L) => L.hero === 'mendicant').map((L) => { const it = HS.makeItem(L.slot, 3, L.name, undefined, 6); it.legend = HS.LEGENDS.indexOf(L); it.power = L.id; return it; }); HS.openInventory(); });
  await p.waitForTimeout(300); await shot('bag-hallowed');
  out.problems = await p.evaluate(() => HS.textProblems());
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.hero = 'saint'; HS.SAVE.bag = []; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
