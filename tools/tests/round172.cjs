// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round172.cjs <outDir> [WxH]
// Round 172: the Sallow Fen (builds, camp, every landmark photographed, Tobe and Marl, the village bell, the sluice
// door, a fight, the Drowned Organist as a world boss), chapter 3 through the fen, the South Gate in Vael, Vael at
// true size (photos at the cathedral, the market, the lanes), the moor's Charnel King and a region person's label.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r172-${n}-${vw}.png` });
  const logged = () => p.evaluate(() => (HS.ERRS || []).map((e) => e.msg).slice(-4));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 2; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.lvl = 30; HS.ensureQuests(); });
  // 1. Vael: the South Gate, and photos at true size.
  out.southGate = await p.evaluate(() => { const g = HS.room.interact.find((q) => q.label === 'LEAVE VAEL' && q.x > 1300 && q.y > 2000); return g ? { x: g.x, y: g.y } : null; });
  for (const [k, xy] of [['cathedral', () => [HS.CATHEDRAL_X, HS.TOWN_TOP * 16 + 120]], ['market', () => [HS.TOWN_SQ.fx - 200, HS.TOWN_SQ.fy + 120]], ['gate', () => [(HS.room.pw / 2), HS.room.ph - 140]]]) {
    await p.evaluate((s) => { const [x, y] = eval(s)(); HS.player.x = x; HS.player.y = y; HS.game.banner = null; }, xy.toString()); await p.waitForTimeout(700); await shot(`vael-${k}`);
  }
  out.gateButton = await p.evaluate(() => HS.interact && HS.interact.label);
  // 2. Chapter 3 begins in the fen.
  await p.evaluate(() => { const q = HS.qOf('story2') || (HS.SAVE.q.story2 = { st: 'active', step: 0, c: {} }); q.st = 'active'; q.step = 0; q.c = {}; HS.travelRegion('fen'); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'fen')); i++) await p.waitForTimeout(100);
  out.fen = await p.evaluate(() => ({ region: HS.room.region, name: HS.room.name, zones: HS.room.rooms.length, marks: HS.room.marks.map((m) => m.kind), wet: HS.room.water.size, foes: HS.enemies.length, foeKinds: [...new Set(HS.enemies.map((e) => e.type))], npcs: HS.room.npcs.map((n) => n.talk), story: HS.game.run && HS.game.run.story, lore: HS.room.interact.filter((q) => q.lore).length, ring: HS.room.interact.filter((q) => q.label === 'RING').length }));
  await p.evaluate(() => { HS.SAVE.god = 1; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 500) e.dead = true; HS.game.banner = null; });
  await p.waitForTimeout(1500); await shot('camp');
  // Talk to Tobe.
  const talkTo = async (id) => { await p.evaluate((id) => { const n = HS.room.npcs.find((m) => m.talk === id); HS.player.x = n.x + 14; HS.player.y = n.y + 6; }, id); await p.waitForTimeout(300); const b0 = await p.evaluate(() => HS.interact && HS.interact.label); await p.keyboard.press('KeyE'); for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(150); } return b0; };
  out.tobeButton = await talkTo('tobe');
  for (const k of ['dam', 'causeway', 'reeds', 'village', 'tower', 'chapel', 'door']) {
    const ok = await p.evaluate((k) => { const m = HS.room.marks.find((q) => q.kind === k); if (!m) return false; HS.player.x = m.x; HS.player.y = m.y + 46; for (const e of HS.enemies) if (Math.hypot(e.x - m.x, e.y - m.y) < 500) e.dead = true; return true; }, k);
    if (!ok) continue; await p.waitForTimeout(1000); await shot(`mark-${k}`);
  }
  out.marlButton = await talkTo('marl');
  out.steps = await p.evaluate(() => HS.qOf('story2').c);
  out.warden = await p.evaluate(() => HS.game.warden && HS.game.warden.type);
  // The sluice opens the station.
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'ENTER'); HS.player.x = it.x; HS.player.y = it.y; }); await p.waitForTimeout(300);
  out.doorButton = await p.evaluate(() => HS.interact && HS.interact.label);
  await p.keyboard.press('KeyE');
  for (let i = 0; i < 100 && !(await p.evaluate(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region)); i++) await p.waitForTimeout(100);
  out.station = await p.evaluate(() => ({ region: HS.room.region || null, story: HS.game.run && HS.game.run.story, name: HS.room.name }));
  // 3. The fen outside the story: the world boss at the chapel, the bell and the eels quests.
  await p.evaluate(() => { HS.SAVE.story = 3; HS.qOf('story2').st = 'done'; HS.SAVE.rtalk = { tobe: 1, marl: 1 }; HS.travelRegion('fen'); });
  for (let i = 0; i < 100 && !(await p.evaluate(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'fen')); i++) await p.waitForTimeout(100);
  await talkTo('tobe');
  out.bell = await p.evaluate(() => HS.qOf('rside_bell') && HS.qOf('rside_bell').st);
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'RING'); HS.player.x = it.x; HS.player.y = it.y; }); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(500);
  out.bellAfter = await p.evaluate(() => HS.qOf('rside_bell'));
  await p.evaluate(() => { const m = HS.room.marks.find((q) => q.kind === 'chapel'); HS.player.x = m.x; HS.player.y = m.y + 60; }); await p.waitForTimeout(3500);
  out.worldBoss = await p.evaluate(() => HS.game.warden && { type: HS.game.warden.type, world: !!HS.game.warden.world });
  await shot('organist');
  // 4. The moor: a region person's name label draws (it used to blank the screen) and the Charnel King comes.
  await p.evaluate(() => HS.travelRegion('moor'));
  for (let i = 0; i < 100 && !(await p.evaluate(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'moor')); i++) await p.waitForTimeout(100);
  await p.evaluate(() => { const m = HS.room.marks.find((q) => q.kind === 'barrows'); HS.player.x = m.x; HS.player.y = m.y + 60; }); await p.waitForTimeout(3500);
  out.moor = await p.evaluate(() => ({ warden: HS.game.warden && HS.game.warden.type, label: HS.interact && HS.interact.label })); await shot('charnel');
  out.logged = await logged();
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
