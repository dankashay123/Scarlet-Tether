# Handoff

Last updated 2026-10-18, after round 6 (clean OWL-style maps, auto equip, bulk sell, name purge).

## Where the game stands

Playable on iPhone landscape (or desktop with keys) at 55–60 fps, with no page errors in any test.

- **Start:** a start menu, then the town of Vael. A dismissible 11-step tutorial (SKIP TUTORIAL) runs from the town into the first fight.
- **The descent:** a floor of 9 rooms on a 3×3 grid (32–40 × 22–28 tiles).
  - Gates lock behind you and waves spawn.
  - Room types: vestibule, crypts, a reliquary with an elite, a shrine, a treasury and the Warden's chamber.
  - Clearing the Warden's chamber wakes the Waystone home, which leads to the tally screen.
  - There is no timer.
- **Monsters:** 30 of them (10 common; 10 rare, which glow blue; 10 elite, which glow gold), plus the Collection Imp. All attacks are telegraphed. 19 affixes, elite names and a nameplate bar.
- **Loot:** gold, health orbs, items in 5 rarities, shrines, chests, breakables and a Carnage bonus. Gold saves to localStorage under the key `hollow-saint`.
- **Vael:** a long twilight street with six districts, 13 talking townsfolk, walkers, kids, crows, fog, ash and lightning.
- **Camera (round 6b):** the view is 305 px tall, so the Saint (50 px head to feet) is about 16.5% of the screen height, measured against the hero in real Otherworld Legends phone captures (round 5's 430 px was based on zoomed Steam promo shots and was too far out). Rooms shrank to 32–40 × 22–28 tiles (`GRID` cells 46×36) to keep OWL's proportions: a room is just under a screen wide and a bit over a screen tall. The descent panel and town map were compacted to fit; the town camera offset is now `H * 0.26`.
- **Round 6:**
  - Maps follow the Otherworld Legends recipe (studied from wiki and Steam screenshots): most of the floor stays open, each combat room gets one mirrored plan (`r.plan`: empty, grid4, twin, center, sidepools, edgerow, corners, pews), clutter sits in corners, and nothing hangs in mid air (the wall chains are gone).
  - Back walls follow a 7-tile rhythm mirrored about the room centre (`bay()`): pilaster, torch stand, statue on a plinth, window or banner.
  - New pale marble pillar (`hall.pillar` in `tools/models/props.mjs`), short and narrow so it never reads as a wall. The old 76 px column is unused.
  - The south side of a room has no wall: the floor ends in a stone ledge over black (`bakeWallEdges`).
  - Bag: AUTO EQUIP wears the best piece per slot by `itemScore`; SELL MANY offers four rules (worse than worn, common and blessed, all but hallowed and set, everything) with counts and gold shown first.
  - Town props and townsfolk no longer block the Saint.
  - Names: every Blasphemous or Diablo term is gone from the game and docs (see CLAUDE.md, "Names").
  - `tools/tests/rooms.cjs` photographs every room of a floor for layout review.
- **Round 5:**
  - Camera: (since changed to 305 px, see above). `resize()` draws into an offscreen buffer, copies it to the screen canvas at the next whole scale, and CSS shrinks it with smoothing, so pixels stay even at any height. `PRE` is that whole scale.
  - Rooms are 54–67 × 26–32 tiles (`GRID` = 3×3, cells 74×40, corridors 5 wide). Wave sizes grow with room area (`r.ak`, power 0.55) and props, decals and critters with power 0.85 (`many()`). The baked floor canvas is about 3.6k × 2k px, under iOS canvas limits.
  - Descent panel (`renderDescent`): before going down it shows the stratum, difficulty picker, floor makeup, monster health and damage, waves, curse counts, gold per coin/kill/rare/elite/room, item odds per kill/rare/elite/room, rarity odds for foes and elites (`rarityOdds`, the same sums as `rollItem`), XP rate, death penalty and your stats.
  - Difficulty tiers (`DIFF`): Pilgrim, Zealot, Martyr, Saint. They scale monster health and damage (`spawnMonster`, `damagePlayer`, `hurtPlayerRaw`), gold, item count and rarity (`dropLoot`), XP (`gainXp`) and add a curse to rares and elites from Martyr. Zealot opens after one descent; each next tier after finishing a descent on the one before (`SAVE.cleared`). The choice is saved in `SAVE.diff`.
  - Town sites (`SITES`): Pilgrim Road (Stratum II), Pell's stall, plush stall, bounty board, scrying pool wagers, the Forge, the Bleeding Vigil (Vigil Trials), Martyrdom and the Canonry (Canonization). Each has a floating badge and a LOCKED prompt; the panel says "UNLOCKED WHEN …" with a progress bar. When the condition is met it says the feature comes in a later build. New counters: `SAVE.eliteKills`, `SAVE.bestLevel`.
  - Town minimap: a small picture of the street around you with badges for every site and named townsperson (`NPC_BADGE`). Tap it (or press M) for the full map with district names and a legend.
  - Map badges: `ui.badge` / `ui.badgeBig` in `tools/models/props.mjs` (`MAP_BADGES`, same order in `index.html`). The small font gained ( ) < > ~ =.
  - `tools/tests/descent.cjs` covers the minimap, map, a site panel and the descent panel.
- **OWL polish (round 1, see `docs/ART_COMPARISON.md`):**
  - Large mixed-size flagstone floors per theme, and in the town street.
  - Walls on every side with lit tops, and soft cast shadows.
  - Darker ambient, warm torch pools and bloom, no orange wash.
  - Effects, item icons, coins, orbs and enemy shots remodelled (`tools/models/vfx.mjs`).
  - New UI font: Kenney High, bold, cap height 9.
  - Saint legs show in the run; golem legs split; leviathan rears; darker Inquisitor hood.
- **Optimisation and bug pass:**
  - Rendering: the game draws straight into the screen canvas and CSS scales it (pixelated); only the visible part of the baked floor is drawn; blood soaks into the floor canvas; darkness and soft glows render at half size; glows and light holes are cached sprites. About 11 to 18 fps in the heaviest crowd at 4x CPU throttle in headless Chromium (software rendering), 44+ in town; our own code is 3 to 6 ms per frame at real speed.
  - Fixed: raised walls could trap the Saint (box test plus an `unstick` safety net for the Saint and enemies); last run's Stigmata leaked into town and the next run; a full bag could destroy an item for an empty slot; bolts fizzled against the back wall (they now track height above the floor); vacuumed drops could turn NaN; 1/2/3 on the card screen also cast a rite; stale run flags on items after a closed tab; the mute button took taps meant for overlays; useless hits delayed the stuck-room rescue; the second censer had no glow; heal on kill could heal a dead Saint.
  - Cleared rooms pull their gold and gear to the Saint.
  - `tools/tests/soak.cjs` plays at random for minutes and checks for errors, NaN, stuck states and the Saint inside walls.
- **Round 3 (inspired by Pixel Hunter Idle, see `docs/ART_COMPARISON.md`):**
  - The Nail Crossbow floats: `tools/models/weapon.mjs` renders it at 16 angles; `updateFloatBow`/`drawFloatBow` in `index.html` hover, aim, recoil and glow. Bolts leave from its tip. The Saint now raises a glowing palm instead of holding it.
  - Stigmata (GDD in-run talents): kills give XP (`gainXp`), each level offers 3 of 20 Wounds (`WOUNDS`). Plain boons fold into `gearStats()`; six skills run in `updateSkills` with big smooth effects (`drawSkillsGlow`). The pause screen lists what you bear. Tests set `window.HS_AUTOSTIG` so cards pick themselves.
- **Round 2:**
  - Map bug fixed: the room grid lookup wrapped across rows, so corridors could join far rooms and leave others unreachable (185 of 200 floors were affected). Loop links are now orthogonal, the spawn and carpet aisles are kept clear of props, and enemies spawn only on open tiles. A room where nothing is hurt for 15 s pulls its survivors into the open. `tools/tests/maps.cjs` checks 300 floors.
  - Minimap redrawn as a room grid with fog, corridors, locked gates in red, room icons and a blinking marker; the town shows a street strip.
  - Inventory and equipment: a 30-slot bag and 8 slots (hood, mantle, gloves, girdle, pendant, seal, item, greaves), saved in localStorage (`SAVE.bag`, `SAVE.equip`). Every item has a slot base stat plus rolls; hallowed items have a power, Odile's set has 2- and 4-piece bonuses. Stats apply through `G` (see `gearStats()`). Open with the bag button or I. Tap twice to wear; sell for gold. Empty slots auto-equip. On death the Choir takes every other item picked up that run (worn ones are safe). Floor labels stack and show a green arrow for upgrades; rarer drops have loot beams.
  - 3/4-view furniture (crate, chest, pew, altar, sarcophagus, shrine, coffin, maiden, cage, statues, columns, urns), stone pilasters on back walls, engraved floor seals, new splats, mounds, candles, gibs, cobwebs and HUD buttons. `node tools/sprites.mjs --audit` reports no old art left.
- **Audio:** Kenney SFX for every action, OpenGameArt music (town, dungeon) and town wind and crickets. Mute button under pause (or M key), saved in localStorage. iOS 17+ follows the silent switch via `navigator.audioSession.type = 'ambient'`. Sources in `docs/CREDITS.md`.
- **Graphics v5:**
  - Everything is sculpted with the SDF renderer with a ×1.3 world scale (see `docs/GDD.md` → "Art v5"). The view is now 305 px tall (round 6b).
  - Back walls are 3 tiles tall.

## The owner's preferences

- Graphics matter most right now. The target is Otherworld Legends (the owner shared six screenshots): warm torch-lit stone halls, crisp hue-shifted pixel art with 7–10 shades per material, and nothing that looks AI-made.
- Systems lean on classic action-RPG ideas (elite affixes, loot showers, a lively town), with our own names. Never use names or terms from other games (the owner asked for no Blasphemous or Diablo terminology).
- Ship each finished round to `master`.
- They read on a phone, so keep updates short and lead with the outcome.

## Next steps (suggested order)

1. **Art polish** (weak spots the modelling pass flagged):
   - Golem legs overlap in side view.
   - Mother Wax is boxy.
   - Choirboy's mask is small.
   - Leviathan barely rears in its attack.
   - The Inquisitor's hood is too bright.
   - Sarcophagus lid is plain.
   - The Saint's legs barely show in the run cycle.
   - The fx sheet (bolt, impacts, smoke, thurible, vial, chain links) and the item icons are still the older hand-drawn style at the old size.
   - The 5×7 pixel font is small at 360 px; consider a larger or bolder UI font.
2. **Audio:** the owner wants a free sound pack. Kenney (CC0) is the easiest. The network must allow the host first (see below). Sounds can also be synthesised with WebAudio.
5. **Roadmap items** (`docs/ROADMAP.md`): Stigmata level-ups, Vestments and crafting, the Bellwright boss, death/Shade, Martyrdom, Vigil tiers, suspend/resume.

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
- Town coordinates in `makeTown()` are already at the ×1.3 scale. The player starts at x 2340 (the cathedral), and the Vestry door is there too.
- Elite HP bars sit at `spriteTop(e)`, the height of the sprite's first walk frame, not `hy`.
- `glow()` draws cached sprites; inside the glow pass it writes to a half-size layer (`GLOW_TO`). Pass rgba colours.
- `text()` caches each string as a small canvas (cleared at 600 entries). Use `small: true` for the old thin 5x7 font.
- Audio starts on the first tap (iOS rule). Music streams through `<audio>` elements, effects are decoded buffers. `AUDIO.set([...])` picks the loops; `sfx(name)` plays an effect.
- Rebuild audio with `tools/build-audio.sh <src>` after downloading the packs; the sources are not committed.
