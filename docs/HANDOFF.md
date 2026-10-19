# Handoff

Last updated 2026-10-19, after round 21. Read this first, then `CLAUDE.md`.
The history of every round is at the bottom; the sections above it describe
the game as it is now.

**Every reply that completes a prompt ends with two lists: what was done,
and 5 suggestions for what to do next.** (The owner's standing request;
see "The owner's preferences".)

## Starting a new session

1. Read this file and `CLAUDE.md`. `docs/SETS.md` and `docs/COMBAT.md` hold
   the set and monster details.
2. Serve the repo (`python3 -m http.server 8123`) and open `/?town` or
   `/?run`. Add `?dev` for the dev menu (sets, items, levels, Stations,
   Wardens, Bloodrose Keys, Chrism, Censer upgrades).
3. Work on the branch `round8-monster-anim`, then fast-forward `master` and
   push both. GitHub Pages deploys from `master`.
4. Before shipping: run the tests listed in `CLAUDE.md` (each prints
   `errors 0 []`), a soak (`SOAK_DEATH=0.04 node tools/tests/soak.cjs <dir> 150`),
   and look at the screenshots at phone sizes (game widths run about 445 to
   620 px, heights 250 to 290). Text must fit: use `fitText` and `wrapW`.

## Where the game stands

A playable action-RPG slice for iPhone, always landscape (held upright the
canvas turns a quarter, `PORTRAIT` in `resize`, and `toLocal` maps taps).
Desktop works with keys. 55–60 fps in dense crowds.

- **Look:** sculpted SDF pixel art on a chunky 2x2 grid (the Otherworld
  Legends look), whole-number scaling, a 305 px tall view, warm torch light
  on dark stone. Every pixel is on the palette (`tools/palette.mjs`, 25
  ramps; `rose` was added in round 18 for the Bloodrose Keys).
- **Vael, the town:** two short streets (`TOWN_SPLIT`, `ROW_DY`) with
  townsfolk and nine sites: Pell's curio stall, the Plush stall, the
  Bounty Board, the Scrying Pool, the Ember Forge, the Ashen Altar, the
  Penitent Cells, Martyrdom, the Canonry, plus the Pilgrim Road (Stratum
  II). Some still say "coming soon" (Plush stall, Scrying Pool, Martyrdom).
- **The descent:** the Descent panel at the cathedral doors picks a Station
  (I–XV, `DIFF`), a stratum (the Undercroft or the Drowned Nave), omens,
  and now also holds **the Bleeding Vigil** (top-right button). Maps are
  random 11–12 room layouts packed with 500+ monsters (`populate()`,
  seeded so a suspended run rebuilds the same map). Kills ring **the
  Toll**; at 90% the **Warden** comes (five in Stratum I, two in the Nave).
  Monsters climb faster than gear (`MON_STEP` 1.5 against `POWER_STEP`
  1.36), so progress needs farming (`tools/tests/balance.cjs`).
- **The Bleeding Vigil** (timed endless trial): each one costs a
  **Bloodrose Key** (`SAVE.vkeys`), dropped by Wardens of Station X and
  deeper half the time (`dropVkey`, pink beam). Ten minutes to fill the
  Toll and slay the Warden; time left raises the Vigil level.
- **Combat:** a floating auto-aiming crossbow, dash with a perfect dodge,
  the Censer (a thurible that swings round the Saint), two rites and a
  Reckoning chosen from 12 (`RITES`, the Rites panel), Zeal, executions.
  Monsters are punishing (round 16): `MON_DMG`, faster shots (`SHOT_K`),
  and new telegraphed attacks (snipe lines, fast-ticking blight pools,
  novas, barrages, homing shots, the Sentence that only a dash cleanses).
  22 elite curses. Heal per kill is capped at 3% of health a second.
- **Run levels:** up to 15 (`MAX_LEVEL`), each 1.22x the last, paced so 15
  comes at about 75% of the map. Each level offers 3 of 30 Wounds;
  rite Wounds only appear for chosen rites.
- **Gear:** 10 slots (8 vestments, crossbow, quiver), 5 rarities, item
  level = Station (Sanctity). Hallowed pieces (30 in `LEGENDS`) are rare
  (about 1.5–2.5% of drops). Five 6-piece vestment sets with 2/4/6
  bonuses, each with its own Saint skin, crossbow and bolts, plus 2-piece
  set Arms; Odile's Habit is the starter set. Sets drop from Station VI.
- **Account systems:** Devotion and Virtues (Canonry), the Ember Forge
  (reforge, temper), the Ashen Altar (burn a Hallowed piece to learn its
  power for good: gold price, 30% success plus 5% per past failure, Chrism
  raises the odds, three spare pieces grind into a Chrism; three sockets), the Censer's 12 deed upgrades (tap the censer on the bag's
  paper doll), the Bounty Board, Penitent Cells, Odile's Gift, suspend and
  resume.
- **Settings and tools:** settings panel (effects, shake, numbers, sound,
  left-handed), dev menu (`devRows()`), `?prof` and `?fps` profiling.

## The owner's preferences

- **After every completed prompt, reply with (1) a short list of what was
  done and (2) 5 suggestions for what to do next.**
- Graphics matter most. The target is Otherworld Legends: chunky, crisp
  pixel art, nothing that looks AI-made. They check text layout on a phone
  closely: no overlapping or clipped text.
- Systems borrow from Diablo 3 and Torchlight Infinite, always under our
  own names (never borrow names or terms from other games).
- They want the game hard: monsters punish mistakes, drops are rare,
  progress needs farming. Every hit must still be telegraphed.
- Ship each finished round to `master`. Raise `BUILD` and add its lines
  to `CHANGES` every round (the owner sees them on their phone). Keep updates short, lead with the
  outcome, attach screenshots.

## Next steps (ideas, building on what is there)

1. **A "best kept" board in Vael.** Show the highest Vigil levels kept and
   the time left, now that the Vigil pays its own rewards.
2. **Finish the "coming soon" sites.** The Scrying Pool (wager gold on how
   deep a run gets), Martyrdom (one life, doubled rewards), the Plush stall
   (cosmetic halos and robe colours bought with gold).
3. **A training yard in Vael.** A dummy and a monster summoner so players
   can learn the round 16 attacks (snipe, blight, Sentence) safely.
4. **Altar sound.** Its own crackle for the flame and a chime for a learned
   power (today it borrows the shrine and break sounds).
5. **Rite depth.** Let rites gain ranks with use, and give each set a
   rite-specific 6-piece twist, so the Rites panel becomes a build screen.
6. **Stratum III.** A third look (the Ossuary Spire or a burnt chapter
   house) with its own two Wardens, reusing the `STRATA` remap pipeline.
7. **A second playable saint.** A short-range melee saint with its own
   rites, to reuse the sets and Stations.
8. **Art pass on small icons.** Review every sheet with `CHUNKY=2`: item
   icons, the Chrism vial on the ground, weed mats.
9. **Death recap.** After a fall, show what hit you hardest and a tip for
   that attack.
10. **Tune from play.** `tools/tests/balance.cjs`, `perf.cjs` and the
    survival check in round 16's notes after any balance change.

## History by round

- **Round 21 (the altar's memory, build notes, frame styles):** tapping an
  altar socket opens THE ALTAR'S MEMORY (`renderAltarPick`, our take on
  a power collection): every Hallowed power that fits the socket as a
  grid of cards (icon and name; icons only on small phones), learned ones
  lit, the socketed one marked with a gem. Tap one to read it, then SET IT
  or EMPTY. Socket cards show the set power's icon and how many are
  learned. A returning Saint on a new build sees A NEW BUILD once in Vael
  with that build's lines (`CHANGES[BUILD]`, `SAVE.seenBuild`); a new
  player does not. Windows take a style: `panelFrame(x, y, w, h, style)`
  with `_iron` (the Forge), `_silver` (the Canonry), `_blood` (the
  Vigil); each style has its own corners, crest and studs (`ui`
  `frame_corner_iron` and so on). The Pilgrim Road has a waymark
  (`town2` `waymark`); the stall badges are centred on their stalls.
  Test: `tools/tests/round21.cjs`.
- **Round 20 (framed menus, self-updating builds, landmarks):** every
  menu window now uses `panelFrame` (an iron band with a gilt rule, a faint
  diamond lattice, sculpted gilt corner brackets with crimson gems, a crest
  on the bottom edge and side studs; `ui` `frame_corner`, `frame_crest`,
  `frame_stud`) and `headerBar` (a raised title plate with a gilt rule).
  The frame is drawn inside the window's rect, and the ornaments are
  redrawn after the content. Buttons (`invButton`) got cut corners, a gilt
  rim when pressable, and labels that fit. Short phones: shop rows share
  the height, the Canonry goes two columns, Censer rows keep two lines (tap
  a row for its full text), the Forge grid wraps to the list width.
  Phones kept stale builds (the owner saw last round's altar), so `BUILD`
  now versions every asset URL and `checkBuild()` reloads into a newer
  build (in Vael; a run waits until the Saint is back in town). **Raise
  `BUILD` every round.** Brother Cinder stands by the altar and explains
  burning, pity, Chrism and grinding. New landmarks: Martyrdom's chained
  stake and the Canonry's lectern (`town2` `stake`, `lectern`); the Cells'
  badge moved onto the mausoleum door. Test: `tools/tests/menus.cjs`.
- **Round 19 (altar extras, Vigil rewards):** every altar row shows its
  price and its odds with the chosen Chrism. Each failed burn adds 5% to
  the next until one succeeds (`ALTAR_PITY`, `SAVE.altarPity`). GRIND 3 TO
  CHRISM mills three Hallowed pieces (learned ones first, then the lowest
  item level) into one Chrism, by kind 60/28/10/2% (`grindAtAltar`,
  `GRIND_W`). Burning and grinding play a flame on the altar's left column
  (`renderAltarFx`): a golden ring when the power is learned, grey ash when
  refused, the new vial when ground; taps wait for it. Each Chrism kind has
  its own vial (`loot` `chrism`, four frames). The Vigil pays more
  (`VIGIL_PAY`): Chrism twice as often and of better kinds as the level
  climbs, its Warden always pays a set piece from Vigil 12 and a Hallowed
  Chrism from Vigil 20, and a Chrism 60% + 2% a level of the time
  (`vigilPayout`). The Vigil panel's rows share the room above the
  buttons so they fit short screens. Test: `tools/tests/round19.cjs`.
  The Ashen Altar now has its own sculpted model in Vael (`town2`
  `ashaltar`: a stepped stone altar, crimson cloth and gold cross, two
  candles, an iron bowl of ash and embers, three frames of fire). It took
  the forge yard's well's place; the site badge sits above it (`S.lift`).
- **Round 18 (Rites tabs, the Vigil moves, Bloodrose Keys, always
  landscape):** the Rites panel now has slot tabs (Rite I, Rite II,
  Reckoning) over one wide column of cards, smaller icons, and text that
  fits at every phone width (`fitText`, `SET_SHORT`). The Bleeding Vigil
  left its town site and now opens from the Descent panel's top-right
  button; each Vigil spends a Bloodrose Key (`SAVE.vkeys`), dropped by
  Wardens of Station X and deeper half the time (`VKEY_FROM`,
  `VKEY_CHANCE`), with a sculpted key (`loot` `vkey`, new `rose` ramp) and
  a tall pink beam (`VKEY_BEAM`). The Descent panel fits short screens
  (drops its footer and least useful rows) and shows corrected drop
  numbers. Held upright, the game no longer asks you to turn the phone:
  the canvas turns a quarter (`PORTRAIT`, `toLocal`). Test:
  `tools/tests/round18.cjs`.
  The altar's odds were turned round: a burn now succeeds only 30% of the
  time (`ALTAR_WIN`), so Chrism takes it to 40/50/60/100%.
- **Round 17 (rarer Hallowed, altar odds, run levels):** Hallowed weight
  3.5 to 1.4, and drop boosts lift Hallowed and set pieces only a little
  (about 1.5% of plain drops, 2.5% of elite and Warden drops; was about
  12%). Elites drop at boost 1.5, rares 20% of the time. The Ashen Altar
  now shows a price per piece (`burnCost`, by item level), succeeds only 30% of
  the time (`ALTAR_WIN`; otherwise the piece is lost) and takes a Chrism, a very rare
  drop (`maybeChrism`: commons 0.04%, rares 1%, elites 5%, imps 15%,
  reliquaries 25%, Wardens 40%) in four kinds that add 10/20/30/70% to the
  odds (`CHRISM`, `SAVE.chrism`). Tap a piece to read its power in the
  detail panel. Run levels stop at 15 (`MAX_LEVEL`); each needs 1.22x the
  last (`XP_G`), with the base set from the map's foes so 15 comes at
  about 75% of them, before the Toll fills. Test: `tools/tests/altar.cjs`.
- **Round 16 (punishing foes, the Censer):** monsters hit harder
  (`MON_DMG` 1.25, plus up to +40% by Station V in `DIFF`), shots fly 35%
  faster (`SHOT_K`), lobs land sooner, hurt i-frames 0.6 to 0.4 s, and heal
  per kill is capped at 3% of health a second. Most monsters learn one more
  attack (`MORE_ATTACKS`): `snipe` (a sighting line, then a very fast
  shot), `blight` (pools under the Saint that tick every 0.2 s and ignore
  i-frames), `nova` (a delayed blast round the monster), `barrage` (a rain
  of small blasts), homing shots (`home`), and the Sentence (a mark that
  bursts unless the Saint dashes or is warded). New affixes: BLIGHTED,
  SENTENCING, HAWK-EYED. An idle Saint in a crowd now falls in about 5 s
  (was 12 to 16 s). The Censer: a tappable icon on the bag's paper doll
  opens its panel (what it does, live numbers, 12 upgrades in `CENSER_UP`).
  Upgrades light by lifetime deeds (`SAVE.life` via `bumpBounty`, deaths,
  descents, Vigil best) and stay lit. Level-up Wounds tied to a rite
  (`rite` in `WOUNDS`) are offered only while that rite is chosen; every
  rite now has one (Deep Vial, Longer Chains, and ten new ones such as
  Stormwright and Martyr's Resolve). Test: `tools/tests/punish.cjs`.
- **Round 15f (Rites panel polish):** the bag's RITES button moved to the
  bottom left, with the three chosen rites shown beside it. The Rites panel
  was redone: roomier cards (round icon socket, set stripe, cooldown, SET
  when the synergy is on) and a detail pane for the slot last tapped (full
  text, cooldown after Rite CD, what its set adds and whether it is active,
  and the Hallowed piece that bends it, from `RITE_MORE`).
- **Round 15e (difficulty pass):** monsters now climb by `MON_STEP` (1.5)
  per Station while gear climbs by `POWER_STEP` (1.36), so each Station is
  about 10% beyond its own gear, compounding (x1.5 at V, x2.4 at X, x3.9 at
  XV). Monster damage climbs by `MON_STEP^0.72`. Commons have 1.6x and
  rares 1.3x health. Fewer drops (commons 0.6%, rares 30%, elites 1 piece,
  Wardens 3). Main sets and arms drop from Station VI (`SET_FROM`).
  Measured with `tools/tests/balance.cjs` (Consecrated gear in all 10
  slots, a mid-run Wound build, Warden seconds against the 100 s enrage):
  I about 55 s; V about 85 s matched, 100 s one Station behind; X about
  220 s matched without a set, about 130 s with a full set and arms; XV
  about 400 s without a set, about 90 to 200 s with one. Late Stations
  need sets, Devotion, Hallowed powers and the Altar on top of matched
  gear, so progress means farming. Warden blows to die at matched gear:
  about 5.5 at I, 3 at X, 2.5 at XV.
- **Round 15d:** 20 more Hallowed pieces (`LEGENDS`, 30 in all, two or
  three per slot; many lean on the new rites, such as the Stormwright's
  Gloves, the Pall of Seven Wards, the Seal of Judgement). The Ashen Altar
  (town site, opens after 3 descents; `SAVE.altar`): burn a Hallowed piece
  to learn its power for good, then set one learned power each in the
  vestment, arms and relic sockets; they count as worn (`gearStats`).
- **Round 15c:** the worn quiver shows on the Saint's back in its set's
  colours (`weapon` `quiver_<set>`, `G.quiver`); Odile's Habit has a
  starter look (brown homespun, cream collar; `SKINS.habit`). The bounty
  board (`BOUNTIES`, `bumpBounty`): three bounties counted across
  descents, each paying gold, Devotion and a Consecrated or better piece;
  all three pay the Board's Purse (a Hallowed piece). Suspend and resume:
  maps are built from a seed (`seeded`, `run.seed`), the run is saved
  every 5 s and when the page hides (`snapRun`), and Vael offers to rebuild
  it (`resumeRun`: slain stay slain, fog, Toll, gold, Wounds, Warden or
  Waystone). New test: `tools/tests/round15.cjs`.
- **Round 15b:** more monsters (about 450 at Station I, 850 at VIII, 1,100
  at XV; `MAX_FOES` caps a map) and the Warden comes at 90% of the map's
  Toll (`TOLL_SHARE`). Vael folded into two streets about 1,200 px wide
  (upper: gate, market, Gilded Lamb, forge; lower: Quiet Acre, Cells,
  Martyrdom, Cathedral) joined by two alleys (`TOWN_SPLIT`, `ROW_DY`,
  `townRow`, `TOWN_ALLEYS`). The minimap shows the whole town; the full
  map puts its legend beside the picture.
- **Round 15a:** choosable rites (`RITES`, `riteOf`, the Rites panel from
  pause, the bag or the T key). Three slots, four rites each, every rite
  feeding one set's hooks: Holy Water, Baptism (Font); Nail Storm,
  the Hundredfold (Nails); Ember Step, Martyr's Ward (Stride); Chain of
  Penance, Shackle Circle (Confessor); Censer Blaze, Rain of Reckoning,
  Judgement (Choir); the Great Font (Font). Dashes go through
  `startDash()`. New test: `tools/tests/rites2.cjs`.
- **Round 14:** set arms (crossbow and quiver slots, 2-piece bonuses), the
  Penitent Cells and Cathedral banners, set-coloured rites, Drowned Nave
  props and drips, settings panel, the Warden's fall. Dev menu grew ARMS
  and cell buttons. New test: `tools/tests/round14.cjs`.
- **Round 14a:** dev menu (`devRows()`, `?dev`, pause screen DEV button, backquote key). New test: `tools/tests/dev.cjs`.
- **Round 13:** a crossbow, bolt and bolt colours per set skin; hand-posed
  `cast`, `hit` and `die` frames for the Saint (death shows the fall for
  0.7 s before the receipt). Crowd stutter fixed: kill hitstops chained
  into near-constant freezes (32% of the time in a dense fight, now 7%;
  `hitStop()` has a 0.35 s cooldown), and every new damage number or
  counter built a new text canvas (strings with digits now draw from
  cached glyphs, `numText`; caches drop their oldest entries instead of
  clearing). Caps on effects, particles, numbers and new sound voices.
  `?prof` now also times each part of the frame draw (`r:*`). New test:
  `tools/tests/perf.cjs` (frame times, frozen share, canvases made).
- **Round 12:** the five vestment sets in game: drops, 2/4/6 bonuses, set
  cards, set icons, a sculpted Saint skin and HUD portrait per set, the
  Lesser Vow, Odile's Gift. New test: `tools/tests/sets.cjs`.
- **Round 11:** Pell's curio stall, the Ember Forge (reforge, temper), the
  Canonry with Devotion and Virtues, and Stratum II (the Drowned Nave:
  recoloured sheets, Silt Wretch, Nave Eel, Tide Cantor, the Tide-Bishop
  and the Drowned Organist). Site unlocks moved earlier (Forge II, Road
  III, Vigil IV, stall and Canonry after one descent). New tests:
  `tools/tests/town2.cjs`, `tools/tests/stratum.cjs`; `rites.cjs` now
  spawns its crowd near the Saint (the packed maps fooled its count).
- **Round 10b:** Wardens made punishing: more health and damage, new
  moves per phase, near-zero recovery in the last phase, an enrage timer,
  roots on bell attacks.
- **Round 10:** five unique Wardens (models, kits, new attack types
  `peal`, `pattern`, `volley`, `sweep`), loot beams, density by Station,
  the Bleeding Vigil (timed endless trial), knells, Shrine of Judgement,
  the Weeping Reliquary, omens. Off-screen elite glows and light holes are
  culled. `?prof` shows per-system ms in `HS.PROF`. New tests:
  `tools/tests/wardens.cjs`, `tools/tests/vigil.cjs`.
- **Round 9:** the descent rebuilt the D3/TLI way: 15 Stations gated by
  Wardens, random packed maps with fog-of-war minimap and full map, the
  Toll and the Warden boss, item levels and Sanctity for loot balance,
  sleeping/leashed monsters for speed. Old saves restart at Station I
  (gear kept). Town site unlocks moved to Stations V, IX and XV.
  `tools/tests/floor.cjs` now plays a whole descent (walk, Toll, Warden,
  phases, Waystone, tally).
- **Round 8:** monster animation pass. 8-frame planted-foot walks for all
  30 monsters (`stride()` in `tools/models/base.mjs`), `<id>_hit` and
  `<id>_die` anims made by `reactions()` (re-renders the model tipped back
  through `setPose()` in `tools/sdf.mjs`), engine flinch (`HIT_T`) and fall
  (`falls`, `drawFall`, `updateFalls`). Monster frames are trimmed and all
  sheets are shelf-packed (the elite sheet went from 4236 px tall to 1244).
- **Round 8b:** walk jitter fix. Body bobs now move whole 2x2 blocks
  (`bobAt()` in `base.mjs`; 2 px down through contact and recoil). A 1 px
  or fractional bob re-cut every block, so 60–80% of the upper body changed
  each frame. Townfolk cloth folds hold still while walking. The camera
  follows the Saint's rounded position, and monsters have a 6 px dead zone
  before turning to face the Saint.
- **Round 8c:** freeze guard. A player froze after firing both rites at
  once (not reproduced). The frame loop now books the next frame first,
  each system and each actor draw runs inside `safe()`, a monster whose
  update throws is removed, and errors are kept in localStorage
  `hollow-saint-errors` (the pause screen shows the latest). Fixed the
  chain leaving a bound monster in an unknown `'walk'` state (it stood
  frozen). `tools/tests/rites.cjs` fires both rites together for a while
  and injects faults to prove the game keeps running.
- **Round 8d:** coffins no longer flicker to their broken frame (`drawProp`
  animated any multi-frame prop placed without a `frame`; breakables now
  always show frame 0).
- **Round 8e:** town site panels wrap every line to the panel width
  (`wrapW()`, a pixel-width wrap; use it for any new panel text).
- **Round 8f:** Vael condensed from 3120 to 2150 px wide and 17 to 12
  walkable rows. `makeTown()` still writes positions in the old "plan"
  coordinates; `townX()` (piecewise, landmarks keep their width, gaps
  shrink) and `townY()` (depth past the kerb x0.6) squeeze them at the end.
  `CATHEDRAL_X` is the descent door. The minimap draws a keeper's badge
  once (at their site), and Sister Odile has the plain townsperson badge.
- **Round 8g:** the shrine blessing label (e.g. WARDING 9) sits on its own
  line under the portrait instead of over the portrait corner.
- **Round 7:** chunky 2x2 pixels (`setRes(2)` in `tools/sdf.mjs`,
  `tools/chunky.mjs` for every sheet but `ui`, `chunkCanvas()` for the
  baked floor), whole-number nearest-neighbour scaling, thicker halo,
  8-frame walks, street props (`tools/models/street.mjs`), clean title and
  loading screens, M/N key clash fixed.
- **Round 6b:** camera matched to OWL phone captures (view 305 px; round 5's
  430 px came from zoomed promo shots); rooms resized to OWL proportions;
  descent panel and town map compacted to fit.
- **Round 6:** OWL map layouts (mirrored plans, wall rhythm `bay()`, south
  ledge, pale marble `hall.pillar`), AUTO EQUIP and SELL MANY, town
  walk-through, borrowed names removed, `tools/tests/rooms.cjs`.
- **Round 5:** descent panel (`renderDescent`), difficulty tiers (`DIFF`,
  `SAVE.diff`, `SAVE.cleared`), locked town sites (`SITES`), town minimap
  and full map, map badges (`ui.badge`), `tools/tests/descent.cjs`.
- **Optimisation and bug pass:** visible-only floor drawing, blood baked into
  the floor, half-size darkness and glow layers, cached glow and light-hole
  sprites, `unstick` safety net, many fixes, `tools/tests/soak.cjs`.
- **Round 3:** floating Nail Crossbow (`tools/models/weapon.mjs`, 16
  angles), Stigmata level-ups and six big skills.
- **Round 2:** map connectivity fix and `tools/tests/maps.cjs`, room-grid
  minimap, inventory and equipment, 3/4-view furniture, every old sprite
  remodelled.
- **Round 1:** OWL look (flagstone floors, walls on every side, cast
  shadows, warm light pools, remodelled effects and icons, Kenney High UI
  font), audio and mute, `docs/CREDITS.md`.

## Network access

These hosts are allowed now. Notes: Steam's `api/appdetails` and the App Store page give screenshot URLs; the fandom wiki works through `api.php`; Reddit works through `svc/shreddit/...`; YouTube search is blocked but `i.ytimg.com` thumbnails load. Freesound downloads need an account.

- Reference art:
  - `store.steampowered.com`, `cdn.akamai.steamstatic.com`, `shared.akamai.steamstatic.com`, `cdn.cloudflare.steamstatic.com`
  - `apps.apple.com`, `is1-ssl.mzstatic.com` … `is5-ssl.mzstatic.com`
  - `www.taptap.io`, `www.taptap.cn`, `img.tapimg.com`
  - `otherworld-legends.fandom.com`, `static.wikia.nocookie.net`
  - `www.reddit.com`, `i.redd.it`, `preview.redd.it`, `i.ytimg.com`, `www.mobygames.com`
- Sound:
  - `kenney.nl`, `opengameart.org`, `freesound.org`, `cdn.freesound.org`
  - `sonniss.com`, `pixabay.com`, `cdn.pixabay.com`, `mixkit.co`, `assets.mixkit.co`
  - `itch.io`, `img.itch.zone`, `soundbible.com`

## Gotchas

- `node tools/sprites.mjs` must be re-run after any model change. The sheets are committed, so commit them too.
- A model set that throws on import only prints a warning; the old art stays in place. Read the build output.
- The test server is a plain `python3 -m http.server 8123`. Background servers in cloud sessions time out after about 2 h.
- Town coordinates in `makeTown()` are plan coordinates (×1.3 scale, the old long street), squeezed by `townX()`/`townY()`; tests use `HS.townX(x)`. The player starts at `CATHEDRAL_X` (the descent doors). The street floor runs from `base` (272) to about 464 px.
- Elite HP bars sit at `spriteTop(e)`, the height of the sprite's first walk frame, not `hy`. Monster frames are trimmed, so this is the real sprite height.
- While `setPose()` is active, `render()` returns a bigger frame and `dot()`/`under()` remap their coordinates. Helpers that write `f.px` directly (`put()` in props/dungeon) do not follow it; use `dot()` in monster models.
- `glow()` draws cached sprites; inside the glow pass it writes to a half-size layer (`GLOW_TO`). Pass rgba colours.
- Art ships on a 2x2 grid: anything under 2 px vanishes. Check new models with `CHUNKY=1 node tools/preview.mjs …`. `dot()` fills a whole 2x2 block; local `put()` helpers write single pixels, which `chunkify` then votes on.
- `resize()` picks the whole-number scale whose view height lands closest to `T.viewH` (305), so `H` varies a little per device (292 on an iPhone 13). Lay out UI from `W`/`H`, never fixed sizes.
- Town `place()` never marks tiles solid (walk-through by request); dungeon `place()` does.
- Keys: M opens the map (town or dungeon), N mutes, I opens the bag, E interacts, Esc closes panels.
- Never bob or slide a whole body by 1 px or a fraction: on the 2x2 grid that re-cuts every block and reads as jitter. Move bodies in steps of 2 px (`bobAt()`); elites are scaled by `s` in `shoot()`, so use `2 / s` model units.
- To test the Vigil or high Stations quickly from the console: `HS.SAVE.cleared = 3` (opens Station V and the Vigil), `HS.SAVE.vigilOpen = 10`.
- Errors never stop the loop; they are logged instead. If the owner reports a bug, ask what the pause screen says under BUG LOGGED, or read `localStorage['hollow-saint-errors']`.
- `text()` caches each string as a small canvas (cleared at 600 entries). Use `small: true` for the old thin 5x7 font.
- Audio starts on the first tap (iOS rule). Music streams through `<audio>` elements, effects are decoded buffers. `AUDIO.set([...])` picks the loops; `sfx(name)` plays an effect.
- Rebuild audio with `tools/build-audio.sh <src>` after downloading the packs; the sources are not committed.
