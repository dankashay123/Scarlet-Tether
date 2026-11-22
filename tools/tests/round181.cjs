// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round181.cjs <outDir> [WxH]
// Round 181: the GORE setting (FULL, LESS, OFF: drops, gibs and splats counted, photos), blood from an elite's crumble,
// a Warden's mess when it settles, chapter 8 (THE LIT STAIR: Hew's chapter lines, the newest grave, the stair, the
// Charnel King, the outro) and the story page with eight chapters.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r181-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const closeDialog = async () => { const seen = []; for (let i = 0; i < 80 && (await p.evaluate(() => HS.game.state === 'dialog')); i++) { seen.push(await p.evaluate(() => HS.game.dialog && HS.game.dialog.who[HS.game.dialog.i])); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(140); } return [...new Set(seen)]; };
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.DEV.god = true; HS.game.dialog = null; HS.game.state = 'play'; HS.game.run.level = 99; for (const e of HS.enemies) e.dead = true; });
  // 1. The setting, and what each level leaves.
  await p.evaluate(() => { HS.game.setSec = 0; HS.game.state = 'settings'; }); await p.waitForTimeout(400); await shot('settings'); out.setProblems = await p.evaluate(() => HS.textProblems().length);
  out.levels = {};
  for (const lv of ['full', 'less', 'off']) {
    out.levels[lv] = await p.evaluate(async (L) => {
      HS.game.state = 'play'; HS.SAVE.opts = { ...(HS.SAVE.opts || {}), gore: L }; HS.GORE_FORCE = null;
      const p0 = HS.parts.length, g0 = HS.gibs.length, kinds = {};
      for (let i = 0; i < 12; i++) { const e = HS.spawnMonster(['votary', 'flagellant', 'crawler'][i % 3], HS.player.x + 60 + (i % 4) * 14, HS.player.y - 20 + Math.floor(i / 4) * 16, { tier: 'common' }); e.state = 'idle'; e.spawnDelay = 0; }
      await new Promise((r) => setTimeout(r, 150));
      for (const e of HS.enemies) if (!e.dead && Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 160) HS.hurtEnemy(e, e.hp + 5, false, 1, 0);
      for (const g of HS.gores) kinds[g.kind] = (kinds[g.kind] || 0) + 1;
      await new Promise((r) => setTimeout(r, 60));
      return { drops: HS.parts.filter((q) => q.g && q.st).length, gibs: HS.gibs.length - g0, kinds };
    }, lv);
    await p.waitForTimeout(500); await shot(`gore-${lv}`); await p.waitForTimeout(2500);
  }
  await p.evaluate(() => { HS.SAVE.opts.gore = 'full'; });
  // 2. An elite's crumble and its blood; a Warden's mess.
  out.crumble = await p.evaluate(async () => { const e = HS.spawnMonster('votary', HS.player.x + 70, HS.player.y, { tier: 'elite', affixes: [] }); e.state = 'idle'; e.spawnDelay = 0; await new Promise((r) => setTimeout(r, 900)); if (!e.dead) HS.hurtEnemy(e, e.hp + 5, false, 1, 0); await new Promise((r) => setTimeout(r, 400)); return { stains: HS.gores.filter((g) => g.kind === 'stain').length, falls: HS.falls ? HS.falls.length : null }; });
  await p.waitForTimeout(1200); await shot('crumble');
  out.warden = await p.evaluate(async () => { for (const e of HS.enemies) e.dead = true; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden('cardinal'); await new Promise((r) => setTimeout(r, 2500)); HS.game.dialog = null; HS.game.state = 'play'; const w = HS.game.warden; if (!w) return null; w.x = HS.player.x + 80; w.y = HS.player.y; HS.hurtEnemy(w, w.hp + 10, false, 1, 0); return { type: w.type }; });
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); await p.evaluate(() => { HS.game.dialog = null; if (HS.game.state !== 'play') HS.game.state = 'play'; }); }
  await shot('warden-mess'); out.wardenStains = await p.evaluate(() => HS.gores.filter((g) => g.kind === 'stain').length);
  // 3. Chapter 8.
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 7; HS.SAVE.cleared = 29; HS.SAVE.ending = 1; HS.SAVE.eliteKills = 12; HS.SAVE.lvl = 60; HS.SAVE.god = 1; HS.DEV.god = true; HS.ensureQuests(); });
  out.offered = await p.evaluate(() => HS.qOf('story7') && HS.qOf('story7').st);
  await p.evaluate(() => HS.openStory(7, 'play')); await p.waitForTimeout(400); await shot('story'); out.storyProblems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; HS.talk('odile'); }); await p.waitForTimeout(200); out.intro = await closeDialog();
  await p.evaluate(() => HS.travelRegion('isle')); await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.room && HS.room.region === 'isle');
  out.hewMark = await p.evaluate(() => { const n = HS.room.npcs.find((m) => m.talk === 'hew'); HS.player.x = n.x + 26; HS.player.y = n.y + 4; return true; });
  await p.evaluate(() => { HS.game.banner = null; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 320) e.dead = true; }); await p.waitForTimeout(600); await shot('hew');
  await p.evaluate(() => HS.regionTalk('hew')); await p.waitForTimeout(150); out.hewLines = await closeDialog();
  await p.evaluate(() => { const L = HS.REGION_LORE.isle.find((q) => q.id === 'i_graves'); HS.readLore(L); }); await p.waitForTimeout(150); await closeDialog();
  out.steps = await p.evaluate(() => HS.qOf('story7').c);
  await p.evaluate(() => { const m = HS.room.marks.find((q) => q.kind === 'door'); HS.player.x = m.x; HS.player.y = m.y + 40; HS.room.interact.find((i) => i.label === 'ENTER').use(); });
  await until(() => HS.game.scene === 'wound' && !HS.room.region && HS.game.state === 'play'); await p.waitForTimeout(800);
  out.run = await p.evaluate(() => { HS.game.run.level = 99; return { story: HS.game.run.story, stratum: HS.game.run.stratum }; });
  await p.evaluate(() => { HS.enemies.length = 0; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden(); const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 30; }); await p.waitForTimeout(700); await shot('finale');
  await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 10; }); await p.waitForTimeout(400); await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!HS.game.warden)); i++) { await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(100); }
  await p.waitForTimeout(800); await shot('king'); await closeDialog();
  out.chWarden = await p.evaluate(() => HS.game.warden && HS.game.warden.type);
  await p.evaluate(() => { for (const [k, n] of HS.STORY[7].goals) if (k !== 'read' && k !== 'warden') HS.questBump(k, n); const e = HS.game.warden; if (e) { e.x = HS.player.x + 70; e.y = HS.player.y; HS.hurtEnemy(e, e.hp + 10); } }); await p.waitForTimeout(2400);
  for (let i = 0; i < 30 && (await p.evaluate(() => HS.game.state === 'stig')); i++) { await p.evaluate(() => { HS.game.state = 'play'; }); await p.waitForTimeout(300); }
  out.death = await closeDialog(); await p.waitForTimeout(1500); await shot('king-mess');
  await p.evaluate(() => HS.finishDescent()); await p.waitForTimeout(1600); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(1500); await closeDialog();
  await until(() => HS.game.scene === 'town' && HS.game.state === 'play');
  await p.evaluate(() => HS.talk('odile')); await p.waitForTimeout(200); out.outro = await closeDialog();
  for (let i = 0; i < 20 && (await p.evaluate(() => HS.game.state !== 'play')); i++) { await p.evaluate(() => { if (HS.game.state === 'recap') HS.game.state = 'play'; }); await p.waitForTimeout(200); await closeDialog(); }
  out.done = await p.evaluate(() => ({ story: HS.SAVE.story, q: HS.qOf('story7').st }));
  await p.evaluate(() => HS.openStory(7, 'play')); await p.waitForTimeout(400); await shot('story-done');
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
