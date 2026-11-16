// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round142.cjs <outDir> [WxH]
// Round 142: Pell's stall shows the Sanctity pill (no text problems); auto sell keeps only pieces that raise Sanctity;
// picking up an upgrade says the gain; the minimap marks a chest and a shrine left behind; photos of the new pets.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const fs = require('fs');
const S = process.argv[2], [VW, VH] = (process.argv[3] || '667x375').split('x').map(Number);
fs.mkdirSync(`${S}/shots`, { recursive: true });
(async () => {
  const b = await chromium.launch(); const errs = [], out = {};
  const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
  await p.goto('http://localhost:8123/?town&dev'); await p.waitForTimeout(1500); await p.mouse.click(300, 200); await p.waitForTimeout(400);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.news = null; HS.SAVE.hero = 'saint'; HS.SAVE.equip = {}; HS.SAVE.bag = []; HS.SAVE.gold = 1e6;
    for (const s of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) HS.SAVE.equip[s] = HS.makeItem(s, 2, 'X', ['dmg'], 6); HS.applyGear(true); });
  // The stall.
  out.stall = await p.evaluate(async () => { HS.openShop(); await new Promise((r) => setTimeout(r, 400)); const t = JSON.stringify(HS.textAudit()); return { pill: /Sanctity [0-9,]+ to [0-9,]+/i.test(t), probs: HS.textProblems() }; });
  await p.screenshot({ path: `${S}/shots/r142-stall.png` });
  await p.evaluate(() => { HS.game.state = 'play'; });
  // A descent: an upgrade picked up says the gain; the minimap marks a chest and a shrine left behind.
  await p.evaluate(() => { HS.game.nextMap = 'rooms'; HS.newRun(); HS.tut.on = false; HS.game.state = 'play'; HS.DEV.god = true; HS.enemies.length = 0; HS.game.cardAt = -99; }); await p.waitForTimeout(400);
  out.toast = await p.evaluate(async () => { const it = HS.makeItem('gloves', 3, 'UP', ['dmg', 'crit'], 14); const P = HS.player; HS.drops.push({ kind: 'item', item: it, x: P.x, y: P.y, z: 0, vz: 0, t: 1 });
    await new Promise((r) => setTimeout(r, 600)); return HS.game.toast && HS.game.toast.msg; });
  // Auto sell: a better piece is kept, a worse one sold.
  out.sell = await p.evaluate(() => { HS.SAVE.autoW = { on: true, off: 2, def: 2, util: 0, sell: 3 }; const better = HS.makeItem('hood', 2, 'B', ['dmg', 'crit', 'hp'], 12), worse = HS.makeItem('hood', 0, 'W', [], 1);
    const was = HS.game.run.auto; HS.game.run.auto = true;
    const r = { better: HS.autoSellPick(better), worse: HS.autoSellPick(worse) }; HS.game.run.auto = was; return r; });
  out.marks = await p.evaluate(async () => { const R = HS.room, P = HS.player, c = R.rooms.find((q) => q.chest), s0 = R.rooms.find((q) => q.shrine); const mk = (o) => { if (o) R.seen[Math.floor(o.y / 16) * R.w + Math.floor(o.x / 16)] = 1; }; mk(c && c.chest); mk(s0 && s0.shrine);
    await new Promise((r) => setTimeout(r, 300)); return { chest: !!c, shrine: !!s0, far: c ? Math.round(Math.hypot(c.chest.x - P.x, c.chest.y - P.y)) : null }; });
  await p.screenshot({ path: `${S}/shots/r142-minimap.png`, clip: { x: VW - 330, y: 0, width: 330, height: 120 } });
  // The new pets on the bag's PETS tab.
  await p.evaluate(() => { HS.game.state = 'play'; HS.SAVE.pets = HS.PETS.map((q) => q.id); HS.SAVE.hero = 'anchoress'; HS.SAVE.petEq = { battle: ['glassmoth', 'cherub'], drop: ['rosemoth', null], show: 'cherub' }; HS.applyGear(true); HS.openInventory(); HS.game.inv.tab = 4; }); await p.waitForTimeout(500);
  await p.screenshot({ path: `${S}/shots/r142-pets.png` });
  out.ok = out.stall.pill && !out.stall.probs.length && out.sell.better === false && out.sell.worse === true && /SANCTITY IF WORN/.test(out.toast || '');
  console.log(JSON.stringify(out));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
