// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/soak.cjs <outDir> [seconds]
// Plays at random for a while: menu, town, dungeon, fights, dashes,
// miracles, the bag, level-up cards, pausing, dying and coming home. Every
// second it checks for page errors, NaN positions, stuck states and lists
// that keep growing.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], SECS = +(process.argv[3] || 180);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto('http://localhost:8123/?fps'); await p.waitForTimeout(900);
  const W = await p.evaluate(() => HS.W), H = await p.evaluate(() => HS.H);
  const box = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); return { l: r.left, t: r.top, k: r.width / HS.W }; });
  const tap = (x, y) => p.mouse.click(box.l + x * box.k, box.t + y * box.k);
  await p.evaluate(() => { HS.SAVE.tutorialDone = true; HS.tut.on = false; });
  await tap(W / 2, Math.round(H * 0.8)); await p.waitForTimeout(600);
  const problems = [], peak = {}, keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  let lastState = '', stateSince = Date.now(), lastPos = null, stillSince = Date.now(), shot = 0;
  const t0 = Date.now();
  for (let sec = 0; (Date.now() - t0) / 1000 < SECS; sec++) {
    const st = await p.evaluate(() => {
      const P = HS.player, bad = [];
      const num = (v) => typeof v === 'number' && isFinite(v);
      if (P && !(num(P.x) && num(P.y) && num(P.hp))) bad.push('player NaN');
      for (const e of HS.enemies) if (!(num(e.x) && num(e.y) && num(e.hp))) { bad.push(`enemy NaN ${e.type}`); break; }
      if (P && HS.room && HS.room.isSolid(Math.floor(P.x / 16), Math.floor(P.y / 16))) bad.push('player inside a wall');
      return { state: HS.game.state, scene: HS.game.scene, x: P && Math.round(P.x), y: P && Math.round(P.y), hp: P && Math.round(P.hp), bad, dropKinds: HS.drops.map((d) => d.kind + (d.item ? d.item.slot : '') + '@' + Math.round(Math.hypot(d.x - P.x, d.y - P.y)) + (HS.room.isSolid(Math.floor(d.x / 16), Math.floor(d.y / 16)) ? 'SOLID' : '')).join(' '), bag: HS.SAVE.bag ? HS.SAVE.bag.length : 0,
        sizes: { enemies: HS.enemies.length, bolts: HS.bolts.length, drops: HS.drops.length, hazards: HS.hazards.length, fx: HS.skillFx.length }, room: HS.game.curRoom && HS.game.curRoom.id, roomState: HS.game.curRoom && HS.game.curRoom.state, level: HS.game.run && HS.game.run.level, deathT: +(HS.game.deathT || 0).toFixed(2), kills: HS.game.kills, cpu: +(HS.game.cpu || 0).toFixed(1) };
    });
    for (const [k, v] of Object.entries(st.sizes)) peak[k] = Math.max(peak[k] || 0, v);
    if (st.bad.length) problems.push(`${sec}s ${st.bad.join(', ')}`);
    if (st.state !== lastState || st.state === 'play') stateSince = Date.now(); lastState = st.state;
    if (Date.now() - stateSince > 8000) { stateSince = Date.now(); problems.push(`${sec}s stuck in state ${st.state} deathT ${st.deathT} hp ${st.hp}`); await p.screenshot({ path: `${S}/shots/stuck-${shot++}.png` }); }
    const moved = lastPos && Math.hypot(st.x - lastPos[0], st.y - lastPos[1]) > 2; lastPos = [st.x, st.y];
    if (st.state !== 'play' || moved) stillSince = Date.now();
    if (Date.now() - stillSince > 6000) { stillSince = Date.now(); problems.push(`${sec}s player not moving at ${st.x},${st.y} in ${st.scene} room ${st.room}`); await p.screenshot({ path: `${S}/shots/stuck-${shot++}.png` }); }
    if (sec % 15 === 0) console.log(sec, JSON.stringify(st));
    // Act on the current state.
    if (st.state === 'title') await tap(W / 2, Math.round(H * 0.8));
    else if (st.state === 'descent') { if (Math.random() < 0.3) await p.keyboard.press('ArrowRight'); await p.keyboard.press(Math.random() < 0.85 ? 'Enter' : 'Escape'); }
    else if (st.state === 'site' || st.state === 'map') { await tap(W / 2, H / 2); }
    else if (st.state === 'dialog' || st.state === 'pause' || st.state === 'dead' || st.state === 'tally') { await tap(W / 2, H / 2); await p.waitForTimeout(300); }
    else if (st.state === 'stig') { const r = await p.evaluate(() => HS.stigLayout()[Math.floor(Math.random() * HS.stigLayout().length)]); await tap(r.x + r.w / 2, r.y + r.h / 2); }
    else if (st.state === 'inv') {
      const L = await p.evaluate(() => HS.invLayout());
      for (let i = 0; i < 3; i++) { const c = Math.floor(Math.random() * 6), r = Math.floor(Math.random() * 2); await tap(L.bag.x + c * 30 + 13, L.bag.y + r * 30 + 13); await p.waitForTimeout(80); }
      await tap(L.btnA.x + 10, L.btnA.y + 8); await p.waitForTimeout(80); await p.keyboard.press('KeyI');
    } else if (st.state !== 'play') { await p.keyboard.press('Escape'); await p.waitForTimeout(150); // any other panel (dev, settings, cells, shop...)
    } else if (st.state === 'play') {
      const k = keys[Math.floor(Math.random() * 4)];
      await p.keyboard.down(k);
      if (Math.random() < 0.4) await p.keyboard.press('Space');
      if (Math.random() < 0.3) await p.keyboard.press(['KeyQ', 'KeyF', 'KeyR'][Math.floor(Math.random() * 3)]);
      if (Math.random() < 0.05) await p.keyboard.press('KeyI');
      if (st.scene === 'town' && Math.random() < 0.05) await p.keyboard.press('KeyM');
      if (Math.random() < 0.03) await p.keyboard.press('Escape');
      await p.waitForTimeout(500); await p.keyboard.up(k);
      // Nudge progress: in town walk into the Descent; in the dungeon hop to a neighbouring room now and then.
      if (st.scene === 'town' && Math.random() < 0.25) await p.evaluate(() => { HS.player.x = HS.CATHEDRAL_X; HS.player.y = HS.room.top * 16 + 14; }).then(() => p.keyboard.press('KeyE'));
      if (st.scene === 'wound' && Math.random() < 0.2) await p.evaluate(() => { const R = HS.room, r = HS.game.curRoom; if (r.state !== 'active') { const id = r.links[Math.floor(Math.random() * r.links.length)], t = R.rooms[id]; HS.player.x = (t.cx + 0.5) * 16; HS.player.y = (t.cy + 1.5) * 16; } else { for (const e of HS.enemies) if (Math.random() < 0.3) HS.killEnemy(e, 1, 0); } });
      if (st.scene === 'wound' && Math.random() < +(process.env.SOAK_DEATH || 0.02)) await p.evaluate(() => { HS.player.hp = 1; HS.player.iframes = 0; });
      if (st.scene === 'wound' && Math.random() < 0.05) await p.evaluate(() => { if (HS.game.waystone) { HS.player.x = HS.game.waystone.x; HS.player.y = HS.game.waystone.y + 4; } }).then(() => p.keyboard.press('KeyE'));
    } else await p.waitForTimeout(400);
  }
  const caches = await p.evaluate(() => ({ text: document.querySelectorAll('canvas').length }));
  console.log('peak sizes', JSON.stringify(peak), 'canvases in DOM', caches.text);
  console.log('problems', problems.length, JSON.stringify(problems.slice(0, 20)));
  console.log('errors', errs.length, JSON.stringify([...new Set(errs)].slice(0, 6)));
  await b.close();
})();
