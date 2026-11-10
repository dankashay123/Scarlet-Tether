// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round60.cjs <outDir> [WxH]
// Round 60: pixel effects for the basic attacks. The Saint (muzzle flash,
// bolt trails, hit bursts) and the Mendicant (smear, shockwave, cracks) each
// fight a ring of foes; counts the effects made and photographs a few frames,
// in a set's colour too, and with LOW effects.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  for (const [hero, set] of [['saint', ''], ['saint', 'font'], ['mendicant', ''], ['mendicant', 'choir']]) {
    await p.evaluate(([hero, set]) => { HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.equip = {}; HS.game.nextMap = 'rooms'; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; if (set) HS.devSet(set, true); else HS.applyGear(true);
      HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const e = HS.spawnMonster('risen', P.x + (hero === 'saint' ? 110 : 60) + Math.cos(a) * 24, P.y + Math.sin(a) * 18, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; }
      window.__k = {}; const seen = new WeakSet(); clearInterval(window.__iv); window.__iv = setInterval(() => { for (const f of HS.pfx) if (!seen.has(f)) { seen.add(f); window.__k[f.kind] = (window.__k[f.kind] || 0) + 1; } }, 16); }, [hero, set]);
    for (let i = 0; i < 4; i++) { await p.waitForTimeout(i ? 90 : 1400); await p.screenshot({ path: `${S}/shots/r60-${hero}${set ? '-' + set : ''}-${i}.png` }); }
    out[`${hero}${set ? '-' + set : ''}`] = await p.evaluate(() => { clearInterval(window.__iv); return { kinds: window.__k, ramp: HS.shotRamp(), live: HS.pfx.length }; });
  }
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
