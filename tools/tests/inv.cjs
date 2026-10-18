// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/inv.cjs <outDir>
// Fills the bag, opens the inventory, wears and salvages items, and checks
// that worn stats reach the player.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2];
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(800);
  await p.evaluate(() => { HS.SAVE.bag = []; HS.SAVE.equip = {}; for (let i = 0; i < 14; i++) HS.bagAdd(HS.rollItem(i * 0.4)); HS.bagAdd(HS.makeItem('gloves', 3, 'HANDS THAT COUNTED COINS')); HS.bagAdd(HS.makeItem('seal', 4, "ODILE'S SEAL")); });
  const before = await p.evaluate(() => ({ hp: HS.player.maxHp, worn: Object.values(HS.SAVE.equip).filter(Boolean).length, bag: HS.SAVE.bag.length, dmg: HS.G.dmg }));
  console.log('after pickup', JSON.stringify(before));
  // Drop a few items on the floor to show loot beams and labels.
  await p.evaluate(() => { for (let i = 0; i < 4; i++) HS.drops.push({ kind: 'item', item: HS.makeItem(['hood', 'relic', 'mantle', 'rosary'][i], [1, 2, 3, 4][i], ['COWL OF THE FOX', 'GRAVE TOOTH', 'MANTLE OF THE NINTH WOUND', "ODILE'S BEADS"][i]), x: HS.player.x - 60 + i * 40, y: HS.player.y + 30, z: 0, vx: 0, vy: 0, vz: 0, t: 0 }); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${S}/shots/i0-drops.png` });
  await p.evaluate(() => HS.openInventory()); await p.waitForTimeout(200);
  const L = await p.evaluate(() => HS.invLayout());
  const box = await p.evaluate(() => { const r = document.getElementById('screen').getBoundingClientRect(); return { l: r.left, t: r.top, k: r.width / HS.W }; });
  const tap = async (x, y) => { await p.mouse.click(box.l + x * box.k, box.t + y * box.k); await p.waitForTimeout(150); };
  await tap(L.bag.x + 13, L.bag.y + 13);
  await p.screenshot({ path: `${S}/shots/i1-inventory.png` });
  await tap(L.btnA.x + 10, L.btnA.y + 10); // wear
  await tap(L.bag.x + 13 + 30, L.bag.y + 13);
  await p.screenshot({ path: `${S}/shots/i2-compare.png` });
  await tap(L.btnB.x + 10, L.btnB.y + 10); // salvage
  const after = await p.evaluate(() => ({ hp: HS.player.maxHp, worn: Object.values(HS.SAVE.equip).filter(Boolean).length, bag: HS.SAVE.bag.length, gold: HS.game.run.gold, dmg: HS.G.dmg, state: HS.game.state }));
  console.log('after wear+salvage', JSON.stringify(after));
  await p.keyboard.press('KeyI'); await p.waitForTimeout(100);
  console.log('closed', await p.evaluate(() => HS.game.state));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
