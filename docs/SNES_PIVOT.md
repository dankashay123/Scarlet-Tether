# The Scarlet Tether: SNES shooter pivot

The game moves from a melee roguelite at 640x360 to a **16-bit SNES-style
metroidvania shooter** in the spirit of Super Metroid. The setting stays the
same: religious body horror, the Under-Naves beneath the sinless city of
Sanctum, Lucidity, gore. The melee version is preserved on the
`melee-roguelite` branch.

## Screen and scale
- **Logical screen: 224 px tall** (SNES), width from the device aspect
  (about 400–490 px on phones). Constant: `VIEW_H = 224` in
  `src/game/config.ts`.
- **Tiles stay 16x16.** The view shows 14 tiles vertically, as in Super
  Metroid.
- **Room cells stay 40x24 tiles** (larger than the screen, so rooms scroll).

**Target on-screen heights** (feet to top of head):

| Character | Height |
|---|---|
| Hero | about 40 px (body hitbox 12 wide by 38 tall) |
| Blind | about 30 px |
| Gossip | about 26 px |
| Penitent (the booth brute) | about 44 px |
| Cherub | about 22 px |
| Boss Bartholomew | about 140 px |
| Ear | about 36 px |
| Hub NPCs | 36–60 px |

## Art style: SNES / Super Metroid
- **Run every sprite through `snesify()`** from `src/art/snes.ts` when it is
  rendered: 15-bit colour, at most 15 colours per sprite, and isolated
  dither pixels removed.
- **Shading:** clean, hand-pixelled-looking bands of colour with 3–5 shade
  steps per material. Avoid noise and checkerboard dithering.
- **Outlines:** a dark outline, selective (lighter where light hits),
  following Super Metroid and SNES Castlevania.
- **Light:** key light from the upper left, matching the existing `KEY_LIGHT`.
- **Backdrops and tiles:** use `snesify(canvas, { colors: 32–64 })`, a few
  palettes' worth.

## Hero: "The Severed", a gunner
The armored hooded design stays: crimson cowl, iron mask with an ember eye
slit, blackened steel, tattered cloak. The **front arm ends in the "Tether
Cannon"**, a bone-and-iron arm-cannon grafted where the chain was; it fires
blood bolts.

**Sprite sheet:**
- Texture key `player`, built by `buildHeroSheet(scene, look, key = 'player')`.
- Frame size `FW = 64`, `FH = 56`, `FOOT_Y = 52`.

**Animation names, with frame counts as guides:**

| Group | Animations |
|---|---|
| Standing aims | `idle` (4, aiming forward), `aim-up` (1), `aim-diag-up` (1), `aim-diag-down` (1) |
| Running | `run` (10, cannon forward), `run-diag-up` (10), `run-diag-down` (10) |
| Crouching | `crouch` (1), `crouch-diag-up` (1) |
| Airborne | `jump` (3, play once), `fall` (2), `air-fwd` (1), `air-up` (1), `air-diag-up` (1), `air-diag-down` (1), `air-down` (1) |
| Moves | `slide` (dash, about 6, play once over about 0.42 s) |
| Damage | `hurt` (2), `die` (about 8) |
| Traversal | `climb` (6, cannon holstered), `hang` (2), `mantle` (4) |
| Shrines | `kneel` (3, at save altars) |

**Exports:**
- `heroMeta.muzzle[frame] = [x, y, angleRad]`: the muzzle position in frame
  pixels (unflipped, facing right) and the aim angle for every frame. The game
  spawns bolts there. Frames with no shot use the nearest sensible value.
- Keep `heroMeta.hands` filled if it is cheap (it is no longer needed for
  gameplay).

## Enemies, NPCs and props
- **Same keys and animation names as now; sizes change.** Export the new
  `{ w, h, footY }` from `src/art/creatures/*`. The gameplay hitboxes in
  `src/game/enemies.ts` are rescaled to match.
- **Environment props and dressing:** scale to the new screen, about 0.62x.
  Booths, saints, candelabras, cages, doors, votives, caches, statues and
  lamp posts are all too big at 224 px tall.
- **Backdrops:** 224 px tall and horizontally tileable (width 512 is
  suggested), same keys (`bg-<set>-far|mid|near`, `fg-<set>`, and the rot
  twins).
