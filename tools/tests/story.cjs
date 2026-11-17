// Round 150: the campaign (THE FIRST DESCENT). A new character: the prologue, the Stations closed, the STORY page,
// every chapter (intro, the message, the held Warden, the chapter's Warden and its line, the finish, the closing
// scene), then the Stations open. Also: an older character counts the story as done.
// Usage: node tools/tests/story.cjs <outDir> [WxH]
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const st = () => p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene, story: HS.SAVE.story, run: HS.game.run && HS.game.run.story }));
  const tap = async (x, y) => { const pos = await p.evaluate(([x, y]) => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left + x / HS.W * r.width, r.top + y / HS.H * r.height]; }, [x, y]); await p.mouse.click(pos[0], pos[1]); };
  const shot = (n) => p.screenshot({ path: `${S}/shots/story-${n}-${VW}.png` });
  const dlg = () => p.evaluate(() => HS.game.dialog && HS.game.state === 'dialog' ? { who: HS.game.dialog.who && HS.game.dialog.who[HS.game.dialog.i], line: HS.game.dialog.lines[HS.game.dialog.i] } : null);
  const closeDialog = async (name) => { const seen = []; for (let i = 0; i < 60 && (await st()).state === 'dialog'; i++) { const d = await dlg(); if (d && !seen.includes(d.who)) { seen.push(d.who); if (name) { await p.evaluate(() => { HS.game.dialog.t = 99; }); await p.waitForTimeout(60); await shot(`${name}-${seen.length}`); } } await tap(200, 150); await p.waitForTimeout(90); } return seen; };
  const out = {};
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(900);
  const W = await p.evaluate(() => HS.W), H = await p.evaluate(() => HS.H);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(500);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(2500);
  out.wake = await st();
  out.prologue = await closeDialog('prologue');
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.game.state = 'play'; HS.persist(); });
  // The cathedral opens the story page, not the Stations.
  await p.evaluate(() => { HS.startDescent(); }); await p.waitForTimeout(300);
  out.gate = (await st()).state; await shot('page');
  out.pageText = await p.evaluate(() => HS.textProblems().length);
  // Every chapter in turn.
  out.ch = [];
  for (let k = 0; k < 5; k++) {
    const c = {};
    await p.evaluate((k) => { HS.openStory(k); HS.game.state = 'story'; }, k);
    const L = await p.evaluate(() => HS.storyLayout());
    await tap(L.play.x + 10, L.play.y + 10); await p.waitForTimeout(200);
    c.intro = await closeDialog(k === 0 ? 'intro0' : null);
    for (let i = 0; i < 60 && (await st()).scene !== 'wound'; i++) await p.waitForTimeout(100);
    await p.waitForTimeout(600);
    c.run = await p.evaluate(() => ({ story: HS.game.run.story, stratum: HS.game.run.stratum, find: !!HS.storyFind, auto: HS.game.run.auto }));
    // The Toll fills before the message is read: no Warden yet.
    await p.evaluate(() => { HS.enemies.length = 0; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden(); });
    c.held = await p.evaluate(() => !HS.game.warden);
    // Walk to the message and read it.
    await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 10; HS.enemies.length = 0; }); await p.waitForTimeout(500);
    if (k === 0) await shot('find');
    await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
    c.note = await closeDialog(k === 0 || k === 4 ? `note${k}` : null);
    await p.waitForTimeout(1700);
    c.wardenLine = await closeDialog(k === 0 ? 'warden' : null);
    c.warden = await p.evaluate(() => HS.game.warden && HS.game.warden.type);
    await p.evaluate(() => { const e = HS.game.warden; if (e) HS.hurtEnemy(e, e.hp + 10); });
    await p.waitForTimeout(1500);
    c.cleared = await p.evaluate(() => HS.SAVE.cleared);
    await p.evaluate(() => HS.finishDescent()); await p.waitForTimeout(1600);
    await tap(W / 2, H / 2); await p.waitForTimeout(900);
    c.outro = await closeDialog(k === 4 ? 'outro4' : null);
    c.after = await st();
    out.ch.push(c);
  }
  await p.waitForTimeout(400); await shot('open');
  out.done = await p.evaluate(() => HS.storyDone());
  await p.evaluate(() => { HS.game.state = 'play'; HS.startDescent(); }); await p.waitForTimeout(300);
  out.afterGate = (await st()).state;
  // The STORY page from the pause screen, all chapters done (READ shows).
  await p.evaluate(() => { HS.openStory(2, 'pause'); }); await p.waitForTimeout(300); await shot('done');
  out.donePageText = await p.evaluate(() => HS.textProblems().length);
  // An older character (a Station cleared, no story field) counts the story as done.
  out.old = await p.evaluate(() => { const was = HS.SAVE.story; delete HS.SAVE.story; HS.SAVE.cleared = 3; const r = HS.storyN(); HS.SAVE.story = was; return r; });
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
