// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/storyplay.cjs <outDir> [chapter] [WxH]
// Round 169: one story chapter played through the way a player would, with the auto pilot fighting (god mode on):
// a new character, the prologue, walking up to the giver and pressing E, the cathedral doors, the descent, the
// message, the Warden's lines, the fight, the Waystone, the tally, the Saint level summary back in Vael, the ? and the
// closing scene. Every frame's text is checked along the way for UNDEFINED, NULL, NAN and [OBJECT; every string seen
// is written to <outDir>/story-text-<chapter>.txt for a read-through.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], CH = +(process.argv[3] || 0), [VW, VH] = (process.argv[4] || '844x390').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const seen = new Set(), bad = [], log = [];
  const scan = async (where) => { const L = await p.evaluate(() => HS.textAudit().flat().map((q) => q.s)).catch(() => []);
    for (const s of L) { if (!seen.has(s)) { seen.add(s); log.push(`[${where}] ${s}`); } if (/undefined|\bnull\b|\bnan\b|\[object|infinity/i.test(s) && !bad.some((q) => q.s === s)) bad.push({ where, s }); } };
  const st = () => p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene }));
  const tap = async (x, y) => { const pos = await p.evaluate(([x, y]) => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left + x / HS.W * r.width, r.top + y / HS.H * r.height]; }, [x, y]); await p.mouse.click(pos[0], pos[1]); };
  const shot = (n) => p.screenshot({ path: `${S}/shots/play${CH}-${n}.png` });
  const closeDialog = async (where) => { let n = 0; for (let i = 0; i < 120 && (await st()).state === 'dialog'; i++) { await p.evaluate(() => { if (HS.game.dialog) HS.game.dialog.t = 99; }); await p.waitForTimeout(40); await scan(where); if (n++ === 0) await shot(where); await tap(200, 150); await p.waitForTimeout(60); } return n; };
  const press = async (key) => { await p.keyboard.press(key); await p.waitForTimeout(120); };
  const walkTo = async (x, y) => { await p.evaluate(([x, y]) => { HS.player.x = x; HS.player.y = y; HS.game.toast = null; }, [x, y]); await p.waitForTimeout(400); };
  const out = { chapter: CH };
  // A new character and the prologue.
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(900);
  const W = await p.evaluate(() => HS.W), H = await p.evaluate(() => HS.H);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(500);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(2500);
  out.prologue = await closeDialog('prologue');
  await p.evaluate((k) => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.game.news = null; if (k > 0) { HS.SAVE.story = k; HS.SAVE.lvl = Math.max(HS.SAVE.lvl || 1, 2 + k * 3); } HS.ensureQuests(); HS.game.state = 'play'; HS.persist(); }, CH);
  const C = await p.evaluate((k) => ({ giver: HS.STORY[k].giver, turn: HS.STORY[k].turn, goals: HS.STORY[k].goals, title: HS.STORY[k].title }), CH);
  out.title = C.title;
  // The giver: walk up and press E.
  const npcAt = (id) => p.evaluate((id) => { const n = HS.room.npcs.find((m) => (m.talk || m.npc) === id); return n && { x: n.x, y: n.y }; }, id);
  { const n = await npcAt(C.giver); await walkTo(n.x - 24, n.y + 6); await scan('town'); await shot('giver'); out.giverButton = await p.evaluate(() => HS.interact && HS.interact.label); await press('KeyE'); }
  out.intro = await closeDialog('intro');
  out.taken = await p.evaluate((k) => HS.qOf(`story${k}`).st, CH);
  await p.waitForTimeout(300); await scan('town-taken');
  // The cathedral doors.
  { const D = await p.evaluate(() => { const d = HS.room.interact.find((q) => q.door); return d && { x: d.x, y: d.y }; }); await walkTo(D.x, D.y + 4); out.doorButton = await p.evaluate(() => HS.interact && HS.interact.label); await press('KeyE'); }
  for (let i = 0; i < 60 && (await st()).scene !== 'wound'; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(800); await scan('arrive'); await shot('arrive');
  out.run = await p.evaluate(() => ({ story: HS.game.run.story, find: !!HS.storyFind, lvl: HS.SAVE.lvl }));
  // The pilot fights (god mode) until every goal but the message and the Warden is met.
  await p.evaluate(() => { HS.DEV.god = true; HS.DEV.speed = 2; HS.game.run.auto = true; });
  const goalsMet = () => p.evaluate((k) => { const q = HS.qOf(`story${k}`), d = HS.STORY[k]; return d.goals.filter(([g]) => g !== 'read' && g !== 'warden' && g !== 'chest').every(([g, m]) => (q.c[g] || 0) >= m); }, CH);
  const tick = async (where) => { const s0 = await st(); if (s0.state === 'stig') await p.evaluate(() => HS.pickStigma(0)); else if (s0.state === 'dialog') await closeDialog(where); else if (s0.state !== 'play' && s0.state !== 'loading' && s0.state !== 'tally') await p.evaluate(() => { HS.game.state = 'play'; }); await scan(where); };
  const t0 = Date.now(); let shots = 0;
  while (Date.now() - t0 < 240000 && !(await goalsMet())) { await tick('fight'); if (Date.now() - t0 > 15000 * (shots + 1) && shots < 3) await shot(`fight${shots++}`); await p.waitForTimeout(450); }
  // The pilot never opens chests: when a chapter asks for one, walk to the nearest unopened chest and press E.
  for (let k = 0; k < 3 && await p.evaluate((ch) => { const q = HS.qOf(`story${ch}`), g = HS.STORY[ch].goals.find(([x]) => x === 'chest'); return g && (q.c.chest || 0) < g[1]; }, CH); k++) {
    const C0 = await p.evaluate(() => { const r = HS.room.rooms.filter((q) => q.chest && !q.chest.open).sort((a, b) => Math.hypot(a.chest.x - HS.player.x, a.chest.y - HS.player.y) - Math.hypot(b.chest.x - HS.player.x, b.chest.y - HS.player.y))[0]; return r && { x: r.chest.x, y: r.chest.y }; });
    if (!C0) break; await walkTo(C0.x, C0.y + 14); out.chestButton = await p.evaluate(() => HS.interact && HS.interact.label); await press('KeyE'); await p.waitForTimeout(400); await tick('chest');
  }
  out.fightSecs = Math.round((Date.now() - t0) / 1000);
  out.counts = await p.evaluate((k) => ({ ...HS.qOf(`story${k}`).c }), CH);
  // The message, then the Warden's lines.
  await p.evaluate(() => { HS.game.run.auto = false; });
  { const F = await p.evaluate(() => HS.storyFind && { x: HS.storyFind.x, y: HS.storyFind.y }); await walkTo(F.x, F.y + 12); await scan('message'); await shot('message'); out.readButton = await p.evaluate(() => HS.interact && HS.interact.label); await press('KeyE'); }
  out.note = await closeDialog('note');
  // Until the Toll fills, the pilot keeps fighting; then the Warden rises and speaks.
  out.tollAtRead = await p.evaluate(() => HS.game.toll && Math.round(100 * HS.game.toll.v / HS.game.toll.max));
  await p.evaluate(() => { HS.game.run.auto = true; });
  const t2 = Date.now(); while (Date.now() - t2 < 240000 && !(await p.evaluate(() => !!HS.game.warden))) { await tick('toll'); await p.waitForTimeout(450); }
  out.tollSecs = Math.round((Date.now() - t2) / 1000);
  for (let i = 0; i < 20 && (await st()).state !== 'dialog'; i++) await p.waitForTimeout(100);
  out.spawn = await closeDialog('warden');
  // The fight with the Warden.
  await p.evaluate(() => { HS.game.run.auto = true; });
  const t1 = Date.now(); while (Date.now() - t1 < 120000 && await p.evaluate(() => HS.game.warden && !HS.game.warden.dead)) { await tick('warden'); await p.waitForTimeout(450); }
  out.wardenSecs = Math.round((Date.now() - t1) / 1000);
  out.wardenByPilot = await p.evaluate(() => !(HS.game.warden && !HS.game.warden.dead));
  if (!out.wardenByPilot) await p.evaluate(() => { const e = HS.game.warden; if (e) HS.hurtEnemy(e, e.hp + 10); });
  await p.evaluate(() => { HS.game.run.auto = false; });
  for (let i = 0; i < 40 && (await st()).state !== 'dialog'; i++) { await tick('fall'); await p.waitForTimeout(150); }
  out.death = await closeDialog('death');
  for (let i = 0; i < 60 && !(await p.evaluate(() => !!HS.game.waystone)); i++) { await tick('waystone-wait'); await p.waitForTimeout(150); }
  out.step = await p.evaluate((k) => HS.qOf(`story${k}`).step, CH);
  // The Waystone, the tally, back to Vael.
  { const Wy = await p.evaluate(() => HS.game.waystone && { x: HS.game.waystone.x, y: HS.game.waystone.y }); if (Wy) { await walkTo(Wy.x, Wy.y + 14); out.stoneButton = await p.evaluate(() => HS.interact && HS.interact.label); await press('KeyE'); } }
  for (let i = 0; i < 30 && (await st()).state !== 'tally'; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(1600); await scan('tally'); await shot('tally');
  await tap(W / 2, H / 2); for (let i = 0; i < 30 && (await st()).scene !== 'town'; i++) await p.waitForTimeout(100);
  for (let i = 0; i < 40 && (await st()).state === 'play'; i++) await p.waitForTimeout(100);
  out.backState = (await st()).state;
  if (out.backState === 'saintlv') { await scan('saintlv'); await shot('saintlv'); out.saintLv = await p.evaluate(() => HS.game.lvUp && `${HS.game.lvUp.from} to ${HS.game.lvUp.to}`); await tap(4, 4); await p.waitForTimeout(200); }
  if ((await st()).state === 'dialog') out.townScene = await closeDialog('town-back');
  await p.waitForTimeout(2800); await scan('town-back');
  // The ? and the closing scene.
  out.where = await p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene, npcs: HS.room.npcs.map((m) => m.talk || m.npc).filter(Boolean).join(',') }));
  if (!(await npcAt(C.turn))) { console.log(JSON.stringify(out, null, 1)); fs.writeFileSync(`${S}/story-text-${CH}.txt`, log.join('\n')); console.log('errors', errs.length, errs.slice(0, 3)); await b.close(); return; }
  { const n = await npcAt(C.turn); await walkTo(n.x - 24, n.y + 6); await scan('turnin'); await shot('turnin'); out.turnButton = await p.evaluate(() => HS.interact && HS.interact.label); await press('KeyE'); }
  out.outro = await closeDialog('outro');
  await p.waitForTimeout(500); await scan('reward'); await shot('reward');
  out.after = await p.evaluate((k) => ({ quest: HS.qOf(`story${k}`).st, story: HS.SAVE.story, next: HS.qOf(`story${k + 1}`) && HS.qOf(`story${k + 1}`).st }), CH);
  out.strings = seen.size; out.bad = bad;
  fs.writeFileSync(`${S}/story-text-${CH}.txt`, log.join('\n'));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
