# The Scarlet Tether — Design Research (Blasphemous / Metroid / Dead Cells)

Practical reference for maps, movement, systems and menus. Our units: **screen = 640x360 px = 40 x 22.5 tiles**, **tile = 16 px**, **player ≈ 72 px ≈ 4.5 tiles tall**.

> **How this was researched.** The research proxy blocked direct page fetches and image downloads (HTTP 403 on fandom, wiki.gg, deepnight.net, gamedeveloper.com, Steam, Wikipedia). So there are **no screenshot studies**. The facts below come from web-search snippets of the cited pages plus general knowledge of the games. Lines marked **(est.)** are estimates from play knowledge, not measurements. Check them against footage before you lock any numbers.
>
> Our current code for comparison (`src/game/player.ts`, `physics.ts`): RUN 128 px/s (8 tiles/s), JUMP_V 410, GRAVITY 1150 → jump apex ≈ **73 px ≈ 4.6 tiles ≈ 1.0 body height**, airtime ≈ 0.71 s, flat running jump ≈ **91 px ≈ 5.7 tiles**.

---

## 1. Room & map scale in Blasphemous 1/2

**Baseline: Blasphemous is native 640x360 pixel art** (scaled 3x to 1080p) **(est., widely reported)**. That is the same canvas as ours, so its framing transfers almost one-to-one. The Penitent One is roughly 1/6 of the screen height (~55–65 px) **(est.)**, a bit smaller than our 72 px hero. Our rooms should therefore be about **10–20% larger in tiles** to feel the same.

- **Room sizes (est.):**
  - Small "chamber" rooms: 1 screen (40x22 tiles). Used for a prie-dieu, an NPC, a shrine or a single fight.
  - Corridors and halls: 2–4 screens wide, 1 screen tall. This is the most common shape.
  - Vertical shafts: 1 screen wide, 2–5 screens tall, climbed with ladders, ledge grabs and small platforms.
  - Big set pieces (cathedral naves, bell towers, the Mother of Mothers): 3–6 screens in either direction.
- **Connections:** rooms are discrete. Leaving through an edge triggers a short fade-to-black cut (~0.3–0.5 s) **(est.)**, and the camera clamps to each room's bounds. Inside a room, scrolling is seamless. A door in Blasphemous is usually an open archway at the screen edge, not an object.
- **Verticality:** strong. Many zones are built as deep descents (Mercy Dreams → Mother of Mothers → Wasteland, the Desecrated Cistern underground) or tall towers (Grievance Ascends, the bell tower). Each zone mixes long horizontal halls with 1–2 tall shafts as its spine.
- **Rooms per zone (est.):** about 15–40 rooms. A full playthrough of Blasphemous 1 is roughly 20 named areas around a central hub (Albero, the village), plus the Brotherhood start area.
- **Landmark rooms:** prie-dieu rooms (an altar lit in gold), Mea Culpa altar rooms, the big hub church, boss arenas (a closed 1–2 screen box with a long entry corridor), and giant background figures (statues, bodies, the Holy Visage) that make a room readable at a glance.
- **Shortcuts:** one-way doors, lifts and breakable gates that open back toward the prie-dieu. Reviewers praise the checkpoint placement ([KeenGamer](https://keengamer.com/articles/reviews/ps4-reviews/bloody-hack-and-slash-blasphemous-cuts-in-review-ps4/)). Backtracking with new abilities is a core loop ("come back later with new abilities").
- **Secrets:** breakable false walls (hit them with the sword), hidden ledges, relic-gated paths (for example, the *Blood Perpetuated in Sand* relic reveals blood platforms), and cherubs hidden in cages off the main path (38 in Blasphemous 1). Collectibles sit just off-screen behind a breakable wall or under a ledge.
- **Hazards:**
  - **Spikes and bottomless pits are instant death** regardless of health. They are the game's most criticised feature.
  - [Twinfinite](https://twinfinite.net/2019/09/blasphemous-review-castlevania-souls/): "Far too many spikes are placed just under a ledge, which means you either stick the landing or turn into an ex-living pincushion."
  - [PC Gamer](https://www.pcgamer.com/uk/blasphemous-review): the hero "automatically grabs onto the ledge and there's a slight margin for error, but you're not afforded that mercy with the plethora of spike falls."
  - [Nintendo World Report](https://www.nintendoworldreport.com/review/51743) calls instant-death platforming combined with wind "some of the least fun I've ever had playing a Metroidvania."
  - **Lesson: spikes should deal heavy damage and respawn you at the room entry, not kill you.**
- **Camera framing (est.):** the player sits slightly below the vertical centre, with the floor at about the bottom 15–25% of the screen. That leaves 2–3 body heights of headroom for vaulted ceilings, chandeliers and hanging corpses. Horizontal look-ahead is modest (about 1/8 screen) and the camera eases rather than snapping.
- **Ceiling heights (est.):**
  - Crawl and tension corridors: about 2 body heights (~9 tiles for us).
  - Standard halls: 3–4 body heights (12–18 tiles).
  - Naves: the full screen or more, with parallax.

## 2. Movement metrics

Penitent One (Blasphemous 1), relative to body height H, all **(est.)**:

- **Run:** ~1 screen in 2.5–3 s, about 13–16 H/s. That is deliberate and weighty, slower than Hollow Knight.
- **Jump:** fixed arc with modest variable height. The apex is about 1–1.25 H, and the long jump is about 3 body widths. There is **no double jump in Blasphemous 1**.
- **Ledge grab:** automatic when the hands pass a ledge corner on the way up or during the early fall. The hero hangs, then pulls up with up or jump, or drops with down. Reach is about 0.5 H above the head at apex. This is the main forgiveness mechanic ([PC Gamer](https://www.pcgamer.com/uk/blasphemous-review)).
- **Ladders:** grab with up or down, climb at about 50–60% of run speed. You can't attack on a ladder, and jump detaches you. Ladders top out on a platform you can walk off.
- **Dodge/slide:** a ground slide of about 2–2.5 H distance (~3–4 tiles for us) with i-frames for most of it. It passes under low gaps and through enemies. The cooldown is short.
- **Plunge attack:** down + attack in the air. You drop fast and hit on landing. The *Vertical Attack* Mea Culpa skill adds a shockwave, and the plunge also breaks some floors.
- **Blasphemous 2 traversal abilities.** [PCGamesN](https://www.pcgamesn.com/blasphemous-2/abilities) lists four, each unlocked by finding an urn:
  - **Passage of Ash**: a mid-air (double) jump.
  - **Ivy of Ascension**: climb certain surfaces.
  - **Mercy of the Wind**: an air dash **(effect from memory, not confirmed by the source)**.
  - **Scions' Protection**: a late traversal ability (effect not verified).
- **Blasphemous 2's three weapons** double as keys:
  - **Veredicto** (war censer): longest reach, slow, can't parry. It rings bells or lights braziers that open paths ([Wikipedia](https://en.wikipedia.org/wiki/Blasphemous_2), [Prima](https://primagames.com/gaming/all-weapon-tier-upgrade-locations-in-blasphemous-2)).
  - **Sarmiento & Centella** (rapier and dagger): fastest, shortest range. Striking mirrors teleports you to a linked mirror ([TV Tropes](https://www.tvtropes.org/pmwiki/pmwiki.php/Characters/Blasphemous)).
  - **Ruego al Alba** (sword): balanced, life drain, and cuts certain barriers ([TV Tropes](https://www.tvtropes.org/pmwiki/pmwiki.php/Characters/Blasphemous)).
  - **For us:** the chain flail is a natural Veredicto analogue, with long reach and a heavy swing. Give it a traversal verb (see Recommendations).

## 3. Combat & progression systems

| Blasphemous system | How it works | Maps onto our system |
|---|---|---|
| **Mea Culpa skills (B1)** | Bought with Tears at Mea Culpa altars. Tiers unlock as you buy more. Skill types: combo extensions, charged attack, lunge, vertical plunge plus shockwave, ranged blood projectile (costs Fervour), ripostes/parry follow-ups. | Deacon Vivisect chain upgrades: combo link 4, charged swing tiers, a "lash" lunge, a plunge, and a ranged hook throw. |
| **Weapon trees (B2)** | Each weapon has its own tree. Mea Culpa has 14 skills over 2 tiers, and the other weapons 18 skills over 3 tiers. Skills cost **Marks of Martyrdom**, which you earn by filling an XP bar from kills ([meowdb](https://meowdb.com/db/blasphemous-2/weapons/mea-culpa)). | A permanent meta tree for the Tether, paid in a kill-earned "Vertebrae" mark rather than currency, so it can't be farmed by hoarding Tears. |
| **Prayers** | Spells that spend **Fervour**, a mana bar filled by hitting enemies. Blasphemous 2 splits them into quick **Verses** and channelled **Chants**. | Stigma active ability, fuelled by a Lucidity cost or a Censer-adjacent resource. |
| **Rosary Beads (B1)** | Passive trinkets. You start with **2 slots**, and Rosary Knots raise that to **8** ([fandom](https://blasphemous.fandom.com/wiki/Category:Rosary_Beads)). | **Sacraments** (run passives): cap at 2 slots early in a run and grow to 4–6 by finding knots inside the run. |
| **Relics (B1)** | One active traversal or perception relic, such as revealing platforms or climbing roots. | Optional run-found "Reliquaries" that act as keys for secret rooms in templates. |
| **Mea Culpa Hearts (B1)** | Sword cores. You equip one, and each has a strong upside with a drawback (for example, a longer block that also exposes you longer) ([meowdb](https://meowdb.com/db/blasphemous/sword-hearts/heart-of-the-virtuous-pain)). | **Stigmas** already fit this upside-plus-drawback pattern. Keep it: 1 equipped Stigma "heart" plus passives. |
| **Altarpiece of Favours (B2)** | Carved figures equipped in slots. You start with 2 and can unlock up to 8 via the sculptor Montañés for **25 Marks of Martyrdom** in total (1 → 10 per slot) ([Prima](https://primagames.com/gaming/how-to-unlock-more-statue-slots-in-blasphemous-2)). There are 55–67 figures, and adjacent figures grant set bonuses ([meowdb](https://meowdb.com/db/blasphemous-2/figures)). | A **Votive Altar** in the hub: a permanent passive grid where adjacent relics combine. Good long-term meta goal. |
| **Tears of Atonement** | Currency dropped by enemies, spent on everything (upgrades, skills, shops, prie-dieu upgrades: tier 3 teleport costs 20,000) ([wiki.gg](https://blasphemous.wiki.gg/wiki/Prie_Dieu)). | **Tears of Contrition** (currency and heal). The dual use is a great tension, keep it. |
| **Guilt fragments** | Dying leaves a fragment at the death spot. Guilt lowers maximum Fervour and Fervour/Tears gain until you recover it or pay to absolve it ([fandom](https://blasphemous.fandom.com/wiki/Category:Game_Mechanics?oldid=778), [Siliconera](https://www.siliconera.com/how-to-get-rid-of-guilt-in-blasphemous-2/)). | **Weight of Sin**: the death penalty carries to the next citizen. Add an optional "Guilt corpse" of the previous citizen in the next run's biome-1 map that you can reclaim. |
| **Bile Flasks** | Limited heals refilled at a prie-dieu. Empty vessels add flasks, and quicksilver makes them stronger. | Tear (heal) charges: start at 2 per run and add more from in-run reliquaries. |
| **Prie-Dieu** | Kneel to save, fully heal, refill flasks and respawn enemies. Upgrades: tier 2 boosts Fervour regen, tier 3 teleports between prie-dieus. | **Votive shrines** as in-run checkpoints (see Recommendations). |
| **Censer** | Not in Blasphemous: it has no stamina. | Our Censer stamina is a deliberate departure. Keep the costs low so it doesn't fight the touch controls. |

**Lucidity (sanity)** has no direct analogue. Blasphemous's closest idea is the *Shroud of Dreamt Sins*-style relics that show hidden ghosts and platforms. **Low Lucidity revealing hidden platforms and secrets at the cost of lying UI** is a strong unique hook.

## 4. Menus & UI

**Visual language (both games):**
- Near-black backgrounds with **ornate gold filigree frames**, thin gold double borders and corner flourishes.
- Gothic serif headings with small caps, light parchment text, and **crimson accents** for selected states.
- Every item has a hand-painted pixel icon and a lore paragraph.
- Menus pause the game, and the audio drops to a choir pad.

**HUD (Blasphemous 1) (est.):**
- Top-left: an ornate thorn/rosary frame. Inside it, a long **red health bar** with a **blue Fervour bar** below.
- Below or next to the bars: a row of **Bile Flask icons**, filled or empty.
- An optional prayer icon slot.
- Top-right: a **Tears counter** (tear-drop icon plus number) that briefly flashes with gains.
- A Guilt icon appears when you carry Guilt.
- The HUD is minimal: no minimap.
- **Boss bar:** a wide ornate bar at the **bottom centre**, with the boss name in gothic caps above it.

**Map screen:**
- A full-screen map made of **square cells**, one cell per screen. Rooms are drawn as outlined rectangles spanning cells, in muted colours, with openings shown as gaps.
- Only visited rooms appear (fog of war). A blinking marker shows the player's position.
- Icons mark prie-dieus, Mea Culpa altars, shops, NPCs, doors/gates and teleports.
- Zone names appear as you move the cursor.
- Blasphemous 2 adds player-placed markers and better icons. Fast travel goes through the "blessed hands" shrines ([GodIsAGeek](https://godisageek.com/2023/08/blasphemous-2-how-to-fast-travel/)).

**Inventory (B1):**
- A row of **tab icons along the top**: Rosary Beads, Relics, Quest Items, Mea Culpa Hearts, Prayers, Abilities, Collectibles. Shoulder buttons switch tabs.
- Left side: a grid of item cells (slots shown as sockets on a rosary or in a frame).
- Right side: a large icon, the item name, effect text and italic lore in a parchment-tinted panel.
- Equipped slots appear as a strip along the top or bottom.

**Skill tree (Mea Culpa altar):**
- A vertical tree of circular skill medallions joined by gold lines. Locked nodes are dark, and purchased nodes glow.
- Each node shows its Tears cost.
- A preview panel shows the input (as button icons) and a looping demo.

**Death:**
- The screen tints red, then black. A short stylised death title appears, followed by the respawn at the prie-dieu.
- A Guilt fragment (a ghostly kneeling figure) waits at the death point.

**Dialogue:**
- A dark, semi-transparent box across the bottom third with a thin gold border.
- The speaker's name sits in a small tab. Text types on letter by letter.
- No portraits in Blasphemous 1. The actors are fully voiced (English or Spanish).

## 5. Metroid map design principles (Super Metroid / Metroid Dread)

- **Grid cells:** in Super Metroid, each map cell = one 256x256-px screen of 16x16 tiles. Every room is a union of cells: long horizontal corridors, tall elevator shafts, L shapes, and big multi-cell caverns. The original Metroid strictly alternated horizontal and vertical rooms; Super Metroid's "chambers vary wildly in size, layout, purpose" ([Anatomy of Games, via Quaddicted](https://www.quaddicted.com/webarchive/www.anatomyofgames.com_20170315/index.html%3Fp=9556.html)).
- **Map screen conventions:**
  - Explored cells are filled (pink in Super Metroid). Cells revealed by a map station but not yet visited use a different tint.
  - Doors are short ticks on cell edges, colour-coded by lock: blue = any shot, red = missiles, green = super missiles, yellow = power bomb, grey = event-locked.
  - Item dots mark visible pickups. "S" marks save rooms, "M" map rooms, "E" energy refills, and "↕" elevators.
- **Metroid Dread** adds:
  - Six marker colours.
  - Highlighting every door a given beam opens.
  - **Areas that still hide items glow** ([Gfinity](https://www.gfinityesports.com/metroid/nintendo-steam-deck-competition/), [Samurai Gamers](https://samurai-gamers.com/metroid-dread/how-to-use-map/)).
  - Zone colouring: blue = normal, yellow = safe rooms (save, map, network), grey = EMMI zones.
  - After downloading its map, a map room also works as a save point.
- **Save, map and recharge rooms:** small 1x1 rooms that are visually distinctive and quiet. They usually sit just off a hub corridor or before a boss.
- **Elevators** join areas. They are long 1-cell-wide shafts with a loading transition, which keeps area maps readable as separate pages.
- **Gating:** every key item opens doors scattered across the map. In GMTK's *Boss Keys* dependency graphs, a "wide graph means one item opens many areas" (freedom) and a "tall, thin" graph means linear ([Omega Metroid](https://omegametroid.com/check-out-this-in-depth-world-design-analysis-of-the-metroid-series/), [Boss Keys: Super Metroid](https://yt.dorper.me/v/yt/nn2MXwplMZA)). **Soft locks** (a path that is hard rather than impossible) reward skilled players.
- **Loops:** after each major ability, the player is routed back through earlier areas via a new shortcut, so the world folds back toward the start (Crateria/Landing Site). Super Metroid's opening is gently linear and "slowly unreeling" ([Anatomy of Games](https://www.quaddicted.com/webarchive/www.anatomyofgames.com_20170315/index.html%3Fp=9556.html)).
- **Landmarks:** each room has a unique silhouette (statues, wrecked ship, giant creature bones) and its own music per area, so players navigate by memory.
- **HUD minimap (Super Metroid):** a 5x3-cell window at the top-right centred on the player. The current cell blinks, explored cells are filled, and doors are ticks.

## 6. Dead Cells hybrid level generation

Source: Sébastien Bénard / Motion Twin, "Building the Level Design of a procedurally generated Metroidvania: a hybrid approach" ([Game Developer](https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-), [IndieDB mirror](https://www.indiedb.com/games/dead-cells/news/the-level-design-of-a-procedurally-generated-metroidvania), [deepnight.net](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/)). Reconstructions: [Edgar-Unity's Dead Cells example](https://ondrejnepozitek.github.io/Edgar-Unity/docs/examples/dead-cells/), [ManiaMap](https://github.com/mpewsey/ManiaMap).

**Why hybrid:** fully handmade was too much work for a small team, and pure procedural generation gives "bland, messy, and inconsistent" levels ([moddb](https://www.moddb.com/news/the-level-design-of-a-procedurally-generated-metroidvania)).

**The six steps:**
1. **Fixed framework:** the biome order and the links between biomes are fixed. Each biome has a fixed start and an exit to the next biome, and some exits need specific runes (permanent abilities).
2. **Handmade tiles (room templates):** designers build rooms per biome (prison rooms are never reused in the sewers). A template carries a few parameters, mainly the **number and position of entrances and exits** and its **purpose**. Room types: entrance, exit, normal (combat/explore), shop, treasure, teleport. Rooms are also flagged indoor or outdoor ([Edgar](https://ondrejnepozitek.github.io/Edgar-Unity/docs/examples/dead-cells/)).
3. **Concept graph per biome:** a hand-authored schematic of nodes, laid out in this order: entrance and exit first, then special rooms (shop, treasure, timed door, teleporters), then the combat/explore rooms that fill the paths between them. It controls the level's length, branching and loops. Each biome has its own graph.
4. **Graph → level:** for each node, the generator picks a random template of the right type and tests it against the node's constraints (exit count, exit position/direction, type). If it fails, it tries another. **Playability is guaranteed because connectivity comes from the graph, not from random geometry.** Each template has been hand-tested to be traversable between all its exits.
5. **Enemy placement:** procedural, by density, at valid spawn spots in each template. The total is scaled to the level's length, and some rooms are left empty as rest "breaks". Pacing alternates peaks and breaks, borrowing from Left 4 Dead's AI Director ([moddb](https://www.moddb.com/news/the-level-design-of-a-procedurally-generated-metroidvania)).
6. **Loot:** scrolls, gold and items are placed with fixed budgets per biome so that power progression is deterministic in quantity but varies in location.

**Extras:**
- **Timed doors:** the graph can branch with a timed door ([Dead Cells modding API](https://dead-cells.com/mods/tool/mod/script/Struct.html)).
- **Teleporters** inside big levels cut backtracking.
- **Rune-gated side exits** create metroidvania gating across runs.
- The start area and some structures stay "loosely intact" while everything in between changes ([Neoseeker](https://www.neoseeker.com/dead-cells/walkthrough/Graveyard)).
- **Length:** a biome takes about 3–8 minutes and holds about 10–20 rooms **(est.)**.

**Lessons for us:**
- Author **templates with typed, grid-snapped exits** and a **hand-made graph per biome**, rather than random walks.
- Validate offline: write a script that checks every template can reach every exit with the current jump metrics.
- Fix landmark rooms (shrine, confessional, boss antechamber) in the graph so every run has recognisable beats.

## 7. Recommendations for The Scarlet Tether

Ordered by priority. Numbers assume the current metrics: apex 4.6 tiles, flat running jump 5.7 tiles, run 8 tiles/s.

1. **Map cell = 48 x 24 tiles (768 x 384 px).** That is wider than the widest iPhone view (~780 px at 19.5:9, so frame it with 6 px of black wall) and 1.5 tiles taller than the screen, so a 1-cell room still has gentle vertical camera play. Every template is an integer number of cells.
2. **Template sizes:**
   - **1x1**: shrine, confessional, treasure, NPC.
   - **2x1 / 3x1**: combat halls, the bulk of templates (≈60%).
   - **1x2 / 1x3**: vertical shafts with ladders and chains (≈20%).
   - **2x2**: arenas, big landmark rooms.
   - **L-shapes**: corners (≈10%).
   - Boss arena: 2x1 plus a 1x1 antechamber.
3. **Typed, snapped exits:**
   - Side exits sit at fixed slots per cell (floor at tile row 18 of 24, opening 7 tiles high).
   - Top and bottom exits are 6 tiles wide at the cell's horizontal centre ±12 tiles.
   - Exit types: `open`, `one-way-drop`, `ladder`, `chain`, `locked(shortcut)`, `secret`. The generator only joins compatible exits.
4. **Run size:**
   - Each biome: **12–16 rooms (~25–35 cells), 10–15 min**, matching the vertical slice target.
   - The full run: 3 biomes plus the hub ≈ 40–50 rooms.
   - The biome graph: 1 main path of 6–8 rooms, 2 side branches of 2–3 rooms each (one treasure, one confessional), and **at least 1 loop** that returns near the shrine.
5. **Hand-authored concept graph per biome** with node types: `entry`, `combat`, `rest` (empty), `shrine`, `confessional` (Sacraments), `treasure`, `secret`, `shortcut`, `elite`, `boss-antechamber`, `boss`, `exit`. Pace combat nodes as peak, peak, break.
6. **Offline playability validator:** a script that flood-fills each template with the jump rules below and checks every exit pair is connected (or only one-way, by design), and that no spikes sit within 2 tiles of the landing zone below a mandatory ledge.
7. **Ceiling heights:**
   - Minimum **10 tiles** wherever jumping is expected (4.5 body + 4.6 jump + margin).
   - **7–8 tiles** only for tension corridors where jumping is pointless.
   - Standard halls 14–18 tiles. Landmark naves 24+ (a full cell or more, with parallax).
8. **Jump rules for level design:**
   - Steps up to 4 tiles: a plain jump.
   - **5–6 tiles: only reachable with a ledge grab.**
   - 7 tiles or more: needs a ladder, chain or one-way platform.
   - Gaps: up to 4 tiles is comfortable, **5 tiles is the maximum for required jumps**, 6 or more needs the air dash.
   - Keep the apex at about 1 body height (4.5–5 tiles), which already matches Blasphemous's weighty feel.
9. **Ledge grab:**
   - Snap when the hand point (head + 0.5 tile) is within **±12 px horizontally and 0–20 px vertically** of a ledge corner, while rising or within the first 0.25 s of falling.
   - Pull up in 0.35 s, or drop with down. No attacks while hanging.
   - Make it automatic, as in Blasphemous: no button press.
10. **Ladders and chains:**
    - Climb at 92 px/s (keep current). Ladders are **fully vertical, 1 tile wide**, and extend 1 tile above the top floor so the player can step off.
    - Never end a ladder over a hazard.
    - Ladder spacing between rest platforms: 12 tiles or less.
    - **Hanging chains** allow side-swing and a release-jump that gets +30% horizontal distance, giving shafts a "Tether" identity.
11. **Spikes and pits:**
    - **No instant kill.** Deal 35% of maximum health, then respawn at the last safe ground (as Hollow Knight does) and drain 5 Lucidity.
    - Never place spikes directly under a mandatory ledge-grab jump. This is the top complaint about Blasphemous (see Section 1).
12. **Camera for phone:**
    - Feet at about **y = 230 of 360** (64%), leaving about 130 px below for floor plus the thumb-zone overlap. That gives roughly 2 body heights of headroom.
    - Horizontal look-ahead 56 px in the facing direction, eased over 0.4 s.
    - When falling faster than 300 px/s, shift the look-down 48 px so the player can see landings.
    - Keep hazards and pickups out of the bottom 40 px, which the buttons can cover.
13. **Room transitions:**
    - A 0.25 s fade-cut between rooms, as in Blasphemous, with seamless scrolling inside a room.
    - Freeze enemies until the fade-in is done.
    - Spawn the player 2 tiles inside the door with 0.5 s of invulnerability.
14. **Votive shrines (prie-dieu analogue):** in every biome, 1 at the entry, 1 mid-biome, 1 before the boss.
    - Kneel to refill Tear heals, restore 25 Lucidity and set the respawn point inside the run (one respawn per shrine per run, costing Weight of Sin).
    - Mid-run teleport between lit shrines **only within the current biome**.
15. **Secrets:**
    - Each biome graph includes 2 `secret` nodes behind **breakable false walls** (the chain hits them) and 1 hidden ledge above the screen top.
    - At Lucidity below 50%, secret walls show a faint rot seam.
    - Rewards: Tears, Sacrament knots, Stigma fragments.
16. **Shortcuts:** each biome has 1–2 `locked(shortcut)` exits (a gate or a chain lift) that open from the far side and link back toward the shrine. They feel Metroid-like within a single run.
17. **Chain traversal verb (Veredicto-style key):** the Tether can **hook iron rings** to swing or pull up 6–8 tiles, ring **confession bells** that toggle platforms, and smash breakable walls. Gate optional branches and secrets behind it, never the main path, so runs never soft-lock.
18. **Skill tree (Mea Culpa analogue) for the Severed Tether at Deacon Vivisect.** About 15 nodes in 3 tiers, unlocked with "Vertebrae", a meta currency earned per boss or elite kill:
    - Tier 1: 4th combo link, charge level 2, Plunge Slam.
    - Tier 2: Lash Lunge (dash attack), Hook Throw (ranged pull), Riposte after Perfect Dodge.
    - Tier 3: Ring Swing traversal, Execution Spin, a vertebra "heart" slot.
    - Each tier costs more as the previous tier fills, like Blasphemous 1 (nodes shown as gold medallions).
19. **Sacraments as rosary-bead slots:** **2 slots** at run start, +1 per "knot" found in treasure or secret nodes, maximum 5 per run. They reset on death. The permanent Votive Altar in the hub mirrors the Altarpiece of Favours: 2 starting slots, up to 6, with adjacency bonuses.
20. **Weight of Sin as Guilt:** each death adds Sin, which lowers maximum Censer by 10% and Tears gain by 15% per stack, up to 3 stacks. The new citizen can find the previous body (a "Guilt" node in biome 1) and reclaim it to clear 1 stack.
21. **Map screen (Metroid plus Blasphemous):**
    - Full-screen parchment-on-black page with a gold filigree frame. **1 cell = 12x6 px** on the map.
    - Rooms drawn as filled cell unions in muted ochre. The current room is crimson and pulsing.
    - Openings shown as gaps in the walls. Locked shortcuts are gold ticks, secrets are hidden until found.
    - Fog of war: unvisited rooms that are adjacent to visited ones appear as dotted outlines.
    - Icons: shrine (candle), confessional (grille), treasure (reliquary), boss (skull), exit (arch).
    - Pinch to zoom, drag to pan. A "glow" marks rooms that still hold items, as in Dread.
22. **HUD minimap:** top-right, **5x3 cells at 10x6 px each** (about 54x22 px with border) in a thin gold frame, 70% opacity, centred on the player. Tap it to open the full map.
23. **HUD layout:**
    - Top-left: an ornate frame with a red health bar (about 120x6 px), the Censer bar below it (amber), then Tear heal icons as 2–5 small vials.
    - Top-right, beside the minimap: Tears counter, then Lucidity as an eye icon that cracks as it falls.
    - The boss bar goes at the **top centre**, not the bottom, because the touch buttons occupy the bottom.
24. **Menu art style:**
    - Near-black (#0b0708) with double gold borders (#c9a24a with a #6b4e1f shadow) and crimson selection (#8f1d1d).
    - Parchment text (#e8dcc0) in a pixel blackletter for titles and a clean pixel serif for body text, with item art in an ornate socket.
    - **Inventory tabs across the top** (Stigmas, Sacraments, Relics, Tether, Lore) with big touch targets of **44 px or more**.
    - Selected-item detail on the right, with effect plus italic lore.
    - Dialogue box across the top third or the middle so it doesn't clash with the touch buttons. Use a speaker name tab and typewriter text.
25. **Death screen:**
    - A red tint plus a slow fade, then a blackletter "ABSOLVED" (or "SEVERED") title.
    - Then the citizen vignette, and a summary of carried Weight of Sin and Stigmas on a parchment card. This replaces Blasphemous's Guilt reveal.
