// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round94.cjs <outDir> [WxH]
// Round 94: caps on gear stats and affix totals (a god-roll build), Rubrics: a drop and its pickup,
// sockets and the picker in the Rites panel, Might on a rite's own damage (pools, bolts, chains), Swiftness on its cooldown.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r94-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  // Caps: every piece rolled to the top on every line.
  out.caps = await p.evaluate(() => { HS.tut.on = false; HS.SAVE.hero = 'anchoress'; HS.SAVE.lvl = 60; HS.SAVE.equip = {};
    for (const sl of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) { const it = HS.makeItem(sl, 3, 'X', ['dmg', 'crit', 'speed'].filter((k) => k !== HS.SLOT_BASE[sl]), 12); it.power = null;
      it.stats = it.stats.map(([k]) => [k, HS.qualRange(k, 3, 4)[1], 4]); it.adv = [['shard', 1], ['haste', 12]]; it.ult = [['shards', 2], ['wrath', 20]]; it.shards = 2; HS.SAVE.equip[sl] = it; }
    HS.applyGear(); const G = HS.G; return { crit: G.crit, speed: G.speed, haste: G.haste, shards: HS.shardCount(), moreK: +G.moreK.toFixed(2), ok: G.crit <= 50 && G.speed <= 40 && G.haste <= 60 && G.moreK <= 1.401 && HS.shardCount() <= 4 + 6 }; });
  // Rubrics: Might on Holy Water, Nail Storm and the Chain; damage to a held dummy over a cast, with and without.
  const riteDmg = (rite, slot, k) => p.evaluate(async ([rite, slot, k]) => { HS.SAVE.hero = 'saint'; HS.SAVE.equip = {}; for (const sl of ['hood', 'gloves', 'bow']) HS.SAVE.equip[sl] = HS.makeItem(sl, 2, 'X', undefined, 20); HS.SAVE.rubrics = k ? [{ u: 'x1', r: rite, k: 'might', t: 3 }] : []; HS.SAVE.rsock = k ? { [rite]: ['x1', null, null] } : {}; HS.rubBuild();
    HS.SAVE.rites = { m1: slot === 'm1' ? rite : 'water', m2: slot === 'm2' ? rite : 'chain', pen: 'rain' }; HS.game.nextDiff = 2; HS.newRun(); HS.tut.on = false; HS.applyGear(true); HS.DEV.god = true;
    for (const e of HS.enemies) e.dead = true; const P = HS.player, d = HS.spawnMonster('golem', P.x + 60, P.y, { room: HS.game.curRoom.id }); d.hp = d.maxHp = 1e12; d.spawnDelay = 0; d.state = 'move'; d.bound = 1e9;
    const hx = d.x, hy = d.y, pin = setInterval(() => { d.x = hx; d.y = hy; P.fireCd = 9; }, 16), r0 = HS.T.crossbow.range; HS.T.crossbow.range = 0;
    await new Promise((r) => setTimeout(r, 300)); const h0 = d.hp; P[slot + 'cd'] = 0; HS.input[slot] = true; await new Promise((r) => setTimeout(r, 2500)); clearInterval(pin); HS.T.crossbow.range = r0;
    return Math.round(h0 - d.hp); }, [rite, slot, k]);
  out.might = {}; for (const [rite, slot] of [['water', 'm1'], ['storm', 'm1'], ['chain', 'm2']]) { const a = await riteDmg(rite, slot, 0), c = await riteDmg(rite, slot, 1); out.might[rite] = { none: a, might3: c, k: +(c / Math.max(1, a)).toFixed(2) }; }
  // Swiftness shortens the cooldown; a Rubric on another rite does nothing to this one.
  out.swift = await p.evaluate(() => { HS.SAVE.rites = { m1: 'water', m2: 'chain', pen: 'rain' }; HS.SAVE.rubrics = [{ u: 's1', r: 'water', k: 'swift', t: 3 }, { u: 'm1', r: 'chain', k: 'might', t: 3 }]; HS.SAVE.rsock = { water: ['s1', null, null], chain: ['m1'] }; HS.rubBuild();
    return { waterCd: +HS.riteCdOf('m1').toFixed(2), waterMight: HS.rubK('water'), chainMight: HS.rubK('chain') }; });
  // A drop and its pickup.
  out.drop = await p.evaluate(() => { HS.game.nextDiff = 4; HS.SAVE.rubrics = []; const P = HS.player, n0 = HS.drops.length; HS.maybeRubric(P.x, P.y, 1); const d = HS.drops[HS.drops.length - 1]; return { made: HS.drops.length > n0 && d.kind === 'rubric', rub: d && d.rub }; });
  await p.waitForTimeout(1500); out.picked = await p.evaluate(() => HS.rubrics().length);
  await shot('drop');
  // The Rites panel: sockets, then the picker, then socket one by tapping.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.lvl = 60; HS.SAVE.rites = { m1: 'water', m2: 'chain', pen: 'rain' }; HS.SAVE.rubrics = [{ u: 'a', r: 'water', k: 'might', t: 2 }, { u: 'b', r: 'water', k: 'zeal', t: 1 }, { u: 'c', r: 'water', k: 'might', t: 3 }, { u: 'd', r: 'water', k: 'echo', t: 3 }]; HS.SAVE.rsock = { water: ['a', 'b', null] }; HS.rubBuild(); HS.openRites(); HS.game.riteFocus = 'm1'; });
  await p.waitForTimeout(300); await shot('rites'); await check('rites');
  out.ui = await p.evaluate(() => { const L = HS.riteLayout(), R = HS.rubGeo(L).sock(2); HS.ritesTap(R.x + 5, R.y + 5); const open = !!HS.game.rubPick; return { open }; });
  await p.waitForTimeout(250); await shot('picker'); await check('picker');
  out.ui2 = await p.evaluate(() => { const G0 = HS.rubPickGeo(); const iD = G0.list.findIndex((q) => q.u === 'd'), iC = G0.list.findIndex((q) => q.u === 'c'); HS.rubPickTap(G0.row(iD).x + 5, G0.row(iD).y + 5);
    const after = HS.rsock().water.slice(); HS.game.rubPick = { rite: 'water', j: 2 }; const G1 = HS.rubPickGeo(); HS.rubPickTap(G1.row(iC).x + 5, G1.row(iC).y + 5); return { after, clashRefused: HS.rsock().water[2] === 'd', echo: HS.rubV('water', 'echo') }; });
  console.log(JSON.stringify(out)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
