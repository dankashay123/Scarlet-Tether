# Handoff

Last updated 2026-10-18, after the optimisation and bug pass.

## Where the game stands

Playable on iPhone landscape (or desktop with keys) at 55–60 fps, with no page errors in any test.

- **Start:** a start menu, then the town of Vael. A dismissible 11-step tutorial (SKIP TUTORIAL) runs from the town into the first fight.
- **The descent:** a floor of 12 rooms on a 4×3 grid.
  - Gates lock behind you and waves spawn.
  - Room types: vestibule, crypts, a reliquary with an elite, a shrine, a treasury and the Warden's chamber.
  - Clearing the Warden's chamber wakes the Waystone home, which leads to the tally screen.
  - There is no timer.
- **Monsters:** 30 of them (10 common; 10 rare, which glow blue; 10 elite, which glow gold), plus the Collection Imp. All attacks are telegraphed. 19 Diablo III-style affixes, elite names and a nameplate bar.
- **Loot:** gold, health globes, items in 5 rarities, shrines, chests, breakables and a Massacre bonus. Gold saves to localStorage under the key `hollow-saint`.
- **Vael:** a long twilight street with six districts, 13 talking townsfolk, walkers, kids, crows, fog, ash and lightning.
- **OWL polish (this round, see `docs/ART_COMPARISON.md`):**
  - Large mixed-size flagstone floors per theme, and in the town street.
  - Walls on every side with lit tops, and soft cast shadows.
  - Darker ambient, warm torch pools and bloom, no orange wash.
  - Effects, item icons, coins, globes and enemy shots remodelled (`tools/models/vfx.mjs`).
  - New UI font: Kenney High, bold, cap height 9.
  - Saint legs show in the run; golem legs split; leviathan rears; darker Inquisitor hood.
- **Optimisation and bug pass:**
  - Rendering: the game draws straight into the screen canvas and CSS scales it (pixelated); only the visible part of the baked floor is drawn; blood soaks into the floor canvas; darkness and soft glows render at half size; glows and light holes are cached sprites. About 11 to 18 fps in the heaviest crowd at 4x CPU throttle in headless Chromium (software rendering), 44+ in town; our own code is 3 to 6 ms per frame at real speed.
  - Fixed: raised walls could trap the Saint (box test plus an `unstick` safety net for the Saint and enemies); last run's Stigmata leaked into town and the next run; a full bag could destroy an item for an empty slot; bolts fizzled against the back wall (they now track height above the floor); vacuumed drops could turn NaN; 1/2/3 on the card screen also cast a miracle; stale run flags on items after a closed tab; the mute button took taps meant for overlays; useless hits delayed the stuck-room rescue; the second censer had no glow; life on kill could heal a dead Saint.
  - Cleared rooms pull their gold and relics to the Saint.
  - `tools/tests/soak.cjs` plays at random for minutes and checks for errors, NaN, stuck states and the Saint inside walls.
- **Round 3 (inspired by Pixel Hunter Idle, see `docs/ART_COMPARISON.md`):**
  - The Nail Crossbow floats: `tools/models/weapon.mjs` renders it at 16 angles; `updateFloatBow`/`drawFloatBow` in `index.html` hover, aim, recoil and glow. Bolts leave from its tip. The Saint now raises a glowing palm instead of holding it.
  - Stigmata (GDD in-run talents): kills give XP (`gainXp`), each level offers 3 of 20 Wounds (`WOUNDS`). Plain boons fold into `gearStats()`; six skills run in `updateSkills` with big smooth effects (`drawSkillsGlow`). The pause screen lists what you bear. Tests set `window.HS_AUTOSTIG` so cards pick themselves.
- **Round 2:**
  - Map bug fixed: the room grid lookup wrapped across rows, so corridors could join far rooms and leave others unreachable (185 of 200 floors were affected). Loop links are now orthogonal, the spawn and carpet aisles are kept clear of props, and enemies spawn only on open tiles. A room where nothing is hurt for 15 s pulls its survivors into the open. `tools/tests/maps.cjs` checks 300 floors.
  - Minimap redrawn as a room grid with fog, corridors, locked gates in red, room icons and a blinking marker; the town shows a street strip.
  - Inventory and equipment: a 30-slot bag and 8 slots (hood, mantle, gloves, girdle, rosary, seal, relic, greaves), saved in localStorage (`SAVE.bag`, `SAVE.equip`). Every item has a slot base stat plus rolls; relic-touched items have a power, Odile's set has 2- and 4-piece bonuses. Stats apply through `G` (see `gearStats()`). Open with the bag button or I. Tap twice to wear; sell for gold. Empty slots auto-equip. On death the Choir takes every other relic picked up that run (worn ones are safe). Floor labels stack and show a green arrow for upgrades; rarer drops have loot beams.
  - 3/4-view furniture (crate, chest, pew, altar, sarcophagus, shrine, coffin, maiden, cage, statues, columns, urns), stone pilasters on back walls, engraved floor seals, new splats, mounds, candles, gibs, cobwebs and HUD buttons. `node tools/sprites.mjs --audit` reports no old art left.
- **Audio:** Kenney SFX for every action, OpenGameArt music (town, dungeon) and town wind and crickets. Mute button under pause (or M key), saved in localStorage. iOS 17+ follows the silent switch via `navigator.audioSession.type = 'ambient'`. Sources in `docs/CREDITS.md`.
- **Graphics v5:**
  - Everything is sculpted with the SDF renderer, and the view is about 360 px tall with a ×1.3 world scale (see `docs/GDD.md` → "Art v5").
  - Rooms are 24–32 × 14–20 tiles, corridors 4 wide, back walls 3 tiles tall.

## The owner's preferences

- Graphics matter most right now. The target is Otherworld Legends (the owner shared six screenshots): warm torch-lit stone halls, crisp hue-shifted pixel art with 7–10 shades per material, and nothing that looks AI-made.
- Inspiration for systems is Diablo III: elite affixes, loot showers and a lively town.
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
   - The fx sheet (bolt, impacts, smoke, thurible, flask, chain links) and the item icons are still the older hand-drawn style at the old size.
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
