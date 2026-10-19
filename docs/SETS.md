# Vestment sets

Five main gear sets, built in round 12. Our own names throughout.

In game: `VSETS`, `MAIN_SETS`, `sb(id, n)` (pieces worn), `setGuard()`
(damage taken), `setFoeK()` (damage dealt by source), Odile's Gift
(`openGift`). Skins: `SKINS` in `tools/models/base.mjs` make the sheets
`saint_<set>` and `portrait_<set>`; `saintSheet()` picks one at 4 pieces.
Set icons: `ui` `set_<set>`. Test: `tools/tests/sets.cjs`.
Round 13: each skin also has its own crossbow (`weapon` `xbow_<set>`,
`XSKIN` in `tools/models/weapon.mjs`), bolt (`fx` `bolt_<set>`) and bolt
trail, glow and hit-spark colours (`BOLT_FX`). Every Saint sheet has
hand-posed `cast`, `hit` and `die` frames.

## What we take from Diablo 3

- **Sets are builds.** A class set is six pieces. 2 pieces bend how a skill
  works, 4 pieces add a defence or utility hook, and 6 pieces give a huge
  multiplier to one skill. The set tells you how to play.
- **Six of ten slots.** Six set pieces leave the other slots for top-rarity
  pieces with powers, so players still mix and match.
- **One fewer piece.** A ring lets sets count one fewer piece (minimum 2),
  which frees a slot.
- **A starter gift.** The season hands every player a set, so the endgame
  starts quickly.
- **A set trial.** Each set has a short challenge map that teaches its play
  style.

## How it fits Hollow Saint

- We have 8 slots: hood, mantle, gloves, girdle, pendant, seal, charm,
  greaves. **Each set has 6 pieces in fixed slots**, leaving 2 slots free
  for Hallowed pieces and their powers.
- Bonuses at **2, 4 and 6 pieces**. The 6-piece multiplies only the set's
  own skill (about ×3 to ×5). It is the biggest jump in the game, but set
  pieces still carry an item level, so **Sanctity still gates the
  Stations**: a Station I set cannot carry you to XV.
- Set pieces drop from Station VI up (`SET_FROM`; rarity `set`, green beam; Odile's Habit below that). Rares
  never drop them; elites rarely do; Wardens sometimes do. Rates rise with
  the Station.
- **The Lesser Vow** (a Hallowed seal power): sets need one fewer piece
  (never fewer than 2).
- **Odile's Gift:** the first time you slay the Wardens of III, VI and IX,
  Sister Odile gives you 2 pieces of a set of your choice (6 in all, so one
  full set).
- **Penitent Cells** (not built yet): one small fixed trial room per set, opened
  by wearing the full set. Clearing it hangs a banner in the Cathedral.
- Today's 4-piece "Odile's" set stays as the **starter set, Odile's
  Habit** (drops from Station I; 2: +10% damage, 4: +1 dash charge and
  +15% damage). It is not one of the five.
- **The Saint's look changes at 4 pieces:** each set recolours the robe
  and adds one detail, so the build shows on screen.

## The five sets

### 1. The Hundred Nails (crossbow)

Slots: hood, gloves, girdle, pendant, seal, greaves. Colour: iron and gold.
Look: a quiver of nails on the back.

- **2:** bolts pierce 1 more foe and split into 2 when they hit the last
  one.
- **4:** every bolt that hits adds a Nail stack (max 50, lost after 3 s
  without a hit). Each stack is 1% less damage taken.
- **6:** bolts deal +8% damage per Nail stack (×5 at 50 stacks).

Play: never stop firing; stand and shoot, then dash only to keep stacks.

### 2. The Penitent's Stride (dash)

Slots: mantle, gloves, girdle, charm, seal, greaves. Colour: ash grey and
ember. Look: smouldering footprints.

- **2:** +1 dash charge. Dashing leaves a line of holy fire for 2 s.
- **4:** a perfect dodge refills every dash charge and gives 2 s of
  Penance: 50% less damage taken.
- **6:** for 4 s after a dash, the crossbow, Holy Nova and the fire trail
  deal ×4 damage. Dashing through a foe brands it; branded foes take 25%
  more damage.

Play: weave through packs, chain perfect dodges, keep the window up.

### 3. The Drowned Font (holy-water vial)

Slots: hood, mantle, girdle, pendant, charm, greaves. Colour: pale teal and
silver. Look: a dripping font bowl at the hip. (Drops more often in the
Drowned Nave.)

- **2:** holy-water pools are 30% wider and slow foes inside by 40%.
- **4:** while you stand in your own pool you take 40% less damage and gain
  Zeal twice as fast.
- **6:** pools deal ×5 damage, slowly pull foes to their centre, and every
  kill inside one lowers the vial's cooldown by 0.5 s.

Play: throw a pool, hold the ground, let the crowd come to you.

### 4. The Last Confessor (chain)

Slots: hood, mantle, gloves, pendant, seal, charm. Colour: rust and black.
Look: a chain wrapped round the arms.

- **2:** the chain binds 3 more foes, and bound foes take 25% more damage
  from everything.
- **4:** each foe bound gives 8% less damage taken (up to 40%) until the
  chain breaks.
- **6:** when the chain ends, it drags every bound foe together and they
  burst for ×5 the chain's damage in a ring. Slaying an elite resets the
  chain's cooldown.

Play: bind a pack, kite while it is held, then crush it together.

### 5. The Burning Choir (Reckoning and Zeal)

Slots: hood, mantle, gloves, girdle, pendant, greaves. Colour: white and
flame red. Look: a halo of small candle flames.

- **2:** Zeal fades half as fast, and critical hits give +50% Zeal.
- **4:** during Reckoning you cannot be rooted or slowed, and each kill
  heals 2% of your health.
- **6:** Reckoning lasts while you have Zeal (it drains Zeal instead of
  ending), and all your damage is ×3 while it burns. A Carnage bonus
  refills 20 Zeal.

Play: build Zeal fast, then hold Reckoning as long as the killing lasts.

## Balance notes

- Each 6-piece multiplies one source only, so off-set Wounds still matter.
  The Stigmata pick that matches the set (Split Nail, Holy Nova, Deep Vial,
  Longer Chains, Zealous) is the natural partner.
- Aim for a full set to be worth about one and a half Stations of Sanctity
  in its own skill, and about half a Station elsewhere.
- Numbers are first guesses; tune from play with the descent knobs.

## How it is built

- `rollItem` and the curio stall: rarity `set` picks a set (Odile's Habit
  below Station VI) and one of its slots; `it.set` holds the set id (old
  saves' `true` becomes `habit`). 35% of Hallowed seals are the Lesser Vow.
- `gearStats` counts pieces per set (`g.sets`), adds the Vow and picks
  `g.skin`. The crossbow, dash, vial, chain and Reckoning code read
  `sb(id, n)`.
- Item cards list the set's bonuses, lit when active. The HUD shows NAILS,
  STRIDE or IN THE FONT under the portrait.
- Skins are sculpted, not recoloured sheets: each set swaps the Saint's
  cloth materials and adds a detail (Nails: gilt crown, iron mantle,
  quiver; Stride: cream cape, smouldering soles and hem; Font: deep blue
  robes, silver trim, glowing vial; Confessor: slate robes, cream hood, a
  chain from the fist; Choir: white mantle, crown of lit candles). The
  crowned skins drop the halo.

Research sources:
[PCGamesN, new class sets](https://www.pcgamesn.com/diablo-iii/new-class-sets),
[Blizzard Watch, season 20 patch notes](https://blizzardwatch.com/2020/03/05/diablo-3-season-20-patch-notes/),
[Season of Grandeur](https://blizzplanet.substack.com/p/diablo-iii-season-16-the-season-of-grandeur),
[Season 37 preview](https://www.icy-veins.com/forums/topic/85351-diablo-3-season-37-official-preview/).

## Arms (round 14)

Each set also has two weapon pieces, a crossbow and a quiver, with their own
2-piece bonus that leans on the same skill. They drop as set rarity from
Station VI (30% of set drops). A set crossbow sets the crossbow's look.

| Arms | Crossbow | Quiver | 2-piece |
|---|---|---|---|
| Hundred Nails | The Nailwright's Arbalest | The Hundredfold Quiver | Every 5th bolt is a great nail: x3 damage, pierces every foe |
| Penitent's Stride | The Pilgrim's Ember-Bow | The Quiver of Coals | After a dash, the next 6 bolts set foes alight |
| Drowned Font | The Aspergill Arbalest | The Brimming Case | Bolts slow 30%; foes they slay leave a small pool |
| Last Confessor | The Penance Engine | The Quiver of Links | Every 8th bolt binds its foe and 2 near it for 1.5 s |
| Burning Choir | The Canticle Bow | The Quiver of Candles | Crits charge Reckoning twice as fast; in Reckoning bolts burst into flame |

## Penitent Cells (round 14)

Built: one 90 s wave trial per set (`CELLS`). Goals: Nails 150 small foes,
Stride 90 chargers, Font 140 of a slow tide, Confessor 24 rares, Choir 60
with an elite each wave. Absolving hangs a banner on the Cathedral; the
first time also gives the set's missing arms.

## Round 27 tuning

Measured with `tools/tests/setbal.cjs` (Station VI, each set whole with its
arms and its own rites, seeded crowds). Numbers live in `SETK` in
`index.html`; the set cards in the game show them.

| Set | Change |
|---|---|
| The Hundred Nails | 6: +4% per nail stack (was 8%) |
| The Penitent's Stride | 6: X6 for 5 S after a dash (was X4 for 4 S), and every dash releases a nova |
| The Drowned Font | 6: pools deal X2.5 (was X5) |
| The Last Confessor | 2: bound foes take 40% more (was 25%); 6: bound foes take double damage, burst when they die, and the crush deals X12 (was X5) |
| The Burning Choir | 6: X1.25 damage in Reckoning (was X3); Zeal drains 18 a second while it lasts (was 12) |

After tuning each whole set clears about 10-15 kills a second in the test
crowd (before: 5 to 16).

## Round 28: four pieces

Four pieces of any set add +25% damage and a smaller form of the set's
six-piece damage (six pieces replace it): Nails +2% bolt damage per stack,
Stride X2 for 3 S after a dash, Font pools X1.5, Confessor bound foes take
30% more, Choir X1.1 in Reckoning (`SETK.*4`). In `setbal.cjs` the 4+2 mixes
moved from 3.7-10 to 5-11 kills a second (no set: about 3.5; whole sets 8-15).
