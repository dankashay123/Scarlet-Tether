// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round126.cjs <outDir> [WxH]
// Round 126: each premium skin's censer (anim, chain, photo in play per class), the skin's look in the shop,
// premium busts on the pause panel, rite effects in the skin's colours, Steel Chime's blades.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
const IDS = ['enlightened', 'void', 'psychedelic', 'dread', 'radiant', 'divine', 'demonic'];
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  const shot = (n, clip) => p.screenshot({ path: `${S}/shots/r126-${n}.png`, clip });
  const clip = () => p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(), k = r.width / HS.W, P = HS.player, sx = (P.x - HS.cam.x) * k + r.left, sy = (P.y - HS.cam.y) * k + r.top; return { x: Math.max(0, sx - 150), y: Math.max(0, sy - 130), width: 300, height: 190 }; });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(500);
  const run = (hero) => p.evaluate((hero) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.game.nextYard = false; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; }, hero);
  const crowd = (d = 60) => p.evaluate((d) => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const e = HS.spawnMonster('risen', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; } }, d);

  // 1. The censer per skin: its anim exists and is the one drawn; a photo per class and skin.
  out.censer = [];
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await run(hero); await p.waitForTimeout(300);
    for (const id of IDS) {
      await p.evaluate((id) => { HS.SAVE.pskins = HS.PSKINS.map((k) => k.id); HS.SAVE.pskin = id; }, id); await crowd(120);
      await p.waitForTimeout(500); if (hero === 'saint' || id === 'dread') await shot(`censer-${hero}-${id}`, await clip());
      out.censer.push(await p.evaluate(() => HS.thAnim()));
    }
    await p.evaluate(() => { HS.SAVE.pskin = null; }); out.censer.push(await p.evaluate(() => HS.thAnim()));
  }
  out.censerOk = out.censer.filter((a, i) => a === (i % 8 === 7 ? 'thurible' : `thurible_${IDS[i % 8]}`)).length === out.censer.length;
  // The shop's SKINS tab shows the censer beside the hero.
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; HS.SAVE.pskin = null; HS.openStore(3, 'play'); HS.game.store.sel = 3; }); await p.waitForTimeout(400); await shot('shop-skins'); out.shopText = await p.evaluate(() => HS.textProblems());

  // 2. Steel Chime: blades fly out (skillFx 'chime'), no bell rings, stunned foes show glints over their heads.
  await run('mendicant'); await p.evaluate(() => { HS.SAVE.pskin = null; (HS.SAVE.mrites ||= {}).m2 = 'toll'; }); await crowd(70); await p.waitForTimeout(300);
  out.chime = await p.evaluate(async () => { const n0 = HS.rings ? HS.rings.length : 0; HS.player.m2cd = 0; HS.input.m2 = true; let seen = false, rings = 0; const t0 = performance.now(); while (performance.now() - t0 < 600) { await new Promise((r) => setTimeout(r, 16)); if (HS.skillFx.some((f) => f.kind === 'chime')) seen = true; } return { seen, bound: HS.enemies.filter((e) => e.bound > 0).length }; });
  await p.evaluate(() => { HS.player.m2cd = 0; HS.input.m2 = true; }); await p.waitForTimeout(140); await shot('chime-blades', await clip()); await p.waitForTimeout(500); await shot('chime-stunned', await clip());
  // 3. Busts: each class shows its own bust per premium skin on the pause panel.
  out.busts = {};
  for (const hero of ['saint', 'mendicant', 'anchoress']) {
    await run(hero); out.busts[hero] = [];
    for (const id of IDS) { out.busts[hero].push(await p.evaluate((id) => { HS.SAVE.pskin = id; return HS.bustAnim(); }, id)); }
    await p.evaluate(() => { HS.SAVE.pskin = 'demonic'; HS.game.state = 'pause'; }); await p.waitForTimeout(300); await shot(`pause-${hero}`);
    await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.pskin = null; });
  }
  out.bustOk = Object.entries(out.busts).every(([h, L]) => L.every((a, i) => a === `portrait_${h === 'saint' ? '' : h === 'mendicant' ? 'm_' : 'a_'}${IDS[i]}`));
  // 4. Rites in the skin's colours: riteFx() and the cast ramp follow the skin; a Reckoning plays the skin's sigil.
  out.riteFx = {};
  await run('saint');
  for (const id of ['void', 'dread', 'divine']) {
    await p.evaluate((id) => { HS.SAVE.pskin = id; (HS.SAVE.rites ||= {}).m1 = 'water'; HS.SAVE.rites.pen = 'rain'; }, id); await crowd(80); await p.waitForTimeout(200);
    out.riteFx[id] = await p.evaluate((id) => ({ glow: HS.riteFx().glow === HS.RITE_FX_P[id].glow, ramp: HS.riteRamp('nails'), sigil: !!HS.SPR.fx.anims[`sigil_${id}`] }), id);
    await p.evaluate(() => { HS.player.m1cd = 0; HS.input.m1 = true; HS.player.penance = HS.T.penance.charge; HS.input.pen = true; }); await p.waitForTimeout(420); await shot(`rites-saint-${id}`, await clip());
    await p.waitForTimeout(900); await p.evaluate(() => { HS.player.rainT = 0; });
  }
  await run('anchoress'); await p.evaluate(() => { HS.SAVE.pskin = 'demonic'; }); await crowd(80);
  await p.evaluate(() => { HS.player.m1cd = 0; HS.input.m1 = true; HS.player.penance = HS.T.penance.charge; HS.input.pen = true; }); await p.waitForTimeout(420); await shot('rites-anchoress-demonic', await clip());
  out.riteFxOk = Object.entries(out.riteFx).every(([k, v]) => v.glow && v.sigil);
  if (globalThis.__more) await globalThis.__more(p, out, { run, crowd, shot, clip, IDS });
  await p.evaluate(() => { HS.SAVE.hero = 'saint'; HS.SAVE.pskin = null; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
