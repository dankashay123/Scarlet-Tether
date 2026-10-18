# Hollow Saint: notes for Claude

A top-down pixel auto-shooter for iPhone landscape, in one file with no build
step. Read `docs/HANDOFF.md` first: it holds the current state, what comes
next, and the owner's preferences.

## Where things are

| Path | What |
|---|---|
| `index.html` | The whole game (about 2,600 lines, Canvas 2D). The `T` table at the top holds tuning (`T.viewH` = 430, the view height); `WS = 1.3` is the world scale |
| `assets/sprites/*.png`, `sprites.json` | Generated sheets (committed). Never edit them by hand |
| `tools/sprites.mjs` | Builds every sheet. Older hand-drawn art lives here; sculpted models override it by anim name |
| `tools/sdf.mjs` | The sculpted pixel-art renderer (SDF shapes, smooth union, lighting, palette banding, outlines) |
| `tools/models/*.mjs` | Model sets: `base` (materials + Saint model), `saint`, `common`, `rare`, `elite`, `townfolk`, `town`, `dungeon`, `floor` (flagstones, water), `vfx` (effects, icons, loot, HUD sound icon), `props` (3/4-view furniture, pilasters, floor bits, HUD buttons), `weapon` (the floating crossbow, 16 angles) |
| `assets/audio/*.mp3` | Sound effects, music and ambience (committed). Rebuilt by `tools/build-audio.sh <src>` from the packs in `docs/CREDITS.md` |
| `docs/CREDITS.md` | Every asset source and licence. Add to it when you add an asset |
| `docs/ART_COMPARISON.md` | Otherworld Legends vs our art: the gap list |
| `tools/palette.mjs` | Master palette: 24 ramps × 9 steps. Every pixel must be on it |
| `tools/preview.mjs` | Render one model set to a PNG for review |
| `tools/tests/*.cjs` | Playwright checks (see below) |
| `docs/GDD.md` | Design bible (source of truth) + the v5 art spec |
| `docs/COMBAT.md` | Rooms, 30 monsters, affixes, loot, town layout |
| `docs/ROADMAP.md` | Vertical-slice checklist |

## Commands

```sh
node tools/sprites.mjs                                   # rebuild all sheets (~8 s)
node tools/preview.mjs tools/models/rare.mjs out.png 4   # preview one set at 4x; optional 4th arg filters anim names
python3 -m http.server 8123                              # serve; open /?town, /?run, /?fps
node tools/tests/dun.cjs <outDir>     # dungeon: start room, fight, rare+elite packs
node tools/tests/all.cjs <outDir>     # spawns all 30 monsters with affixes
node tools/tests/floor.cjs <outDir>   # clears a full floor through the Waystone to the tally
node tools/tests/town.cjs <outDir>    # tour of Vael's districts
node tools/tests/e2e.cjs <outDir>     # menu → town → tutorial → dungeon → death
node tools/tests/maps.cjs [n]         # builds n floors; every room reachable, spawn clear (no screenshots)
node tools/tests/inv.cjs <outDir>     # bag, wear, sell, loot labels
node tools/tests/stig.cjs <outDir>    # level-up cards and every Stigmata skill at once
node tools/tests/descent.cjs <outDir> # town minimap, full map, a locked site, descent panel and difficulty
SOAK_DEATH=0.04 node tools/tests/soak.cjs <outDir> 300   # 5 min of random play: errors, NaN, stuck states, walls
node tools/tests/err.cjs              # prints page errors and state
node tools/sprites.mjs --audit        # lists any animation still drawn by the old hand-drawn code
```

Each test writes screenshots to `<outDir>/shots/` and prints `errors 0 []` when clean. `?fps` shows frames per second and the ms our own code takes per frame. Look at the screenshots yourself; the user cares most about how it looks.

## Conventions

- **Art rules (from the owner):**
  - No visible separation of body parts: build forms with smooth union (`k` ≈ 1–2).
  - Lit from the top-left.
  - Hand-place eyes with `dot()`.
  - Use `folds()` on cloth and `bumpy()` on flesh and stone.
  - No dithering mush and nothing that looks AI-made.
  - Every pixel must be on the palette.
  - Characters face right; the engine flips them.
  - Every character frame sets `ax`/`ay` at the feet.
  - Furniture is drawn in 3/4 view: pass `tilt` (about 0.3 to 0.6), `tiltY` (the ground line) and `tiltLift` to `render()` so the top face shows (see `tools/models/props.mjs`).
- **Model sets:** a set exports `{ sheetName: { animName: () => frames } }`. `sprites.mjs` loads it automatically if its name is in the list near the top. Monster anims are `<id>_walk` (4 frames) and `<id>_attack` (2 frames, or 3 = windup, windup2, strike).
- **World units:** distances in `index.html` are world pixels at the v5 scale. Any new size or range should already include the ×1.3 scale. MON stats are written at the old scale and multiplied by `WS` in a loop after the table.
- **Floor tiles:** stay 16 px (`TILE`). Back walls are 3 tiles tall plus a cap: `hall.wall` = [top, cap, upper, lower, mid].
- **Shipping:** work on a branch, then push to `master`. The owner asked for every finished round to go to master; GitHub Pages deploys from it. End commits with the attribution lines the session asks for.
- **Writing style:** keep docs and code comments plain and short.
