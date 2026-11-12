# Handoff

Last updated 2026-11-12, after round 83 (build 83, on `master`). Read
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
   932x430, 844x390 and 667x375 (and `TEXT=large` once), a soak per class
   (`SOAK_HERO=saint|mendicant|anchoress SOAK_DEATH=0.04 node
   tools/tests/soak.cjs <dir> 300`; three run fine in parallel), and look at the
   screenshots at phone sizes (game widths run about 445 to 620 px, heights
   250 to 290). Text must fit: prefer shorter wording to `fitText` chopping.
5. Big art or sound jobs can go to helper agents in parallel (round 31 did
   this): give them the art rules from `CLAUDE.md`, tell them not to touch
   `index.html` or commit, and review their previews yourself before
   wiring anything in.
6. Run at most four Playwright tests at once: with more, a test can poke
   the page before it has loaded (`HS.player` or `HS.shards` undefined) and
   fail; rerun it alone before looking for a bug. `setbal.cjs` runs take
   minutes per build; three classes in parallel is fine.
7. Rounds 74-81 were worked on the branch `claude/pensive-archimedes-wuz1yw`
   and pushed to `master` each round; rounds 82-83 on `claude/nifty-darwin-4oposd`.
8. Balance jobs in a shell script: do not pass `WOUNDS='{"x":1}'` through
   `xargs` (it strips the quotes and the run prints nothing).

## Where the game stands

A playable action-RPG slice for iPhone, always landscape (held upright the
canvas turns a quarter, `PORTRAIT` in `resize`, and `toLocal` maps taps).
Desktop works with keys. 55-60 fps in dense crowds on a phone.

- **Look:** sculpted SDF pixel art on a chunky 2x2 grid (the Otherworld
  Legends look), whole-number scaling, a 305 px tall view, torch light on
  dark stone. Every pixel is on the palette (`tools/palette.mjs`, 26 ramps; `sea` was added in 32.2 for water).
  `resize()` sizes from `visualViewport` and re-checks twice a second
  (iPhone Safari's toolbars once left a black band). Since rounds 78-79
  every monster, Warden and hero renders with `rich` shading (`sdf.mjs`:
  parts melt together, cast soft shadows on each other, seams crease, cloth
  folds and flesh lumps; `NORICH=1` previews the old look). Round 79
  re-sculpted the three boxiest models (the Coffin Golem, the Bellwright,
  the Drowned Organist). Every monster attack has three frames (wind-up,
  a second wind-up from `rear()`, strike; elites and Wardens each lean
  their own way, `WIND` in `elite.mjs`).
- **Text and HUD (rounds 29-30, font and case from round 66):** all text is
  Saira Semi Condensed (SemiBold, Bold for titles; `assets/fonts/ui.woff2`,
  `ui-bold.woff2`) in mixed case (`caseOf`: short labels in Title Case,
  longer ones as sentences, game names and Roman numerals kept), drawn at screen resolution over the
  pixel art (`text()` queues, `flushText()` draws, `layerBreak()` between
  windows). HP and Zeal bars sit top left with the damage bonus and Zeal
  step under them, then the kill streak; a slim level bar is centred at
  the bottom. Crits are gold, orange or crimson by size; the Zeal bar
  flashes at each step; big hits shake the HP bar; a red edge pulses below
  25% health. TEXT SIZE setting (small, normal, large).
- **Vael, the town:** a walled hub town (`makeTown`, 90 x 68 tiles). The
  cathedral (the descent) stands at the top above a paved close, with
  Martyrdom's stake and the Canonry's lectern by its doors and the Ashen
  Altar's yard to its left. Below it is the cobbled market square
  (`TOWN_SQ`, a fountain, benches, flower beds). Pell's stall, the
  Enchanter, the tavern, the Scrying Pool, the Plush stall and the Bounty
  Board all face the square (`STALLS`, `STALL_Y`). Dirt lanes
  (`TOWN_ROADS`) lead to the Pilgrims' Gate and the homes (west), the
  Ember Forge's yard (east), the Quiet Acre with the Penitent Cells and the
  Vigil Roll (north east), the Training Yard (south east) and the south
  gate. Buildings below the north row are depth-sorted props with solid
  bases, so people pass behind them (the Saint shows as a faint ghost
  there). Walkers keep to `TOWN_WALKS`. `HS.townOverlaps()` must stay
  empty. With `?dev`, the pause screen's LAYOUT button opens the town
  designer (round 45).
- **The descent:** the Descent panel at the cathedral doors picks a Station
  (I-XXX, `DIFF`), a stratum, omens, and holds the Bleeding Vigil. Three
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
  Round 48 added a RECORDS tab (`YARD_REC`, `yardRecords`): every build's
  best 5 s window and best 30 s test (`SAVE.yardTest`, `YARD_TEST`), a
  START 30 S TEST button (3 s count, then the HUD shows time left and the
  average) and RESET RECORDS (asks first).
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
- **Characters and classes (rounds 70-73):** up to four characters
  (`roster()`, `MAX_CHARS`), each a whole save with a class fixed when it is
  made; no switching in game. Front screens: splash, character select,
  creation with three class cards (`HEROES`). Three classes:
  - **The Saint:** a floating auto-aiming crossbow (`updateCrossbow`).
  - **The Mendicant:** a mace that hits every foe in its arc
    (`updateMelee`, `MELEE`; 10% less damage taken). Blows go through
    `boltStrike(b, e)` with `b.melee`. Rites `MRITES` (`castMM1`/`castMM2`,
    `maceHit`).
  - **The Anchoress (round 71):** reliquary shards that fire on their own
    (`SHARD`, `shardCount`, `updateShards`, `fireShard`). Since round 73
    they are ice-blue crystal blades hovering in a ring over her head (fx
    `crystal`, 16 headings); rites that throw them bring them to the
    ground. In flight they draw as a slimmer crystal (`crystalbolt`) with a
    faint ice trail, burst ice-blue on a hit and fire with a glass `chime`
    at four pitches. Fewer shards hit harder each, so every extra shard is about
    +10-15%. She raises her reliquary as they fire (`raise` anim). Rites
    `ARITES` (`castAM1`/`castAM2`; her Reckonings `shattered` and
    `cathedral` run in `updateShards`).
  Each class has 18 rites (6 per slot, one per set), its own Hallowed
  pieces (`LEGENDS` with `hero`), its own five sets and starter set (below)
  and its own level-up cards (Wounds with `hero`; `rollStigmata` also
  filters by equipped rites). Text that names a weapon goes through
  `heroText` (`HERO_TEXT` for him, `HERO_TEXT_A` for her).
- **Combat:** each class's basic attack (above), dash with a perfect dodge,
  the Censer, two rites and a Reckoning chosen from the class's 18 (6 per slot, one per
  set; `RITES`, `MRITES`, `ARITES`; 15 of them open by Saint level, `RITE_LV`, and each slot lists them lowest level first), with ranks from use (`RANK_AT`), 6-piece twists
  (`TWIST`), and drag-to-aim (`AIMABLE`). Passives: three slots opened by
  Saint level (1, 10, 25), 24 in all, 8 earned by deeds (`PASSIVES`). Zeal steps give
  +10% damage each. Executions, kill streaks and the Carnage bonus.
  Monsters are punishing: telegraphed snipes, blight pools, novas,
  barrages, homing shots, the Sentence. A death recap names what hurt most.
- **Run levels and Wounds (rounds 73, 80-81):** up to 15 levels
  (`MAX_LEVEL`). Each level offers 3 Wounds: shared ones, the class's own (7
  each since round 80) and those of its chosen rites (`round73.cjs` and
  `round80.cjs` check). The level-up screen also has:
  - **REROLL:** new cards for `REROLL_BASE` (500) x the Station's gold rate
    (500 at I, about 1,380 at VI, 2,430 at XII; about a quarter of a full
    clear), paid from the run's gold only. Each reroll in the same level
    costs 1.5 times the last (`REROLL_UP`); the next level starts at the base.
  - **SACRIFICE:** asks first, then takes 7 random ranks for a random
    mythic Wound (one rank each, never on a card; 3 shared plus 2 per
    class, each with its own emblem). The owner wants it random: a gamble.
    Round 82: the seven ranks fly in and break one by one (`renderSacrifice`,
    1.15 s, sound `sacrifice`), then the mythic card.
  - **Held Wounds:** small rarity-framed tiles with ranks in the top
    corners (`heldStrip`). Tapping one shows its card (round 82).
- **Gear:** 10 slots (8 vestments plus two arms slots: crossbow and quiver,
  a mace and satchel for him, a reliquary and phylactery for her), 5
  rarities, item level = Station (Sanctity). Drops are rare on purpose
  (`DROP`); Hallowed pieces are about 1-1.8% of drops.
- **Sets (round 72):** each class finds only its own five 6-piece sets and
  starter set (`HERO_SETS`, `STARTER`, `mySets()`): the Saint the Hundred
  Nails, Penitent's Stride, Drowned Font, Last Confessor, Burning Choir and
  Odile's Habit; the Mendicant the Beggar King's Iron, Wanderer's Road,
  Almsgiver's Bowl, Gaoler's Keys, Cracked Bell and his Rags; the Anchoress
  the Shattered Reliquary, Glass Martyr, Mother's Psalter, Veiled Lantern,
  Thorned Crucible and her Shroud. Each has 2/4/6 bonuses (4 pieces also
  give +110% damage, 6 pieces +25% plus the set's own big 6-piece bonus),
  2-piece arms, a skin, item icons, a badge, a sigil and a Penitent Cell.
  Strength in `SETK`; check with `setbal.cjs` per class. `docs/SETS.md` has
  the table.
- **Affix tiers (round 71):** besides basic stats, a piece holds up to two
  Graven (advanced) and two Beatified (ultimate) lines (`GRAVEN`,
  `BEATIFIED`, `it.adv`, `it.ult`). Graven lines sometimes drop on rare+
  pieces; Beatified never drop. The forge's AFFIXES tab cuts them (Graven 8
  Emberstones and gold; Beatified 40 Emberstones, much more gold and a
  Reliquary Tear, `SAVE.tears`, from the Weeping Reliquary and deep
  Wardens). ALL LINES lists every line and range. Proc lines (round 72):
  hit twice, lightning every 12th hit, kills that burst.
- **Menus (rounds 66-69):** Torchlight-style panels after the owner's
  reference screens (`panelFrame`, `headerBar`, `inset`, `rowPlate`,
  `tabPlate`, `invButton`), one character hub with tabs (Gear, Items,
  Ingredients, Rites, Talents, Censer), item cards that fade in, town
  services in list panels, a pause panel of tiles, a settings page.
  Hits on one foe within 0.35 s add into one damage number.
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
- **Account systems:** the Saint level (1-60) and its talent trees (Canonry), the Ember Forge
  (reforge, temper), the Ashen Altar (burn a Hallowed piece to learn its
  power; three sockets; Chrism and pity raise the odds), the Censer's 12
  deed upgrades, the Bounty Board, Penitent Cells, Odile's Gift, the
  Scrying Pool, the Martyr's vow, suspend and resume.
- **Settings and tools:** settings panel (effects, shake, damage numbers,
  text size, haptics, music, sounds, voices, monster cries, left-handed),
  dev menu (`devRows()`), `?prof` and `?fps` profiling.
- **Sound (round 77):** every attack has a sound: the mace's swing and
  blow, monster swings, casts and slams (`sfxAt`, quieter with distance,
  deeper for elites and Wardens), a cast on every rite, glass on a shard
  crit, the Anchoress's chime. Built from CC0 OpenGameArt packs already in
  `docs/CREDITS.md` (`build-sfx.py`; the packs download from
  opengameart.org here, kenney.nl is blocked; the chime is synthesised by
  `tools/build-chime.py`).
- **Not yet checked by ear:** the round 77 attack sounds and the chime, and
  the round 31 sounds (`roar_`/`fall_ossuarch`, `roar_`/`fall_ashWidow`,
  `music_ossuary`, `music_warden_ossuary`) were only measured. Ask the owner
  how they sound and whether any are too loud (`VOL`). A backup battle track
  ("Heavy Dungeon", MintoDog, CC0) was noted but not downloaded.

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

- **Mythic Wounds.** Measured with full sets in rounds 82-83; all sit at
  about x1.3-1.6 at Station XII now. Earthbreaker still does little at VI
  and for the Cracked Bell. Nothing has been measured for the Saint with
  sets (round 81's Saint numbers are bare).
- **Wound follow-ups.** A REROLL count on the button ("2nd reroll"); the
  held strip on the pause screen too; ask the owner how the sacrifice sound
  and the 1.5x reroll step feel.
- **Set balance, where it stands.** Mendicant (round 74, 3 seeds): Alms 12.0
  and Gaol 10.2 at VI, Bell 13.8 at VI and 5.2 at XII; the Beggar King's
  Iron is his lowest deep (4.9 at XII). Anchoress (round 76, 4 seeds):
  reliquary 17.7 / 7.5, glass 18.1 / 6.1, psalter 15.0 / 5.8, thorn 13.1 /
  6.9 (after round 77's wider ring), lantern about 6.8 at XII (VI / XII).
- **More art.** Rite glyphs and passive icons are flat hand-drawn glyphs
  on buttons (`button`, `badge` in `props.mjs`), not sculpts, so `rich`
  shading does not apply to them; a re-draw would be its own job. The class
  busts (`portrait_m`, `portrait_a`) show only on the pause panel; set looks
  have busts for the Saint only (`portrait_<set>`).
- **Sounds, still unheard.** Round 83 measured every effect's loudest 100 ms
  times its `VOL`: the round 77 attack sounds play at -21 to -30 dB (the
  other effects' median is -20, `shoot` is -30), so none stands out; the
  sacrifice was as loud as `legend` and `hurt` and was lowered (0.7 to
  0.55). The owner has not said how any of them sound.
- **Whole-game review leftovers (round 74).** A longer hero dash (3
  frames), a hint card in the bag's empty right third on wide phones, the
  Descent panel's tight rows. A brow gem for the Shattered Reliquary was
  tried and dropped (it vanishes on the 2x2 grid).
- **Set polish.** Some 6-piece texts run to three lines on small cards
  (the Wanderer's Road); the new sets' Penitent Cells reuse old monster
  mixes; the Iron and Thorn crowns have no halo. One Hallowed piece per
  new set that bends its mechanic.
- **Affix tuning.** Watch how fast Reliquary Tears come (`TEAR`) and the
  Graven drop rate (`GRAVEN_DROP`) in play.
0. **Town from the owner's own layout.** If the owner sends a `VAEL1:` code
   from the designer, build `makeTown` from it (keep buildings as props with
   base footprints and run `HS.townOverlaps()`).
1. **Town polish.** Round 47 redid the hedges and flower beds; the
   bushes and oaks could get the same 3/4 tilt, and the square's empty
   cobbles south of the fountain could take a market cart or two.
2. **Rites panel.** The 35-40 gap is the last long one (Iron Brand 35, the
   Great Penance 40). (The Saint-level toast names the next rite since round 74.)
3. **Round 42 follow-ups.** Ask the owner how the talent numbers and the
   level curve feel (`lvNeed`, `TALENT_TREES`) and whether rite levels
   (`RITE_LV`) open too slowly for the Font and Confessor sets.
4. **Tune enchants and reforge odds from play.** Enchant strengths are set
   by eye (`enchKill`, `passK`, `damagePlayer`); try them at Stations X to
   XV and in the Training Yard.
5. **Tune Stratum III from play.** Round 32 gave both Wardens a fifth
   attack; ask the owner how the fights at Stations VII to XV feel.
6. **Balance, what is left (round 57 data, both heroes, 4 seeds).**
   Station XII full sets now 6.6-9.1 kills a second (Saint: Stride 8.7,
   Confessor 8.8, Nails 6.8, Choir 6.7, Font 6.6). Station VI full sets
   11.6-22 (the Saint's Choir about 20-22 and Font 19 are the top; the
   Mendicant's 11.6-19). Weakest mixes: Font 4 + Confessor 2 (4.7 at XII,
   7.8 for the Mendicant at VI) and Choir 4 + Stride 2 deep (5.3-6.1).
   Why sets differ deep: flat multipliers (Stride x7 after a dash, the
   Confessor on bound foes, now the Choir in Reckoning) pay off where foes
   are tough; shares of health barely help. Runs move about 20% between
   tries: use 4 seeds.
7. **Warden blows.** Round 49 caps one Warden blow at 40% of health
   (`WARDEN_BLOW`); `balance.cjs` now shows 2.5 blows to die from Station XI
   on. Ask whether the deep Stations still feel hard enough.
8. **More ambience.** The Undercroft's draught could carry a few leaves or
   ash flakes. (Foes wading in the Nave ripple since round 74.)
9. **The pool's crowd.** Let the crowd at the Scrying Pool cheer or jeer
   when a wager settles in Vael, and show past wagers (won and lost).
10. **A fourth class.** Done for three (round 71 added the Anchoress). A
   new class needs: `HEROES` (game and `base.mjs`), a model file, 18 rites
   with glyphs, Wounds, `RITE_MORE`/`TWIST`/`RITE_LV`, five sets and a
   starter (see "Sets per class" in `CLAUDE.md`), Hallowed pieces with
   icons, `heroText` lines and a create-screen card.
11. **Art pass on small icons.** Review every sheet with `CHUNKY=2`: the
   Chrism vial on the ground, weed mats.
12. **Tune from play.** Wager odds (`WAGER_MARKS`, `wagerOdds`), the
   vow's doubling, `balance.cjs`, `perf.cjs`.
14. **Animation follow-ups (rounds 60-63).** Sprite-sheet effects for the
   biggest moments (a Reckoning cast, a Warden's fall) drawn in `vfx.mjs`;
   hand-sculpted wind-up poses for the Wardens in place of `rear()`'s lean;
   per-rite unique hit sparks and cast sounds (nails, water, chains); a LOW effects check on
   an older phone.
13. **Feature ideas (round 57).** (a) Relic Hunts: a weekly chase for one
   named Hallowed piece, with clues on the Bounty Board and a marked room in
   a random descent. (b) Pilgrim companions: hire a townsfolk acolyte who
   follows you down and casts one weak rite; levels with use. (c) A Station
   leaderboard and a daily seeded descent (same map and omens for everyone,
   scored by time and Toll). (d) Cathedral rebuilding: spend gold and
   Emberstones to restore parts of Vael (a bell tower, a scriptorium), each
   unlocking a small perk or vendor. (e) Warden trophies: each Warden kill
   at a new Station adds a trophy to a hall in town, with a one-line record.
   (f) A codex: monsters, Wardens, sets, Hallowed pieces and Wounds you
   have seen, with kill counts (suggested again in rounds 77-81). (g) Weekly mutators on the Vigil (fast foes, double
   elites, no dashing) with their own leaderboard.

## History by round

- **Round 83:** the owner picked suggestions 1, 2, 3 again. **Endless Zeal
  per class:** the Mendicant gets +45% damage (not +20%), the Anchoress
  +20% and 2 shards; the Saint's is unchanged (its text reads per class).
  With full sets, 3 seeds: Mendicant iron / alms / bell at VI x1.12 / 1.07 /
  1.20, at XII x1.16 / 1.54 / 1.37 (was x1.07 / 1.27 / 1.09); Anchoress
  reliquary / glass at XII x1.57 / 1.44. **Feel:** the owner gave no notes,
  so sounds were levelled by measurement only (see "Sounds, still unheard").
  **Art:** the Mendicant and the Anchoress have their own busts
  (`portrait(skin, hero)` in `townfolk.mjs`: his brown hood, steel rim and
  iron mantle with ember eyes; her violet hood under the cream veil with
  violet eyes; `bustAnim()` in `index.html` picks one for the pause panel).
  Ingredients, ground loot and the small fx props render with `IRICH`; at
  their size nothing visible changes. Note: `heroPortrait` already exists
  (the character screen's model portrait): a second `const` of that name
  broke the page until renamed; run `err.cjs` after adding any helper.

- **Round 82:** the owner picked suggestions 1, 2, 3. **Mythic Wounds with
  gear** (`setbal.cjs`, full sets, 3 seeds, kills a second against the same
  set with no Wound; runs move about 20%). Mendicant, sets iron / alms /
  bell: at VI none 12.1 / 11.8 / 12.7; the Giant's Mace x1.50 / 1.43 / 1.30;
  Endless Zeal x1.14 / 1.02 / 1.05; Earthbreaker x1.29 / 0.93 / 1.09 before,
  x1.36 / 1.03 / 0.87 after. At XII none 4.8 / 6.9 / 4.9; the Giant's Mace
  x1.65 / 1.38 / 1.39; the Halo x1.15 / 1.49 / 1.33; Fury (40% health) x1.46
  / 1.28 / 1.69; Zeal x1.07 / 1.27 / 1.09; Earthbreaker x1.36 / 1.25 / 0.99
  before, x1.81 / 1.41 / 1.39 after. So his mythics work once he has a set;
  only Earthbreaker changed (400% from 250%, radius 110 from 95). Anchoress,
  sets reliquary / glass: at XII none 5.7 / 5.2, Prism Heart x1.45 / 1.82,
  Choir of Glass x1.47 / 1.38; at VI Prism x1.07 / 1.04 (the kill ceiling).
  Prism Heart was left alone: +25% damage was tried and gave x1.70 / 2.17 at
  XII. **Wound screen:** tapping a held tile opens its card (`heldTiles`,
  `game.stig.peek`, `renderPeek`; any tap closes); a sacrifice plays for
  `SAC_T` 1.15 s (`renderSacrifice`: the seven ranks as tiles on a ring fall
  to the middle in turn and break into pixels, the emblem grows; taps wait;
  skipped under `HS_AUTOSTIG`) with its own synthesised sound (`sacrifice`,
  `tools/build-sacrifice.py`: seven cracks, then a low bell; not heard, only
  built); each reroll in one level costs `REROLL_UP` 1.5 times the last
  (1,380, 2,060, 3,090 at VI). **Art:** the Penitent Colossus has a real
  hood (a big sack head set forward, a cowl over both shoulders, a dark
  opening with ember eyes); the Inquisitor has his own spaulders (`spaulder`
  in `elite.mjs`: a dome, two lames with steel rims, a flange and a spike);
  gear, set, Hallowed and mythic icons (`IRICH` in `vfx.mjs`) and the
  portrait render with gentle `rich` shading (a small change at icon size).
  Test: `round82.cjs`. `e2e.cjs` ends in the tutorial's Wound step
  (`state: stig`) on build 81 as well: not new.

- **Round 81:** the reroll's price, measured. Gold from one full clear
  (every foe, breakable, chest, imp, the Warden, the Reliquary 60% of the
  time; coins 3-9 x the Station's `gold`): about 1,900 at Station I, 3,400 at
  III, 6,500 at VI, 12,000 at X, 14,800 at XII, 20,800 at XV, 25,000 at XX. A
  reroll costs `REROLL_BASE` 500 x the Station's gold rate, rounded to 10
  (500 at I, 1,030 at IV, 1,380 at VI, 2,430 at XII), about a quarter of a
  full clear; still paid from `run.gold`. The sacrifice stays random (the
  owner wants it a gamble). Mythic balance at Station VI, no gear, 4 seeds,
  kills a second against no Wounds (`setbal.cjs` now takes `WOUNDS` and
  `HPK`): Saint Halo x1.31, Fury x2.0 (held at 40% health), Nailstorm x1.66
  (pierce removed; was x2.18), Eye x1.28, Zeal x1.46; Anchoress Halo x1.21,
  Fury x1.45, Choir x1.46, Prism x1.17, Zeal x1.13; the Mendicant x0.96-1.22
  (bare at VI his kills are capped by foes reaching him; damage taken fell
  from 117 to about 90 a second). Raised: Endless Zeal (x3 Zeal, 30% rite
  recharge, +20% damage), the Giant's Mace (+50%), Earthbreaker (250%),
  Choir of Glass (+30% damage), Prism Heart (+25% crit, shard crits triple).
  Each mythic has its own emblem (loot `mythic`, `MYTHIC_ICONS` in `vfx.mjs`,
  icon `myth:N`). The level-up screen shows held Wounds in its top corners
  (`heldStrip`: rarity-framed tiles, rank in the corner, mythics first).

- **Round 80:** level-up Wounds. Six more per class (`hero`-tagged in
  `WOUNDS`, ids `s*`, `m*`, `a*`): mostly stats added in `gearStats` (crit
  damage, elite damage, haste, rite cooldown, dash, armor, gold, health),
  plus Great Nails (every 9th/6th bolt a great nail), Groundbreaker (mace crits
  crack the floor; `QUAKING` guard, 0.35 s cap) and Shatterpoint (her kills
  burst into splinters; `splint` bolts never burst again, 0.12 s cap). A
  fourth rarity, MYTHIC (`WOUND_RARITY[3]`, `mythic: true`, one rank,
  ids `x*`): three for everyone (the Unbroken Halo, Martyr's Fury, Endless
  Zeal) and two per class. Mythics are never on a card; the level-up screen
  has SACRIFICE (`askSacrifice`, `sacrificeWounds`: asks first, then takes
  `SACRIFICE_N` 7 ranks at random from non-mythic Wounds, gives one random
  mythic from `mythicPool()`, uses the level's pick, and shows the mythic
  card with what was given up) and REROLL (`rerollWounds`, `rerollCost()`:
  `REROLL_PCT` 10% of `run.gold`, rounded up, at least 1; the account's gold
  is untouched; R on a keyboard). The HUD's level bar hides while the cards
  are up. Test: `round80.cjs`.

- **Round 79:** the three boxiest models re-sculpted (`elite.mjs`). The
  Coffin Golem is a barrel chest of stone swelling into shoulders and hips,
  with the coffin lid painted onto the chest as a breastplate (`lid(x, y)`,
  straps and cross kept to it). The Bellwright's bell hangs tipped from a
  wooden yoke over his shoulder with leather straps (`TB` tips its parts).
  The Organist has no case: a hump under the robe, a rounded wind-chest and
  seven pipes fanning out of his back. `rich` shading now also covers
  commons (`common.mjs` `RICH`), rares, the Ossuary's commons and rare, and
  the three heroes with all their set looks (`base.mjs`, calmer numbers).
  `NORICH=1` renders the old shading for a comparison sheet.

- **Round 78:** the owner found elites and Wardens looked pieced together.
  `render()` takes `rich: true` (`sdf.mjs`; all elites and Wardens through
  `elite.mjs`'s and `ossuary.mjs`'s `wshoot` render calls): smooth-union
  radii grow (x1.5 + 0.5; a prim with `noMelt` keeps its own), each point
  marches toward the light for a soft cast shadow from other parts, a second
  wider occlusion sample darkens creases, the whole figure falls off toward
  its bottom-right, material seams on one surface drop a shade on the side
  away from the light, and the normal is bent for detail: hanging folds on
  cloth ramps (`RICH_CLOTH`), broad lumps on flesh, bone and stone
  (`RICH_LUMP`), a faint grain on wood. Options: `rich: { melt, meltAdd,
  shadow, fall, reach, detail }`. Still to do by hand if the owner wants
  more: the bell on the Bellwright's back and the Organist's organ are
  separate boxes by design; rares and commons do not use `rich` yet.

- **Round 77:** shards in flight are a little bigger (`crystal(i, true)`:
  radius 3.9), leave a faint ice pixel trail (the `holy` ramp at 0.3 alpha)
  in place of the glow-pass line, glow ice-blue and burst ice-blue on a hit.
  Attack sounds, all from CC0 packs already credited (Swishes, 80 CC0 RPG
  SFX, 100 CC0 SFX, Magic Spell SFX; recipes at the top of `SFX` in
  `build-sfx.py`): `swing` and `mace` (the Mendicant), `mswing`, `mcast`
  and `mslam` for monsters (`performAttack` and hazard detonations, through
  `sfxAt(name, x, y, o)`, which fades with distance and is silent past 300
  px), `cast` on every rite (`riteFlare`, lower for a Reckoning), `glass` on
  a shard crit. The chime plays at four pitches, low for a great shard.
  None of these were heard, only measured: ask the owner about levels
  (`VOL`). The packs download from opengameart.org in this environment
  (kenney.nl is blocked). Elites and Wardens each wind up their own way
  (`WIND` in `elite.mjs`: turn and shift of the second wind-up frame; a
  variation of the lean, not new sculpts). The Thorned Crucible's ring is
  45% wider at 4 pieces and 65% at 6 (`SETK.thornR4`, `thornR6`): VI 13.1
  (was 12.1, inside the noise), XII 6.9.

- **Round 76:** shards in flight use a slimmer crystal (`crystalbolt`, 16
  headings, `crystal(i, true)` in `vfx.mjs`) and ring with a glass ping
  (`chime`, synthesised by `tools/build-chime.py`, no sample pack). Every
  common, elite and Warden attack has a second wind-up frame: the wind-up
  pose reared back about the feet (`rear(make, rot)` in `base.mjs`, built on
  `posedFrame`); the engine already played 3-frame attacks. Anchoress
  balance, 4 seeds (kills a second, VI / XII): reliquary 17.7 / 7.5, glass
  18.1 / 6.1, psalter 15.0 / 5.8, thorn 12.1 / 7.1, lantern 13.9 / 6.8,
  after flat 6-piece multipliers for the Lantern and the Psalter (`SETK.six`
  1.3 each; raising `lampK` or `psalK6` did nothing measurable). Note: edit
  `SETK` by matching text, not by line number (a `sed` by line missed once).
  Tests starved when seven ran at once: run at most four in parallel.

- **Round 75:** the shards the Anchoress fires are drawn with the hovering
  `crystal` sprite, picked by heading (the frame whose slanted angle matches
  the flight, no canvas rotation; `shardbolt` stays only as a fallback).

- **Round 74:** a review pass over the whole game. Balance (Mendicant): the
  Almsgiver's wave starts at 4 pieces (every 5th blow at 20+ Alms, radius
  `SETK.almsR`; every 3rd and `almsR6` at 6); the Gaoler's Keys throw chains
  every 4th blow at 4 pieces (2 Fetters on foes within `SETK.gaolR`) and
  drag from farther and faster; the Bell's `ringK6` 3 (was 2). Menus: the
  level-up screen's shade is 0.92 and damage numbers stop under it; locked
  rites in the Rites grid are brighter and every set line shows in its
  set's colour. Fix: the Saint-level toast named the first rite of any class
  at that level (a Mendicant read "Nail Storm"); it now names only the
  class's own and otherwise says when the next rite opens. Ambience: foes
  wading in the Nave leave ripples (capped at 36, off under `LOWFX`).
  `stratum.cjs` forces a room map (it failed on open maps now and then).

- **Round 73:** the Anchoress's shards are crystal blades (fx `crystal`, 16
  headings, `crystal(i)` in `vfx.mjs`; `shardbolt` is ice too) hovering in a
  ring over her head (`shardPos` returns `up`; ground orbit only for Nova,
  the Cathedral, the Thorned Crucible and the wide orbit; shards glide
  between the two). Level-up cards: Wounds take `hero` (`rollStigmata`
  filters by class and equipped rites); the Saint keeps Orbiting Nails, the
  Mendicant gets Long Reach (Piercing Faith) and Aftershock, the Anchoress
  Reliquary's Call (+1 shard) and shard names for the nail cards
  (`HERO_TEXT_A`). Test: `round73.cjs` (rolls every rite loadout per class).

- **Round 72:** every class has its own five sets and starter set; none are
  shared (`HERO_SETS`, `STARTER`, `mySets()`, `starterSet()`, `ALL_SETS`).
  The Mendicant: the Mendicant's Rags (starter), the Beggar King's Iron
  (crushing blows), the Wanderer's Road (Momentum), the Almsgiver's Bowl
  (Alms stacks from kills, waves), the Gaoler's Keys (Fetters that slow,
  drag foes in and lock), the Cracked Bell (rings). The Anchoress: the
  Anchorite's Shroud (starter), the Shattered Reliquary, the Glass Martyr
  (shard crits), the Mother's Psalter (rites fire every shard), the Veiled
  Lantern (burning), the Thorned Crucible (the shard ring cuts). Each has
  arms (`ARMS`), a skin (`SKINS` with `hero`; hero modules build only their
  own), item icons (`SET_LOOK`, `SET_ICONS` order matches), a badge, a
  sigil, a Penitent Cell (`CELLS`) and colours. Their rites were remapped
  to the new sets (`MRITES`/`ARITES` `set`). Old pieces convert once
  (`migrateSets`, `SET_MIGRATE`, `SAVE.setsV`). Also: the Anchoress raises
  her reliquary while shards fire (`raise` anim, `p.raiseT`); hits on one
  foe within 0.35 s merge into one number (`e.lastNum`); the forge's
  AFFIXES tab has ALL LINES (`renderAffixList`); new proc lines (Graven
  `echo`, Beatified `tempest` and `reaper`; `procHit`, `setsOnKill`).
  Set balance (kills a second, 2 seeds): Station VI Saint sets about 14-16,
  the Mendicant's iron 12.6, road 14, alms 8.9, gaol 7.4, bell 14.4, the
  Anchoress's reliquary 16.4, glass 17-18, psalter 14.9, lantern 13.6,
  thorn 11.7. Station XII: Saint 4.3-10.5, Mendicant 3.7-7.0, Anchoress
  4.75-6.4 (glass 5.9 after its x1.4). His Alms and Gaol sets trail at VI:
  melee kills there are capped by how many foes reach him, so area helps
  more than damage. Tests: `round72.cjs`; `setbal.cjs` runs each class's
  own sets; the soak takes `SOAK_HERO`.

- **Round 71:** the Anchoress, a third class (`HEROES.anchoress`, `isAnch()`,
  `noBow()`; class card on the create screen, which now lays out every
  `HEROES` key). Reliquary shards circle her and fire on their own
  (`SHARD`, `shardCount`, `shardDmgK`, `updateShards`, `fireShard`,
  `shardCut`; drawn as y-sorted actors, `drawShard`). Fewer shards hit
  harder each (`(4/n)^0.35`), so every extra shard is about +10-15%. Her 18
  rites are `ARITES` (`castAM1`/`castAM2`; her own Reckonings `shattered`
  and `cathedral` run inside `updateShards`, the other four go through
  `PEN_BASE`), each with a glyph, `RITE_MORE`, `TWIST`, `RITE_LV` and a
  Wound. Her set, the Shattered Reliquary (`VSETS.reliquary`, `hero`):
  2 pieces +2 shards, 4 pieces +`SETK.shardPer`% damage per shard above 4 (`SHARD.base`),
  6 pieces votive shards on every rite. Her arms (`ARMS.reliquary`, loot
  `aarms`) and six Hallowed pieces (`hero: 'anchoress'`) add shards; her
  bow and quiver pieces can roll `it.shards` (`rollShards`). Sprites:
  `tools/models/anchoress.mjs` (wraps `saintModel` with `HEROES.anchoress`
  in `base.mjs`), the `reliquary` skin, `shard`/`shardbolt` in the fx sheet.
  Then affix tiers after the owner's reference: Graven (advanced) and
  Beatified (ultimate), two lines each per piece (`GRAVEN`, `BEATIFIED`,
  `AFF_TIER`, `it.adv`, `it.ult`, `affixAdd` into `gearStats`; hooks for
  crit damage, damage to elites, attack speed in `fireCdOf`, Reckoning
  charge, more damage in `dmgMul`, less damage in `setGuard`, dash charges,
  shards). Graven lines drop on rare+ pieces (`GRAVEN_DROP`, `rollGraven`);
  Beatified never drop. The forge's AFFIXES tab (`renderAffixes`,
  `affixTap`, `affixGeo`, `affixCost`) cuts and recuts them: Graven 8
  Emberstones and gold, Beatified 40 Emberstones, much more gold and a
  Reliquary Tear (`SAVE.tears`, `maybeTear`, `TEAR`, pity `SAVE.tearDry`;
  from the Weeping Reliquary and Wardens of Station X+ or Vigil 30+; loot
  `rtear`). Cards show the lines with a coloured diamond (`affixLines`).
  Tests: `round71.cjs`. The soak now waits out the reload that CREATE causes.

- **Round 70:** characters. Up to four (`MAX_CHARS`), each a whole save with a
  class fixed when it is made (no switching: the other saint in the close,
  his map marker, `askHero`/`switchHero` and the Switch Saint tile are gone).
  The active character stays under `hollow-saint`; the others under
  `hollow-saint-char-<id>`; the roster under `hollow-saint-chars` (`roster`,
  `charMeta`, `playChar`, `createChar`, `deleteChar`). Settings, mute, dev and
  the tutorial carry over (`CHAR_GLOBAL`). Changing or making a character
  writes the saves and reloads (`sessionStorage` `hs-autostart` goes straight
  to Vael). An old save becomes the first character on first load. Front
  screens (`renderTitle`, `renderChars`, `renderCreate`, `frontTap`,
  `charsLayout`, `createLayout`): splash, then character select (slots with
  portrait, level and best Station, a delete tab, the hero on a lit ring,
  the logo box with the class, START, REPLAY TUTORIAL), and character
  creation (two class cards, a name: ANOTHER or TYPE ONE, CREATE). START and
  CREATE sit just below the middle so e2e and soak taps go straight through.
  Also: tapping a set in Odile's Gift shows its card; a claimed bounty shows
  the gear it paid (`game.itemPop`, `renderItemPop`); the bag sorts by rarity,
  slot or newest (`SAVE.bagSort`, `BAG_SORTS`, items get `t` in `bagAdd`);
  the pause panel shows HP, damage, Sanctity and Saint level against
  `SAVE.lastStats` (taken in `newRun`); the Forge's Values tab has lit quality
  headers and banded rows; site markers in Vael are navy hexes with a gold rim.
- **Round 69:** Pell's stall has COMPARE (`game.shop.cmp`): the worn piece's
  card takes the list's place beside the one for sale; BUY moved to the right
  button. Tapping a talent opens its card by the node (now, next, rank; drawn
  after a `layerBreak`), and the foot keeps LEARN and RESET with a hint.
  Sounds: a light tick on hub tabs and a softer one when a card changes,
  `buy` on a purchase, `learn` on a talent point. A dot marks the Gear tab
  while the bag holds new pieces. The Descent and Vigil arrows are drawn by
  `navArrows`; the Descent's columns have banded rows. `cardAnim` keeps one
  timer per card position (`CARD_SEEN`), so two cards on one page do not
  restart each other's fade.
- **Round 68:** polish. Town services (Pell's stall, the Forge, the
  Enchanter, the Altar) put their list in a panel with a lit header strip
  (`listPanel(L, acc, label, note, bottom)`) and draw rows with `rowPlate`;
  the Enchanter's card is lit in the enchant's colour. Every talent has an
  icon (`TAL_ICON`, `talIcon`: passive icons in the tree's colour, plus a few
  rite and loot icons). Motion: switching hub tabs slides the page in from
  the side the tab lies on and fades it up (`game.hubT`, `game.hubDir`, the
  translate round the menu calls in `render`); an item card fades in when a
  new piece is picked (`cardAnim` in `cardPlate`); fades are queued in
  `UI_FADES` and drawn over the screen at the end of `render`. The bag's
  Gear tab dropped its Rites button and Censer badge (they are tabs now) for
  one stats panel: health and Sanctity in the header, every stat as label
  and value, then sets. Wound cards are as tall as their text needs
  (`stigLayout`) and show the rank. Rite names on two lines drop the set line.
- **Round 67:** the character hub and menus, part 3. The bag, rites, talents
  and the Censer share one row of tabs in the title bar (`HUB`, `hubTabs`,
  `drawHub`, `hubTap`, `hubGo`; `hubEnter`/`hubClose` and `game.hubBack`
  replace the old per-page back states; `invTabs` is the first three hub
  tabs). Talents can be learned anywhere from the bag. Rites: a rail of slot
  tiles (Rite I, Rite II, Reckoning, Passives) with hex icons (`hexPath`,
  `hexIcon`, `pill`), the slot's six rites as hex icons in a 3 x 2 grid (rank
  and level pills), the chosen rite in full on the right; `riteLayout` keeps
  `tab(c)` and `card(_, i)`. Talents: a tree rail (`talTabs`, emblems in
  `treeEmblem`) and a node graph (tiers left to right under an axis of
  `TAL_NEED`, round nodes with rank badges, lines lit once the next tier is
  open; `talLayout().node`/`cell`). Settings: a full page with a section rail
  (`SET_SECS`; `OPT_ROWS` carry `sec` and `seg`) and a strip of choices per row
  (`row(i)` is the strip of the open section's i-th row). HUD: `gild` and the
  bars are navy and gold; round buttons and the stick knob are recoloured
  once per icon (`navyBtn`: the light disc turns navy, dark lines pale,
  saturated colour kept) with a gold ring. Wound cards are navy cards lit in
  their rarity's colour with the icon in a hex; the death summary is a navy
  card (crimson after a death, gold after a full descent). The town map's
  labels sit on dark backings and step aside when they would overlap.
- **Round 66:** menus, part 2, after the owner's reference screens (a
  mobile ARPG's full-screen menus). Font: Saira Semi Condensed from the
  `@fontsource` npm package (Google Fonts is blocked here; npm works), SemiBold
  plus Bold (`isBold`: titles with `glow` and text at `sc` 1.5+). Text shows
  in mixed case: source strings stay in capitals and `caseOf` converts them
  (memoised): up to four words with no punctuation become Title Case, longer
  ones sentences; `CASE_TERMS` (Zeal, Warden, Station...) and every multi-word
  `name` in the data (`caseNames`) keep their capitals inside sentences;
  Roman numerals, HP, XP stay upper; "6 S" becomes "6 s". A string that
  already has a lower-case letter is left alone, so `wrapW`/`wrap` case the
  whole string first and their lines pass through. Menu text (`UI_SOFT`, set
  in `render()` once a window is up, and on the title) gets a soft drop
  shadow, not the black outline. Windows: `panelFrame` turns any window over
  75% of the screen into a full-screen page (`backdrop(style)`: cached
  canvas, navy, violet for `_silver`, ember for `_iron`, crimson for
  `_blood`, diagonal light, a warm glow and hex lattice at the foot);
  `headerBar` then draws a dark title bar the width of the screen. Smaller
  windows are navy cards. The gilt corners are gone (`frameOrnaments` is a
  no-op). The `close` sprite is drawn as a back arrow (`backArrow`) in menus.
  Tabs are solid gold plates with dark text (`tabPlate`, `TAB_INK`); buttons
  are bright plates (`BTN_KIND`: gold and silver with dark text, other
  colours with white) with a sheen; pickers are dark fields with a fine edge;
  item tiles are filled in their rarity's colour (`itemSlot`). The pause
  screen is a right-hand panel of tiles (`pauseLayout`, `pauseIcon`,
  `pauseTap`: Bag, Rites, Map, Settings, Sound, Switch Saint, Dev, Layout,
  Resume) with the saint and Saint level at the top; the bag opened from it
  returns to it (`game.invBack`). The title's start prompt sits on a fading
  band. `menus.cjs` takes `FONT=file` and `ONLY=a,b`.
- **Round 65:** menus, part 1: dark glass and gold. A UI kit replaced the
  flat ink boxes everywhere: `panelFrame` (translucent body, accent wash at
  the top, fine rim and inner rule, gilt corners), `headerBar`, `inset`,
  `rowPlate`, `tabPlate`/`tabButtons`, `goldRule`, `invButton` (gradient
  pill, gold rim, dips where tapped), `pickerBtn` (every `< X >` label), and
  `itemSlot` (a sunken socket lit from inside in the rarity's colour). Item
  cards (`cardPlate`, `drawItemCard` and the bag's own card) show the piece's
  icon in a socket, a gold divider, arrows on stat comparisons and a badge for
  better or worse than worn. The bag: a spotlit hero on a pedestal, glass
  panels for totals and the grid, a capacity bar. Title text can glow.
  Windows fade in. Next: re-lay out the pause screen as a card, the Descent
  panel, Wound cards and the title screen.

- **Round 64:** brightness. Pixel effects skip each ramp's near-white
  shades (`dimR`); Judgement and Hammer of Heaven pillars are warmer and
  see-through, cast flares, arcs, crescent rings, pool glows and impact glows
  are dimmer, and a dying monster's first instant washes white instead of
  turning solid white. Sprite effects for the biggest moments (vfx.mjs): a
  Reckoning's turning sigil on the floor in its set's colour (`sigil_<set>`,
  12 frames, drawn at scale 2 under the actors) and a Warden's fall, a gold
  column that bursts along the floor and sends sparks up (`wardenfall`).
  `drawFxs(ground)` draws one-shot sprites in the ground or air pass, `anchor`
  at the frame's foot. The Burning Choir's 6-piece Reckoning x1.9 (was 2.2):
  Station VI back in the pack (Saint 19.2, Mendicant 15.0), XII nearly
  unchanged (6.3, 7.7). `setbal.cjs` reports `reck` (Reckoning uptime).

- **Round 63:** animation overhaul, part 4 (monsters). Kills burst in the
  monster's family colour (`FAM_RAMP`) with a rising soul; elites add a
  shockwave, crack and beam of light, Wardens a big one as they fall.
  Swipes and cones leave a crescent streak, slams and lobbed blasts a
  shockwave, burst and crack, shots a burst where they land; a ring tightens
  at a monster's feet through any wind-up of 0.3 s or more.

- **Round 62:** animation overhaul, part 3 (hero bodies). Both saints:
  an 8-frame idle (breath in whole chunky pixels, the cape stirring, the
  halo rising and settling, a blink; the Mendicant's mace shifts), a 4-frame
  cast (gather, raise, thrust, settle; paced by each cast's own length,
  `castMax`), a 3-frame flinch, and dust at each footfall while running.

- **Round 61:** animation overhaul, part 2 (rites). Every cast draws a
  rune circle with light rising from it (`riteFlare`; a Reckoning adds a big
  shockwave); `pfxSkill` layers pixel effects on every rite effect (novas,
  Judgement's pillars get a falling `beam`, Censer and Cinder Slam a ring of
  pixel `flames`, brands and choirs crack the floor, waves and hymns throw
  spray); `maceHit` gives every Mendicant rite blow a shockwave, burst and
  crack; the Rain's lashes burst; wards and vows show a shield of light;
  bound foes a turning ring of shackles. Foes hit now wash white over their
  sprite instead of turning solid white. Test: `round61.cjs`.

- **Round 60:** animation overhaul, part 1 (basic attacks). A pixel effects
  kit (`pfx`, `px2`, `pxRay`, `pxRing`) draws chunky 2x2 effects at run time
  in `FXR` ramps with glow under them, in the set's colour (`shotRamp`). The
  Saint: a star flash at the bow (`pfxMuzzle`), chunky cooling bolt trails,
  hit bursts (rays, a widening ring, a hot core; crits add a cross flare and
  shards). The Mendicant: a blazing crescent smear leading each blow, a
  shockwave along the floor, cracks on crits and blows on three or more foes;
  his many-foe hits use small glow-free bursts so they do not wash out. Next
  parts: rites, hero body animation, monsters. Test: `round60.cjs`.

- **Round 59:** open maps (`layoutOpen`, `OPEN_SHARE`): about two descents
  in three now roll winding paths of open ground that widen into clearings
  (round, long galleries, or a ring round a block of wall), with dead-end
  pockets for treasuries and shrines and sometimes a loop; edges smoothed,
  no rooms or gates. Zones (the nearest clearing per tile, `room.zone`)
  stand in for rooms for spawns, the Toll, the leash, the map and the room
  types. A small layout is laid out again. The dev WORLD tab has a MAP
  picker. `maps.cjs` checks both kinds. A suspended run saves its map kind
  (`SAVE.suspend.map`) and the map-kind dice are always drawn, so a resume
  rebuilds the same map; a resumed spot in a wall moves to the start. The
  finisher (`execute`) lands on a clear side, and the Saint falls back to his
  last clear spot (`safeX`) if a push out of a wall fails. Test: `round59.cjs`.

- **Round 58:** fix: the Mendicant had the Saint's floating crossbow in
  Vael (`update` called `updateFloatBow` in town for both heroes).

- **Round 57:** balance. `setbal.cjs` now reports `reck` (share of the fight
  spent in Reckoning), which showed the Choir's deep weakness was damage, not
  uptime (75-85% at both Stations). The Burning Choir: x2.2 in Reckoning at 4
  and 6 pieces (`SETK.choir4`, `choir`), and in Reckoning foes within
  `choirR` burn for `choirHp` 2% (`choirHp6` 3%) of their health a second
  (`choirShare`). The Font's 6 pieces: smaller spread (`fontGrow6` 1.35),
  bigger share (`fontHp6` 10%). The Confessor's four pieces +155% (was 170).
  Shares of health now go through one helper, `shareTick`. Lesson: a share
  of health a second barely moves kill rate (it scales with the foes in
  reach); a flat multiplier pays deep and is capped early.

- **Round 56:** the app icon (`tools/icon.mjs`, `assets/icons/`): the
  Saint's hooded bust under a floating halo in a stone arch lit violet, drawn
  on a 64x64 palette grid in chunky pixels so every size is a whole-number
  scale (180 for the iPhone home screen, 32 favicon, 192 and 512 in
  `manifest.webmanifest`). Linked in `index.html`'s head with
  `apple-mobile-web-app-title`.

- **Round 55:** switching saints is easy to find: SWITCH SAINT on the
  pause screen in town (`heroBtn`, asks first), and the other saint in the
  cathedral close has his name, "PLAY AS HIM" and a gold ring at his feet,
  plus a badge on the town map. The Mendicant's own look everywhere: Wound
  cards show a mace (`weapon/mace`, new sculpt) and his names (MACE OF
  WRATH, WIDE ARC, LONG REACH, HEAVY BLOWS); talents (HEAVY BLOWS, GREAT
  BLOW); his arms are maces and satchels (`marms` icons in every set's
  colours, names through `nm(it)`: ARBALEST to MAUL, QUIVER to SATCHEL and so
  on); the Penitent's Prod shows as a spiked crimson mace for him. LONG
  REACH (the pierce Wound) now lengthens his reach. Test: `round55.cjs`.

- **Round 54:** the Drowned Font's pools spread over their first 1.5 s
  at 4 and 6 pieces (`SETK.fontGrow`/`fontGrow6` for the Saint, x1.3/x1.5;
  `fontGrowM`/`fontGrow6M` for the Mendicant, x1.15/x1.25, since his pools
  are big already). Font 4 + Confessor 2: pools bind foes that wade in
  (once every 3 s each), and bound foes take the Font's share of health as
  if in a pool (`fontShare`). The Mendicant's wind-up cocks the mace behind
  his shoulders (it sat on the halo and merged at chunky size). Enchants
  re-checked at Station X after round 53's changes (Relentless now with the
  pack; the run was noisy). Test: `round54.cjs`.

- **Round 53:** polish for the Mendicant before a third saint. His cards,
  talents, passives and altar powers say blows and the mace (`heroText`,
  `HERO_TEXT`); the Nails set and pierce powers lengthen his reach; his
  swing has five frames (gather, wind up, strike, follow through, settle;
  timed in the anim picker); the arc of light takes his set's colour or the
  Plush trail (`boltFx`) with afterimages of the mace head; blows on three
  or more foes or crits add a deeper crunch, and shake grows with foes hit.
  Set cards on small phones fold the lowest tiers into a gold "TAP HERE"
  line that opens every bonus (`setPopLayout`, `renderSetPop`,
  `game.inv.setTap`). The Undercroft has dust shafts sifting from the
  vaults and a draught every 12-25 s that leans the dust, bends torch
  flames and blows sparks (`updateUndercroft`, `drawDust`, `draftK`).
  Balance: more Zeal a kill at deep Stations was tried and did nothing at
  XII (even x5), so it was dropped (next steps 6 has why). The Choir hits
  harder in Reckoning (`SETK.choir` 1.5, `choir4` 1.6); Font pools also take
  a share of a foe's health a second (`SETK.fontHp` 4%, `fontHp6` 8%, half on
  elites, none on Wardens or the dummy; `hurtEnemy` `opts.share` skips
  multipliers). Enchants from Stations X and XV for both heroes
  (`enchbal.cjs` takes `HERO`): Relentless capped lower, Frostbite and
  Reaper's Mark raised. `setbal.cjs` takes `SETK='{...}'` overrides. Test:
  `round53.cjs`.

- **Round 52:** Ember Step bursts where it lands (nova damage, so the
  Stride set multiplies it), its fire is twice as hot, its twist is a
  second burst, and with the stick idle it leaps at the best cluster in
  reach. The Last Confessor binds on its own (`boltStrike`: every
  `SETK.bindEvery2` (10th) hit at 2 pieces, every `bindEvery` (6th) at 4),
  and bound foes burst on death from 4 pieces (was 6). The Drowned Font's
  pools draw foes in from 4 pieces at half strength. The bag's card stops
  set lines above its buttons and drops the lowest tiers whole when they
  do not fit (it ran into TAKE OFF on small phones). The four-piece damage
  can differ per set (`SETK.fourBy`, `fourOf`; the Confessor 170%). Set
  balance checked at Stations III, VI and XII (next steps 6). Test:
  `round52.cjs`.

- **Round 51:** drag to aim the Mendicant's Smite, Shackle Blow (a blow
  circle), Nail Burst (blow and fan), Penitent Charge (leap), Iron Hook
  (chain line), Hammer of Heaven and the Deluge (zones) (`AIMABLE`,
  `renderAim` kinds `blow`, `nailfan`). Seven Hallowed pieces for his rites
  (`LEGENDS` entries with `hero: 'mendicant'`, keys bigBlow, loudToll,
  longCharge, moreShards, longVow, deepTide, bigHammer; icons 31-37 in
  `LEGEND_ICONS`); pieces tagged `hero` drop (and sell at Pell's) only for
  that hero, and the Saint-only ones (Ward, Nail Storm, Censer, Judgement,
  the Longway Arbalest) are tagged `saint`. Set balance: the flat damage of
  four pieces is now +110% at 4-5 pieces and +25% at 6, counted for one set
  only (`SETK.four`, `four6`); Confessor bonuses up (2: x1.6, 4: x2.8,
  6: x3), Font 6 x3 and Font 4 x4, Choir 6 x1.12, Stride 6 x7 for 7 s and
  Stride 4 x4.5; set card and rite lines are built from `SETK`. Before:
  Saint mixes 5.1-9.6 kills a second against full sets 9.9-16.0. Test:
  `round51.cjs`.

- **Round 50:** the Mendicant's set looks (`mendicant_<set>`) and his own
  18 rites (`MRITES`, see "Two playable saints"). Crossbow Wounds read right
  for the mace and Piercing Faith is not offered to him. `setbal.cjs` had
  lost its braces, so every set build cast Holy Water, Chain and Rain; it
  now casts each set's own rites, and `HERO=mendicant` runs his. Set
  balance at Station VI (kills a second / damage taken a second): the
  Saint's full sets 9.9-16.0 / 62-103, no set 3.2 / 216; the Mendicant's
  first pass 7.7-18.5 / 23-68 and 7.7 / 97 bare, so the mace went from
  1.9x to 1.6x, his guard from 20% to 10%, the Tolling down and Shackle
  Blow and Iron Hook up: now 9.0-13.8 / 19-73, bare 4.7 / 166. Test:
  `round50.cjs`.

- **Round 49:** the Mendicant, a second playable saint (melee mace, see
  "Two playable saints"); `boltStrike` now holds every bolt on-hit effect.
  One Warden blow takes at most 40% of the Saint's health (`WARDEN_BLOW`,
  `isWardenSrc` in `damagePlayer`; `balance.cjs` applies it). Yard
  records: a 60 s test (`YARD_TESTS`, `yardTestKey`; 30 s bests stay in
  `SAVE.yardTest`, 60 s in `SAVE.yardTest60`), tap a build then DELETE
  BUILD (asks; `yardForget`), and the build's yard best along the bottom of
  the Rites panel's detail. The Drowned Nave: drops fall in view and ring
  where they land, brighter on the flood, with the drip sound on landing
  (`updateDrips`, `drawDrips`); the Saint leaves ripples while wading.
  `preview.mjs` and the sheet list know `mendicant`. An open question
  (`ask`) now takes the keys (Enter yes, Escape cancel), so M or I cannot
  open a window behind it (the soak found that). Test: `round49.cjs`.

- **Round 48:** Training Yard RECORDS tab (every build, best 5 s and best
  30 s test, START 30 S TEST, RESET RECORDS with a question). Drowned Nave
  chapels get a deep sea-blue runner with pale trim (`tiles_d`,
  `DROWN_SHEET`; targets may be `[ramp, shift]`). Stratum III: pale ash
  falls through the dark (`drawAmbientGlow`, a third under `LOWFX`), the
  cairn's candles are bigger so their green flames survive the 2x2 grid and
  its light is green (`ash`), and skull heaps rattle when the Saint brushes
  past (`updateCritters`; the bone death sounds, high and quiet, on the
  effects bus: `sfx(..., { bus: 'sfx' })`). Balance numbers gathered for
  the owner (next steps 6). Test: `round48.cjs`.

- **Round 47 (polish):** hedges are taller, in 3/4 view with a lumpy lit
  top, and the flower beds show their soil and bigger blooms from above
  (`hedge`, `flowerBed` in `town.mjs`). The lone Acre fence piece west of
  its gate is gone. The Rites panel header names the next rite the Saint's
  level opens (`nextRite`); the Great Penance opens at 40 (was 45). The
  Passives tab lists wearable passives first and locked deed ones last
  (`passOrder`; icons still index `PASSIVES`). Ossuary chapels get a cool
  grey floor and an ash runner with bone trim: `tiles` now has an `_o`
  copy, and `OSS_SHEET` in `sprites.mjs` holds per-sheet overrides of the
  `OSSUARY` remap. `preview.mjs` filters take `a|b`. Test: `round47.cjs`.

- **Round 46.2:** each slot's rites in the Rites panel are listed by the
  Saint level that opens them (`RITES[slot]` is sorted by `RITE_LV` once at
  load; the first entry stays the level 1 rite, which `riteOf` falls back to).

- **Round 46 (town tidy-up):** the owner liked round 44's town but people
  clipped over roofs. Buildings below the north row are now props drawn in
  depth order with only their base solid, so the Saint and townsfolk pass
  behind them (the Saint shows as a faint ghost there). The north row (gate,
  two houses, cathedral, dead trees, mausoleum) stays baked since nothing
  walks behind it. Walkers follow `TOWN_WALKS` (the roads, plus a loop round
  the square) instead of pacing left and right through houses. The square is
  bigger and the Scrying Pool's booth sits on it beside the tavern; homes are
  fewer and spaced along the lanes; leafy oaks, bushes, flower beds and two
  hedges by the road into the square; tidier lamps; the candles at the
  cathedral doors are gone (braziers, stake and lectern stay). The town map
  and minimap read `room.mapCanvas` (the ground plus buildings and oaks).
  `HS.townOverlaps()` lists props whose images overlap a building, sites
  hidden behind one and walks that pass through one; `town.cjs` prints it
  (`overlaps []`).

- **Round 45 (layout designer, dev only):** with `?dev`, the pause screen
  has a LAYOUT button that opens a town editor on a blank 90 x 68 tile map:
  paint ground (grass, dark grass, dirt, earth, cobble, flagstone, sand,
  water), place any town asset from six tabs (buildings, stalls, props, holy
  things, nature, ground), move, change variant, flip, copy and delete,
  undo, snap to 16/8/1 px, grid, zoom by buttons, pinch or wheel. Work
  saves on its own. MENU: PICTURE downloads a PNG of the whole map,
  EXPORT shows a code (`VAEL1:`, format in CLAUDE.md) to send to Claude,
  IMPORT loads one, FILL MAP, CLEAR. New assets for it (and the town):
  leafy trees, bushes, flower beds, a hedge, a town wall section and a wall
  tower (`town.mjs`). Test: `tools/tests/designer.cjs`.

- **Round 44 (a walled hub town):** the owner asked for Vael to look like
  a real town, laid out like Diablo III's and Torchlight's hubs. Principles
  used: a wall round the town with gates; one hub (the market square below
  the cathedral, the descent) with every vendor facing it a few seconds'
  walk away; winding dirt lanes to the districts rather than a grid; grass
  and dirt ground with cobbles only on the square and flagstones before the
  cathedral; props only where they belong. Layout: the north row (the
  Pilgrims' Gate, two houses, the cathedral, the Quiet Acre with its
  mausoleum and trees) in front of a crenellated wall; the Ashen Altar's
  yard beside the cathedral; Pell's and the Enchanter at the square's north
  corners, the Gilded Lamb and the Scrying Pool booth on the west, the
  Forge with its yard on the east, Plush and the Bounty Board by the south
  road; homes and a well along the west lanes; the Vigil Roll and its halo
  stands by the Acre's gate; a fenced Training Yard south east; small
  houses along the south wall with a gate where the road leaves. The ground
  is painted per 2 px cell (value noise grass, dirt within each road
  polyline's width, yards) and chunked like the rest.

- **Round 43 (Vael as one square):** the owner wanted the town to look like
  their sketch: no two streets, no stone "bridges", the cathedral at the
  top. `makeTown` was rewritten in world pixels: the north row (the gate,
  three houses, the cathedral in the middle, the Quiet Acre with its
  mausoleum, tombs, trees and a fence on the right), the altar yard (the
  Ashen Altar, braziers, Brother Cinder) and the stall row (Pell, Plush,
  Bounty, Scrying Pool, Enchanter, Forge, the Gilded Lamb), two cobbled
  roads crossing at the fountain (four benches, two small booths), the
  Vigil Roll with its halo stands (south west) and the Training Yard (south
  east), and a row of houses along the south with the road leaving between
  them. Buildings are baked and block their whole image. Districts are
  boxes (`DISTRICTS`, `districtAt`); the old plan squeeze (`streetX`,
  `townX`, `TOWN_KNOTS`) is gone. Tests place the Saint with
  `HS.CATHEDRAL_X` and site positions.

- **Round 42 (Saint level and talents, rites by level, effects, town):**
  Devotion and Virtues are gone: the Saint level runs 1-60 (`lvNeed`, about
  500k XP in all) and each level past 1 gives a talent point for three trees
  at the Canonry (offence, defence, rites; 9 talents each, rows open at
  0/5/10/15/20 points; capstones Great Bolt, Aegis, The Choir; RESET for
  100 gold a level). Old Devotion XP converts on load (`migrateDevotion`;
  Devotion 25 became level 17). Passive slots open at levels 1, 10 and 25.
  Rites open by level (`RITE_LV`): Holy Water, Chain of Penance and Rain of
  Reckoning from the start, then 3, 5, 7 ... up to the Great Penance at 45.
  Effects: a particle kit (`vemit`, `FXR`, `flameTongue`, `lightning`) and
  rebuilt fire trails (Ember Step, the Stride set, Emberwake), novas,
  Judgement, Hymn of Cinders, Baptism, Iron Brand, Stormlink, Censer Blaze
  (a new ring of fire), pools and vials, plus enchant cues (Bone Ward ready,
  Last Light, The Hunger, Frostbite, Reaper's Mark, Bloodletting, Splinter,
  Tithe, Ghost Step, Phantom Volley, Relentless, Thorns). About +1 ms a
  frame in `perf.cjs`. The STONEBOUND wall is a new 3/4-view bone and stone
  block (`stonewall` in `props.mjs`) drawn y-sorted, bursting up and sinking.
  Bug fix: Bone Ward used Martyr's Ward's timer (`wardT`), so it also cut
  damage 60% for its whole cooldown; it now has `bwT`. Town: every vendor
  has a stall on the upper street (new `stall_board`, `stall_pool`,
  `stall_ench` in `town.mjs`), the ground is plain with lamps, the well and
  four benches; carts, booths, hay, crates and bunting are gone; the Ashen
  Altar and Brother Cinder moved to the cathedral square. Smaller: a door
  icon (`use`) on open sites' LOOK button, DAMAGE NUMBERS has TAKEN and a
  full OFF, Vigil's Blood gives +10% max HP, Stormwright text says SHOOTS.

- **Round 41 (steadier enchant test, the Font, a name clash):**
  `enchbal.cjs` replaced its single-target column (it swung too much) with a
  guard phase: the Saint stands still and shoots while twelve foes that
  cannot die ring it; health is held at 60% and net health lost a second
  (taken less healed) is the measure. It varies about +-25% between seeds,
  against 3x and more for crowd damage taken. Readings (vs no enchant):
  Bone Ward 0.38 (II 0.17), Bloodletting 0.44 (II 0.33) after it was raised
  to 2% / 4% of damage dealt (1% healed about 30 a second at Station X),
  Thorned Hide and Martyr's Echo 0.65-0.9; Second Breath and Ghost Step
  need deaths and dodges, which the guard leaves out. Ten tier II enchants
  heal more than a ring of commons deals at Station X. The Drowned Font was
  the weakest set at Station X (3.6 kills a second): pools now deal X2 / X4
  at 4 / 6 pieces (`SETK.font4`, `SETK.font`), 6.6 a second, beside 5.9-9.1
  for the others (`docs/SETS.md`). `setbal.cjs` takes `ONLY=` to run some
  builds. The Bloodletting Wound is now BLOOD MEAL (the enchant keeps the
  name); no other names are used twice.

- **Round 40 (tougher Stations, deep rewards, Vigil to XXX):** the owner
  was killing everything in one shot at Station XV. `balance.cjs` gained a
  `max` profile (mythic Hundred Nails, tier II enchants on every slot, maxed
  Virtues, three altar powers, three passives, more Wounds); at XV it
  needed 0.3 shots per common and 18 s per Warden. Monster health and
  damage now get a middle-Station bump (`toughHp`, `toughDmg`, through
  `stationHp`/`stationDmg`): it starts at VII, peaks at XV (x3 health,
  x1.7 damage) and eases to x1.4 / x1.25 at XXX, where gear has caught up.
  The max build now needs about 1 shot per common and 65 s per Warden at XV,
  and 2-3 shots at XX-XXX. Deep Stations pay more (`DEEP`, `deepPayout`):
  from XVI the Warden always drops a Bloodrose Key and a set piece, and
  ingredients are 10% likelier per Station past XV (x2.5 at XXX); from XXI
  also a Hallowed Chrism; from XXVI a second set piece. The Descent panel
  shows WARDEN EXTRAS and INGREDIENTS. The Vigil follows all thirty Stations
  (`VIGIL_SOFT` 60, `vigilStation`), then grows 3% health and 2% damage a
  level as before. `setbal.cjs` takes `ENCH=` to check sets with enchants.
  `enchbal.cjs` (Station X, two seeds): kill rates are steady between seeds,
  damage taken and the single-target column are not. The weakest were
  buffed: Frostbite (slowed foes take 10% / 20% more, tier II slows 40%),
  Last Light (below 50% health, +40% / +60%), Bloodletting (cap 3% / 5% a
  second), Gilded Tithe (also 15 / 25 Zeal), Second Breath (2 / 3 s
  unharmed). Combos of ten tier II enchants give about 1.9x kills.
  `setbal.cjs` at Station X with and without ten tier II enchants
  (`ENCH=`): sets go from 3.6-8.7 kills a second to 11.6-15.5 (Stride
  highest, x2.2; Font gains most, x3.3), so enchants pull the sets
  together rather than making one run away. No changes to `SETK`.

- **Round 39 (enchant balance, reflect, thirty Stations):** the owner found
  Splinter melting everything, a REMORSEFUL foe's reflect always one-shotting
  them, and Station XV too easy. Splinter's bolts are marked (`HIT_BOLT`) and
  never splinter again, at most 6 bursts a second (it chain-reacted through
  crowds). Reflect stores 0.4% of the Saint's health per hit, paid every 0.5 s,
  at most 5% a second, without the Station multiplier (`hurtPlayerRaw`
  `fixed`); it used to be 4% of damage dealt times the Station multiplier.
  `tools/tests/enchbal.cjs` (endgame Hundred Nails set, all mythic, dense
  crowd, two seeds) found Relentless doubling kill rates (rites always up);
  it now takes at most 0.6 s (II: 1 s) off cooldowns a second (1.3x kills).
  Other enchants sit within about +-15% kills alone; full 10-slot combos give
  1.3-1.7x kills and 55-90% less damage taken. Stations run to XXX
  (`MAX_STATION`, `ROMAN`, three new bands, a fourth extra curse from XXVII);
  foes at XXX are about 6x tougher against matched gear than at XV. The
  enchant scenes were removed at the owner's request (the Enchanter card lists
  ingredients again; `enchPop` is text and ingredients). On narrow views
  (667x375, game width 445) the bag's item card was 15 px wide: `invLayout`
  now returns `narrow` and the card covers the bag grid (tap it to go back),
  doll stats show only the rows that fit, and SANCTITY/STATION wrap.

- **Round 38 (enchant tiers, ingredient pity, bag previews, balance):** each
  enchant has a tier II (`t2` text, `E2()` values), bought with a second set
  of its ingredients at the Enchanter (UPGRADE TO II, asks first). Wardens of
  Station X+ that drop no ingredient raise the next one's chance by 0.25% each
  (up to 4%; `SAVE.ingrDry`), lifting the average from 0.48 to 0.63 a Warden
  and capping dry runs near 8. The bag shows an enchant's card with its scene
  from INGREDIENTS or from an enchanted piece (`enchPop`). Balance check
  (`balance.cjs` profiles mythic, chase): all-mythic set gear roughly doubles
  damage (Station X Warden 90-110 s to about 45 s) and gives 2-3x the blows
  to die; tier II damage enchants add little on one target. Left as is: a
  full mythic set needs thousands of Emberstones (hundreds of Wardens or
  over a million gold). Single runs are noisy at XV (Warden health differs).

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
