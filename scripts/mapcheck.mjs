// Bundles the map generator + checker with esbuild and runs it in node.
import { build } from 'esbuild';
const out = 'node_modules/.cache/mapcheck.mjs';
await build({ entryPoints: ['src/dev/mapcheck.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { checkMany } = await import('../' + out + '?t=' + Date.now());
const res = checkMany(Number(process.argv[2] || 200));
console.log(`maps: ${res.n}, templates: ${res.templates}, avg rooms per map: ${res.avgRooms.toFixed(1)}, maps with problems: ${res.fails.length}`);
const tally = new Map();
for (const f of res.fails) for (const u of f.unreachable) tally.set(`${u.what} in ${u.room}`, (tally.get(`${u.what} in ${u.room}`) || 0) + 1);
for (const [k, v] of [...tally.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v}x  ${k}`);
process.exit(res.fails.length ? 1 : 0);
