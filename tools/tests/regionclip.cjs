// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/regionclip.cjs [maps]
// Round 186: builds each open-world region several times and lists props that clip (HS.propClash: two pictures
// overlapping on one row or two tall ones overlapping; a person on a place's use spot). Keep it at 0.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const N = +(process.argv[2] || 4);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1200);
  const res = await p.evaluate(({ N }) => {
    const tally = {}, ex = [], per = {}; let maps = 0;
    HS.SAVE.story = 10; HS.SAVE.ending = 1; HS.SAVE.cleared = 29;
    for (const id of ['moor', 'fen', 'ash', 'salt', 'isle']) for (let i = 0; i < N; i++) {
      HS.game.nextRegion = id; HS.game.nextStory = null; HS.game.nextSeed = 4000 + i * 13; HS.game.nextStratum = 1; HS.game.nextDiff = 11;
      HS.newRun(); maps++;
      if (HS.room.region !== id) { ex.push(`${id}: not built (${HS.room.region})`); continue; }
      for (const c of HS.propClash()) { const key = `${id}: ${c.replace(/ at .*/, '')}`; tally[key] = (tally[key] || 0) + 1; per[id] = (per[id] || 0) + 1; if (ex.length < 16) ex.push(`${id} #${i}: ${c}`); }
    }
    return { maps, per, tally, ex };
  }, { N });
  console.log(JSON.stringify(res, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
