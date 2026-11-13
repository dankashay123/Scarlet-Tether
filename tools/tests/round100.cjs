// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round100.cjs <outDir> [WxH]
// Round 100: no stagger or execute (an elite at 5% health still fights), the Reckoning's NOT CHARGED toast, the REFORGE hint,
// hold tips with their own text on a level-up card and a Rubric row (the tap waits for release), Codex hints on unseen Wounds.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r100-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  const pt = (x, y) => p.evaluate(([x, y]) => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.left + x * c.width / HS.W, c.top + y * c.height / HS.H]; }, [x, y]);
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  // An elite hit down to 5% keeps fighting; no execute anywhere.
  out.elite = await p.evaluate(async () => { HS.SAVE.hero = 'saint'; HS.SAVE.lvl = 60; HS.game.nextDiff = 3; HS.newRun(); HS.tut.on = false; HS.DEV.god = true; for (const e of HS.enemies) e.dead = true; const P = HS.player;
    const e = HS.spawnMonster('golem', P.x + 60, P.y, { room: HS.game.curRoom.id, tier: 'elite' }); e.spawnDelay = 0; e.state = 'move'; e.hp = e.maxHp; HS.hurtEnemy(e, e.maxHp * 0.95, false, 1, 0, 0);
    await new Promise((q) => setTimeout(q, 600)); return { state: e.state, hpShare: +(e.hp / e.maxHp).toFixed(2), execBtn: !!HS.hud.exec, inputExec: 'execute' in HS.input, fn: typeof HS.execute }; });
  // The Reckoning before it is charged.
  out.pen = await p.evaluate(async () => { const P = HS.player; P.penance = 0; HS.game.noFoeT = 0; HS.game.toast = null; HS.input.pen = true; await new Promise((q) => setTimeout(q, 150)); return HS.game.toast && HS.game.toast.msg; });
  await shot('pen');
  await p.evaluate(() => { for (const e of HS.enemies) e.dead = true; HS.game.toast = null; }); await p.waitForTimeout(1600); // let the fight's numbers fade before the menus
  // The REFORGE hint.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.equip = { hood: HS.makeItem('hood', 2, 'PIECE', undefined, 6) }; HS.SAVE.bag = []; HS.applyGear(); HS.openForge(); HS.game.forge.tab = 0; });
  await p.waitForTimeout(300); await shot('hint'); await check('hint');
  // A level-up card: a quick tap picks it on release; a hold shows its tip and picks nothing.
  out.stig = {};
  await p.evaluate(() => { HS.game.forge = null; HS.game.state = 'play'; HS.game.run.level = 2; HS.game.state = 'stig'; HS.game.stig = { cards: HS.WOUNDS.filter((w) => !w.mythic && !w.rite && !w.hero && (w.max || 1) > 1).slice(0, 3), t: 5 }; });
  await p.waitForTimeout(300);
  { const r = await p.evaluate(() => HS.stigLayout()[1]), [x, y] = await pt(r.x + r.w / 2, r.y + r.h / 2);
    await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(700); out.stig.held = await p.evaluate(() => ({ state: HS.game.state, tip: HS.game.statTip && HS.game.statTip.title }));
    await shot('stig-hold'); await check('stig-hold'); await p.mouse.up(); await p.waitForTimeout(100); out.stig.afterHold = await p.evaluate(() => HS.game.state);
    await p.mouse.click(x, y); await p.waitForTimeout(100); out.stig.closeTip = await p.evaluate(() => ({ state: HS.game.state, tip: !!HS.game.statTip }));
    await p.mouse.click(x, y); await p.waitForTimeout(150); out.stig.tapped = await p.evaluate(() => HS.game.state); }
  // A Rubric row: the hold shows its tiers; a tap sockets it.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.rites = { m1: 'water', m2: 'chain', pen: 'rain' }; HS.SAVE.rubrics = [{ u: 'q1', r: 'water', k: 'might', t: 2 }, { u: 'q2', r: 'water', k: 'zeal', t: 1 }]; HS.SAVE.rsock = {}; HS.rubBuild(); HS.openRites ? HS.openRites() : HS.hubEnter('rites'); HS.game.rubPick = { rite: 'water', j: 0 }; });
  await p.waitForTimeout(300);
  { const r = await p.evaluate(() => HS.rubPickGeo().row(0)), [x, y] = await pt(r.x + 40, r.y + 8);
    await p.mouse.move(x, y); await p.mouse.down(); await p.waitForTimeout(700); out.rub = { held: await p.evaluate(() => ({ tip: HS.game.statTip && HS.game.statTip.text, socketed: (HS.SAVE.rsock.water || [])[0] || null })) };
    await shot('rub-hold'); await check('rub-hold'); await p.mouse.up(); await p.mouse.click(x, y); await p.waitForTimeout(100); await p.mouse.click(x, y); await p.waitForTimeout(150);
    out.rub.tapped = await p.evaluate(() => (HS.SAVE.rsock.water || [])[0] || null); }
  // The Codex: an unseen rite Wound and a mythic Wound explain themselves.
  out.codex = await p.evaluate(() => { HS.game.rubPick = null; HS.game.state = 'play'; HS.openCodex(4, 'pause'); const L = HS.codexLayout(), i = L.list.findIndex((q) => !q.seen && q.hint && /RITES/.test(q.hint)), j = L.list.findIndex((q) => !q.seen && q.hint && /SACRIFICE/.test(q.hint));
    HS.game.codex.sel = i; HS.game.codex.page = Math.floor(i / L.per); return { rite: i >= 0 && L.list[i].hint, mythic: j >= 0 && L.list[j].hint }; });
  await p.waitForTimeout(250); await shot('codex-hint'); await check('codex-hint');
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
