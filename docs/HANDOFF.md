# Handoff

Last updated 2026-10-19, after round 14. Read this first, then `CLAUDE.md`.

**Every reply that completes a prompt ends with two lists: what was done,
and 5 suggestions for what to do next.** (The owner's standing request;
see "The owner's preferences".)

## Where the game stands

A playable vertical slice on iPhone landscape (desktop works with keys) at
55–60 fps, with no page errors in any test or in 5 minutes of random play.

- **Look:** sculpted SDF pixel art rendered on a chunky 2x2 grid, so art
  pixels read as hard blocks like Otherworld Legends. The view is 305 px
  tall, so the Saint is about 16.5% of the screen height, as in OWL phone
  play. The screen always scales by a whole number, nearest neighbour. Warm
  torch light on dark stone, soft bloom.
- **Start:** a clean title (logo, Saint, cathedral silhouette, one button),
  then the town of Vael. An 11-step tutorial (skippable) runs from the town
  into the first fight.
- **Vael (the town):** a compact twilight street (2150 px, round 8f) with six districts (Pilgrims'
  Gate, Curio Market, Gilded Lamb, Ember Forge, Quiet Acre, Cathedral),
  13 talking townsfolk, walkers, kids, crows, fog, ash and lightning.
  Market booths, benches, hay, planters, shrines, a fountain and ground
  detail fill the whole street. Nothing blocks movement.
  - Nine **feature sites** (`SITES`) with badges and "UNLOCKED WHEN …"
    panels and progress bars. Built (round 11):
    - **Pell's curio stall** (finish one descent): 6 pieces, restocked
      every descent (`shopStock`, `SAVE.shop`), at the best cleared
      Station + 1, never common; price by rarity and item level.
    - **The Ember Forge** (Warden of II): reforge one stat of a worn or
      bagged piece (the first stat rerolls its value, any other becomes a
      new stat; cost grows per reforge), or temper a piece up to your best
      Station's item level (`bestIl`).
    - **The Canonry** (finish one descent): **Devotion**, an account level
      fed by all XP (`gainDevotion`, `devNeed`). Each level gives a point
      to spend on six **Virtues** (Might, Vigour, Fortune, Precision,
      Swiftness, Piety; `VIRTUES`), small permanent boosts with caps.
    - **The Bleeding Vigil** (Warden of IV).
    - **The Pilgrim Road** (Warden of III): opens Stratum II.
    Plush stall, bounty board, wagers and Martyrdom still say "coming in a
    later build".
  - Town minimap with badges; tap it or press M for the full map and legend.
- **The descent (round 9, modelled on Diablo 3 rifts and Torchlight
  Infinite Timemarks, with our own names):**
  - **The Fifteen Stations of the Wound** (`DIFF`, Station I–XV) are the
    difficulty ladder, in four bands: Pilgrim I–IV, Zealot V–VIII, Martyr
    IX–XII, Saint XIII–XV. A Station opens when you slay the Warden of the
    one before (`SAVE.cleared` = highest Station index cleared). Monster
    health climbs by `POWER_STEP` (1.36) per Station plus 5%, damage a
    little slower; rares/elites gain a curse at IX and XIII.
  - The descent panel at the cathedral doors shows the Station, every
    number, and your Sanctity against what the Station expects.
  - **The map** is new every descent: 11–12 rooms grown as a random blob
    on a 4×4 grid of cells (`GRID`), joined by corridors with a few loops,
    no locked gates. Every room but the Vestibule starts packed
    (`populate()`): clusters of commons, a chance of a blue rare pack, gold
    elite packs in two Champion's Halls, a shrine and one or two
    treasuries. About 220–290 monsters per map. Monsters sleep until the
    Saint is near (or they are hurt) and go back to sleep when left far
    behind (`awake` list), so the frame cost stays low.
  - **Fog of war:** the minimap is the explored map around the Saint (one
    pixel per tile, `room.fog`), filling in as you walk (`revealAround`,
    15 tiles). Tap it or press M for the full explored map.
  - **The Toll** (the progress bar at the top): every kill rings it
    (commons 1, rares 4, elites 12; `tollValue`). It needs about 68% of the
    map's monsters. When it is full a banner says THE WARDEN COMES and the
    **Warden** appears near the Saint (`spawnWarden`): one of five, each
    with its own sculpted model (`mon_warden` sheet, `tools/models/elite.mjs`,
    150×160 frames), name, lore line and kit (`MON` entries with
    `warden: true`):
    - **The Bellwright** (bell on his back, iron hammer): slam, `peal`
      (three concentric shockwaves), a ring of falling bells, risen.
    - **Mother Candlemass** (wax matron crowned with candles): burning wax
      pools, an ember spiral, a ring of fire round the Saint, ember ring.
    - **The Hollow Cardinal** (empty floating robes, mitre, crozier):
      `sweep` (three rotating holy beams), blink, violet fans, acolytes.
    - **The Charnel King** (bone giant, crown, femur sceptre): a line of
      bone spikes toward the Saint, triple charge, risen, shockwave.
    - **Our Lady of Nails** (iron saint, halo of nails): `volley` (four
      fans of nails), chain pull, a cross of spikes, a ring of nails.
    Wardens are meant to punish (`WARDEN`): ×1.8 health and ×1.6 damage on
    top of their MON stats. At 66% and 33% each learns its `phases` moves
    (a bigger peal, eight-stream spiral, five beams, a cross of spikes,
    six-shot nail volleys and so on), gets faster, and by the last phase
    chains attacks with almost no recovery. After 100 s it enrages (double
    damage, much faster); the boss bar counts down WRATH. The Bellwright's
    peals and bells root the Saint; Candlemass's pools burn harder. The
    tutorial's Warden is gentler. Never staggered or executed. Slaying one drops 4
    pieces, opens the next Station and raises the Waystone home.
  - **Density** climbs with the Station: more and bigger clusters, more
    rare packs, a third champion hall from Station VIII. About 240
    monsters at I, 480 at VIII, 760 at XV.
  - **Knells:** rares and elites drop bell-shards that add 3 to the Toll
    when gathered (our take on progress orbs).
  - **Shrine of Judgement:** holy lightning strikes the two nearest foes
    every 0.35 s for 15 s (joins Zeal, Haste, Warding, Plenty).
  - **The Weeping Reliquary:** one per map (not in the Vigil). Wake it and
    the dead pour in for 30 s; lay 30 to rest near it and it opens
    (3 pieces). Fail and it falls silent.
  - **Omens:** at the cathedral doors take one or two random omens (more
    monsters, more health, more damage, more curses, faster monsters);
    each pays +40% gold, +30% gear and rarer gear (`OMENS`, `applyOmens`).
- **Vestment sets** (round 12, `docs/SETS.md`): five 6-piece sets with 2/4/6
  bonuses built around one skill each (the Hundred Nails: crossbow; the
  Penitent's Stride: dash; the Drowned Font: holy water; the Last
  Confessor: chain; the Burning Choir: Reckoning). At 4 pieces the Saint
  and the HUD portrait wear the set's sculpted skin. Odile's Habit is the
  4-piece starter set (below Station IV). The Lesser Vow (a Hallowed seal)
  counts one extra piece. Odile's Gift: after the Wardens of III, VI and
  IX, talk to Sister Odile for two pieces of a set you choose. Each skin
  has its own crossbow, bolts and bolt colours (round 13).
- **Set arms** (round 14): two new slots, crossbow and quiver (Sanctity now
  averages 10 slots). Each set has a 2-piece Arms set (`ARMS`, `it.wset`,
  `sbw(id)`): Arms of the Hundred Nails (every 5th bolt a great nail),
  of the Penitent's Stride (ember bolts after a dash), of the Drowned Font
  (slowing bolts, pools on kills), of the Last Confessor (every 8th bolt
  binds), of the Burning Choir (crits charge Reckoning, flame bursts in
  Reckoning). A set crossbow sets the crossbow's look (`G.xskin`). 30% of
  set drops from Station IV are arms.
- **Penitent Cells** (round 14, town site near the Quiet Acre): one 90 s
  wave trial per set, opened by wearing all six pieces (`CELLS`,
  `updateCell`). Absolving one hangs its banner on the Cathedral front and
  the first time pays the set's missing arms.
- **Rite colours** (round 14): holy water, the chain and Reckoning take the
  robe's colour (`RITE_FX`).
- **The Drowned Nave's own pieces** (round 14): organ pipes on the back
  wall, half-sunk pews, kelp in corners, weed mats on the floor, a dripping
  ambience (synthesised `drip`).
- **Settings** (round 14, pause screen): effects full/low, screen shake,
  damage numbers all/crits/off, haptics (Android only; iPhone Safari has no
  vibration), music and sound levels, left-handed controls (`SAVE.opts`,
  `opt()`).
- **The Warden's fall** (round 14): a long slow-motion beat, flash and a
  fountain of coins that lands before it is drawn in.
- **Dev menu** (round 14): `?dev`, then DEV on the pause screen.
- **Stratum II, the Drowned Nave** (round 11): after the Warden of III the
  descent panel shows a STRATUM button. The Nave is a flooded look
  (`STRATA`, `useStratum`): its sheets (`hall_d`, `floor_d`, `walldecor_d`,
  `props_d`, `loot_d`) are the Undercroft's ramps remapped to teal and
  silt (`DROWN` in `tools/sprites.mjs`), with a cold ambient and mostly
  flooded room themes. Own monsters mix in with the old ones (`stratum: 2`
  in `MON`; `poolC`/`poolR`): the **Silt Wretch** and **Nave Eel**
  (commons) and the **Tide Cantor** (rare: tear ring, frost pools). Two
  Wardens: **the Tide-Bishop** (shockwaves that slow, chain pull, frost
  rings, eels; later peals, a frost cross and pool lobs) and **the
  Drowned Organist** (rotating beams, nail volleys, peals, cantors; later
  a 30-shot ring, four beams and a bell ring). Same Stations, same Toll.
  The Vigil always uses Stratum I.
- **The Bleeding Vigil** (the town site in the Quiet Acre, open after the
  Warden of Station IV): our timed endless trial. Pick a Vigil level (up to
  `SAVE.vigilOpen`), light the candle: 10 minutes to fill the Toll and slay
  the Warden. Two Vigil levels per Station step, climbing past Station XV,
  and density grows every level (`vigilDiff`). Monsters drop gold and
  knells, never gear; the Warden pays 3 + level/5 pieces. Finishing with
  5 minutes left opens +3 levels, 3 minutes +2, in time +1; a burnt-out
  candle opens nothing. `SAVE.vigilBest` is the best level kept.
- **Combat:** a floating auto-aiming crossbow, dash with perfect-dodge
  slow-mo, two rites (holy-water vial, chain), Reckoning (the ultimate,
  charged by Zeal), executions, Carnage bonus.
  - 30 monsters (10 common, 10 rare in blue packs, 10 elite in gold), plus
    the Collection Imp. All attacks are telegraphed. 19 affixes, named
    elites, nameplate bar.
  - Stigmata: XP and level-ups offer 3 of 20 Wounds, six of which are big
    auto skills.
- **Loot:** gold, health orbs, gear in 5 rarities (common, blessed,
  consecrated, hallowed, Saint's set) across 8 slots (hood, mantle, gloves,
  girdle, pendant, seal, charm, greaves). Every piece has an item level,
  the Station it dropped on (`it.il`), which sets its **Sanctity**
  (10 × 1.36^(il−1)). Your Sanctity is the average over the eight slots
  (an empty slot counts 10); it multiplies your damage, and your health by
  its 0.85 power, matching the monsters' climb. So Station I gear cannot
  carry you up the ladder. Dropped gear shows a pillar of light by rarity
  (blessed blue, consecrated gold, hallowed and set tall), drawn in the
  additive pass over the darkness (`drawLootBeams`); hallowed and set also
  show a star on the minimap. Drop rates were trimmed (commons 1.5%, rares
  45%, elites 2 pieces) and rarity odds rise with the Station. A 30-slot bag with AUTO EQUIP and
  SELL MANY. On death the Choir takes half your gold and every other piece
  found that run; worn gear is safe. Saved in localStorage (`hollow-saint`).
- **Audio:** Kenney SFX, OpenGameArt music and ambience (`docs/CREDITS.md`).
  Mute button (or N key). Follows the iPhone silent switch on iOS 17+.
- **Animation:** the Saint, townsfolk and all 30 monsters have 8-frame walk
  cycles (planted foot slides back, the other swings forward lifted, body
  bob). Every monster flinches when hit (2 frames) and falls over when
  slain (3 frames, then the gibs burst). Rats and crawlers roll belly-up.
  Executions still burst at once.

## The owner's preferences

- **After every completed prompt, reply with (1) a short list of what was
  done and (2) 5 suggestions for what to do next.** Keep both as plain
  bullet lists at the end of the reply, after the outcome and screenshots.

- Graphics matter most. The target is Otherworld Legends: chunky, crisp
  pixel art, warm torch-lit stone halls, clean open rooms, nothing that
  looks AI-made. Match OWL by measuring real phone captures, not promo art.
- Systems lean on classic action-RPG ideas (elite affixes, loot showers, a
  lively town), with our own names. Never use names or terms from other
  games (no Blasphemous or Diablo terms; see CLAUDE.md, "Names").
- Ship each finished round to `master` (GitHub Pages deploys from it).
- They read on a phone: keep updates short, lead with the outcome, attach
  screenshots. They notice when an earlier request was not fully done.
- Gameplay direction (rounds 9–10): Diablo 3 and Torchlight Infinite style
  progression (difficulty ladder, random packed maps, a progress bar that
  brings a boss, a timed endless trial), always under our own names.
  Monster density should feel high and climb with difficulty. Wardens must
  be difficult and punishing, but every hit stays telegraphed.

## Next steps (ideas, roughly in priority order)

1. **Tune from play.** Set and arms multipliers, cell goals (`CELLS`),
   shop prices, forge costs, Devotion pace, Toll size, Warden health and
   enrage. Use the dev menu to try each set quickly.
2. **Bounty board.** Three small goals per descent paying gold and Devotion.
3. **Chunky-grid art pass.** Review every sheet with `CHUNKY=2`: small
   faces, item icons, the weed mats (they read a little like lily pads).
4. **Set looks for Odile's Habit and the arms on the doll.** Show the worn
   quiver on the Saint's back; a starter look for the Habit.
5. **More Nave room plans.** Deep water channels with bridges, a flooded
   organ loft for the Organist's arena.
6. **Suspend and resume.** Save a run mid-map so a closed tab returns to it.
7. **Character choice.** A second playable saint (melee, short range).
8. **Season-style events.** A rotating weekly omen with a set showcased.

## History by round

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
