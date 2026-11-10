// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round61.cjs <outDir> [WxH]
// Round 61: pixel effects on the rites. Every rite of both heroes is cast in a
// crowd; counts the effects each one makes (rune circles, beams, flames,
// shockwaves, bursts, cracks) and photographs some of them.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
const SHOOT = ['censer', 'pillars', 'rain', 'shackle', 'cinderslam', 'toll', 'hammer', 'tolling', 'ward'];
(async () => {
  const b = await chromium.launch(); const errs = [], out = { saint: {}, mendicant: {} };
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  for (const hero of ['saint', 'mendicant']) {
    await p.evaluate((hero) => { HS.tut.on = false; HS.game.dialog = null; HS.SAVE.lvl = 60; HS.SAVE.hero = hero; HS.SAVE.rites = {}; HS.SAVE.mrites = {}; HS.game.nextMap = 'rooms'; HS.game.nextStratum = 1; HS.game.nextDiff = 2; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; }, hero);
    await p.waitForTimeout(600);
    const list = await p.evaluate(() => ['m1', 'm2', 'pen'].flatMap((s) => HS.riteList(s).map((r) => [s, r.id])));
    for (const [slot, id] of list) {
      await p.evaluate(([slot, id, hero]) => { HS.enemies.length = 0; const P = HS.player; for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, d = 40 + (k % 3) * 22; const e = HS.spawnMonster('risen', P.x + 30 + Math.cos(a) * d, P.y + Math.sin(a) * d * 0.7, { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 1e7; e.speed = 0; }
        HS.SAVE[hero === 'mendicant' ? 'mrites' : 'rites'][slot] = id; P.m1cd = P.m2cd = 0; P.penance = HS.T.penance.charge; P.rainT = 0; P.fireCd = 99;
        window.__k = {}; const seen = new WeakSet(); clearInterval(window.__iv); window.__iv = setInterval(() => { for (const f of HS.pfx) if (!seen.has(f)) { seen.add(f); window.__k[f.kind] = (window.__k[f.kind] || 0) + 1; } }, 16);
        HS.input[slot] = true; }, [slot, id, hero]);
      await p.waitForTimeout(slot === 'pen' ? 1200 : 600);
      if (SHOOT.includes(id)) await p.screenshot({ path: `${S}/shots/r61-${hero}-${id}.png` });
      out[hero][id] = await p.evaluate(() => { clearInterval(window.__iv); HS.player.rainT = 0; return Object.entries(window.__k).map(([k, n]) => `${k}${n}`).join(' '); });
    }
  }
  out.noRune = Object.entries({ ...out.saint, ...out.mendicant }).filter(([, v]) => !/rune/.test(v)).map(([k]) => k);
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
