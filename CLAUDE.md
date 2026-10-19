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
| `docs/SETS.md` | The five vestment sets: design and how they are built |

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
node tools/tests/town2.cjs <outDir>   # Pell's stall, the Ember Forge, the Canonry (Devotion)
node tools/tests/sets.cjs <outDir>    # vestment sets: Odile's Gift, each skin and set card, each set's bonuses in a fight
node tools/tests/stratum.cjs <outDir> # Stratum II: panel button, a Drowned Nave run, both of its Wardens
node tools/tests/dev.cjs <outDir>     # dev menu: every tab, sets into the bag, descend, summon, toggles
node tools/tests/round14.cjs <outDir> # Penitent Cells, banners, rite colours, Nave props, settings, the Warden's fall
node tools/tests/rites2.cjs <outDir>  # the Rites panel and all 12 rites cast in a crowd
node tools/tests/round15.cjs <outDir> # worn quiver and Habit look, bounty board, suspend and resume across a reload
node tools/tests/punish.cjs <outDir>  # round 16 monster attacks (snipe, blight, nova, barrage, homing, the Sentence) and the Censer panel
node tools/tests/balance.cjs [stations] [profiles] # difficulty check: DPS, Warden seconds and blows to die per Station, gear matched and behind
node tools/tests/perf.cjs [secs]      # dense crowd: frame times, % of time frozen by hitstop, canvases made, slowest systems
node tools/tests/err.cjs              # prints page errors and state
node tools/sprites.mjs --audit        # lists any animation still drawn by the old hand-drawn code
```

**Dev menu:** open with `?dev` (it stays on), the backquote key, or five quick taps in the bottom-left corner of the pause screen; then the DEV button on the pause screen. Tabs: sets (whole sets into the bag or worn), items, hero (god mode, levels, Wounds), world (descend to any Station or stratum, summon any Warden or monster, reveal map), unlock, debug (fps, profile, hitboxes, game speed). Add new tools to `devRows()`.

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
- **Names:** never borrow names or terms from other games (the owner removed all Blasphemous and Diablo terms for copyright). Our terms: Zeal (resource), Reckoning (ultimate), Rites (skills; 12 choosable in `RITES`: Holy Water, Baptism, Nail Storm, Ember Step, Chain of Penance, Shackle Circle, Censer Blaze, Martyr's Ward, Rain of Reckoning, Judgement, the Great Font, the Hundredfold), the Fifteen Stations (difficulty, I–XV, in bands Pilgrim/Zealot/Martyr/Saint), the Toll (progress bar), the Warden (the Station boss; five of them), Sanctity (gear power from item level), the Bleeding Vigil (timed endless trial), knells (Toll orbs), omens (map curses), the Weeping Reliquary (an event), Hallowed (top rarity; 30 named pieces in `LEGENDS`), the Ashen Altar (burn a Hallowed piece to learn its power, three sockets), Vigil Trials (endless mode), health orbs, Carnage bonus, Devotion (account level) and its Virtues (spent at the Canonry), reforge and temper (the Ember Forge), Pell's curio stall, the vestment sets (the Hundred Nails, the Penitent's Stride, the Drowned Font, the Last Confessor, the Burning Choir, Odile's Habit, the Lesser Vow, Odile's Gift, Penitent Cells and absolution, the Arms of each set: the Nailwright's Arbalest, the Hundredfold Quiver, the Pilgrim's Ember-Bow, the Quiver of Coals, the Aspergill Arbalest, the Brimming Case, the Penance Engine, the Quiver of Links, the Canticle Bow, the Quiver of Candles), Stratum II the Drowned Nave (Silt Wretch, Nave Eel, Tide Cantor, the Tide-Bishop, the Drowned Organist).
- **Saint skins:** `SKINS` in `tools/models/base.mjs` (materials + one detail per set) build `saint_<set>` and `portrait_<set>`; `saintSheet()` in `index.html` picks one at 4 set pieces. Draw the Saint through `saintSheet()`, never `'saint'` directly. Skins also swap the crossbow (`xbow_<set>`) and bolt (`bolt_<set>`, `BOLT_FX`).
- **Slots:** 10 (eight vestments in `GEAR_SLOTS`, plus `bow` and `quiver`). Set pieces carry `it.set`, arms carry `it.wset`.
- **Settings:** read player options with `opt(k)` (`OPT_DEF` holds defaults). Respect `LOWFX` for anything decorative.
- **Performance:** never build a canvas per frame or per hit. `text()` caches each string, so anything with changing digits goes glyph by glyph (it does this by itself). Freeze frames go through `hitStop()`. Check crowds with `tools/tests/perf.cjs`.
- **Monster attacks:** `MON` lists each kit; `MORE_ATTACKS` adds the round 16 ones. Damage is written at the old scale and multiplied by `MON_DMG`; shot speed by `SHOT_K`. Every attack needs a telegraph (windup tell, circle, `aim` line or the Sentence ring).
- **The Censer:** `CENSER_UP` holds its 12 upgrades, unlocked by lifetime deeds (`SAVE.life`, bumped by `bumpBounty`). Read them with `censerUp(id)`.
- **Wounds:** level-up cards in `WOUNDS`. A Wound with `rite` is offered only while that rite is chosen; give each new rite one.
- **Strata:** `STRATA` and `useStratum(k)` swap the dungeon sheets for the `_d` copies (built by the `DROWN` ramp remap in `tools/sprites.mjs`). Give a monster `stratum: 2` to put it in Stratum II's pools.
- **Town:** two streets. Plan x below `TOWN_SPLIT` is the upper street, the rest the lower street `ROW_DY` further south (`townX`, `townRow`). Sites carry `S.row`; site `dy` already includes the row.
- **Seeds:** descent maps and their monsters come from `rng`, which `newRun` seeds (`run.seed`) so a suspended run rebuilds the same map. Never use `Math.random` in map building or `populate()`.
- **Descent maps:** 11–12 rooms grown at random on a 4×4 grid (`GRID`), packed by `populate()`; no gates or waves. Balance numbers live in `DIFF` (Stations; monsters climb by `MON_STEP`, gear by `POWER_STEP`), `TOLL_SHARE`, `MAX_FOES`, `WARDEN`, `SET_FROM` and `itemSanctity`. The owner wants progress to need a lot of farming: check `tools/tests/balance.cjs` after any change.
- **Layouts:** dungeon rooms follow the Otherworld Legends recipe in `docs/ART_COMPARISON.md`: open floors, one mirrored plan per room, a mirrored back-wall rhythm, clutter in corners, nothing floating. Review with `tools/tests/rooms.cjs`.
- **UI sizes:** the view height varies a little per device (whole-number scaling), so place UI from `W`/`H` and check panels fit at H ≈ 290.
- **Writing style:** keep docs and code comments plain and short.
- **Replies:** after every completed prompt, end the reply with a short list of what was done and 5 suggestions for what to do next (the owner's standing request).
- **Finishing a round:** run the tests and soak, look at the screenshots, update `docs/HANDOFF.md` (state, history, next ideas) and this file, then push the branch and `master`.
