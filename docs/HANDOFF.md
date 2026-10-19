# Handoff

Last updated 2026-10-19, after round 10. Read this first, then `CLAUDE.md`.

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
- **Vael (the town):** a long twilight street with six districts (Pilgrims'
  Gate, Curio Market, Gilded Lamb, Ember Forge, Quiet Acre, Cathedral),
  13 talking townsfolk, walkers, kids, crows, fog, ash and lightning.
  Market booths, benches, hay, planters, shrines, a fountain and ground
  detail fill the whole street. Nothing blocks movement.
  - Nine **locked feature sites** (`SITES`) with badges and "UNLOCKED WHEN
    …" panels and progress bars: Pilgrim Road (Stratum II), Pell's curio
    stall, plush stall, bounty board, scrying-pool wagers, Ember Forge,
    the Bleeding Vigil (Vigil Trials), Martyrdom, the Canonry. None of
    the features behind them exist yet.
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
    All have phases at 66% and 33% (faster, a burst of shots, adds), a
    boss bar, and are never staggered or executed. Slaying one drops 4
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

- Graphics matter most. The target is Otherworld Legends: chunky, crisp
  pixel art, warm torch-lit stone halls, clean open rooms, nothing that
  looks AI-made. Match OWL by measuring real phone captures, not promo art.
- Systems lean on classic action-RPG ideas (elite affixes, loot showers, a
  lively town), with our own names. Never use names or terms from other
  games (no Blasphemous or Diablo terms; see CLAUDE.md, "Names").
- Ship each finished round to `master` (GitHub Pages deploys from it).
- They read on a phone: keep updates short, lead with the outcome, attach
  screenshots. They notice when an earlier request was not fully done.

## Next steps (ideas, roughly in priority order)

1. **Chunky-grid art fixes.** Some models lost detail at 2x2: wardens read
   as white blocks, small faces lose eyes, item icons got rough. Review
   every sheet with `CHUNKY=2` side by side and thicken or simplify. Make
   the effects (bolts, impacts, skill effects) bolder to suit the bigger
   pixels.
2. **Locked doors the OWL way.** Replace the iron gates with a row of
   glowing vertical bars across the doorway (OWL uses orange light bars).
   Minimap: squares only, current room outlined, "?" for unknown rooms.
3. **More room plans and biomes.** Add a centre dais, a 3×3 chest grid for
   treasuries, a shop room (keeper plus three pedestals), a secret room
   behind a cracked wall, and a second biome look for Stratum II.
4. **Build the first locked feature.** Pell's curio stall is the smallest:
   a shop panel with 6 items rerolled per descent, priced by rarity. Then
   the Ember Forge (reroll one stat, temper rarity), then bounties.
5. **More from the D3/TLI playbook (own names).** An account-wide level
   after the cap that gives small permanent points ("Devotion"); a
   crafting bench that rerolls one stat (the Ember Forge site); bounties on
   the board; a Vigil leaderboard; set dungeons; more Wardens per biome.
6. **Tune the descent from play.** Toll size (68% of the map), Warden
   health and skills, monster counts per room and drop rates are first
   guesses. Watch how long a Station takes at matched Sanctity (aim for
   6–10 minutes) and adjust `populate()`, `TOLL_VALUE` and `WARDEN`.
   Vigil timer (10 min) and level step (0.5 Station per level) too.
6. **Vigil Trials (endless mode).** One timed descent that gets harder each
   level; a candle timer on the HUD; leaderboard in localStorage.
7. **Juice.** Screen-shake tuning, hit-flash on every enemy, bigger damage
   numbers for crits, coin fountain on elite death, a short slow-mo on
   room clear, footstep dust when the Saint runs.
8. **Character choice.** A second playable saint (melee, short range) to
   show off the chunky style; pick at the cathedral doors.
9. **Phone polish.** Haptics via `navigator.vibrate` where supported,
    safe-area insets for notched phones, a settings panel (music/SFX
    volume, screen shake, left-handed controls), save export/import.
10. **Suspend and resume.** Save the run mid-floor so a closed tab returns
    to the same room.
11. **Hand-made reactions.** Hit and death frames are the rest pose tipped
    back as a whole. Hand-posed versions (arms flung up, weapon dropped,
    wings folding) would read better for the elites in particular.

## History by round

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
- Keys: M opens the town map, N mutes, I opens the bag, E interacts, Esc closes panels.
- Never bob or slide a whole body by 1 px or a fraction: on the 2x2 grid that re-cuts every block and reads as jitter. Move bodies in steps of 2 px (`bobAt()`); elites are scaled by `s` in `shoot()`, so use `2 / s` model units.
- Errors never stop the loop; they are logged instead. If the owner reports a bug, ask what the pause screen says under BUG LOGGED, or read `localStorage['hollow-saint-errors']`.
- `text()` caches each string as a small canvas (cleared at 600 entries). Use `small: true` for the old thin 5x7 font.
- Audio starts on the first tap (iOS rule). Music streams through `<audio>` elements, effects are decoded buffers. `AUDIO.set([...])` picks the loops; `sfx(name)` plays an effect.
- Rebuild audio with `tools/build-audio.sh <src>` after downloading the packs; the sources are not committed.
