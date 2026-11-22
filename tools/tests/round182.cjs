// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round182.cjs <outDir> [WxH]
// Round 182: chapter 9 (THE DOOR BELOW: offered after chapter 8 and the ending, played through to the Doorkeeper,
// its entrance, a photo mid-fight, its death and mess, the outro), the Doorkeeper kept out of the Stations' list, the
// story page with nine chapters, the yard's DEATHS picker, Warden blood mid-fight, the old burst path in the new art.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r182-${n}-${vw}.png` });
  const until = async (fn, a, n = 200) => { for (let i = 0; i < n && !(await p.evaluate(fn, a)); i++) await p.waitForTimeout(100); };
  const closeDialog = async () => { const seen = []; for (let i = 0; i < 80 && (await p.evaluate(() => HS.game.state === 'dialog')); i++) { seen.push(await p.evaluate(() => HS.game.dialog && HS.game.dialog.who[HS.game.dialog.i])); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(140); } return [...new Set(seen)]; };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1800);
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = 8; HS.SAVE.cleared = 29; HS.SAVE.ending = 1; HS.SAVE.eliteKills = 12; HS.SAVE.lvl = 60; HS.SAVE.god = 1; HS.DEV.god = true; HS.ensureQuests(); });
  out.offered = await p.evaluate(() => HS.qOf('story8') && HS.qOf('story8').st);
  out.inList = await p.evaluate(() => Object.keys(HS.MON).filter((k) => HS.MON[k].warden && !HS.MON[k].story && HS.MON[k].stratum === 3));
  await p.evaluate(() => HS.openStory(8, 'play')); await p.waitForTimeout(400); await shot('story'); out.storyProblems = await p.evaluate(() => HS.textProblems().length);
  await p.evaluate(() => { HS.game.state = 'play'; HS.talk('odile'); }); await p.waitForTimeout(200); out.intro = await closeDialog();
  await p.evaluate(() => HS.openStory(8, 'play')); await p.waitForTimeout(200);
  await p.evaluate(() => { HS.game.state = 'play'; HS.beginStory(8, false); }); await until(() => HS.game.scene === 'wound' && HS.game.state === 'play' && HS.game.run && HS.game.run.story === 8);
  await p.waitForTimeout(800);
  out.run = await p.evaluate(() => { HS.game.run.level = 99; return { story: HS.game.run.story, stratum: HS.game.run.stratum }; });
  await p.evaluate(() => { HS.enemies.length = 0; HS.game.toll.v = HS.game.toll.max; HS.game.toll.done = true; HS.spawnWarden(); const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 30; }); await p.waitForTimeout(700); await shot('finale');
  await p.evaluate(() => { const F = HS.storyFind; HS.player.x = F.x; HS.player.y = F.y + 10; }); await p.waitForTimeout(400); await p.keyboard.press('KeyE'); await p.waitForTimeout(200);
  for (let i = 0; i < 40 && !(await p.evaluate(() => !!HS.game.warden)); i++) { await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(100); }
  await p.waitForTimeout(900); await shot('entrance'); out.spawnLines = await closeDialog();
  out.warden = await p.evaluate(() => HS.game.warden && { type: HS.game.warden.type, title: HS.game.warden.title });
  // The fight: let it attack a while (god mode), photos; then its blood on the floor.
  await p.evaluate(() => { const e = HS.game.warden; e.x = HS.player.x + 90; e.y = HS.player.y; });
  for (let i = 0; i < 3; i++) { await p.waitForTimeout(2200); await p.evaluate(() => { if (HS.game.state !== 'play') { HS.game.dialog = null; HS.game.state = 'play'; } }); await shot(`fight-${i}`); }
  out.wardenBlood = await p.evaluate(() => { const e = HS.game.warden; if (!e) return null; HS.hurtEnemy(e, e.maxHp * 0.25, false, 1, 0); return e.bledN || 0; });
  await p.waitForTimeout(500); await shot('bleeding');
  await p.evaluate(() => { for (const [k, n] of HS.STORY[8].goals) if (k !== 'read' && k !== 'warden') HS.questBump(k, n); const e = HS.game.warden; if (e) { e.hp = e.maxHp * 0.45; } }); await p.waitForTimeout(1200); await p.evaluate(() => { HS.game.dialog = null; HS.game.state = 'play'; }); await shot('phase');
  await p.evaluate(() => { const e = HS.game.warden; if (e) HS.hurtEnemy(e, e.hp + 10, false, 1, 0); }); await p.waitForTimeout(900); await shot('dying'); await p.waitForTimeout(1800);
  for (let i = 0; i < 30 && (await p.evaluate(() => HS.game.state === 'stig')); i++) { await p.evaluate(() => { HS.game.state = 'play'; }); await p.waitForTimeout(300); }
  out.death = await closeDialog(); await p.waitForTimeout(1500); await shot('mess');
  await p.evaluate(() => HS.finishDescent()); await p.waitForTimeout(1600); await p.mouse.click(vw / 2, vh / 2); await p.waitForTimeout(1500); await closeDialog();
  await until(() => HS.game.scene === 'town' && HS.game.state === 'play');
  await p.evaluate(() => HS.talk('odile')); await p.waitForTimeout(200); out.outro = await closeDialog();
  for (let i = 0; i < 20 && (await p.evaluate(() => HS.game.state !== 'play')); i++) { await p.evaluate(() => { if (HS.game.state === 'recap') HS.game.state = 'play'; }); await p.waitForTimeout(200); await closeDialog(); }
  out.done = await p.evaluate(() => ({ story: HS.SAVE.story, q: HS.qOf('story8').st }));
  // The Codex card.
  await p.evaluate(() => { HS.openCodex(1, 'play'); const K = HS.game.codex, L = HS.codexLayout(); K.sel = L.list.findIndex((q) => q.id === 'doorkeeper'); K.page = Math.floor(K.sel / L.per); }); await p.waitForTimeout(400); await shot('codex'); out.codexProblems = await p.evaluate(() => HS.textProblems().length);
  // The Training Yard's DEATH picker: pick one, summon three foes, kill them; that death plays.
  await p.evaluate(() => { HS.game.state = 'play'; HS.openYard(); }); await until(() => HS.game.yard && HS.game.state === 'play' && HS.game.scene === 'wound');
  await p.waitForTimeout(800);
  out.yard = await p.evaluate(async () => { HS.game.state = 'yard'; HS.game.yard.tab = 0; const G0 = HS.yardGeo(); for (let i = 0; i < 3; i++) HS.yardTap(G0.death.x + 10, G0.death.y + 8); return HS.GORE_KINDS[HS.game.yard.death]; });
  await p.waitForTimeout(300); await shot('yard-panel'); out.yardProblems = await p.evaluate(() => HS.textProblems().length);
  out.yardDeath = await p.evaluate(async () => { HS.game.state = 'play'; HS.yardSummon('votary'); await new Promise((r) => setTimeout(r, 1500)); for (const e of HS.enemies) if (!e.dead && e.type !== 'dummy') HS.hurtEnemy(e, e.hp + 5, false, 1, 0); return HS.gores.map((g) => g.kind); });
  await p.waitForTimeout(150); await shot('yard-death');
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs);
  await b.close();
})();
