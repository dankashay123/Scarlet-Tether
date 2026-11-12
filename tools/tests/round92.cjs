// Playwright check. Serve the repo on :8123 first (python3 -m http.server 8123).
// Usage: node tools/tests/round92.cjs <outDir> [WxH]
// Round 92: the Shattered Reliquary's 4 pieces raise damage with every shard above 4 (dummy held in place,
// so knockback cannot carry it out of range), its card shows the bonus now; the Veiled Lantern's fire burns
// for a share of the hit that lit it.
const { chromium } = (() => { try { return require('/opt/node-tools/node_modules/playwright'); } catch { return require('playwright'); } })();
const S = process.argv[2], [VW, VH] = (process.argv[3] || '844x390').split('x').map(Number);
(async () => {
  const b = await chromium.launch(); const errs = [], out = { reliq: [] }, probs = [];
  const run = async (o) => { const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })).newPage(); p.on('pageerror', (e) => errs.push(String(e.stack || e).slice(0, 400)));
    await p.goto('http://localhost:8123/?run'); await p.waitForTimeout(1200);
    const r = await p.evaluate(async ([set, pieces, extra, secs]) => { window.HS_AUTOSTIG = true; HS.tut.on = false; HS.DEV.god = true; HS.SAVE.hero = 'anchoress'; HS.SAVE.lvl = 60; HS.SAVE.talents = {}; HS.SAVE.passives = [];
      HS.SAVE.equip = {}; for (const s of ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver']) HS.SAVE.equip[s] = HS.makeItem(s, 2, 'X', undefined, 6);
      HS.VSETS[set].slots.slice(0, pieces).forEach((s) => { const it = HS.makeItem(s, 4, 'X', undefined, 6); it.set = set; HS.SAVE.equip[s] = it; });
      HS.game.nextDiff = 5; HS.newRun(); HS.tut.on = false; HS.applyGear(true); HS.G.shards = (HS.G.shards || 0) + extra;
      for (const e of HS.enemies) e.dead = true; const P = HS.player, d = HS.spawnMonster('risen', P.x + 70, P.y, { room: HS.game.curRoom.id }); d.hp = d.maxHp = 1e12; d.spawnDelay = 0; d.state = 'move'; d.bound = 1e9;
      const hx = d.x, hy = d.y, pin = setInterval(() => { d.x = hx; d.y = hy; }, 16);
      await new Promise((r) => setTimeout(r, 1500)); const h0 = d.hp, t0 = HS.game.time; await new Promise((r) => setTimeout(r, secs * 1000)); clearInterval(pin);
      const piece = Object.values(HS.SAVE.equip).find((it) => it.set === set);
      return { set, pieces, shards: HS.shardCount(), dps: Math.round((h0 - d.hp) / (HS.game.time - t0)), lampDps: Math.round(d.lampDps || 0), card: piece ? HS.setLines(piece).map(([t]) => t).join(' | ') : '' }; }, [o.set, o.pieces, o.extra, o.secs]);
    await p.screenshot({ path: `${S}/shots/r92-${o.set}${o.pieces}-${r.shards}-${VW}.png` }); await p.close(); return r; };
  for (const [pieces, extra] of [[3, 6], [4, 0], [4, 6]]) out.reliq.push(await run({ set: 'reliquary', pieces, extra, secs: 8 }));
  out.lantern = [await run({ set: 'lantern', pieces: 1, extra: 0, secs: 6 }), await run({ set: 'lantern', pieces: 6, extra: 0, secs: 6 })];
  const R = out.reliq; out.ok = { fourBeatsThree: R[2].dps > R[0].dps * 1.8, moreShardsMore: R[2].dps > R[1].dps * 1.5, cardNow: /NOW \+120%/.test(R[2].card), lampBurns: out.lantern[1].lampDps > 5 };
  console.log(JSON.stringify(out)); console.log('errors', errs.length, errs.slice(0, 3)); await b.close();
})();
