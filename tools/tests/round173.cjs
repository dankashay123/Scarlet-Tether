// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round173.cjs <outDir> [WxH]
// Round 173: the Ashfields (camp, every landmark, Ide and the collector, the scarecrows burned, the purse found, the
// crypt door into the Wall of Names, the Ash Widow and her 20-minute wait, her Hallowed drop), the East Gate, a rest
// fire in each region, each chapter's finale room (photos) with the Warden rising there, KILLS on the Toll bar.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r173-${n}-${vw}.png` });
  const until = async (fn, n = 120) => { for (let i = 0; i < n && !(await p.evaluate(fn)); i++) await p.waitForTimeout(100); };
  const closeDlg = async () => { for (let i = 0; i < 20 && await p.evaluate(() => HS.game.state === 'dialog' || HS.game.state === 'stig'); i++) { await p.evaluate(() => { if (HS.game.state === 'stig') HS.pickStigma(0); }); await p.mouse.click(400, 200); await p.waitForTimeout(150); } };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 3; HS.game.news = null; HS.game.state = 'play'; HS.SAVE.lvl = 40; HS.ensureQuests(); HS.SAVE.god = 1; HS.DEV.god = true; });
  // 1. The East Gate.
  out.eastGate = await p.evaluate(() => { const g = HS.room.interact.find((q) => q.label === 'LEAVE VAEL' && q.x > HS.room.pw - 200); if (!g) return null; HS.player.x = g.x; HS.player.y = g.y; return { x: g.x, y: g.y }; });
  await p.waitForTimeout(600); out.gateButton = await p.evaluate(() => HS.interact && HS.interact.label); await shot('eastgate');
  // 2. Chapter 4 out in the Ashfields.
  await p.evaluate(() => { const q = HS.qOf('story3') || (HS.SAVE.q.story3 = { st: 'active', step: 0, c: {} }); q.st = 'active'; q.step = 0; q.c = {}; HS.travelRegion('ash'); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'ash');
  out.ash = await p.evaluate(() => ({ name: HS.room.name, marks: HS.room.marks.map((m) => m.kind), foes: HS.enemies.length, kinds: [...new Set(HS.enemies.map((e) => e.type))], npcs: HS.room.npcs.map((n) => n.talk), story: HS.game.run.story, lore: HS.room.interact.filter((q) => q.lore).length, rest: HS.room.interact.filter((q) => q.label === 'REST').length, burn: HS.room.interact.filter((q) => q.label === 'BURN').length, search: HS.room.interact.filter((q) => q.label === 'SEARCH').length }));
  const clear = () => p.evaluate(() => { for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 500) e.dead = true; HS.game.banner = null; });
  await clear(); await p.waitForTimeout(1200); await shot('camp');
  const talkTo = async (id) => { await p.evaluate((id) => { const n = HS.room.npcs.find((m) => m.talk === id); HS.player.x = n.x + 14; HS.player.y = n.y + 6; }, id); await clear(); await p.waitForTimeout(300); const b0 = await p.evaluate(() => HS.interact && HS.interact.label); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await closeDlg(); return b0; };
  out.ideButton = await talkTo('ide');
  for (const k of ['foundry', 'gallery', 'farms', 'crows', 'pit', 'field', 'door']) {
    const ok = await p.evaluate((k) => { const m = HS.room.marks.find((q) => q.kind === k); if (!m) return false; HS.player.x = m.x; HS.player.y = m.y + 50; return true; }, k);
    if (!ok) continue; await clear(); await p.waitForTimeout(1100); await shot(`mark-${k}`);
    if (k === 'foundry' || k === 'gallery') { await p.evaluate((k) => { const it = HS.room.interact.find((q) => q.lore === (k === 'foundry' ? 'a_foundry' : 'a_gallery')); HS.player.x = it.x; HS.player.y = it.y; }, k); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await closeDlg(); }
  }
  out.steps = await p.evaluate(() => HS.qOf('story3').c);
  out.noWidowInStory = await p.evaluate(() => !HS.game.warden);
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'REST'); HS.player.x = it.x; HS.player.y = it.y; HS.player.hp = 10; }); await p.waitForTimeout(400); await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  out.rest = await p.evaluate(() => HS.player.hp === HS.player.maxHp); await shot('rest');
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'ENTER'); HS.player.x = it.x; HS.player.y = it.y; }); await clear(); await p.waitForTimeout(300); await p.keyboard.press('KeyE');
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region);
  out.station = await p.evaluate(() => ({ name: HS.room.name, story: HS.game.run.story }));
  // 3. The finale room and KILLS on the Toll bar.
  await p.waitForTimeout(800); await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 70; for (const e of HS.enemies) if (Math.hypot(e.x - F.x, e.y - F.y) < 500) e.dead = true; HS.game.banner = null; HS.game.toast = null; });
  await p.waitForTimeout(900); await shot('finale');
  out.tollText = await p.evaluate(() => { HS.textAudit && HS.textAudit(); return (HS.TEXT_CACHE ? 1 : 0); });
  await p.evaluate(() => { HS.storyRead(); }); await p.waitForTimeout(200); await closeDlg();
  await p.evaluate(() => { HS.game.toll.v = HS.game.toll.max - 1; const e = HS.enemies.find((q) => !q.dead && !q.boss); HS.killEnemy(e, 0, 0); });
  await until(() => !!HS.game.warden, 60); await closeDlg(); await p.waitForTimeout(1200);
  out.wardenInFinale = await p.evaluate(() => { const w = HS.game.warden, F = HS.storyFind; return w ? Math.round(Math.hypot(w.x - F.x, w.y - F.y)) : null; });
  await shot('finale-warden');
  // 4. Side quests and the Ash Widow outside the story.
  await p.evaluate(() => { HS.enterTown(false); HS.SAVE.story = 4; HS.qOf('story3').st = 'done'; HS.SAVE.rtalk = { ide: 1, collector: 1 }; HS.SAVE.worldBossT = {}; HS.travelRegion('ash'); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'ash');
  await talkTo('ide'); await talkTo('collector');
  out.quests = await p.evaluate(() => ({ crows: HS.qOf('rside_crows') && HS.qOf('rside_crows').st, tithe: HS.qOf('rside_tithe') && HS.qOf('rside_tithe').st }));
  for (let k = 0; k < 6; k++) { await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'BURN' && !q.done); if (it) { HS.player.x = it.x; HS.player.y = it.y; } }); await p.waitForTimeout(250); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); }
  await shot('burned');
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'SEARCH'); HS.player.x = it.x; HS.player.y = it.y; }); await p.waitForTimeout(250); await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  out.questsAfter = await p.evaluate(() => ({ crows: HS.qOf('rside_crows'), tithe: HS.qOf('rside_tithe') }));
  await p.evaluate(() => { const m = HS.room.marks.find((q) => q.kind === 'field'); HS.player.x = m.x; HS.player.y = m.y + 60; }); await p.waitForTimeout(3500); await closeDlg();
  out.widow = await p.evaluate(() => HS.game.warden && { type: HS.game.warden.type, world: !!HS.game.warden.world });
  await shot('widow');
  const bag0 = await p.evaluate(() => HS.SAVE.bag.filter((i) => i && i.ri === 3).length); await p.evaluate(() => { const w = HS.game.warden; if (w) HS.killEnemy(w, 0, 0); }); await p.waitForTimeout(4000); await closeDlg();
  out.widowDrop = await p.evaluate((bag0) => ({ hallowed: HS.drops.filter((d) => d.item && d.item.ri === 3).length + HS.game.run.items.filter((i) => i && i.ri === 3).length, wait: Math.round((HS.SAVE.worldBossT || {}).ashWidow ? 1 : 0) }), bag0);
  out.logged = await p.evaluate(() => (HS.ERRS || []).map((e) => e.msg).slice(-4));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
