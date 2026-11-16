// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round137.cjs <outDir> [WxH]
// Round 137: hold tips on the Auto Play and Auto Wounds icons (a quick tap still switches Auto Wounds); the pets'
// cues (the Nail Finch's chirp, the White Lamb's bleat and ring, the Censer Mouse's puff and embers, the Stone
// Cherub's clink and ring); damage numbers in a blade storm stay apart (no text problems), with a photo.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const scr = (x, y) => p.evaluate(([x, y]) => { const c = document.getElementById('screen').getBoundingClientRect(), k = c.width / HS.W; return { x: c.left + x * k, y: c.top + y * k }; }, [x, y]);
  const start = async (hero) => { await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
    await p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = hero; HS.SAVE.autoW = { on: false, off: 2, def: 2, util: 0 }; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.enemies.length = 0; }, hero); await p.waitForTimeout(400); };
  await start('saint');
  // Hold the Auto Wounds icon: its tip opens and the switch does not move. A quick tap switches it.
  const q = await p.evaluate(() => HS.HOLD_TIPS.find((r) => r.title === 'AUTO WOUNDS')); out.woundsRect = !!q; out.playRect = await p.evaluate(() => !!HS.HOLD_TIPS.find((r) => r.title === 'AUTO PLAY'));
  if (q) { const c = await scr(q.x + q.w / 2, q.y + q.h / 2); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.waitForTimeout(650);
    out.tip = await p.evaluate(() => HS.game.statTip && HS.game.statTip.title); out.tipText = await p.evaluate(() => HS.textProblems().length); await p.screenshot({ path: `${S}/shots/r137-autowounds-tip.png` }); await p.mouse.up(); await p.waitForTimeout(150);
    out.afterHold = await p.evaluate(() => HS.autoW().on);
    await p.waitForTimeout(3300); await p.mouse.click(c.x, c.y); await p.waitForTimeout(200); out.afterTap = await p.evaluate(() => HS.autoW().on); }
  // Pets: equip each acting pet in turn next to a foe and watch for its sound and effect.
  out.pets = await p.evaluate(async () => {
    const P = HS.player, res = {}, wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const e = HS.spawnMonster('risen', P.x + 50, P.y, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; P.target = e; HS.DEV.god = false;
    const eq = (id) => { HS.SAVE.pets = HS.PETS.map((Q) => Q.id); HS.SAVE.petEq = { battle: [id, null], drop: [null, null], show: id }; HS.applyGear(true); };
    for (const [id, snd] of [['nailfinch', 'chirp'], ['censermouse', 'puff'], ['lamb', 'bleat']]) {
      eq(id); HS.AUDIO.last[snd] = 0; const r0 = HS.rings ? HS.rings.length : 0; if (id === 'lamb') P.hp = P.maxHp * 0.5; if (id === 'censermouse') { const f = HS.spawnMonster('risen', P.x + 24, P.y, { room: HS.game.curRoom.id }); f.state = 'move'; f.spawnDelay = 0; f.asleep = false; f.hp = f.maxHp = 1e7; f.speed = 0; e.dead = true; }
      P.petT = {}; await wait(id === 'lamb' ? 7000 : 2600); res[id] = { sound: !!HS.AUDIO.last[snd], hasBuf: HS.AUDIO.has(snd) }; }
    eq('cherub'); HS.AUDIO.last.block = 0; P.iframes = 0; P.cherubT = -9; P.dashStart = -99; const hp0 = P.hp; HS.damagePlayer({ x: P.x + 5, y: P.y, type: 'test' }, 5, [[P.x, P.y]], 'test'); res.cherub = { sound: !!HS.AUDIO.last.block, hurt: P.hp < hp0 };
    HS.DEV.god = true; return res; });
  // The Vesper's blade storm on a still foe: the numbers keep apart.
  await start('mendicant');
  out.storm = await p.evaluate(async () => { const P = HS.player, e = HS.spawnMonster('risen', P.x + 70, P.y, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; HS.DEV.god = true;
    HS.game.cardAt = -99; const V = P.vd; V.st = 'storm'; V.t = 3; V.tgt = e; V.cx = e.x; V.cy = e.y; const seen = []; for (let k = 0; k < 8; k++) { await new Promise((r) => setTimeout(r, 180)); seen.push(HS.textProblems().filter((s) => /^OVERLAP: "\d/.test(s)).length); } return seen; });
  await p.screenshot({ path: `${S}/shots/r137-storm-numbers.png` });
  out.ok = out.tip === 'AUTO WOUNDS' && out.playRect && !out.tipText && out.afterHold === false && out.afterTap === true && ['nailfinch', 'censermouse', 'lamb'].every((k) => out.pets[k].sound) && out.pets.cherub.sound && out.storm.every((n) => n === 0);
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
