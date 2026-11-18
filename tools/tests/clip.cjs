// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/clip.cjs [maps] [strata]
// Round 159: builds many maps of both kinds and lists props that clip (HS.propClash): on a wall tile, two on one
// tile, or a shrine or chest pressed against a wall. Prints counts by kind and a few examples.
const { chromium, devices } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const N = +(process.argv[2] || 60), STRATA = (process.argv[3] || '1,2,3').split(',').map(Number);
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ ...devices['iPhone 13 landscape'] })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e.stack || e)));
  await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(900);
  const res = await p.evaluate(({ N, STRATA }) => {
    const tally = {}, ex = []; let maps = 0;
    for (let i = 0; i < N; i++) for (const k of STRATA) for (const kind of ['open', 'rooms']) {
      HS.game.nextMap = kind; HS.game.nextSeed = 9000 + i * 7 + k; HS.SAVE.stratum = k; HS.game.nextStratum = k;
      HS.newRun(); maps++;
      for (const c of HS.propClash()) { const key = c.replace(/ at .*/, ''); tally[key] = (tally[key] || 0) + 1; if (ex.length < 12) ex.push(`${kind} s${k} #${i}: ${c}`); }
    }
    return { maps, tally, ex };
  }, { N, STRATA });
  console.log(JSON.stringify(res, null, 1));
  console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
