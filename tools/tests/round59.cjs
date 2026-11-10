// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round59.cjs <outDir> [WxH]
// Round 59: open maps (paths and clearings, no rooms). One per stratum: its
// size, zones, foes and Toll, the zone under the Saint, spawns inside their
// zone, a picture of the whole map and the view in play; and the share of
// open maps over many seeds.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  for (const st of [1, 2, 3]) {
    const r = await p.evaluate((st) => { HS.tut.on = false; HS.game.dialog = null; HS.game.nextMap = 'open'; HS.game.nextStratum = st; HS.game.nextDiff = 3; HS.game.nextOmens = []; HS.game.nextVigil = 0; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true;
      const R = HS.room; let floor = 0; for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) if (!R.solid[y][x]) floor++;
      const here = R.zone[Math.floor(HS.player.y / 16) * R.w + Math.floor(HS.player.x / 16)];
      // Foes stand in their own zone.
      const stray = HS.enemies.filter((e) => R.zone[Math.floor(e.y / 16) * R.w + Math.floor(e.x / 16)] !== e.room).length;
      return { open: R.open, zones: R.rooms.length, types: R.rooms.map((q) => q.type[0]).join(''), floor, foes: HS.enemies.length, toll: HS.game.toll.max, startZone: here === R.start.id, stray, pic: HS.mapShot(0.2) }; }, st);
    fs.writeFileSync(`${S}/shots/r59-map-s${st}.png`, Buffer.from(r.pic.split(',')[1], 'base64')); delete r.pic; out[`s${st}`] = r;
    await p.waitForTimeout(1200); await p.screenshot({ path: `${S}/shots/r59-play-s${st}.png` });
  }
  // Walk the Saint along: the current zone follows him.
  out.walk = await p.evaluate(async () => { const R = HS.room, other = R.rooms[R.rooms.length - 1]; HS.enemies.length = 0; HS.player.x = (other.cx + 0.5) * 16; HS.player.y = (other.cy + 0.5) * 16; await new Promise((r) => setTimeout(r, 400)); return { cur: HS.game.curRoom && HS.game.curRoom.id, want: other.id, known: other.known }; });
  out.share = await p.evaluate(() => { let n = 0; for (let i = 0; i < 30; i++) { HS.game.nextStratum = 1; HS.newRun(); if (HS.room.open) n++; } return n; });
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
