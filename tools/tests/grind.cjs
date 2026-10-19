// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/grind.cjs [stations] [minutes per run]
// How grindy gear is: builds a real map at each Station, counts its foes by
// tier and its breakables, and works out the gear one full clear is expected
// to drop (DROP, the Station's drop multiplier, the Warden, the treasury
// chest, the Reliquary at 60%) and its rarity (rarityOdds). Reports pieces
// per run, Hallowed and set pieces per run, and runs (and hours) to finish one
// chosen six-piece set.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const stations = (process.argv[2] || '1,3,5,6,8,10,12,15').split(',').map(Number), mins = +(process.argv[3] || 7);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1500);
  const rows = [];
  for (const st of stations) {
    const r = await p.evaluate(([st]) => {
      HS.tut.on = false; HS.game.nextDiff = st - 1; HS.game.nextStratum = 1; HS.game.nextOmens = []; HS.newRun(); HS.tut.on = false;
      const df = HS.curDiff(), E = HS.enemies.filter((e) => !e.dead && !e.minion), n = (t) => E.filter((e) => (e.tier || 'common') === t).length;
      const props = HS.room.props.filter((q) => q.breakable), coffins = props.filter((q) => q.kind === 'coffin').length;
      // Sources: [expected pieces, rarity boost on top of the Station's].
      const src = [[n('common') * HS.DROP.kill, 0], [n('rare') * HS.DROP.rare, 1], [n('elite') * HS.DROP.elite, 1.5], [HS.WARDEN.items, 2], [2, 1], [3 * 0.6, 2], [coffins * 0.03 + (props.length - coffins) * 0.01, 0]];
      let items = 0, cons = 0, hal = 0, set = 0;
      for (const [k, boost] of src) { const x = k * df.drop, o = HS.rarityOdds(df.boost + boost); items += x; cons += x * (o[2] + o[3] + o[4]) / 100; hal += x * o[3] / 100; set += x * o[4] / 100; }
      return { foes: E.length, rares: n('rare'), elites: n('elite'), breakables: props.length, items: +items.toFixed(1), consecratedUp: +cons.toFixed(2), hallowed: +hal.toFixed(3), setPieces: +set.toFixed(3), mainSets: st >= HS.SET_FROM };
    }, [st]);
    // One chosen set: a set drop is that set 1 time in 5, and six different pieces are needed (5 x 6 x H6 = 73.5 set drops).
    const runsSet = r.mainSets && r.setPieces ? Math.round(73.5 / r.setPieces) : null;
    rows.push({ station: st, ...r, runsPerHallowed: r.hallowed ? +(1 / r.hallowed).toFixed(1) : null, runsForOneFullSet: runsSet, hoursForOneFullSet: runsSet ? +(runsSet * mins / 60).toFixed(1) : null });
  }
  console.table(rows.map(({ mainSets, ...q }) => q));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
