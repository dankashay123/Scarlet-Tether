// Rounds 150-151: the campaign (THE FIRST DESCENT) as quests. A new character: the prologue, the Stations closed,
// the giver's ! (talk to take the chapter), the chapter's objectives in the tracker, the message, the held Warden, the
// Warden's opening lines before it can be hit, its line at a phase, its last words, the ? on the one to report to, the
// closing scene and its reward; every chapter, then the Stations open. Site quests: the ! on a newly opened site, its
// scene and gift on the first visit, the goal, and the quest done. Older characters count the story as done.
// Usage: node tools/tests/story.cjs <outDir> [WxH]
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const st = () => p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene, story: HS.SAVE.story }));
  const tap = async (x, y) => { const pos = await p.evaluate(([x, y]) => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left + x / HS.W * r.width, r.top + y / HS.H * r.height]; }, [x, y]); await p.mouse.click(pos[0], pos[1]); };
  const shot = (n) => p.screenshot({ path: `${S}/shots/story-${n}-${VW}.png` });
  const dlg = () => p.evaluate(() => HS.game.dialog && HS.game.state === 'dialog' ? HS.game.dialog.who && HS.game.dialog.who[HS.game.dialog.i] : null);
  const closeDialog = async (name) => { const seen = []; for (let i = 0; i < 80 && (await st()).state === 'dialog'; i++) { const w = await dlg(); if (w && !seen.includes(w)) { seen.push(w); if (name) { await p.evaluate(() => { HS.game.dialog.t = 99; }); await p.waitForTimeout(60); await shot(`${name}-${seen.length}`); } } await tap(200, 150); await p.waitForTimeout(80); } return seen; };
  const q = (id) => p.evaluate((id) => HS.qOf(id) && { ...HS.qOf(id) }, id);
  const out = {};
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(900);
  const W = await p.evaluate(() => HS.W), H = await p.evaluate(() => HS.H);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(500);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(2500);
  out.prologue = await closeDialog('prologue');
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.game.state = 'play'; HS.persist(); });
  out.offer0 = await q('story0');
  // The doors stay shut until the chapter is taken.
  await p.evaluate(() => HS.startDescent()); await p.waitForTimeout(200); out.gate = (await st()).state;
  await p.evaluate(() => { const v = HS.room.npcs.find((n) => n.npc === 'vane'); HS.player.x = v.x - 30; HS.player.y = v.y + 20; HS.game.toast = null; }); await p.waitForTimeout(700); await shot('mark');
  out.ch = [];
  for (let k = 0; k < 5; k++) {
    const c = {};
    const C = await p.evaluate((k) => ({ giver: HS.STORY[k].giver, turn: HS.STORY[k].turn, goals: HS.STORY[k].goals }), k);
    await p.evaluate((g) => HS.talk(g), C.giver); await p.waitForTimeout(150);
    c.intro = await closeDialog(k === 0 ? 'intro0' : null);
    c.taken = (await q(`story${k}`)).st;
    if (k === 0) { await p.waitForTimeout(300); await p.evaluate(() => { HS.game.toast = null; }); await shot('tracker-town'); }
    await p.evaluate(() => HS.startDescent());
    for (let i = 0; i < 60 && (await st()).scene !== 'wound'; i++) await p.waitForTimeout(100);
    await p.waitForTimeout(700);
    c.run = await p.evaluate(() => ({ story: HS.game.run.story, stratum: HS.game.run.stratum, find: !!HS.storyFind }));
    if (k === 0) { await p.evaluate(() => { HS.game.toast = null; }); await shot('tracker-run'); }
    await p.evaluate(() => { HS.enemies.length = 0; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden(); });
    c.held = await p.evaluate(() => !HS.game.warden);
    await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 10; HS.enemies.length = 0; }); await p.waitForTimeout(500);
    await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
    // The message, then the Warden's lines the moment it appears (one unbroken scene: no blow lands between them).
    const seen = await closeDialog(k === 0 ? `note${k}` : null);
    c.warden = await p.evaluate(() => HS.game.warden && HS.game.warden.type);
    c.spawnSpoke = seen.includes(c.warden);
    await p.waitForTimeout(1800); // it rises from the floor first
    await p.evaluate(() => { const e = HS.game.warden; e.hp = e.maxHp * 0.6; }); await p.waitForTimeout(500);
    c.phaseSay = await p.evaluate(() => !!HS.bossSay); if (k === 0) await shot('phase');
    // The other objectives (counted as play would count them).
    await p.evaluate((goals) => { for (const [key, n] of goals) if (key !== 'read' && key !== 'warden') HS.questBump(key, n); }, C.goals);
    await p.evaluate(() => { const e = HS.game.warden; if (e) HS.hurtEnemy(e, e.hp + 10); }); await p.waitForTimeout(2200); for (let i = 0; i < 30 && (await st()).state === "stig"; i++) { await p.evaluate(() => { HS.game.state = "play"; }); await p.waitForTimeout(400); }
    c.death = await closeDialog(k === 0 ? 'death' : null);
    c.step = (await q(`story${k}`)).step;
    await p.evaluate(() => HS.finishDescent()); await p.waitForTimeout(1600);
    await tap(W / 2, H / 2); await p.waitForTimeout(1500);
    await closeDialog();
    if (k === 0) { await p.evaluate((t) => { const v = HS.room.npcs.find((n) => n.npc === t); HS.player.x = v.x - 30; HS.player.y = v.y + 20; HS.game.toast = null; }, C.turn); await p.waitForTimeout(700); await shot('turnin'); }
    const gold0 = await p.evaluate(() => HS.SAVE.gold || 0);
    await p.evaluate((t) => HS.talk(t), C.turn); await p.waitForTimeout(150);
    c.outro = await closeDialog(k === 4 ? 'outro4' : null);
    await p.waitForTimeout(300); if (k === 0) await shot('reward');
    c.after = { story: (await st()).story, gold: (await p.evaluate(() => HS.SAVE.gold || 0)) - gold0, done: (await q(`story${k}`)).st };
    out.ch.push(c);
  }
  out.sitesOffered = await p.evaluate(() => Object.keys(HS.SAVE.q).filter((id) => id.startsWith('site_')).map((id) => `${id}:${HS.qOf(id).st}`));
  // A site quest: the stall (opened by the first descent).
  await p.evaluate(() => { const S = HS.SITES.find((t) => t.id === 'stall'); HS.player.x = S.x; HS.player.y = HS.room.top * 16 + S.dy + 30; HS.game.toast = null; HS.game.state = 'play'; }); await p.waitForTimeout(700); await shot('sitemark');
  await p.evaluate(() => HS.openSite(HS.SITES.find((t) => t.id === 'stall'))); await p.waitForTimeout(150);
  out.stallScene = await closeDialog('stall');
  out.stallState = (await st()).state;
  await p.evaluate(() => { HS.game.state = 'play'; HS.questBump('buy'); });
  out.stallDone = (await q('site_stall')).st;
  // The forge and the Enchanter (a deeper character): their gifts.
  out.forge = await p.evaluate(() => { HS.SAVE.cleared = 9; HS.ensureQuests(); const e0 = HS.SAVE.embers || 0; HS.openSite(HS.SITES.find((t) => t.id === 'forge')); return { offered: true, embers: (HS.SAVE.embers || 0) - e0 }; });
  await closeDialog(); await p.evaluate(() => { HS.game.state = 'play'; });
  out.ench = await p.evaluate(() => { const i = HS.ENCHANTS ? HS.ENCHANTS.findIndex((e) => e.id === 'emberwake') : -1; HS.openSite(HS.SITES.find((t) => t.id === 'ench')); return { st: HS.qOf('site_ench') && HS.qOf('site_ench').st, ingr: i >= 0 ? HS.SAVE.ingr.slice(i * 3, i * 3 + 3) : null }; });
  await closeDialog('ench'); await p.evaluate(() => { HS.game.state = 'play'; });
  out.done = await p.evaluate(() => HS.storyDone());
  await p.evaluate(() => { HS.game.state = 'play'; HS.startDescent(); }); await p.waitForTimeout(300);
  out.afterGate = (await st()).state;
  await p.evaluate(() => { HS.openStory(2, 'pause'); }); await p.waitForTimeout(300); await shot('done');
  out.donePageText = await p.evaluate(() => HS.textProblems().length);
  out.old = await p.evaluate(() => { const was = HS.SAVE.story; delete HS.SAVE.story; HS.SAVE.cleared = 3; const r = HS.storyN(); HS.SAVE.story = was; return r; });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
