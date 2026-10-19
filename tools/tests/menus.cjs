// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/menus.cjs <outDir> [WxH]
// Photographs every menu window (framed by panelFrame) at one phone size;
// run it at 932x430, 844x390 and 667x375 and look for clipped text.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [w, h] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => { const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?town'); await p.waitForTimeout(1300);
  await p.evaluate(() => { HS.tut.on = false; HS.game.dialog = null; HS.game.state = 'play'; HS.SAVE.descents = 12; HS.SAVE.cleared = 9; HS.SAVE.gold = 9000; HS.SAVE.vkeys = 2; HS.SAVE.chrism = [1, 0, 2, 0];
    for (const id of ['stormHands', 'emberQuiver', 'saintTooth']) { const L = HS.LEGENDS.find((q) => q.id === id); const it = HS.makeItem(L.slot, 3, L.name, undefined, 4); it.power = id; HS.SAVE.bag.push(it); }
    for (let k = 0; k < 6; k++) HS.SAVE.bag.push(HS.rollItem(1, 5)); });
  const shots = [['inv', () => HS.openInventory()], ['altar', () => HS.openAltar()], ['altarpick', () => { HS.SAVE.altar = { known: ['stormHands', 'pallWard', 'chainHands', 'veilFont'], sockets: { vest: 'pallWard' } }; HS.applyGear(); HS.openAltar(); HS.openAltarPick('vest'); HS.game.altarPick.sel = 'stormHands'; }], ['altarpick2', () => { HS.openAltar(); HS.openAltarPick('relic'); }], ['descent', () => HS.startDescent()], ['vigil', () => HS.openVigil()], ['rites', () => HS.openRites('play')], ['censer', () => HS.openCenser('play')], ['shop', () => HS.openShop()], ['forge', () => HS.openForge()], ['canonry', () => HS.openCanonry()], ['board', () => HS.openBoard()], ['site', () => HS.openSite(HS.SITES.find((q) => q.id === 'martyr'))], ['settings', () => { HS.game.state = 'settings'; }], ['dev', () => HS.openDev()], ['plush', () => HS.openPlush()], ['pool', () => HS.openPool()], ['martyr', () => HS.openMartyr()], ['roll', () => HS.openRoll()]];
  for (const [n, f] of shots) { await p.evaluate(() => { HS.game.state = 'play'; HS.game.inv = null; }); await p.evaluate(f); await p.waitForTimeout(250); await p.screenshot({ path: `${S}/shots/m-${n}-${w}.png` }); }
  await p.evaluate(() => { HS.game.state = 'play'; HS.game.stig = { cards: HS.WOUNDS.slice(0, 3), t: 1 }; HS.game.state = 'stig'; }); await p.waitForTimeout(300); await p.screenshot({ path: `${S}/shots/m-stig-${w}.png` });
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close(); })();
