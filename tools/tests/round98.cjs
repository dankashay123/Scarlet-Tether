// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round98.cjs <outDir> [WxH]
// Round 98: stat tips in the item popup and the forge's VALUES tab, Might on a rite's burns (Censer Blaze), the Codex's tile sizes,
// the BUY tab's cost rows, and the tutorial played step by step for each class (pointer, text, every step passes).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r98-${n}-${VW}.png` });
  const check = async (n, only) => { const pr = (await p.evaluate(() => HS.textProblems())).filter((q) => !only || only.test(q)).filter((q) => !/^(OFF SCREEN: \d+|[A-Z]+ [\d.]*:? ?"\d+" \/ "\d+")$/.test(q)); /* floating damage numbers */ if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.lvl = 60; HS.SAVE.embers = 60; HS.SAVE.gold = 90000; HS.SAVE.cleared = 11; HS.SAVE.equip = {}; HS.SAVE.bag = [];
    ['hood', 'mantle', 'gloves', 'bow'].forEach((sl, i) => { HS.SAVE.equip[sl] = HS.makeItem(sl, 2 + i % 2, `PIECE ${i}`, undefined, 5 + i); });
    for (let k = 0; k < 3; k++) HS.SAVE.bag.push(HS.makeItem('hood', 2, `SPARE ${k}`, undefined, 6)); HS.applyGear(); });
  // A stat tip from the item popup: the popup stays open under the tip.
  await p.evaluate(() => { HS.openInventory(); HS.game.itemPop = HS.SAVE.bag[0]; }); await p.waitForTimeout(300);
  out.popTip = await p.evaluate(() => { const r = HS.TIPS[0]; if (!r) return { none: true }; HS.onTap(r.x + 4, r.y + 4); return { k: r.k, tip: HS.game.statTip && HS.game.statTip.k, popup: !!HS.game.itemPop }; });
  await p.waitForTimeout(200); await shot('poptip'); await check('poptip');
  // The forge's VALUES rows and the BUY tab.
  out.valTip = await p.evaluate(() => { HS.game.statTip = null; HS.game.itemPop = null; HS.game.inv = null; HS.game.state = 'play'; HS.openForge(); HS.game.forge.tab = 2; return true; });
  await p.waitForTimeout(250);
  out.valTip = await p.evaluate(() => { const r = HS.TIPS[0]; if (!r) return { none: true }; HS.onTap(r.x + 20, r.y + 4); return { k: r.k, tip: HS.game.statTip && HS.game.statTip.k }; });
  await p.waitForTimeout(200); await shot('valtip'); await check('valtip');
  await p.evaluate(() => { HS.game.statTip = null; HS.game.forge.tab = 3; }); await p.waitForTimeout(250); await shot('buy'); await check('buy');
  // The Codex: tile size per section.
  out.codex = await p.evaluate(() => { HS.game.forge = null; HS.game.state = 'play'; HS.openCodex(0, 'pause'); const o = {}; for (let s = 0; s < HS.CODEX_SECS.length; s++) { HS.game.codex.sec = s; const L = HS.codexLayout(); o[HS.CODEX_SECS[s]] = `${L.cs}px ${L.list.length}/${L.per} ${L.pages}p`; } HS.game.codex.sec = 2; return o; });
  await p.waitForTimeout(250); await shot('codex-sets'); await check('codex-sets');
  await p.evaluate(() => { HS.game.codex.sec = 1; }); await p.waitForTimeout(200); await shot('codex-wardens');
  // Might on burns: Censer Blaze on a pinned dummy, burn ticks only (from 0.4 s after the cast), with and without Might III.
  const burn = (k) => p.evaluate(async (k) => { HS.SAVE.hero = 'saint'; HS.SAVE.equip = {}; const slot = ['m1', 'm2'].find((sl) => HS.riteList(sl).some((r) => r.id === 'censer'));
    HS.SAVE.rubrics = k ? [{ u: 'b1', r: 'censer', k: 'might', t: 3 }] : []; HS.SAVE.rsock = k ? { censer: ['b1', null, null] } : {}; HS.rubBuild();
    HS.SAVE.rites = { m1: slot === 'm1' ? 'censer' : 'water', m2: slot === 'm2' ? 'censer' : 'chain', pen: 'rain' }; HS.game.nextDiff = 2; HS.newRun(); HS.tut.on = false; HS.applyGear(true); HS.DEV.god = true;
    for (const e of HS.enemies) e.dead = true; HS.SAVE.lvl = 60; const P = HS.player, d = HS.spawnMonster('golem', P.x + 66, P.y, { room: HS.game.curRoom.id }); d.hp = d.maxHp = 1e12; d.spawnDelay = 0; d.state = 'move'; d.bound = 1e9; // past the thurible's orbit, inside the blaze
    const hx = d.x, hy = d.y, pin = setInterval(() => { d.x = hx; d.y = hy; P.fireCd = 9; P.m1cd = Math.max(P.m1cd, 5); P.m2cd = Math.max(P.m2cd, 5); }, 16), r0 = HS.T.crossbow.range; HS.T.crossbow.range = 0;
    await new Promise((r) => setTimeout(r, 300)); P[slot + 'cd'] = 0; HS.input[slot] = true; await new Promise((r) => setTimeout(r, 400)); const h0 = d.hp, by = d.burnRite;
    await new Promise((r) => setTimeout(r, 2400)); clearInterval(pin); HS.T.crossbow.range = r0; return { dmg: Math.round(h0 - d.hp), by, slot }; }, k);
  { const a = await burn(0), c = await burn(1); out.burn = { none: a, might3: c, k: +(c.dmg / Math.max(1, a.dmg)).toFixed(2) }; }
  // The tutorial in a descent for each class: every step shows, points at its control and passes.
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await p.evaluate((hero) => { HS.DEV.god = true; HS.SAVE.hero = hero; HS.SAVE.lvl = 1; HS.SAVE.rites = {}; HS.SAVE.mrites = {}; HS.SAVE.arites = {}; HS.game.nextDiff = 1; HS.newRun(); HS.applyGear(true); HS.game.dialog = null; HS.game.news = null; HS.game.state = 'play'; Object.assign(HS.tut, { on: true, step: 3, t: 0, flags: { moved: 0 } }); }, hero);
    const steps = [];
    for (let i = 0, last = -1; i < 40; i++) { // repeat each step's action until it passes; level-ups are closed
      await p.evaluate(() => { if (HS.game.state === 'stig') { HS.game.stig = null; HS.game.state = 'play'; } }); // a level-up card: take none
      await p.waitForTimeout(250);
      const st = await p.evaluate(() => { const s = HS.tutStep(); if (!s) return null; const r = HS.tutRect(), t = s.target && s.target !== 'act' && s.target !== 'toll' ? HS.hud[s.target] : null;
        const hit = (q) => q && q.x + q.r > r.x && q.x - q.r < r.x + r.w && q.y + q.r > r.y && q.y - q.r < r.y + r.h;
        return { state: HS.game.state, lv: HS.game.run && HS.game.run.level, step: HS.tut.step, text: HS.tutText(s), target: s.target || null, ptr: s.target ? !!(t || s.target === 'toll') : null, covers: ['joy', 'dash', 'm1', 'm2', 'pen'].filter((k) => hit(HS.hud[k])) }; });
      if (!st) break; const fresh = st.step !== last; last = st.step; if (fresh) steps.push(st);
      if (fresh && [5, 6, 8].includes(st.step)) { await shot(`tut-${hero}-${st.step}`); await check(`tut-${hero}-${st.step}`, /Skip Tutorial|\/11|Tap |Kills charge/); } // in a fight only the box's own text counts
      await p.evaluate(async (n) => { const P = HS.player;
        if (n === 3 || n === 4) { for (let k = 0; k < 4; k++) { const e = HS.enemies.find((q) => !q.dead); if (e) { e.hp = 1; HS.hurtEnemy(e, 99, false, 0, 0, 0); } else HS.game.kills++; } HS.game.kills = Math.max(HS.game.kills, 4); }
        if (n === 5) { for (let k = 0; k < 2; k++) { P.charges = 3; P.dashT = 0; HS.input.dash = true; await new Promise((r) => setTimeout(r, 450)); } }
        if (n === 6) { P.m1cd = 0; HS.input.m1 = true; }
        if (n === 7) { if (!HS.enemies.some((q) => !q.dead && Math.hypot(q.x - P.x, q.y - P.y) < 80)) { const e = HS.spawnMonster('risen', P.x + 50, P.y, { room: HS.game.curRoom.id }); e.spawnDelay = 0; e.state = 'move'; } P.m2cd = 0; HS.input.m2 = true; } // the chain and the hook need a foe in reach
        if (n === 8) { HS.input.pen = true; }
        if (n >= 9) HS.tut.t = 20; }, st.step);
    }
    await p.waitForTimeout(300);
    out[`tut_${hero}`] = { steps: steps.map((s) => `${s.state} ${s.step}${s.ptr === false ? ' NO POINTER' : ''}${s.covers.length ? ` COVERS ${s.covers}` : ''}: ${s.text}`), done: await p.evaluate(() => !HS.tut.on), end: await p.evaluate(() => [HS.game.state, HS.tut.step, JSON.stringify(HS.tut.flags), HS.player.m2cd, HS.game.scene]) };
  }
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
