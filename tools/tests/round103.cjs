// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round103.cjs <outDir> [WxH]
// Round 103: pets and the shop. The lists per class (10 battle, 10 drop in all; 2 battle pets a class), free packs, a buy,
// equip (two slots a kind), the follower in town and in a fight, each pet's effect, the Tithe Cat's drops, the pause tile.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '932x430').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {}, probs = [];
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n) => p.screenshot({ path: `${S}/shots/r103-${n}-${VW}.png` });
  const check = async (n) => { const pr = await p.evaluate(() => HS.textProblems()); if (pr.length) probs.push(`${n}: ${pr.slice(0, 3).join('; ')}`); };
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1500);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.indul = 0; HS.SAVE.pets = []; HS.SAVE.petEq = null; });
  out.data = await p.evaluate(() => ({ battle: HS.PETS.filter((P) => P.kind === 'battle').length, drop: HS.PETS.filter((P) => P.kind === 'drop').length, perClass: Object.fromEntries(['saint', 'mendicant', 'anchoress'].map((h) => [h, HS.PETS.filter((P) => P.hero === h).length])),
    sprites: HS.PETS.every((P) => HS.SPR.pets.anims[P.id] && HS.SPR.pets.anims[P.id].length === 4), tile: HS.pauseLayout().tiles.some((t) => t.id === 'shop') }));
  // The shop: empty purse, a free pack, a buy, equip two, a third is refused, follow.
  out.shop = await p.evaluate(() => { const o = {}; HS.openStore(0, 'play'); const L = HS.featLayout(), tap = (r) => HS.storeTap(r.x + 5, r.y + 5), yes = () => { if (HS.game.ask) { const A = HS.askLayout(); HS.askTap(A.yes.x + 4, A.yes.y + 4); } };
    o.list = HS.storeList().map((P) => P.id); tap(L.btnB); o.poor = HS.SAVE.pets.length;
    HS.game.store.tab = 2; tap(HS.storePackRow(L, 2)); o.indul = HS.indul(); HS.game.store.tab = 0;
    for (let i = 0; i < 3; i++) { HS.game.store.sel = i; tap(L.btnB); yes(); tap(L.btnB); }
    o.owned = HS.SAVE.pets.length; o.eq = [...HS.petEq().battle]; o.left = HS.indul(); o.follower = HS.petShown();
    HS.game.store.sel = 1; tap(L.btnA); o.follow2 = HS.petShown(); HS.game.store.sel = 0; return o; });
  await p.waitForTimeout(300); await check('shop-battle'); await shot('shop-battle');
  await p.evaluate(() => { HS.game.store.tab = 1; HS.game.store.sel = 9; HS.game.store.scroll = 999; }); await p.waitForTimeout(250); await check('shop-drop'); await shot('shop-drop');
  await p.evaluate(() => { HS.game.store.tab = 2; }); await p.waitForTimeout(250); await check('shop-packs'); await shot('shop-packs');
  // The follower in town.
  await p.evaluate(() => { HS.game.state = 'play'; }); await p.waitForTimeout(900); await shot('town-pet');
  out.follow = await p.evaluate(() => ({ on: HS.PETF.on, near: Math.round(Math.hypot(HS.PETF.x - HS.player.x, HS.PETF.y - HS.player.y)) }));
  // Effects: stats from pets, then the battle pets in a fight.
  out.fx = await p.evaluate(async () => { const o = {}, own = () => { HS.SAVE.pets = HS.PETS.map((P) => P.id); }; own(); HS.SAVE.hero = 'saint'; HS.SAVE.equip = {};
    const E = HS.petEq(); E.battle = [null, null]; E.drop = [null, null]; HS.applyGear(); const g0 = { dmg: HS.G.dmg, speed: HS.G.speed, gold: HS.G.gold }, k0 = HS.setGuard();
    E.battle = ['emberimp', 'hare']; E.drop = ['magpie', null]; HS.applyGear(); o.stats = { dmg: HS.G.dmg - g0.dmg, speed: HS.G.speed - g0.speed, gold: HS.G.gold - g0.gold };
    E.battle = ['cherub', 'lamb']; HS.applyGear(); o.guard = +(HS.setGuard() / k0).toFixed(2);
    HS.game.nextDiff = 2; HS.newRun(); HS.tut.on = false; HS.applyGear(true); HS.DEV.god = true; for (const e of HS.enemies) e.dead = true; const P = HS.player;
    const d = HS.spawnMonster('golem', P.x + 50, P.y, { room: HS.game.curRoom.id }); d.hp = d.maxHp = 1e9; d.spawnDelay = 0; d.state = 'move'; d.bound = 1e9; const pin = setInterval(() => { P.fireCd = 9; }, 16), r0 = HS.T.crossbow.range;
    E.battle = ['nailfinch', 'censermouse']; E.show = 'censermouse'; HS.applyGear(true); P.hp = P.maxHp; const h0 = d.hp; await new Promise((q) => setTimeout(q, 3600)); o.finchAndMouse = { dmg: Math.round(h0 - d.hp), burning: d.burn > 0 };
    E.battle = ['lamb', null]; P.hp = P.maxHp * 0.5; const hp0 = P.hp; await new Promise((q) => setTimeout(q, 4600)); o.lambHeal = +((P.hp - hp0) / P.maxHp).toFixed(3); clearInterval(pin);
    HS.SAVE.hero = 'anchoress'; HS.newRun(); HS.tut.on = false; E.battle = [null, null]; HS.applyGear(true); const s0 = HS.shardCount(); E.battle = ['glassmoth', null]; o.moth = [s0, HS.shardCount()]; return o; });
  // The Tithe Cat: rates over many rolls; nothing without the cat; a drop is picked up.
  out.cat = await p.evaluate(async () => { const E = HS.petEq(), roll = (ch) => { const n0 = HS.drops.length; for (let i = 0; i < 4000; i++) HS.maybeIndul({ x: 0, y: 0 }, ch); const n = HS.drops.length - n0; HS.drops.length = n0; return n / 4000; };
    E.drop = [null, null]; const none = roll(1); E.drop = ['tithecat', null]; const r = { none, warden: roll(HS.INDUL_DROP.warden), elite: roll(HS.INDUL_DROP.elite), other: roll(HS.INDUL_DROP.other) };
    const P = HS.player, i0 = HS.indul(); HS.drops.push({ kind: 'indul', x: P.x + 8, y: P.y, z: 0, vx: 0, vy: 0, vz: 0, t: 1 }); await new Promise((q) => setTimeout(q, 1200)); r.picked = HS.indul() - i0; return r; });
  await p.evaluate(() => { const E = HS.petEq(); E.battle = ['glassmoth', 'votivewisp']; E.show = 'votivewisp'; HS.PETF.on = false; }); await p.waitForTimeout(700); await shot('fight-pet');
  console.log(JSON.stringify(out, null, 1)); console.log('text problems', probs.length, probs.slice(0, 6));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
