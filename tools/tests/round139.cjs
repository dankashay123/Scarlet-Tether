// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round139.cjs <outDir> [WxH]
// Round 139: the Descent panel's LAST RUN line (died and cleared, no text problems); the HOW TO PLAY line on a
// Reckoning's Codex card and in the Rites panel; Aspersion's burst (a nova that leaves foes where they stand); bolts
// fired during the Hundredfold count as that Reckoning (run.killBy, b.rite).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.SAVE.lvl = 60; HS.SAVE.cleared = 8; });
  // The Descent panel with a run that died, then one that cleared.
  out.desc = [];
  for (const [k, LR] of [['died', { d: 5, k: 2, t: 58, n: 412, set: 'font', died: true }], ['cleared', { d: 11, k: 1, t: 84, n: 1203, set: 'choir', died: false, auto: true }]]) {
    out.desc.push(await p.evaluate((LR) => { HS.SAVE.lastRun = LR; HS.game.descent = { i: LR.d, t: 0, stratum: LR.k }; HS.game.state = 'descent'; return new Promise((r) => setTimeout(() => { const L = HS.textAudit ? null : null; r({ line: HS.lastRunLine(LR), probs: HS.textProblems(), shown: JSON.stringify(HS.textAudit()).includes('Last run') || JSON.stringify(HS.textAudit()).includes('LAST RUN') }); }, 250)); }, LR));
    await p.screenshot({ path: `${S}/shots/r139-descent-${k}.png` });
  }
  await p.evaluate(() => { HS.game.state = 'play'; });
  // HOW TO PLAY on the Great Font's Codex card.
  out.codex = await p.evaluate(() => { const e = HS.codexList(5).find((q) => q.id === 'font'); const e2 = HS.codexList(5).find((q) => q.id === 'rain'); return { font: e && e.lines[0], rain: e2 && e2.lines[0] }; });
  // The Rites panel with the Great Font chosen: the line is drawn.
  out.rites = await p.evaluate(async () => { HS.SAVE.rites = { m1: 'water', m2: 'asperse', pen: 'font' }; HS.openRites(); HS.game.riteFocus = 'pen'; await new Promise((r) => setTimeout(r, 300)); const t = JSON.stringify(HS.textAudit()); return { tip: /stand in the pool with the foes/i.test(t), probs: HS.textProblems() }; });
  await p.screenshot({ path: `${S}/shots/r139-rites-font.png` });
  // A descent: Aspersion's burst, then the Hundredfold's bolts.
  await p.evaluate(() => { HS.game.state = 'play'; window.HS_AUTOSTIG = true; HS.SAVE.rites = { m1: 'water', m2: 'asperse', pen: 'volley' }; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; });
  await p.waitForTimeout(400);
  out.asp = await p.evaluate(async () => { const P = HS.player; const fs0 = []; for (let k = 0; k < 4; k++) { const e = HS.spawnMonster('risen', P.x + 40 + k * 8, P.y + (k % 2 ? 8 : -8), { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e6; e.speed = 0; fs0.push(e); }
    const x0 = fs0.map((e) => e.x); HS.player.m2cd = 0; HS.input.m2 = true; await new Promise((r) => setTimeout(r, 600));
    const nova = HS.skillFx.find((f) => f.kind === 'nova' && f.still); const hit = fs0.filter((e) => e.hp < e.maxHp).length, moved = Math.max(...fs0.map((e, i) => Math.abs(e.x - x0[i])));
    return { nova: !!nova || hit > 0, hit, moved: Math.round(moved), by: HS.game.run.dmgBy }; });
  out.vol = await p.evaluate(async () => { const P = HS.player; for (const e of HS.enemies) e.dead = true; for (let k = 0; k < 6; k++) { const e = HS.spawnMonster('risen', P.x + 70 + k * 10, P.y, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 30; e.speed = 0; }
    HS.game.run.killBy = {}; P.penance = 1e9; HS.input.pen = true; await new Promise((r) => setTimeout(r, 2500)); return { kind: P.penKind, tagged: HS.bolts.filter((b) => b.rite === 'volley').length, kill: HS.game.run.killBy }; });
  out.ok = out.desc.every((d) => d.shown && !d.probs.length) && /HOW TO PLAY/.test(out.codex.font || '') && !/HOW TO PLAY/.test(out.codex.rain || '') && out.rites.tip && !out.rites.probs.length && out.asp.hit > 0 && (out.vol.kill.volley || 0) > 0;
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
