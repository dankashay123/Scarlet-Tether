// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round138.cjs <outDir> [WxH]
// Round 138: the minimap's edge arrow toward a Warden out of its view (and the Waystone after); the quiet pet and buff
// sounds (VOL under a menu tap); the run's damage and kills by source (run.dmgBy, run.killBy).
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  await p.evaluate(() => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; HS.game.cardAt = -99; });
  await p.waitForTimeout(400);
  // A Warden far from the Saint: the minimap shows an arrow on its edge. Count gold/red pixels near the edge facing it.
  const probe = (tag) => p.evaluate(async (tag) => { await new Promise((r) => setTimeout(r, 300)); const M = HS.hud.minimap, c = document.getElementById('screen'), k = c.width / HS.W, g = c.getContext('2d');
    const T = tag === 'stone' ? HS.game.waystone : HS.game.warden, P = HS.player, dx = T.x - P.x, dy = T.y - P.y;
    const d = g.getImageData(Math.round(M.x * k), Math.round(M.y * k), Math.round(M.w * k), Math.round(M.h * k)).data; let hot = 0, side = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], bb = d[i + 2], px = (i / 4) % Math.round(M.w * k), py = Math.floor(i / 4 / Math.round(M.w * k));
      const warm = tag === 'stone' ? bb > 180 && gg > 150 && r < 200 : r > 200 && bb < 120 && (gg < 90 || gg > 150); if (!warm) continue; hot++;
      const ex = px / k - M.w / 2, ey = py / k - M.h / 2; if (Math.sign(ex) === Math.sign(dx) && Math.abs(ex) > M.w / 2 - 12 || Math.sign(ey) === Math.sign(dy) && Math.abs(ey) > M.h / 2 - 12) side++; }
    return { hot, side }; }, tag);
  await p.evaluate(() => { const P = HS.player; HS.spawnWarden(); const w = HS.game.warden; w.x = P.x + 900; w.y = P.y + 260; w.speed = 0; w.asleep = true; w.state = 'idle'; });
  out.warden = await probe('warden'); await p.screenshot({ path: `${S}/shots/r138-minimap-warden.png`, clip: { x: VW - 330, y: 0, width: 330, height: 120 } });
  await p.evaluate(() => { const w = HS.game.warden; HS.game.waystone = { x: w.x, y: w.y }; w.dead = true; HS.game.warden = null; });
  out.stone = await probe('stone'); await p.screenshot({ path: `${S}/shots/r138-minimap-stone.png`, clip: { x: VW - 330, y: 0, width: 330, height: 120 } });
  // Damage and kills by source.
  out.by = await p.evaluate(async () => { HS.game.waystone = null; const P = HS.player; for (let k = 0; k < 6; k++) { const e = HS.spawnMonster('risen', P.x + 40 + k * 6, P.y + (k % 2 ? 10 : -10), { room: HS.game.curRoom.id }); e.state = 'move'; e.spawnDelay = 0; e.asleep = false; e.hp = e.maxHp = 5; }
    await new Promise((r) => setTimeout(r, 2500)); return { dmg: HS.game.run.dmgBy, kill: HS.game.run.killBy }; });
  out.ok = out.warden.side > 4 && out.stone.side > 4 && out.by.kill && Object.values(out.by.kill).reduce((a, b) => a + b, 0) > 0;
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
