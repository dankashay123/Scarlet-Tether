// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round167.cjs <outDir> [WxH]
// Round 167: stall keepers beside their stalls (the stall's button wins in front of it), no UNDEFINED toast in a story
// chapter, the locked move stick (and FOLLOWS), the Saint level bar in Vael and in a descent (with hold tips).
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [vw, vh] = (process.argv[3] || '844x390').split('x').map(Number);
const out = {};
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'], viewport: { width: vw, height: vh } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.addInitScript(() => { window.__U = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (s, ...a) { if (/undefined|NaN/i.test(String(s)) && window.__U.length < 20) window.__U.push(String(s)); return f.call(this, s, ...a); }; });
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  for (let i = 0; i < 12 && await p.evaluate(() => HS.game.state === 'dialog'); i++) { await p.mouse.click(400, 200); await p.waitForTimeout(120); }
  await p.evaluate(() => { HS.tut.on = false; HS.SAVE.tutorialDone = true; HS.SAVE.story = HS.STORY.length; HS.SAVE.descents = 30; HS.SAVE.cleared = 6; HS.ensureQuests(); HS.game.toast = null; });
  // 1. Each stall: in front of it the stall's button shows; beside its keeper, TALK.
  out.stalls = [];
  for (const [site, who] of [['stall', 'pell'], ['plush', 'plushseller'], ['ench', 'enchanter'], ['forge', 'hollis']]) {
    const r = await p.evaluate(async ([site, who]) => { const I = HS.room.interact, s = I.find((q) => q.site && q.site.id === site), n = HS.room.npcs.find((m) => m.npc === who); if (!s || !n) return { site, missing: true };
      const at = async (x, y) => { HS.player.x = x; HS.player.y = y; await new Promise((r) => setTimeout(r, 120)); const it = HS.interact; return it ? (it.who ? `TALK:${it.who.npc}` : `${it.label}:${it.site ? it.site.id : ''}`) : 'none'; };
      return { site, d: Math.round(Math.hypot(s.x - n.x, s.y - n.y)), front: await at(s.x, s.y + 8), keeper: await at(n.x + (n.x < s.x ? -8 : 8), n.y + 6) }; }, [site, who]);
    out.stalls.push(r);
  }
  await p.evaluate(() => { const s = HS.room.interact.find((q) => q.site && q.site.id === 'stall'); HS.player.x = s.x + 10; HS.player.y = s.y + 14; }); await p.waitForTimeout(400);
  await p.screenshot({ path: `${S}/shots/pell.png` });
  // 2. The Saint bar in Vael, and its hold tip.
  await p.evaluate(() => { HS.SAVE.lvl = 12; HS.SAVE.lxp = Math.floor(HS.lvNeed(12) * 0.4); HS.player.x = HS.CATHEDRAL_X; HS.player.y = 600; HS.game.toast = null; }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/shots/saintbar-town.png` });
  out.townText = await p.evaluate(() => HS.textProblems().length);
  const k = await p.evaluate(() => innerWidth / HS.W), H = await p.evaluate(() => HS.H), W = await p.evaluate(() => HS.W);
  await p.mouse.move(W / 2 * k, (H - 12) * k); await p.mouse.down(); await p.waitForTimeout(700); await p.screenshot({ path: `${S}/shots/saintbar-tip.png` }); out.tip = await p.evaluate(() => HS.game.statTip && (HS.game.statTip.title || HS.game.statTip.k)); await p.mouse.up();
  // 3. The stick: locked keeps its base; FOLLOWS slides after the thumb.
  for (const mode of ['lock', 'follow']) {
    await p.evaluate((mode) => { HS.setOpt('stick', mode); HS.game.state = 'play'; HS.game.statTip = null; }, mode);
    const J = await p.evaluate(() => ({ x: HS.hud.joy.x, y: HS.hud.joy.y }));
    await p.mouse.move((J.x + 6) * k, (J.y - 4) * k); await p.mouse.down();
    for (let i = 1; i <= 8; i++) { await p.mouse.move((J.x + 6 + i * 12) * k, (J.y - 4 - i * 4) * k); await p.waitForTimeout(16); }
    await p.waitForTimeout(100);
    out[`stick_${mode}`] = await p.evaluate((J) => ({ baseMoved: Math.round(Math.hypot(HS.stick.ox - J.x, HS.stick.oy - J.y)), mx: +HS.input.mx.toFixed(2), my: +HS.input.my.toFixed(2) }), J);
    if (mode === 'lock') await p.screenshot({ path: `${S}/shots/stick-lock.png` });
    await p.mouse.up();
  }
  await p.evaluate(() => HS.setOpt('stick', 'lock'));
  // 4. A story chapter: no UNDEFINED; the toast names the find.
  await p.evaluate(() => { window.__U.length = 0; HS.SAVE.story = 0; HS.SAVE.cleared = -1; HS.ensureQuests(); const q = HS.qOf('story0'); if (q) { q.st = 'active'; q.step = 0; } HS.game.state = 'play'; HS.startDescent(); });
  let toast = null; for (let i = 0; i < 80; i++) { await p.waitForTimeout(100); const s = await p.evaluate(() => [HS.game.state, HS.game.toast && HS.game.toast.msg]); if (s[0] === 'dialog') await p.mouse.click(400, 200); if (s[1] && !toast) toast = s[1]; }
  out.storyToast = toast; out.undefinedDrawn = await p.evaluate(() => window.__U.slice(0, 3));
  // 5. The Saint line under the descent's level bar.
  await p.evaluate(() => { HS.game.toast = null; }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/shots/saintbar-run.png`, clip: { x: vw * 0.3, y: vh * 0.8, width: vw * 0.4, height: vh * 0.2 } });
  out.runText = await p.evaluate(() => HS.textProblems().length);
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
