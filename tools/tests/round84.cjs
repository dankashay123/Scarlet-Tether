// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round84.cjs <outDir> [WxH]
// Round 84: the Codex (five sections, seen and unseen entries, cards, pages), kills and
// Wounds counted, Warden trophies (a new Station adds one), the Vigil Roll's TROPHIES button.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r84-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 4).join('; ')}`); };
  const tap = async (x, y) => { const k = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { l: c.left, t: c.top, kx: c.width / HS.W, ky: c.height / HS.H }; }); await p.touchscreen.tap(k.l + x * k.kx, k.t + y * k.ky); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    const o = out[hero] = {};
    await p.evaluate((hero) => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.SAVE.codex = null; HS.SAVE.trophies = null; HS.applyGear();
      HS.game.nextStratum = 1; HS.game.nextDiff = 6; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; window.HS_AUTOSTIG = true; }, hero);
    await p.waitForTimeout(400);
    // Kills count per monster; a Wound taken counts; a found set piece and Hallowed piece count once.
    o.counts = await p.evaluate(() => { const P = HS.player; for (const id of ['risen', 'risen', 'crawler']) { const e = HS.spawnMonster(id, P.x + 30, P.y, { room: HS.game.curRoom.id }); HS.killEnemy(e, 1, 0); }
      HS.game.run.pending = 1; HS.openStigmata();
      const L = HS.codexList(3)[0], st = HS.codexList(2)[0]; const a = HS.makeItem('hood', 4, 'X', undefined, 7); a.set = st.id; HS.bagAdd(a); HS.bagAdd(a);
      const C = HS.SAVE.codex; return { risen: C.m.risen, crawler: C.m.crawler, wounds: Object.values(C.w).reduce((x, y) => x + y, 0), set: C.s[st.id] }; });
    // Trophies: a first kill at VII is new, a slower one there is not, a faster one keeps the better time, VIII is new.
    o.trophy = await p.evaluate(() => { const w = HS.codexList(1)[0].id, e = (secs) => ({ type: w, bornT: HS.game.time - secs });
      const r = [HS.wardenTrophy(e(90), { n: 7 }), HS.wardenTrophy(e(120), { n: 7 }), HS.wardenTrophy(e(61), { n: 7 }), HS.wardenTrophy(e(200), { n: 8 }), HS.wardenTrophy(e(50), { n: 3, vigil: 12 })];
      return { r, t: HS.SAVE.trophies[w] }; });
    // Seen a spread of entries for the photos.
    await p.evaluate(() => { for (let sec = 0; sec < 5; sec++) HS.codexList(sec).forEach((q, i) => { if (i % 3 !== 1) HS.codexSee(['m', 'x', 's', 'h', 'w'][sec], q.id, 3 + i); }); HS.game.state = 'pause'; });
    for (let sec = 0; sec < 5; sec++) {
      await p.evaluate((sec) => HS.openCodex(sec, 'pause'), sec); await p.waitForTimeout(250);
      const L = await p.evaluate(() => { const L = HS.codexLayout(); return { n: L.list.length, per: L.per, pages: L.pages, cells: [0, 1, 2].map((j) => L.cell(j)), next: L.next }; });
      (o.secs ||= []).push(`${L.n}/${L.per}/${L.pages}`);
      await check(`${hero} sec ${sec} empty`);
      for (const j of [0, 1, 2]) { await tap(L.cells[j].x + 10, L.cells[j].y + 10); await p.waitForTimeout(120); await check(`${hero} sec ${sec} entry ${j}`); if (j === 0 && (hero === 'saint' || sec === 1)) await shot(`${hero}-${sec}`); }
      if (L.pages > 1) { await tap(L.next.x + 20, L.next.y + 9); await p.waitForTimeout(120); o.paged = await p.evaluate(() => HS.game.codex.page); await check(`${hero} sec ${sec} page 2`); }
    }
    // Every entry's card fits (no text problems on any of them).
    o.cards = await p.evaluate(() => { let bad = 0, n = 0; for (let sec = 0; sec < 5; sec++) { HS.game.codex.sec = sec; const L = HS.codexLayout(); for (let i = 0; i < L.list.length; i++) { HS.game.codex.page = Math.floor(i / L.per); HS.game.codex.sel = i; n++; if (HS.textProblems().length) bad++; } } return { n, bad }; });
    await tap(3, 3); await p.waitForTimeout(150); o.back = await p.evaluate(() => HS.game.state);
  }
  // The pause tile and the Vigil Roll's button.
  await p.evaluate(() => { HS.game.state = 'pause'; }); await p.waitForTimeout(300); await shot('pause'); await check('pause');
  const tile = await p.evaluate(() => HS.pauseLayout().tiles.find((t) => t.id === 'codex')); await tap(tile.x + tile.w / 2, tile.y + tile.h / 2); await p.waitForTimeout(200);
  out.tile = await p.evaluate(() => HS.game.state);
  await p.evaluate(() => { HS.game.state = 'roll'; }); await p.waitForTimeout(300); await shot('roll'); await check('roll');
  const rb = await p.evaluate(() => HS.rollTrophyBtn()); await tap(rb.x + rb.w / 2, rb.y + rb.h / 2); await p.waitForTimeout(200);
  out.roll = await p.evaluate(() => [HS.game.state, HS.game.codex.sec, HS.game.codex.back]);
  console.log(JSON.stringify(out));
  console.log(probs.length ? `text problems ${probs.length}\n${probs.join('\n')}` : 'text problems 0');
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
