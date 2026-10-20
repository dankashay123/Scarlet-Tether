# Hollow Saint: notes for Claude

A top-down pixel auto-shooter for iPhone landscape, in one file with no build
step. Read `docs/HANDOFF.md` first: it holds the current state, the
owner's preferences and a prioritised list of ideas to tackle next.

## Where things are

| Path | What |
|---|---|
| `index.html` | The whole game (about 7,300 lines, Canvas 2D). The `T` table at the top holds tuning (`T.viewH` = 305, the view height; matches the Otherworld Legends phone camera); `WS = 1.3` is the world scale |
| `assets/sprites/*.png`, `sprites.json` | Generated sheets (committed). Never edit them by hand |
| `tools/sprites.mjs` | Builds every sheet. Older hand-drawn art lives here; sculpted models override it by anim name |
| `tools/sdf.mjs` | The sculpted pixel-art renderer (SDF shapes, smooth union, lighting, palette banding, outlines). `setRes(2)` renders on a 2x2 grid |
| `tools/chunky.mjs` | Snaps any frame to the 2x2 chunky grid (the Otherworld Legends blocky look); run on every sheet except `ui` |
| `tools/models/*.mjs` | Model sets: `base` (materials + Saint model), `saint`, `common`, `rare`, `elite`, `townfolk`, `town`, `dungeon`, `floor` (flagstones, water), `vfx` (effects, icons, loot, HUD sound icon), `props` (3/4-view furniture, pilasters, floor bits, HUD buttons), `weapon` (the floating crossbow, 16 angles), `street` (town street props and ground decals) |
| `assets/audio/*.mp3` | Sound effects, music and ambience (committed). Effects: `python3 tools/build-sfx.py <src> [names]` (layered CC0 takes, hall reverb, levelled); music loops: `tools/build-audio.sh <src>`. Packs in `docs/CREDITS.md` |
| `docs/CREDITS.md` | Every asset source and licence. Add to it when you add an asset |
| `docs/ART_COMPARISON.md` | Otherworld Legends vs our art: the gap list, map layout recipe, camera and pixel-size measurements |
| `tools/palette.mjs` | Master palette: 26 ramps × 9 steps (`sea` is the water ramp). Every pixel must be on it |
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
node tools/tests/round18.cjs <outDir> # Rites tabs at three phone sizes, the Vigil in the Descent panel, Bloodrose Keys, upright play
node tools/tests/round21.cjs <outDir> # new-build notice, the altar's memory (socket picker), iron/silver/crimson frames
node tools/tests/round22.cjs <outDir> [WxH] # one of each Hallowed piece: their icons in the bag, the altar and its memory
node tools/tests/round23.cjs <outDir> [WxH] # the Plush stall (buy, wear, recoloured Saint), set icons, Hallowed twinkles, every sound decoded
node tools/tests/round24.cjs <outDir> [WxH] # music per place, the choir by the cathedral, Warden voices, bolt and dash trails, an earned halo
node tools/tests/round25.cjs <outDir> [WxH] # Warden music, voice settings, the Scrying Pool, Martyrdom's vow, the Vigil Roll
node tools/tests/round27.cjs <outDir> [WxH] # the Reliquary horde, passives, cast effects, bag colours and set stars
node tools/tests/grind.cjs [stations] [mins] # gear a full clear drops per Station, runs per Hallowed, runs for one full set
node tools/tests/setbal.cjs [secs] [station] [seeds] # set balance: kills and damage taken a second per set and 4+2 mix (seeded)
node tools/tests/round26.cjs <outDir> [WxH] # six new rites, ranks, twists, aimed Judgement and Font, the death recap
node tools/tests/aim.cjs <outDir> [WxH]   # drag to aim each rite, cancel, plain tap
node tools/tests/menus.cjs <outDir> [WxH] # every menu window at one phone size (run at 932x430, 844x390, 667x375); TEXT=large checks the large text size; prints `text problems N` for text that overlaps, runs off the screen or sits a pixel off its neighbour (`HS.textProblems()`)
node tools/tests/round31.cjs <outDir> [WxH] # low-health edge, kill streak, the Training Yard, Stratum III and its Wardens, ten halos on the Vigil Roll
node tools/tests/round30.cjs <outDir> [WxH] # crit numbers by size, the Zeal step flash, the HP shake, text size in settings, HUD and bag
node tools/tests/round38.cjs <outDir> [WxH] # ingredient pity, enchant tier II, the enchant card over the bag
node tools/tests/round37.cjs <outDir> [WxH] # the forge's BUY tab, a photo of every enchant preview
node tools/tests/round36.cjs <outDir> [WxH] # auto-roll aimed at one stat, one ingredient back on removal, ITEMS rows open their sites
node tools/tests/round35.cjs <outDir> [WxH] # bag ITEMS and INGREDIENTS tabs, reforge warnings and auto-roll, enchant warnings and remove, Vigils to 200
node tools/tests/round34.cjs <outDir> [WxH] [safe] # top of the HUD: Toll, elite and Warden bars, Martyr's line, streak bar, crit numbers; no text problems; `safe` fakes a notch inset
node tools/tests/round33.cjs <outDir> [WxH] # reforge odds and colours, the VALUES tab, Warden Emberstones and ingredients, the Enchanter, all 16 enchants in a fight (TEXT=large too)
node tools/tests/round32.cjs <outDir> [WxH] # Ossuary props counted and photographed, the yard's best damage a second
node tools/tests/ossrooms.cjs <outDir> [stratum] [floors] # photographs every room of a descent in one stratum
node tools/tests/round19.cjs <outDir> # altar odds per row, pity, grinding, burn animations, what a Vigil pays
node tools/tests/altar.cjs <outDir>   # altar price, failure and Chrism, Hallowed drop share, levels paced to the map
node tools/tests/punish.cjs <outDir>  # round 16 monster attacks (snipe, blight, nova, barrage, homing, the Sentence) and the Censer panel
node tools/tests/balance.cjs [stations] [profiles] # difficulty check: DPS, Warden seconds and blows to die per Station, gear matched and behind; profiles bare, run, set, mythic, chase
node tools/tests/perf.cjs [secs]      # dense crowd: frame times, % of time frozen by hitstop, canvases made, slowest systems
node tools/tests/err.cjs              # prints page errors and state
node tools/sprites.mjs --audit        # lists any animation still drawn by the old hand-drawn code
```

**Dev menu:** open with `?dev` (it stays on), the backquote key, or five quick taps in the bottom-left corner of the pause screen; then the DEV button on the pause screen. Tabs (`DEV_TABS`, one help line each in `DEV_HELP`): HERO (god mode, levels, Wounds, Devotion, rite ranks), GEAR (items at any Station and rarity, whole sets with arms, the bag), FORGE (Emberstones, force the next reforge quality, enchants on worn gear, ingredients, the altar), WORLD (descend to any Station or stratum, summon any Warden or monster, the Vigil, the yard), TOWN (unlocks, currencies, looks, Censer, bounties, cells) and DEBUG (fps, profile, hitboxes, game speed, errors, the save). In `devRows()` each row is `R(label, ...cells)` with up to three cells; `< X >` buttons are pickers (grey), `on` makes a toggle (green when on), `danger` marks a destructive button; end a tab with `{ info }` for its status line. Keep a tab to seven rows. `tools/tests/dev.cjs` checks every label fits.

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
- **Shipping:** raise `BUILD` near the top of `index.html` every round (it versions asset URLs and lets running games reload into the new build) and add the round's lines to `CHANGES[BUILD]` (shown once to returning players). Work on a branch, then push to `master`. The owner asked for every finished round to go to master; GitHub Pages deploys from it. End commits with the attribution lines the session asks for.
- **Names:** never borrow names or terms from other games (the owner removed all Blasphemous and Diablo terms for copyright). Our terms: Zeal (resource), Reckoning (ultimate), Rites (skills; 12 choosable in `RITES`: Holy Water, Baptism, Nail Storm, Ember Step, Chain of Penance, Shackle Circle, Censer Blaze, Martyr's Ward, Rain of Reckoning, Judgement, the Great Font, the Hundredfold), the Fifteen Stations (difficulty, I–XV, in bands Pilgrim/Zealot/Martyr/Saint), the Toll (progress bar), the Warden (the Station boss; five of them), Sanctity (gear power from item level), the Bleeding Vigil (timed endless trial, opened with Bloodrose Keys), knells (Toll orbs), omens (map curses), the Weeping Reliquary (an event), Hallowed (top rarity; 30 named pieces in `LEGENDS`), the Ashen Altar (burn a Hallowed piece to learn its power, three sockets), Vigil Trials (endless mode), health orbs, Carnage bonus, Devotion (account level) and its Virtues (spent at the Canonry), reforge and temper (the Ember Forge; Emberstones, reforge qualities common to mythic), the Enchanter and its 16 enchants (ingredients from Wardens of Station X and deeper), Pell's curio stall, the vestment sets (the Hundred Nails, the Penitent's Stride, the Drowned Font, the Last Confessor, the Burning Choir, Odile's Habit, the Lesser Vow, Odile's Gift, Penitent Cells and absolution, the Arms of each set: the Nailwright's Arbalest, the Hundredfold Quiver, the Pilgrim's Ember-Bow, the Quiver of Coals, the Aspergill Arbalest, the Brimming Case, the Penance Engine, the Quiver of Links, the Canticle Bow, the Quiver of Candles), Stratum II the Drowned Nave (Silt Wretch, Nave Eel, Tide Cantor, the Tide-Bishop, the Drowned Organist), Stratum III the Ossuary Spire (Bone Gleaner, Cinder Moth, Marrow Abbot, the Ossuarch, the Ash Widow), the Training Yard, kill streaks.
- **Saint skins:** `SKINS` in `tools/models/base.mjs` (materials + one detail per set) build `saint_<set>` and `portrait_<set>`; `saintSheet()` in `index.html` picks one at 4 set pieces. Draw the Saint through `saintSheet()`, never `'saint'` directly. Skins also swap the crossbow (`xbow_<set>`) and bolt (`bolt_<set>`, `BOLT_FX`).
- **Item icons:** draw any piece with `itemIcon(it, x, y)`; it uses the Hallowed piece's own icon (loot `legend`, LEGENDS order, `LEGEND_ICONS` in `vfx.mjs`), a set piece's (loot `setitem`, set * 10 + slot, `SET_LOOK` in `vfx.mjs`), or the slot icon. A new Hallowed piece or set needs new icons.
- **Sounds:** add a recipe to `SFX` in `tools/build-sfx.py`, its name to `SFX` and `VOL` in `index.html`'s `AUDIO`, and its pack to `docs/CREDITS.md` (CC0 preferred). Play with `sfx(name, { vol, rate, gap })`. Music loops are `music()` recipes in the same script and `LOOPS` in `AUDIO`; loops that follow the Saint (`amb_choir`, `amb_fire`) are in `LEVELED` and set by `AUDIO.level`. A new monster needs a `VOICE` family; a new Warden needs `roar_<id>`, `fall_<id>`, an earned halo in `HALOS` (plus a `halostand` frame). Voices (`die_`, `roar`, `fall_`) play on their own bus (`AUDIO.isVoice`). Battle music while a Warden lives: `music_warden`, `music_warden_nave`.
- **Looks:** the Saint is always drawn through `saintSheet()`, which applies the Plush stall look (`lookSheet`).
- **Slots:** 10 (eight vestments in `GEAR_SLOTS`, plus `bow` and `quiver`). Set pieces carry `it.set`, arms carry `it.wset`.
- **Settings:** read player options with `opt(k)` (`OPT_DEF` holds defaults). Respect `LOWFX` for anything decorative.
- **Performance:** never build a canvas per frame or per hit. `text()` caches string widths (`TEXT_W`) and queues the string; `flushText()` draws the queue in the web font (`UI_FONT`) at screen resolution, so text always sits on top of its layer. A window drawn over another window must call `layerBreak()` first or the lower window's text shows through. The player's TEXT SIZE setting scales every string (`TEXT_K`); leave a pixel or two of slack between stacked lines. Freeze frames go through `hitStop()`. Check crowds with `tools/tests/perf.cjs`.
- **Monster attacks:** `MON` lists each kit; `MORE_ATTACKS` adds the round 16 ones. Damage is written at the old scale and multiplied by `MON_DMG`; shot speed by `SHOT_K`. Every attack needs a telegraph (windup tell, circle, `aim` line or the Sentence ring).
- **The Censer:** `CENSER_UP` holds its 12 upgrades, unlocked by lifetime deeds (`SAVE.life`, bumped by `bumpBounty`). Read them with `censerUp(id)`.
- **Run levels:** capped at `MAX_LEVEL` (15); `xpNeed` grows by `XP_G` from `run.xpBase`, set in `populate()` from the map's foes.
- **Wounds:** level-up cards in `WOUNDS`. A Wound with `rite` is offered only while that rite is chosen; give each new rite one.
- **Strata:** `STRATA` and `useStratum(k)` swap the dungeon sheets for that stratum's copies (`STRATUM_SHEET`: `_d` from the `DROWN` remap, `_o` from the `OSSUARY` remap in `tools/sprites.mjs`). Give a monster `stratum: 2` or `3` to put it in that stratum's Warden list; its spawn pools are `COMMON_POOL2/3` and `RARE_POOL2/3`. Room props per stratum: the `drowned` and `ossuary` flags in `populate()` (the Nave's flood, blue flames, skull pedestals, bone piles); `STRATA[k].light`/`torch` set the light colours. A stratum opens at `STRATA_NEED` (`strataOpen(k)`); music per stratum is picked in `update()`.
- **Training Yard:** `openYard()` starts a run with `run.yard` (like a Penitent Cell): a `dummy` monster counts damage (`yardDps`), the statue opens the summon panel (`yardGeo`, `yardTap`, `yardSummon`). In the yard kills give nothing, XP, deeds and bounties are off, and death restores health. Anything new that pays out on a kill must respect `game.yard`. Best damage a second per build: `SAVE.yardBest`, `yardKey()`.
- **Town:** two streets. Plan x below `TOWN_SPLIT` is the upper street, the rest the lower street `ROW_DY` further south (`townX`, `townRow`). Sites carry `S.row`; site `dy` already includes the row.
- **Seeds:** descent maps and their monsters come from `rng`, which `newRun` seeds (`run.seed`) so a suspended run rebuilds the same map. Never use `Math.random` in map building or `populate()`.
- **Descent maps:** 11–12 rooms grown at random on a 4×4 grid (`GRID`), packed by `populate()`; no gates or waves. Balance numbers live in `DIFF` (Stations; monsters climb by `MON_STEP`, gear by `POWER_STEP`), `TOLL_SHARE`, `MAX_FOES`, `WARDEN`, `SET_FROM` and `itemSanctity`. The owner wants progress to need a lot of farming: check `tools/tests/balance.cjs` after any change.
- **Layouts:** dungeon rooms follow the Otherworld Legends recipe in `docs/ART_COMPARISON.md`: open floors, one mirrored plan per room, a mirrored back-wall rhythm, clutter in corners, nothing floating. Review with `tools/tests/rooms.cjs`.
- **Menus:** draw every window with `panelFrame(x, y, w, h, style)` (style `''` gilt, `_iron`, `_silver`, `_blood`) and its title band with `headerBar`; buttons with `invButton`. Keep content 6 px inside the frame.
- **Text checks:** `HS.textProblems()` renders one frame and lists overlapping, off-screen and crooked text in the top window; `menus.cjs` runs it on every window. Keep it at 0.
- **HUD layout:** the left block starts at `HUD_X()` (8 + `SAFE.l`, the notch and corner inset read in `readSafe`; `?safe=N` fakes it); right-side buttons move in by `SAFE.r`. The Toll, elite nameplates and the Warden bar live in `topBand()`, between the HP block and the minimap; stack anything new there below what is above it. The kill streak bar sits under the gold and kills.
- **UI sizes:** the view varies per device (whole-number scaling): game widths run about 445 to 620 px and heights 250 to 290. Place UI from `W`/`H`, fit text with `fitText`/`wrapW` (but prefer shorter wording or a `short` name over letting `fitText` chop letters; the owner reports chopped words), and check panels at those sizes (`tools/tests/round18.cjs` shows how).
- **Orientation:** always landscape; held upright the canvas is turned a quarter (`PORTRAIT`). Map every touch through `toLocal`.
- **The Vigil:** levels run to `VIGIL_MAX` (200); past `VIGIL_SOFT` (30) health +3% and damage +2% a level, the rest stays at level 30's. Opened from the Descent panel; each run spends a Bloodrose Key (`SAVE.vkeys`, `dropVkey`). Its extra rewards live in `VIGIL_PAY` and `vigilPayout`.
- **Wagers and the vow:** `WAGER_MARKS`, `wagerOdds`, `settleWager` (the Scrying Pool; `run.reach`); `SAVE.vow` and `run.martyr` (Martyrdom).
- **Rites:** every slot has one rite per set (6 each). A new rite needs an icon (`GLYPH` in `props.mjs`), a `RITE_MORE` line, a `TWIST` line, a rite Wound, and a `bumpRite` call path. Ranks: `RANK_AT`. Delayed second strikes: `later(sec, fn)`.
- **Passives:** `PASSIVES` (offence, defence, utility; deed ones carry `stat`/`need`/`deed`, `passEarned`), each with an icon in `PASS_ICONS` (`props.mjs`, same order), read with `pas(id)`; damage ones in `passK`, defences in `setGuard`. Slots open at `PASSIVE_AT` Devotion.
- **Set balance:** set bonus strengths are in `SETK`; check `setbal.cjs` after changing any set.
- **Death recap:** pass `how` to `damagePlayer`/`hurtPlayerRaw` for any new attack, and give it a `HURT_HOW` name and `HURT_TIP`.
- **Aiming rites:** `AIMABLE` lists rites that take a drag (and their preview shape in `renderAim`); a new aimable rite takes `aim` (`{a, f}`) in its cast function.
- **Questions:** `ask(msg, yes, label)` opens a yes/no window over anything (`renderAsk`, `askTap`; `onTap` sends taps there first). Ask before anything that loses a good roll, an enchant or gold.
- **Forge and Enchanter:** reforging a stat of quality 3+ asks first (`keepRoll`); auto-roll (`autoStep`, `autoRow`, targets `AUTO_Q`, optional stat `autoKey` from `reforgeKeys`, odds `autoOdds`) runs three reforges a second. `drawItemCard(..., maxY)` stops a card's lines above controls. Enchants warn on replacing or doubling; `UNENCHANT_COST` removes one and gives back one random ingredient. reforge qualities in `QUALITY` (`qualRange`, `rollQuality`; a stat's quality is `st[2]`, its colour `statCol`); Emberstones `SAVE.embers` from `wardenMats`. Enchants in `ENCHANTS` (`it.ench`, read with `ench(id)`; three ingredients each in `SAVE.ingr`, loot `ingr` frame = enchant * 3 + k). Tiers: `it.enchT` (1 or 2, a second set of ingredients), read with `enchT(id)` and `E2(id, tierI, tierII)`; text in `text`/`t2`, card line `enchLine(it)`. Ingredient pity: `SAVE.ingrDry`, `ingrChance` (`INGR_PITY`, `INGR_PITY_MAX`). `enchPop(id, tier)` shows an enchant over the bag. A new enchant needs three ingredient icons in `INGR` (`vfx.mjs`), a hook, and a scene in `enchPreview` (Saint and Risen sprites; half size on short phones, which stays crisp because the art is on a 2x2 grid). Emberstones sell at the forge's BUY tab (`EMBER_PRICE`, `EMBER_PACKS`).
- **The altar:** odds are `burnChance` (`ALTAR_WIN` + Chrism + `ALTAR_PITY` per past failure); `grindAtAltar` mills three pieces into a Chrism.
- **Writing style:** keep docs and code comments plain and short. Player-facing text says only what the player needs, in plain words: no flourishes, no lore asides in UI, no "you slay it" phrasing (the owner finds it reads as AI-made). Use KILL, not SLAY. Townsfolk chatter is character dialogue and may keep its voice.
- **Replies:** after every completed prompt, end the reply with a short list of what was done and 5 suggestions for what to do next (the owner's standing request). At least 2 of the 5 must revisit things already built (polish, fixes, tuning or a second look at an earlier feature).
- **Finishing a round:** run the tests and soak, look at the screenshots, update `docs/HANDOFF.md` (state, history, next ideas) and this file, then push the branch and `master`.
