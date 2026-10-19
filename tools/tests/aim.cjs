// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/aim.cjs <outDir> [WxH]
// Drag to aim: hold a rite button, drag to aim (the outline shows from the
// Saint), release to cast that way. Dragging back to the button cancels; a
// plain tap still auto-aims. Covers every aimable rite.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], WH = (process.argv[3] || '').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const dev = devices['iPhone 13 landscape'];
  const ctx = await b.newContext(WH[0] ? { ...dev, viewport: { width: WH[0], height: WH[1] } } : dev); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const tag = WH[0] ? `-${WH[0]}` : '', out = {};
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(2500); await p.mouse.click(300, 200); await p.waitForTimeout(800);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.DEV.god = true; for (const e of HS.enemies) if (Math.hypot(e.x - HS.player.x, e.y - HS.player.y) > 260) e.dead = true; });
  // Game pixels to page pixels, so the test drives the real touch path.
  const hold = (k, dx, dy) => p.evaluate(([k, dx, dy]) => {
    const r = document.getElementById('screen').getBoundingClientRect(), B = HS.hud[k], cx = (x) => r.left + x / HS.W * r.width, cy = (y) => r.top + y / HS.H * r.height;
    HS.player.m1cd = 0; HS.player.m2cd = 0;
    HS.pointerDown(7, cx(B.x), cy(B.y)); HS.pointerMove(7, cx(B.x + dx), cy(B.y + dy));
    return !!HS.game.aim && HS.game.aim.on;
  }, [k, dx, dy]);
  const rel = () => p.evaluate(() => { HS.pointerUp(7); });
  const rites = [['m1', 'water', 30, -30], ['m1', 'wave', -40, 0], ['m1', 'storm', 0, -40], ['m1', 'step', 40, 10], ['m2', 'chain', -30, -20]];
  for (const [k, id, dx, dy] of rites) {
    await p.evaluate(([k, id]) => { HS.SAVE.rites = { ...(HS.SAVE.rites || {}), [k]: id }; }, [k, id]);
    out[id] = { aiming: await hold(k, dx, dy) };
    await p.waitForTimeout(120); await p.screenshot({ path: `${S}/shots/aim-${id}${tag}.png` });
    const before = await p.evaluate(() => ({ x: HS.player.x, y: HS.player.y }));
    await rel(); await p.waitForTimeout(250);
    out[id].fired = await p.evaluate(([k, dx, dy, b0]) => {
      const a = Math.atan2(dy, dx), P = HS.player;
      if (k === 'm1' && HS.flasks.length) { const f = HS.flasks[HS.flasks.length - 1]; return { cd: P.m1cd > 0, err: +Math.abs(Math.atan2(f.ty - P.y, f.tx - P.x) - a).toFixed(2) }; }
      const w = HS.skillFx.find((f) => f.kind === 'wave'); if (w) return { cd: P.m1cd > 0, err: +Math.abs(w.a - a).toFixed(2) };
      return { cd: (k === 'm1' ? P.m1cd : P.m2cd) > 0, moved: Math.round(Math.hypot(P.x - b0.x, P.y - b0.y)), dirErr: +Math.abs(Math.atan2(P.y - b0.y, P.x - b0.x) - a).toFixed(2) };
    }, [k, dx, dy, before]);
  }
  // Drag out then back to the button: nothing is cast.
  await p.evaluate(() => { HS.SAVE.rites.m1 = 'wave'; });
  await hold('m1', 40, 0);
  out.cancel = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), B = HS.hud.m1; HS.pointerMove(7, r.left + B.x / HS.W * r.width, r.top + B.y / HS.H * r.height); HS.pointerUp(7); return HS.input.m1; });
  // A plain tap still casts.
  out.tap = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), B = HS.hud.m1; HS.player.m1cd = 0; HS.pointerDown(8, r.left + B.x / HS.W * r.width, r.top + B.y / HS.H * r.height); HS.pointerUp(8); return HS.input.m1; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
