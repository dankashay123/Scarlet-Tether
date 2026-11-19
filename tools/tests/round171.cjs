// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round171.cjs <outDir> [WxH]
// Round 171: a new character's opening (the narrated pictures, the Vestry, the walk through Vael by talking to four
// people, the night fight in the Quiet Acre, back to Vane with chapter 1 offered), then the moor's chapter: Vane
// sends you out, the Pilgrims' Gate, Wenna at the camp, the wagons, the survivor, lore, the lost sheep, and the
// barrow door into the station. Every frame's text is checked for UNDEFINED, NULL, NAN.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
require('fs').mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 300)));
  const out = {}, bad = [];
  const scan = async (w) => { const L = await p.evaluate(() => HS.textAudit().flat().map((q) => q.s)).catch(() => []); for (const s0 of L) if (/undefined|\bnull\b|\bnan\b|\[object/i.test(s0) && !bad.some((q) => q.s === s0)) bad.push({ w, s: s0 }); };
  const st = () => p.evaluate(() => ({ state: HS.game.state, scene: HS.game.scene, region: HS.room && HS.room.region }));
  const tap = async (x, y) => { const pos = await p.evaluate(([x, y]) => { const r = document.getElementById('screen').getBoundingClientRect(); return [r.left + x / HS.W * r.width, r.top + y / HS.H * r.height]; }, [x, y]); await p.mouse.click(pos[0], pos[1]); };
  const shot = (n) => p.screenshot({ path: `${S}/shots/r171-${n}-${VW}.png` });
  const closeDialog = async (w, every) => { let n = 0; for (let i = 0; i < 160 && (await st()).state === 'dialog'; i++) { await p.evaluate(() => { if (HS.game.dialog) HS.game.dialog.t = 99; }); await p.waitForTimeout(40); await scan(w); if (every && n < every) await shot(`${w}${n}`); n++; await tap(200, 150); await p.waitForTimeout(50); } return n; };
  const walkTo = async (x, y) => { await p.evaluate(([x, y]) => { HS.player.x = x; HS.player.y = y; HS.game.toast = null; }, [x, y]); await p.waitForTimeout(350); };
  const press = async () => { await p.keyboard.press('KeyE'); await p.waitForTimeout(150); };
  const npc = (id) => p.evaluate((id) => { const n = HS.room.npcs.find((m) => (m.talk || m.npc) === id); return n && { x: n.x, y: n.y }; }, id);
  // A new character: the narrated opening (photograph each picture), then the Vestry.
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(900);
  const W = await p.evaluate(() => HS.W), H = await p.evaluate(() => HS.H);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(500);
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(2500);
  out.narr = await p.evaluate(() => HS.game.dialog && HS.game.dialog.who && HS.game.dialog.who[0]);
  for (let i = 0; i < 7 && (await p.evaluate(() => HS.game.dialog && HS.game.dialog.who && HS.game.dialog.who[HS.game.dialog.i] === 'narr')); i++) { await p.waitForTimeout(1200); await p.evaluate(() => { HS.game.dialog.t = 99; }); await p.waitForTimeout(60); await scan('narr'); await shot(`narr${i}`); await tap(200, 150); await p.waitForTimeout(80); }
  out.vestry = await closeDialog('vestry');
  out.walk = await p.evaluate(() => HS.qOf('walk_vael') && HS.qOf('walk_vael').st);
  out.story0Held = await p.evaluate(() => !HS.qOf('story0'));
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.game.news = null; HS.SAVE.god = 1; }); await p.waitForTimeout(400); await scan('town'); await shot('walk');
  // The walk: walk up to each person and press E.
  out.walkButtons = [];
  for (const who of ['hollis', 'pell', 'barkeep', 'crier']) {
    const n = await npc(who); await walkTo(n.x - 20, n.y + 10); out.walkButtons.push(await p.evaluate(() => HS.interact && HS.interact.label)); await press(); await closeDialog(`walk-${who}`, who === 'crier' ? 4 : 0);
  }
  for (let i = 0; i < 60 && (await st()).region !== 'acre'; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(900); out.acre = await st(); await scan('acre'); await shot('acre');
  out.acreFoes = await p.evaluate(() => HS.enemies.filter((e) => !e.dead).length);
  // The night fight: the pilot clears the Acre (god mode).
  await p.evaluate(() => { HS.game.run.auto = true; HS.DEV.speed = 2; });
  for (let i = 0; i < 300 && (await st()).scene === 'wound'; i++) { const s0 = await st(); if (s0.state === 'stig') await p.evaluate(() => HS.pickStigma(0)); else if (s0.state === 'dialog') await closeDialog('acre-d'); if (i === 20) await shot('acre-fight'); await p.waitForTimeout(400); }
  await p.evaluate(() => { HS.DEV.speed = 1; });
  out.backInTown = (await st()).scene;
  for (let i = 0; i < 40 && (await st()).state !== 'dialog'; i++) await p.waitForTimeout(100);
  out.afterScene = await closeDialog('after');
  out.walkDone = await p.evaluate(() => ({ walk: HS.qOf('walk_vael') && HS.qOf('walk_vael').st, story0: HS.qOf('story0') && HS.qOf('story0').st }));
  await p.waitForTimeout(500); await shot('vane');
  // The moor chapter: chapter 1 marked done, Vane gives chapter 2, then out through the Pilgrims' Gate.
  await p.evaluate(() => { HS.SAVE.story = 1; HS.SAVE.q.story0 = { st: 'done', step: 1, c: {} }; HS.ensureQuests(); HS.enterTown(false); HS.game.state = 'play'; HS.game.lvUp = null; });
  await p.waitForTimeout(600);
  { const n = await npc('vane'); await walkTo(n.x - 20, n.y + 10); out.vaneButton = await p.evaluate(() => HS.interact && HS.interact.label); await press(); out.ch2intro = await closeDialog('ch2'); }
  out.ch2 = await p.evaluate(() => HS.qOf('story1') && HS.qOf('story1').st);
  await p.evaluate(() => HS.startDescent()); await p.waitForTimeout(200); out.doorsSay = await p.evaluate(() => HS.game.toast && HS.game.toast.msg);
  { const g = await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'LEAVE VAEL'); return it && { x: it.x, y: it.y }; }); out.gate = !!g; if (g) { await walkTo(g.x, g.y); out.gateButton = await p.evaluate(() => HS.interact && HS.interact.label); await press(); await p.waitForTimeout(200); await shot('gate-ask'); out.gateNear = await p.evaluate(() => HS.room.interact.filter((q) => Math.hypot(q.x - HS.player.x, q.y - HS.player.y) < 60).map((q) => `${q.label}@${Math.round(Math.hypot(q.x - HS.player.x, q.y - HS.player.y))}`)); out.gateAsk = await p.evaluate(() => !!HS.game.ask); if (out.gateAsk) await p.evaluate(() => { const L = HS.askLayout(); HS.askTap(L.yes.x + 4, L.yes.y + 4); }); else await p.evaluate(() => HS.travelRegion('moor')); } }
  for (let i = 0; i < 60 && (await st()).region !== 'moor'; i++) await p.waitForTimeout(100);
  await p.waitForTimeout(800); out.moor = await p.evaluate(() => ({ region: HS.room.region, story: HS.game.run.story, npcs: HS.room.npcs.map((n) => n.talk), lore: HS.room.interact.filter((q) => q.lore).length, gather: HS.room.interact.filter((q) => q.label === 'GATHER').length }));
  await p.evaluate(() => { for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) < 600) e.dead = true; HS.game.banner = null; }); await scan('moor');
  // Wenna at the camp.
  { const n = await npc('wenna'); await walkTo(n.x - 18, n.y + 12); await shot('wenna'); out.wennaButton = await p.evaluate(() => HS.interact && HS.interact.label); await press(); await closeDialog('wenna', 1); }
  // Wenna again: her side quest.
  { const n = await npc('wenna'); await walkTo(n.x - 18, n.y + 12); await press(); await closeDialog('flock'); out.flock = await p.evaluate(() => HS.qOf('rside_flock') && HS.qOf('rside_flock').st); }
  // The landmarks: the wagons (and its lore), the barrows (the survivor), the stones; read lore at each.
  for (const k of ['wagons', 'barrows', 'circle', 'gibbet', 'cairns', 'tor']) {
    const m = await p.evaluate((k) => { const m = HS.room.marks.find((q) => q.kind === k); if (!m) return null; for (const e of HS.enemies) if (Math.hypot(e.x - m.x, e.y - m.y) < 500) e.dead = true; return { x: m.x, y: m.y }; }, k);
    if (!m) continue; await walkTo(m.x, m.y + 30); await p.waitForTimeout(400); await p.evaluate(() => { HS.game.banner = null; });
    const L = await p.evaluate((k) => { const it = HS.room.interact.find((q) => q.lore && HS.room.marks.find((mm) => mm.kind === k) && Math.hypot(q.x - HS.room.marks.find((mm) => mm.kind === k).x, q.y - HS.room.marks.find((mm) => mm.kind === k).y) < 80); return it && { x: it.x, y: it.y }; }, k);
    if (L) { await walkTo(L.x, L.y); if (k === 'circle') await shot('lore-spot'); await press(); await closeDialog(`lore-${k}`, k === 'circle' ? 1 : 0); }
    if (k === 'barrows') { const n = await npc('brask'); if (n) { await walkTo(n.x + 18, n.y + 10); await shot('brask'); await press(); await closeDialog('brask'); } }
  }
  out.steps = await p.evaluate(() => ({ ...HS.qOf('story1').c }));
  out.lore = await p.evaluate(() => Object.keys(HS.SAVE.lore || {}).length);
  // The sheep.
  for (let k = 0; k < 3; k++) { const it = await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'GATHER' && !q.done); return it && { x: it.x, y: it.y }; }); if (!it) break; await walkTo(it.x, it.y); await press(); }
  out.sheep = await p.evaluate(() => HS.qOf('rside_flock') && { ...HS.qOf('rside_flock') });
  { const n = await npc('wenna'); await walkTo(n.x - 18, n.y + 12); await press(); await closeDialog('flock-done'); out.flockDone = await p.evaluate(() => HS.qOf('rside_flock') && HS.qOf('rside_flock').st); }
  // The barrow door: into the station.
  { const m = await p.evaluate(() => { const it = HS.room.interact.find((q) => q.label === 'ENTER'); return it && { x: it.x, y: it.y }; }); if (m) { await walkTo(m.x, m.y + 4); out.doorButton = await p.evaluate(() => HS.interact && HS.interact.label); await shot('door'); await press(); } }
  for (let i = 0; i < 60 && !((await st()).scene === 'wound' && !(await st()).region); i++) await p.waitForTimeout(100);
  await p.waitForTimeout(800); out.station = await p.evaluate(() => ({ region: HS.room.region || null, story: HS.game.run && HS.game.run.story, find: !!HS.storyFind, name: HS.room.name }));
  await scan('station'); await shot('station');
  out.bad = bad;
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 4)); await b.close();
})();
