# Hollow Saint: notes for Claude

A top-down pixel auto-shooter for iPhone landscape, in one file with no build
step. Read `docs/HANDOFF.md` first: it holds the current state, the
owner's preferences and a prioritised list of ideas to tackle next.

## Where things are

| Path | What |
|---|---|
| `index.html` | The whole game (about 3,850 lines, Canvas 2D). The `T` table at the top holds tuning (`T.viewH` = 305, the view height; matches the Otherworld Legends phone camera); `WS = 1.3` is the world scale |
| `assets/sprites/*.png`, `sprites.json` | Generated sheets (committed). Never edit them by hand |
| `tools/sprites.mjs` | Builds every sheet. Older hand-drawn art lives here; sculpted models override it by anim name |
| `tools/sdf.mjs` | The sculpted pixel-art renderer (SDF shapes, smooth union, lighting, palette banding, outlines). `setRes(2)` renders on a 2x2 grid |
| `tools/chunky.mjs` | Snaps any frame to the 2x2 chunky grid (the Otherworld Legends blocky look); run on every sheet except `ui` |
| `tools/models/*.mjs` | Model sets: `base` (materials + Saint model), `saint`, `common`, `rare`, `elite`, `townfolk`, `town`, `dungeon`, `floor` (flagstones, water), `vfx` (effects, icons, loot, HUD sound icon), `props` (3/4-view furniture, pilasters, floor bits, HUD buttons), `weapon` (the floating crossbow, 16 angles), `street` (town street props and ground decals) |
| `assets/audio/*.mp3` | Sound effects, music and ambience (committed). Rebuilt by `tools/build-audio.sh <src>` from the packs in `docs/CREDITS.md` |
| `docs/CREDITS.md` | Every asset source and licence. Add to it when you add an asset |
| `docs/ART_COMPARISON.md` | Otherworld Legends vs our art: the gap list, map layout recipe, camera and pixel-size measurements |
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
CHUNKY=1 node tools/preview.mjs ...                      # preview as shipped (2x2 chunky pixels); CHUNKY=2 shows fine and chunky
python3 -m http.server 8123                              # serve; open /?town, /?run, /?fps (keys: WASD, Space dash, E use, I bag, M town map, N mute)
node tools/tests/dun.cjs <outDir>     # dungeon: start room, fight, rare+elite packs
node tools/tests/all.cjs <outDir>     # spawns all 30 monsters with affixes
node tools/tests/floor.cjs <outDir>   # a whole descent: explore, fill the Toll, the Warden and its phases, the Waystone, the tally
node tools/tests/town.cjs <outDir>    # tour of Vael's districts
node tools/tests/e2e.cjs <outDir>     # menu → town → tutorial → dungeon → death
node tools/tests/maps.cjs [n]         # builds n random maps; every room reachable, spawn clear, links only between neighbours
node tools/tests/inv.cjs <outDir>     # bag, wear, sell, loot labels
node tools/tests/stig.cjs <outDir>    # level-up cards and every Stigmata skill at once
node tools/tests/descent.cjs <outDir> # town minimap, full map, a locked site, descent panel and difficulty
node tools/tests/rooms.cjs <outDir> [n] # photographs every room of n floors (layout review)
SOAK_DEATH=0.04 node tools/tests/soak.cjs <outDir> 300   # 5 min of random play: errors, NaN, stuck states, walls
node tools/tests/rites.cjs [secs]     # both rites at once in a crowd, plus injected faults: the loop must keep running
node tools/tests/wardens.cjs <outDir> # summons each of the five Wardens and photographs it mid-fight
node tools/tests/vigil.cjs <outDir>   # density by Station, the Bleeding Vigil, the Reliquary, Judgement, omens
node tools/tests/err.cjs              # prints page errors and state
node tools/sprites.mjs --audit        # lists any animation still drawn by the old hand-drawn code
```

Add `?prof` to the URL to fill `HS.PROF` with per-system ms per frame. Each test writes screenshots to `<outDir>/shots/` and prints `errors 0 []` when clean. `?fps` shows frames per second and the ms our own code takes per frame. Look at the screenshots yourself; the user cares most about how it looks.

## Conventions

- **Art rules (from the owner):**
  - No visible separation of body parts: build forms with smooth union (`k` ≈ 1–2).
  - Lit from the top-left.
  - Hand-place eyes with `dot()`.
  - Use `folds()` on cloth and `bumpy()` on flesh and stone.
  - No dithering mush and nothing that looks AI-made.
  - Every pixel must be on the palette.
  - Chunky pixels: art ships on a 2x2 grid (each art pixel is 2 world pixels), so details under 2 px vanish. Keep thin parts (halos, strings, rims) at least 2 px thick and check with `CHUNKY=1` previews. The screen always uses a whole-number scale with nearest-neighbour pixels.
  - Characters face right; the engine flips them.
  - Every character frame sets `ax`/`ay` at the feet.
  - Furniture is drawn in 3/4 view: pass `tilt` (about 0.3 to 0.6), `tiltY` (the ground line) and `tiltLift` to `render()` so the top face shows (see `tools/models/props.mjs`).
- **Model sets:** a set exports `{ sheetName: { animName: () => frames } }`. `sprites.mjs` loads it automatically if its name is in the list near the top. Monster anims are `<id>_walk` (8 frames from half steps, `HALF` in `base.mjs`), `<id>_attack` (2 frames, or 3 = windup, windup2, strike), and `<id>_hit` (2) and `<id>_die` (3) from `reactions(make)`. Use `stride()` for legs so feet stay planted. Bob bodies with `bobAt()` (whole 2 px steps); a 1 px bob makes the sprite shimmer.
- **World units:** distances in `index.html` are world pixels at the v5 scale. Any new size or range should already include the ×1.3 scale. MON stats are written at the old scale and multiplied by `WS` in a loop after the table.
- **Floor tiles:** stay 16 px (`TILE`). Back walls are 3 tiles tall plus a cap: `hall.wall` = [top, cap, upper, lower, mid].
- **Shipping:** work on a branch, then push to `master`. The owner asked for every finished round to go to master; GitHub Pages deploys from it. End commits with the attribution lines the session asks for.
- **Names:** never borrow names or terms from other games (the owner removed all Blasphemous and Diablo terms for copyright). Our terms: Zeal (resource), Reckoning (ultimate), Rites (skills), the Fifteen Stations (difficulty, I–XV, in bands Pilgrim/Zealot/Martyr/Saint), the Toll (progress bar), the Warden (the Station boss; five of them), Sanctity (gear power from item level), the Bleeding Vigil (timed endless trial), knells (Toll orbs), omens (map curses), the Weeping Reliquary (an event), Hallowed (top rarity), Vigil Trials (endless mode), health orbs, Carnage bonus.
- **Descent maps:** 11–12 rooms grown at random on a 4×4 grid (`GRID`), packed by `populate()`; no gates or waves. Balance numbers live in `DIFF` (Stations), `TOLL_VALUE`, `WARDEN` and `itemSanctity`.
- **Layouts:** dungeon rooms follow the Otherworld Legends recipe in `docs/ART_COMPARISON.md`: open floors, one mirrored plan per room, a mirrored back-wall rhythm, clutter in corners, nothing floating. Review with `tools/tests/rooms.cjs`.
- **UI sizes:** the view height varies a little per device (whole-number scaling), so place UI from `W`/`H` and check panels fit at H ≈ 290.
- **Writing style:** keep docs and code comments plain and short.
- **Finishing a round:** run the tests and soak, look at the screenshots, update `docs/HANDOFF.md` (state, history, next ideas) and this file, then push the branch and `master`.
