// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round174.cjs <outDir> [WxH]
// Round 174: the Saltreach (camp, landmarks, Cass and the Lamp Keeper, lore, the chapel door into the station), the
// sixth chapter after the main story (the Stations stay open), the belfry's three bells to silence, the West Gate and
// the gate towers, each region's creatures and music, the Codex lore page (counts per region, TAKE ME THERE).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r174-${n}-${vw}.png` });
  const until = async (fn, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn)); i++) await p.waitForTimeout(100); };
  const closeDlg = async () => { for (let i = 0; i < 24 && await p.evaluate(() => HS.game.state === 'dialog' || HS.game.state === 'stig'); i++) { await p.evaluate(() => { if (HS.game.state === 'stig') HS.pickStigma(0); }); await p.mouse.click(400, 200); await p.waitForTimeout(150); } };
  const clear = () => p.evaluate(() => { for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 500) e.dead = true; HS.game.banner = null; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  // 1. After the main story: the Stations stay open, chapter 6 is offered, the West Gate opens.
  out.story = await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 5; HS.SAVE.cleared = 3; HS.SAVE.lvl = 40; HS.game.state = 'play'; HS.ensureQuests(); return { done: HS.storyDone(), n: HS.storyN(), ch6: HS.qOf('story5') && HS.qOf('story5').st, len: HS.STORY.length }; });
  out.westGate = await p.evaluate(() => { const g = HS.room.interact.find((q) => q.label === 'LEAVE VAEL' && q.x < 200); if (!g) return null; HS.player.x = g.x; HS.player.y = g.y; return { x: g.x, y: g.y }; });
  await p.waitForTimeout(700); out.gateButton = await p.evaluate(() => HS.interact && HS.interact.label); await shot('westgate');
  out.towers = await p.evaluate(() => HS.room.props.filter((q) => q.anim === 'gatetower').length);
  await p.evaluate(() => { HS.player.x = HS.room.pw / 2; HS.player.y = HS.room.ph - 120; }); await p.waitForTimeout(700); await shot('southgate');
  // 2. Codex lore: counts and TAKE ME THERE.
  await p.evaluate(() => { HS.openCodex(6, 'play'); }); await p.waitForTimeout(400); await shot('codex');
  out.codexText = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { const L = HS.codexLayout(), K = HS.game.codex, i = L.list.findIndex((q) => !q.seen && q.rg === 'salt'); K.page = Math.floor(i / L.per); K.sel = i; }); await p.waitForTimeout(300); await shot('codex-unread');
  out.goBtn = await p.evaluate(() => !!HS.game.codex.goBtn);
  await p.evaluate(() => { const b = HS.game.codex.goBtn; HS.codexTap(b.x + 4, b.y + 4); });
  // 3. The Saltreach (chapter 6 active: the story run).
  await p.evaluate(() => { const q = HS.qOf('story5') || (HS.SAVE.q.story5 = { st: 'active', step: 0, c: {} }); q.st = 'active'; q.step = 0; q.c = {}; HS.travelRegion('salt'); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === 'salt');
  out.salt = await p.evaluate(() => ({ name: HS.room.name, story: HS.game.run.story, marks: HS.room.marks.map((m) => m.kind), foes: HS.enemies.length, npcs: HS.room.npcs.map((n) => n.talk), lore: HS.room.interact.filter((q) => q.lore).length, rest: HS.room.interact.filter((q) => q.label === 'REST').length, critters: HS.room.critters.map((c) => c.kind).slice(0, 2), music: HS.game.music }));
  await clear(); await p.waitForTimeout(1200); await shot('camp');
  const talkTo = async (id) => { await p.evaluate((id) => { const n = HS.room.npcs.find((m) => m.talk === id); HS.player.x = n.x + 14; HS.player.y = n.y + 6; }, id); await clear(); await p.waitForTimeout(300); const b0 = await p.evaluate(() => HS.interact && HS.interact.label); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await closeDlg(); return b0; };
  out.cass = await talkTo('cass');
  for (const k of ['wreck', 'lanterns', 'huts', 'stacks', 'pans', 'nets', 'door']) {
    const ok = await p.evaluate((k) => { const m = HS.room.marks.find((q) => q.kind === k); if (!m) return false; HS.player.x = m.x; HS.player.y = m.y + 50; return true; }, k);
    if (!ok) continue; await clear(); await p.waitForTimeout(1000); await shot(`mark-${k}`);
    if (k === 'wreck') { await p.evaluate(() => { const it = HS.room.interact.find((q) => q.lore === 's_wreck'); HS.player.x = it.x; HS.player.y = it.y; }); await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await closeDlg(); }
  }
  out.keeper = await talkTo('keeper');
  out.steps = await p.evaluate(() => HS.qOf('story5').c);
  await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'ENTER'); HS.player.x = it.x; HS.player.y = it.y; }); await clear(); await p.waitForTimeout(300); await p.keyboard.press('KeyE');
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !HS.room.region);
  out.station = await p.evaluate(() => ({ name: HS.room.name, story: HS.game.run.story, find: !!HS.storyFind }));
  await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 70; for (const e of HS.enemies) if (Math.hypot(e.x - F.x, e.y - F.y) < 500) e.dead = true; HS.game.banner = null; }); await p.waitForTimeout(900); await shot('chapel-finale');
  // 4. The belfry: three bells to silence.
  await p.evaluate(() => { HS.enterTown(false); HS.SAVE.story = 4; const q = HS.qOf('story4') || (HS.SAVE.q.story4 = { st: 'active', step: 0, c: {} }); q.st = 'active'; q.step = 0; q.c = {}; HS.beginStory(4, false); });
  await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && !!HS.storyFind);
  out.bells = await p.evaluate(() => HS.room.interact.filter((q) => q.label === 'SILENCE').length);
  for (let k = 0; k < 3; k++) { await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'SILENCE' && !q.done); HS.player.x = it.x; HS.player.y = it.y; for (const e of HS.enemies) if (Math.hypot(e.x - it.x, e.y - it.y) < 400) e.dead = true; }); await p.waitForTimeout(400); if (k === 0) await shot('bell'); await p.keyboard.press('KeyE'); await p.waitForTimeout(300); }
  out.bellCount = await p.evaluate(() => HS.qOf('story4').c.bells || 0); await shot('bell-silenced');
  // 5. Creatures and music in the fen and the Ashfields.
  for (const rg of ['fen', 'ash', 'moor']) { await p.evaluate((rg) => { HS.enterTown(false); HS.SAVE.story = 6; HS.travelRegion(rg); }, rg); await until((rg) => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room.region === rg, 200); await p.waitForTimeout(600);
    out[`life_${rg}`] = await p.evaluate(() => ({ critters: HS.room.critters.length, kind: HS.room.critters[0] && HS.room.critters[0].kind, music: HS.game.music })); }
  await p.evaluate(() => { const c = HS.room.critters[0]; if (c) { HS.player.x = c.x + 30; HS.player.y = c.y + 10; } }); await p.waitForTimeout(300); await shot('critter');
  out.logged = await p.evaluate(() => (HS.ERRS || []).map((e) => e.msg).slice(-4));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
