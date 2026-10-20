# Handoff

Last updated 2026-10-20, after round 37 (build 37.1, on `master`). Read
this first, then `CLAUDE.md`. The history of every round is at the bottom;
the sections above it describe the game as it is now.

**Every reply that completes a prompt ends with two lists: what was done,
and 5 suggestions for what to do next, at least 2 of them revisiting
things already built.** (The owner's standing request;
see "The owner's preferences".) When the owner answers with numbers
("1, 2, 5" or "All"), they mean those suggestions from the last reply.

## Starting a new session

1. Read this file and `CLAUDE.md`. `docs/SETS.md` and `docs/COMBAT.md` hold
   the set and monster details.
2. Serve the repo (`python3 -m http.server 8123`) and open `/?town` or
   `/?run`. Add `?dev` for the dev menu (sets, items, levels, Stations,
   strata I to III, Wardens, Bloodrose Keys, Chrism, Censer upgrades).
   The server dies between sessions: if a test prints nothing or
   `ERR_CONNECTION_REFUSED`, start it again.
3. Work on a round branch (round 32 used `round32-ossuary`), then
   fast-forward `master` and push both. GitHub Pages deploys from `master`.
4. Before shipping: raise `BUILD` and add `CHANGES[BUILD]`; run the tests
   listed in `CLAUDE.md` (each prints `errors 0 []`), `menus.cjs` at
   932x430 and 667x375 (and `TEXT=large` once), a soak
   (`SOAK_DEATH=0.04 node tools/tests/soak.cjs <dir> 150`), and look at the
   screenshots at phone sizes (game widths run about 445 to 620 px, heights
   250 to 290). Text must fit: prefer shorter wording to `fitText` chopping.
5. Big art or sound jobs can go to helper agents in parallel (round 31 did
   this): give them the art rules from `CLAUDE.md`, tell them not to touch
   `index.html` or commit, and review their previews yourself before
   wiring anything in.

## Where the game stands

A playable action-RPG slice for iPhone, always landscape (held upright the
canvas turns a quarter, `PORTRAIT` in `resize`, and `toLocal` maps taps).
Desktop works with keys. 55-60 fps in dense crowds on a phone.

- **Look:** sculpted SDF pixel art on a chunky 2x2 grid (the Otherworld
  Legends look), whole-number scaling, a 305 px tall view, torch light on
  dark stone. Every pixel is on the palette (`tools/palette.mjs`, 26 ramps; `sea` was added in 32.2 for water).
  `resize()` sizes from `visualViewport` and re-checks twice a second
  (iPhone Safari's toolbars once left a black band).
- **Text and HUD (rounds 29-30):** all text is Barlow Semi Condensed
  SemiBold (`assets/fonts/ui.ttf`), drawn at screen resolution over the
  pixel art (`text()` queues, `flushText()` draws, `layerBreak()` between
  windows). HP and Zeal bars sit top left with the damage bonus and Zeal
  step under them, then the kill streak; a slim level bar is centred at
  the bottom. Crits are gold, orange or crimson by size; the Zeal bar
  flashes at each step; big hits shake the HP bar; a red edge pulses below
  25% health. TEXT SIZE setting (small, normal, large).
- **Vael, the town:** two short streets (`TOWN_SPLIT`, `ROW_DY`) with
  townsfolk and twelve sites: Pell's curio stall, the Plush stall, the
  Bounty Board, the Scrying Pool (wagers), the Ember Forge, the Ashen
  Altar, the Penitent Cells, Martyrdom (the vow), the Vigil Roll (ten
  halo stands), the Canonry, the Training Yard (end of the lower street),
  and the Pilgrim Road (explains the strata).
- **The descent:** the Descent panel at the cathedral doors picks a Station
  (I-XV, `DIFF`), a stratum, omens, and holds the Bleeding Vigil. Three
  strata: the Undercroft, the Drowned Nave (opens after Station III), the
  Ossuary Spire (after Station VI; `STRATA`, `STRATA_NEED`). Maps are
  random 11-12 room layouts packed with 500+ monsters (`populate()`,
  seeded so a suspended run rebuilds the same map). Kills ring the Toll;
  at 90% the Warden comes: five in Stratum I, two each in II and III, each
  with its own roar, fall, earned halo and battle music. Monsters climb
  faster than gear (`MON_STEP` 1.5 against `POWER_STEP` 1.36), so progress
  needs farming (`tools/tests/balance.cjs`).
- **The Training Yard (round 31):** a practice run (`run.yard`): a dummy
  that shows damage a second, a summon panel at the statue (any foe or
  Warden, any open Station, foes calm or attacking), no gains, no death.
  It keeps the best damage a second per build (`SAVE.yardBest`, keyed by
  `yardKey()`: the set worn at 4+ pieces and the three rites; counted once
  3 s of hits are in the window).
- **Ossuary rooms (round 32):** Stratum III dresses its rooms with its own
  props (`props` sheet, `tools/models/props.mjs`): skull shelves on most
  back-wall bays (`boneshelf`), skull heaps in corners (`skullheap`), a
  candle cairn in the centre plan of ossuary rooms (`cairn`, any stratum),
  stone pews with skull knobs (`bonepew`) and loose bones baked into the
  floor (`bonestrew`). Flag `ossuary` in `populate()`, like `drowned`.
- **The Bleeding Vigil** (timed endless trial): each one costs a Bloodrose
  Key (`SAVE.vkeys`), dropped by Wardens of Station X and deeper half the
  time. Ten minutes to fill the Toll and kill the Warden.
- **Combat:** a floating auto-aiming crossbow, dash with a perfect dodge,
  the Censer, two rites and a Reckoning chosen from 18 (6 per slot, one per
  set; `RITES`), with ranks from use (`RANK_AT`), 6-piece twists
  (`TWIST`), and drag-to-aim (`AIMABLE`). Passives: three slots opened by
  Devotion, 24 in all, 8 earned by deeds (`PASSIVES`). Zeal steps give
  +10% damage each. Executions, kill streaks and the Carnage bonus.
  Monsters are punishing: telegraphed snipes, blight pools, novas,
  barrages, homing shots, the Sentence. A death recap names what hurt most.
- **Run levels:** up to 15 (`MAX_LEVEL`). Each level offers 3 of the Wounds;
  rite Wounds only appear for chosen rites.
- **Gear:** 10 slots (8 vestments, crossbow, quiver), 5 rarities, item
  level = Station (Sanctity). Drops are rare on purpose (`DROP`); Hallowed
  pieces (30 in `LEGENDS`) are about 1-1.8% of drops. Five 6-piece
  vestment sets with 2/4/6 bonuses (4 pieces also give +25% damage), each
  with its own Saint skin, crossbow and bolts, plus 2-piece set Arms;
  Odile's Habit is the starter set. Bag icons show rarity colours and set
  pieces wear a star. Set strength lives in `SETK` (`setbal.cjs`).
- **The Ember Forge and the Enchanter (round 33):** reforging spends an
  Emberstone (`SAVE.embers`; every Warden drops 2 + 1 per two Stations, Vigils
  2 + level / 3, `wardenMats`) and rolls a quality (`QUALITY`: common 50%,
  rare 30%, epic 14%, legendary 5%, mythic 1%) that scales the stat's range
  (`qualRange`); the stat keeps its quality as `st[2]` and shows in its
  colour (`statCol`). The VALUES tab lists every range. The Enchanter (town
  site `ench`, opens after Station V; `town2` `enchanter` table, badge
  `ench`) puts one of 16 enchants (`ENCHANTS`, read with `ench(id)`) on a
  piece (`it.ench`); each needs three ingredients (`SAVE.ingr`, loot `ingr`
  frame = enchant * 3 + k) that Wardens of Station X and deeper drop 1% of
  the time each (`ENCH_FROM`, `ENCH_DROP`; about 0.5 ingredients a Warden,
  about 180 Warden kills for one chosen enchant).
- **Account systems:** Devotion and Virtues (Canonry), the Ember Forge
  (reforge, temper), the Ashen Altar (burn a Hallowed piece to learn its
  power; three sockets; Chrism and pity raise the odds), the Censer's 12
  deed upgrades, the Bounty Board, Penitent Cells, Odile's Gift, the
  Scrying Pool, the Martyr's vow, suspend and resume.
- **Settings and tools:** settings panel (effects, shake, damage numbers,
  text size, haptics, music, sounds, voices, monster cries, left-handed),
  dev menu (`devRows()`), `?prof` and `?fps` profiling.
- **Not yet checked by ear:** the round 31 sounds (`roar_`/`fall_ossuarch`,
  `roar_`/`fall_ashWidow`, `music_ossuary`, `music_warden_ossuary`) were
  only measured (loudness, peaks, loop seams). Ask the owner how they
  sound. A backup battle track ("Heavy Dungeon", MintoDog, CC0) was noted
  but not downloaded into the repo.

## The owner's preferences

- **After every completed prompt, reply with (1) a short list of what was
  done and (2) 5 suggestions for what to do next, at least 2 of which go
  back over things already built (polish, fixes, tuning).**
- Graphics matter most. The target is Otherworld Legends: chunky, crisp
  pixel art, nothing that looks AI-made. They check text layout on a phone
  closely: no overlapping or clipped text. Game text must be plain and
  short, only what the player needs (no flourishes).
- They play in iPhone Safari and send screenshots. Reported bugs come from
  a real phone: overlapping lines, chopped words ("RECKONIN"), a black band
  at the top. Check at 667x375 as well as 932x430.
- Text that reads as AI-made bothers them ("you slay it", lore asides in
  the UI, flourishes). Use KILL, not SLAY. Short, plain labels.
- HUD taste (round 29): slim bars, a centred "LEVEL N (P%)" label at the
  bottom, HP and Zeal top left, labels lined up under their bars.
- Systems borrow from Diablo 3 and Torchlight Infinite, always under our
  own names (never borrow names or terms from other games).
- They want the game hard: monsters punish mistakes, drops are rare,
  progress needs farming. Every hit must still be telegraphed.
- Ship each finished round to `master`. Raise `BUILD` and add its lines
  to `CHANGES` every round (the owner sees them on their phone). Keep updates short, lead with the
  outcome, attach screenshots.

## Next steps (ideas, building on what is there)

1. **Tune enchants and reforge odds from play.** Enchant strengths are set
   by eye (`enchKill`, `passK`, `damagePlayer`); try them at Stations X to
   XV and in the Training Yard.
2. **Tune Stratum III from play.** Round 32 gave both Wardens a fifth
   attack; ask the owner how the fights at Stations VII to XV feel.
2. **Ossuary chapels.** Chapels in Stratum III still have the red carpet
   and warm floor; give them a bone-grey runner or a different floor.
3. **Yard extras.** A list of past records per build on the yard panel, a
   reset button, and a 30 s timed test.
4. **Stratum III ambience.** Dripping ash, a bone rattle when walking past
   heaps, green candle flames on the cairn.
5. **The pool's crowd.** Let the crowd at the Scrying Pool cheer or jeer
   when a wager settles in Vael, and show past wagers (won and lost).
6. **A second playable saint.** A short-range melee saint with its own
   rites, to reuse the sets and Stations.
7. **Art pass on small icons.** Review every sheet with `CHUNKY=2`: the
   Chrism vial on the ground, weed mats.
8. **Tune from play.** Wager odds (`WAGER_MARKS`, `wagerOdds`), the
   vow's doubling, `balance.cjs`, `perf.cjs`.

## History by round

- **Round 37 (Emberstones for gold, enchant previews):** the forge's BUY tab
  sells Emberstones at 500 gold each in packs of 1, 10 and 50 (packs ask
  first). The Enchanter's card shows a looping two-second scene of the
  chosen enchant (`enchPreview`) with the real Saint and Risen sprites,
  drawn at half size on short phones (crisp, since art is on a 2x2 grid);
  ingredients become one row of icons when space is short, and a tap on the
  card names them.

- **Round 36 (aimed auto-roll, refunds, bag shortcuts):** auto-roll has a
  stat picker (ANY STAT or any stat the line can become, `reforgeKeys`); it
  stops only on that stat at the quality, and the forge shows the odds
  (`autoOdds`, e.g. mythic damage about 1 in 800). Aimed rolls may keep the
  line's own stat; plain reforges still change it. The first line keeps its
  stat. Removing an enchant returns one random ingredient. In Vael, ITEMS
  rows open the Vigil, forge, altar, Pell's stall, Canonry or Odile's gift
  (`openFromBag`; locked sites say what opens them). The forge card stops its
  lines above the controls (`maxY`, "MORE IN THE BAG.").

- **Round 35 (bag tabs, safer reforging, enchant warnings, Vigil 200):** the
  bag has GEAR, ITEMS (keys, Emberstones, Chrism, gold, Virtue points, gifts)
  and INGREDIENTS (all 48 by enchant; tap one to read its names) tabs. A
  shared yes/no window (`ask`) guards reforging a legendary or mythic stat,
  replacing an enchant, a second copy of an active enchant, and removing an
  enchant for 5000 gold (`UNENCHANT_COST`, ingredients not returned).
  AUTO-ROLL in the forge picks epic, legendary or mythic and reforges the
  marked stat three times a second until it rolls that quality or better,
  the stones run out, or STOP. Vigils go to 200 (`VIGIL_MAX`); past 30 only
  health (+3%) and damage (+2%) climb per level; the Warden pays at most 10
  pieces, Emberstones stop growing at Vigil 60; the panel has -10/+10.

- **Round 34.1 (iPhone canvas memory, pause screen):** the owner hit "BLIT:
  THE OBJECT IS IN AN INVALID STATE": iPhone Safari stops drawing once total
  canvas memory passes its limit, and each map's baked floor is about 30 MB
  that waited for garbage collection. `freeRoomCanvases()` empties the old
  map, fog and sky canvases the moment a new map is built; `blit` skips an
  empty buffer and `resize` ignores a near-zero view (app switching). The
  pause screen (`renderPause`) dims the HUD text too, fits the Stigmata in two
  or three columns above the buttons, puts the logged bug line above them,
  and hides banners, toasts and tutorial hints. Crit numbers try a spot
  beside before above and never leave the top of the screen.

- **Round 34 (HUD top and edges):** the phone's safe-area insets (`SAFE`,
  `readSafe`, from CSS `env(safe-area-inset-*)`) keep the HP and Zeal block
  and the right-side buttons clear of the notch and rounded corners. The
  Toll, an elite's nameplate (name, bar, curses that wrap) and the Warden's
  bar (name, title, bar, Wrath clock, curses) fit `topBand()` and stack
  without overlapping; the arrival card hides while a name bar shows. The
  kill streak bar moved under the gold and kills, as wide as the minimap,
  its count centred under it. Damage numbers that would cover an older one
  climb above it (`n.lift`). Test: `tools/tests/round34.cjs`.

- **Round 33.3 (Descent panel, text audit):** the header lore line is gone;
  gear rows read FOE / RARE / ELITE DROPS GEAR as chances and WARDEN GEAR as
  pieces. Foes and rares now pass their drop chance to `dropLoot` as an
  expected count (like elites), so the Station's `df.drop` raises the chance
  instead of only adding a rare second piece (same average). `textAudit()` /
  `textProblems()` find overlapping, off-screen and crooked text; `menus.cjs`
  reports them per window (0 at 932x430 and 667x375, normal and large text).

- **Round 33.2 (dev menu):** reorganised into HERO, GEAR, FORGE, WORLD, TOWN
  and DEBUG tabs, each with a help line, a gold label on every row, row
  shading, a status line at the bottom, and colours by kind (grey pickers,
  green toggles, red actions, bright red for destructive ones). New tools:
  max level, max rite ranks, reset Second Breath, wear a set with its arms,
  +50/+500 Emberstones, force the next reforge quality, worn stats to
  mythic, an enchant on any worn slot or one of each, ingredients for one
  enchant, Warden drops on the spot, clear enchants/ingredients/qualities,
  reset yard records, the Training Yard.

- **Round 33 (reforge qualities, Emberstones, the Enchanter):** reforging no
  longer costs gold: it spends an Emberstone (`loot` `emberstone`, drops `ember`,
  three to start) and rolls one of five qualities with its own colour; the
  forge has REFORGE and VALUES tabs in its title band (`forgeTabs`,
  `renderForgeValues`). Stats show in their quality colour on every card.
  The Enchanter: a new site south of the forge with 16 enchants (Emberwake,
  Stormlink, the Hunger, Reaper's Mark, Second Breath, Bone Ward, Thorned
  Hide, Bloodletting, Splinter, Frostbite, Martyr's Echo, Last Light,
  Relentless, Phantom Volley, Gilded Tithe, Ghost Step), each from three
  unique ingredients (48 icons in `vfx.mjs`, `INGR`). Hooks: `enchKill` (kill
  effects, the yard too), `passK` (damage), `secondBreath`, Bone Ward and
  Thorns/Echo in `damagePlayer`, Frostbite/Stormlink on bolt hits,
  Bloodletting in `hurtEnemy`, Emberwake in `startDash`, Ghost Step in
  `perfectDodge`, Phantom Volley in the player update. Dev menu: +50
  EMBERSTONES, +1 EACH INGREDIENT, OPEN FORGE, OPEN ENCHANTER. Test:
  `tools/tests/round33.cjs`.

- **Round 32.2 (strata restyled after the owner's concept image):** every
  room gets torch stands in all four corners and halfway down each side
  wall; the centre of each back wall holds a stained-glass window (Undercroft,
  Nave) or a skull niche (Ossuary) instead of a pilaster (`midWall`); the
  floor seal is a compass rose, drawn on dry stone in the Nave too; loose
  bones lie in every stratum; cages get a bone pile at their foot. The
  Undercroft lays the warm chapel flagstones in every room. The Nave lies
  under a shallow flood of overlapping pools in nearly every room (water
  is only drawn, never solid), with weed and kelp on the shores and planks
  floating (`plank`); its flames burn blue (`DROWN` maps ember to holy,
  except on the loot sheet; `STRATA[2].light`/`torch`). Water uses the new
  `sea` ramp with a pale foam lip on every shore. The Ossuary uses skull
  pedestals for pillars (`skullpillar`) and heaps bones along its walls.
  Candle light (`LIGHT_RGB.flame`) is warm gold now (it was green) and
  takes the stratum's light colour.

- **Round 32 (Ossuary rooms, yard records, Stratum III Wardens):** new
  props for the Ossuary Spire (skull shelf, skull heap, candle cairn, bone
  pew, strewn bones) placed by `populate()` when `ossuary`; the Training
  Yard keeps a best damage a second per build (`SAVE.yardBest`,
  `yardKey`) and shows it on its panel, with a NEW BEST toast when you beat
  an old record. The Ossuarch gained rising bone spikes (`barrage`,
  thorn) and the Ash Widow an aimed ember volley (`snipe`) in
  `MORE_ATTACKS`; her fire pools burn hotter (14 to 22). Tests:
  `tools/tests/round32.cjs`, `tools/tests/ossrooms.cjs <dir> [stratum]
  [floors]` (photographs every room of a stratum).

- **Round 31 (Stratum III, Training Yard, HUD):** Stratum III, THE OSSUARY
  SPIRE (`STRATA[3]`, sheets `_o` from the `OSSUARY` remap, `OSSUARY_PAL`
  for the baked wall edges, cold `ash` light and green torches via
  `ST.light`/`ST.torch`), opens after Station VI (`STRATA_NEED`). Monsters in
  `tools/models/ossuary.mjs`: Bone Gleaner, Cinder Moth, Marrow Abbot, and
  the Wardens the Ossuarch and the Ash Widow (roars, falls, earned halos
  `rot` and `shroud`, stand frames 9 and 10, `music_ossuary`,
  `music_warden_ossuary`). The Vigil Roll shows five halos to a row. The
  Training Yard (`openYard`, `run.yard`) sits at the end of the lower street
  (`street.yard` prop): a dummy that counts damage a second, a summon panel
  at the statue (every foe and Warden, any open Station, foes calm or
  attacking), no gains, no death. The kill streak line under Zeal replaces
  the old `xN` counter; a pulsing red edge shows below 25% health; Descent
  rows space out with the text size.

- **Round 30 (HUD feel, crits, text size):** crit numbers size and colour
  by how they compare with recent plain hits (`game.avgHit`; gold, orange
  at 3x, crimson at 6x, `CRIT_COL`), with a short pop. Reaching a Zeal
  step flashes the bar, pops the tier name and rings a rising knell
  (`game.zTier`, `game.zFlashT`). A hit of 8% max HP or more shakes the HP
  bar and reddens its number (`game.hpShakeT`, off with screen shake). A
  TEXT SIZE setting (`opt('text')`, `TEXT_SIZES`, `TEXT_K`: 0.92 / 1 /
  1.06) scales every string; `textW` now measures once at scale 1 and
  multiplies, so growing numbers cost nothing. The old bitmap font tables
  (`GLYPHS`, `FONT`) and `drawPortrait` are gone. `TEXT=large node
  tools/tests/menus.cjs` checks every window at the large size.

- **Round 29.2:** a black band could show at the top on iPhone Safari when
  its toolbars moved without a resize event. `resize` now sizes and places
  the canvas from `visualViewport`, the body is fixed so the page cannot
  scroll, and a half-second check re-runs `resize` when the view changes.
  The Zeal bar is as wide as the HP bar (29.3); under it, the damage bonus
  on the left and the tier name on the right (29.4). The vow line under the Toll reads just MARTYR'S VOW.

- **Round 29 (font and HUD):** all text now uses Barlow Semi Condensed
  SemiBold (`assets/fonts/ui.ttf`, font face 'Saint UI', `UI_FONT`).
  `text()` measures and queues; `flushText()` draws the queue on the screen
  canvas at device resolution after `blit()`. `layerBreak()` blits, draws
  the queued text and clears the game buffer, so a window drawn after it
  covers the text under it: render calls it before the menu windows, and
  any window drawn over another window needs one too (the altar's memory
  does). The portrait is gone: HP and Zeal bars (`hudBar`, with a pale
  drain strip for lost HP and tier marks on Zeal) sit at the top left, with
  a line under Zeal giving the damage bonus and the next tier. The level
  bar is a quarter of the width, centred, labelled `LEVEL N (P%)`. The Toll
  bar fits between the HP bar and the minimap with its label underneath.
  The Rites tab label shrinks a little instead of being cut.

- **Round 28 (passive icons, deed passives, 4-piece damage, grind check):**
  every passive has an icon (`PASS_ICONS` in `props.mjs`, same order as
  `PASSIVES`; ui `passive` frames); the PASSIVES tab is a 6-wide icon grid.
  Eight passives are earned by lifetime deeds (`stat`, `need`, `deed`;
  `passEarned`): Blood Tithe, Elite Hunter, Warden-Breaker, Holy Burst, Last
  Stand, Deft Feet (`perfWin`), Shrinekeeper, Relic Sense. Four pieces of
  any set add +25% damage (`SETK.four`) and a smaller form of the set's
  six-piece damage (`SETK.*4`; mixes went from 3.7-10 to 5-11 kills a second). `tools/tests/grind.cjs` works out
  the gear a full clear drops per Station: about 9-17 pieces a run, a
  Hallowed every 3-7 runs, and 620-890 runs (70-100 hours at 7 minutes) to
  finish one chosen six-piece set from drops alone (Odile's Gift, Vigil set
  pieces and bounties shorten it).
- **Round 27 (passives, the Reliquary horde, brighter rites, bag colours,
  fewer drops, set balance):** passive skills (`PASSIVES`, 16 in offence,
  defence and utility; three slots opened at Devotion 0, 5 and 15,
  `PASSIVE_AT`; `pas(id)`; the PASSIVES tab of the Rites panel). Damage
  passives go through `passK`, defences through `setGuard`. The Weeping
  Reliquary (`RELIC`): 100 kills in 90 s, waves of 20-30. Every cast flares
  in its set's colour (`riteFlare`); the Ward shows a shield, a Reckoning an
  aura, pools sparkle, pillars and lashes are larger. Bag cells fill with
  the rarity's `cell` colour and a 2 px rim; set pieces wear a star
  (`setStar`, drawn by `itemIcon`). Drops: `DROP` (kill 0.3%, rare 10%,
  elite 0.5), Wardens drop 2, Hallowed and set weights 1.0 and 0.4. Set
  balance: `tools/tests/setbal.cjs` (each set whole with its arms and rites,
  4+2 mixes, no set; kills and damage taken a second); tuned numbers live in
  `SETK`. The altar text under the bag's paper doll is gone.
- **Round 26 (a rite per set, ranks, twists, aimed Reckonings, death
  recap):** six new rites so every slot has one per set (`RITES`): Rite I
  Iron Brand (Confessor, aimed spot, binds) and Hymn of Cinders (Choir,
  rolling fire, Zeal per hit); Rite II Crown of Nails (Nails, a ring of
  bolts) and Aspersion (Font, heal and a pool); Reckoning Pilgrimage of
  Fire (Stride, dashes refill and leave fire and a nova) and the Great
  Penance (Confessor, binds and judges all in sight, +50% damage via
  `e.judgedT`). Each has a rite Wound and an icon (`GLYPH` in `props.mjs`).
  Ranks: `SAVE.riteXp`, `RANK_AT`, `riteRank`, `bumpRite` (5% off the
  cooldown per rank, +0.4 S for a Reckoning). Twists: `TWIST`, `twist(id)`
  with six pieces of the rite's set (second casts run through `later()`).
  Judgement and the Great Font can be aimed from the Reckoning button
  (`player.penAim`, `AIM_ZONE`). Death recap: `noteHurt` logs damage by
  monster and attack (`damagePlayer`/`hurtPlayerRaw` take `how`),
  `deathRecap` picks the top three and a tip (`HURT_TIP`), drawn by
  `renderRecap` beside the receipt. `tools/tests/round26.cjs`.
- **Round 25.3 (drag to aim, no pop on leaving):** hold an aimable rite's
  button and drag to aim (`AIMABLE`: Holy Water lands where you point,
  Baptism, Nail Storm, Ember Step and the Chain go that way); the outline
  draws from the Saint (`renderAim`) and a knob shows on the button. Release
  casts (`input.aim` into `castM1`/`castM2`); dragging back inside
  `AIM_DEAD` cancels; a plain tap still auto-aims. Shackle Circle, Censer
  Blaze and Martyr's Ward hit around you and stay tap-only. Leaving the page
  fades the audio over 60 ms before suspending (`goAway`/`comeBack` in
  `AUDIO`), which removes the pop on swiping home. `tools/tests/aim.cjs`.
- **Round 25.2 (plain text):** every instruction, panel, toast, banner,
  tutorial step and change note was rewritten short and plain (the owner
  found flourishes like "it needs no aim: stay close and let it work" read
  as AI-made). SLAY became KILL everywhere; Warden lore lines were dropped
  (the banner shows "WARDEN OF STATION N"); the receipt is plain (YOU DIED,
  KILLS, LOST). Townsfolk chatter keeps its voice. The rule is in
  `CLAUDE.md` under Writing style.
- **Round 25 (Warden music, the pool, the vow, the Vigil Roll, sound
  settings):** a living Warden plays its own battle loop (`music_warden`,
  Juhani Junkala's Epic Boss Battle; `music_warden_nave`, an epic Toccata
  and Fugue in the Drowned Nave); `update()` switches on `game.warden` and
  the fall ducks the music. Settings gained VOICES (a third bus,
  `AUDIO.voiceBus`, for `die_`, `roar`, `fall_` sounds) and MONSTER CRIES
  (all, rares and elites, off; `deathVoice`). The Scrying Pool
  (`openPool`): pick a Station, a stake (up to `wagerCap`) and a mark
  (`WAGER_MARKS`: the Toll rung, the Warden falls, home with the
  Waystone); odds from `wagerOdds` are fixed when placed and paid by
  `settleWager` in `bankRun` from `run.reach` (1 Warden came, 2 slain, 3
  home). Martyrdom (`openMartyr`, `SAVE.vow`): the next Station descent is
  a Martyr's (`run.martyr`, kept across suspend): gear and gold x2, a fall
  loses all gold and every found piece, and a fall with the Toll half rung
  earns the cracked halo (`HALOS` `cracked`, `ramp`/`crack`, earned by
  `earnLook('martyr')`). The Vigil Roll (`openRoll`, `SAVE.vigilRoll` via
  `rollVigil`) stands right of the cathedral with a halo stand per
  earnable halo (`vigilroll`, `halostand` in `town.mjs`, frame = earned
  index + 1). `tools/tests/round25.cjs` covers it.
- **Round 24 (music, voices, more looks):** Vael plays Christislord's chant
  (`music_town`); the sung version (`amb_choir`) runs in step with it and
  rises as the Saint nears the cathedral doors while the organ falls away
  (`AUDIO.level`, `LEVELED`). The Undercroft plays `music_undercroft`, the
  Drowned Nave `music_nave`, the Bleeding Vigil the old `music_dungeon`.
  A Warden's coming plays its own `roar_<id>`, the `sting_warden` and
  ducks the music (`AUDIO.duck`); its death plays `fall_<id>`. Monsters
  cry out by family (`VOICE`: bone, flesh, spirit, vermin, cleric; two
  takes each, `deathVoice`): common foes about one death in four, spaced
  out; rares and elites always. The Plush stall gained BOLTS (`TRAILS`,
  read by `boltFx`) and DASH (`DASHES`, tinted ghosts via `tintKey`) tabs,
  and seven halos earned by slaying each Warden at Station X or deeper
  (`HALOS[].earn`, `earnHalo`, `EARN_FROM`); earned halos sparkle.
  `tools/tests/round24.cjs` covers it.
- **Round 23 (new sounds, set icons, Hallowed shimmer, the Plush stall):**
  every effect was rebuilt from CC0 recordings (`tools/build-sfx.py`, sources
  in `docs/CREDITS.md`): a real crossbow, layered wet hits and bone cracks,
  bells and gongs through a stone-hall reverb, a Warden roar. New sounds:
  `dash` (was synthesised), `eshot` (every monster shot), `knell`, `drip`,
  `roar`, `levelup`, `legend` (a Hallowed drop), `buy`, and the altar's
  `burn`, `learn`, `ash` and `grind` (the outcome sounds when the animation
  reveals it). `amb_fire` crackles near the altar and the forge
  (`AUDIO.level`). Each effect is levelled to the loudness of the one it
  replaced, so `VOL` stayed fair. Set pieces and set arms have their own
  icons (loot `setitem`, `SET_ICONS`): the set's colours and its mark.
  Hallowed slots in the bag get a light sweep and a twinkle (`hallowSweep`,
  `twinkles`), and Hallowed drops twinkle on the ground. The Plush stall
  opens after 5 falls: 9 robe dyes and 7 halos (`DYES`, `HALOS`,
  `SAVE.looks`), tried on in a large preview and bought with gold.
  `lookSheet` recolours the Saint's sheet once per look (crimson ramp for
  the robe, gold in the top rows of each frame for the halo; crowned set
  skins keep their crowns) and `drawPortrait` does the HUD portrait.
  `tools/tests/round23.cjs` covers it all.
- **Round 22 (an icon for every Hallowed piece):** `LEGEND_ICONS` in
  `tools/models/vfx.mjs` builds 30 icons into loot `legend`, in `LEGENDS`
  order. Each reuses its slot's sculpt (`BODY`) with materials swapped
  (`remapScene`) and its own mark (embers, a thorn crown, a die, a molar
  with a halo...). `itemIcon(it, x, y, o)` in `index.html` picks it for any
  piece with `it.power`: the bag, the paper doll, shops, drops on the
  ground, the altar list (now with an icon on each row), its socket cards
  and THE ALTAR'S MEMORY. The memory's icons only grow 1.5x on cards 38 px
  and taller. The bag's power list no longer overlaps NOTHING WORN.
  `tools/tests/round22.cjs` puts one of each in the bag.
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
- iPhone Safari has a total canvas memory limit; past it every draw throws "the object is in an invalid state". Empty big canvases you replace (`c.width = c.height = 0`, as `freeRoomCanvases` does) instead of waiting for garbage collection.
- Errors never stop the loop; they are logged instead. If the owner reports a bug, ask what the pause screen says under BUG LOGGED, or read `localStorage['hollow-saint-errors']`.
- `text()` measures (cached in `TEXT_W`, at scale 1) and queues; the real font is drawn after the pixel layer, so text always sits on top of its layer. A window over another window needs `layerBreak()` first, or the lower window's text shows through. `small: true` is the smaller size.
- Audio starts on the first tap (iOS rule). Music streams through `<audio>` elements, effects are decoded buffers. `AUDIO.set([...])` picks the loops; `sfx(name)` plays an effect.
- The sound packs are not committed and not in a fresh container: download them again into a scratch folder (layout in `build-sfx.py`'s header) before rebuilding any sound. Treat downloads as untrusted (own folder, `python3 -I`).
- `node tools/sprites.mjs` takes about 16 s since round 31 (the two Ossuary Wardens are large).
- Rebuild sound effects with `python3 tools/build-sfx.py <src> [names]` (needs numpy) and music loops with `tools/build-audio.sh <src>`, after downloading the packs in `docs/CREDITS.md`; the sources are not committed. Each recipe in `build-sfx.py` lists its layers; `lu=` is the loudness it is levelled to.
