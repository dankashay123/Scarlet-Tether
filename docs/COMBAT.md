# Hollow Saint — Combat, Monsters, Loot and Town (v1)

> Round 9 changed the descent: rooms no longer lock or send waves. A map is 11–12 random rooms packed with monsters, kills fill the Toll, and a full Toll brings the Warden (the Station boss). Difficulty is the Fifteen Stations. See `docs/HANDOFF.md` for the current rules; the room and wave notes below are history.

Our own battle design, built for short mobile runs. This file extends
`GDD.md`; where they differ, this file is newer.

## The descent: a floor of locked rooms

There is no timer. Each Stratum floor is a map of 9 near-square rooms (earlier drafts said 10–12) joined by
corridors (Otherworld Legends style):

| Room | What happens |
|---|---|
| Vestibule | Start. Safe. |
| Crypt (combat) | Step inside and the iron gates drop behind you. 2–3 waves spawn; the next wave comes when the last is nearly dead. Clear it and the gates rise. |
| Champion's Hall (elite) | A yellow Elite and its minions, plus a wave. Skull on the map. |
| Shrine | A shrine with a short buff. Gates never lock. |
| Treasury | A locked chest and breakables; sometimes a Collection Imp. |
| Warden's Chamber (exit) | The furthest room. The hardest fight; clearing it wakes the Waystone home. |

Rooms deeper from the start spend a bigger monster budget. Rooms have themes
(crypt hall, ossuary, flooded chapel, chapel of pews) that change props, decor
and lighting. The minimap reveals rooms as you enter them.

## Monster tiers

| Tier | Look | Affixes | Comes as |
|---|---|---|---|
| Common | normal | none | swarms of 2–3 kinds |
| Rare | **blue glow**, 1.3–1.5× size, named | 1–2 | packs of 2–3 of the same kind sharing affixes |
| Elite | **gold glow**, 1.6–2× size, unique name ("Marrowgaunt the Unshriven") | 2–4 | one Elite with 3–5 common minions |

An engaged Rare or Elite shows its name, HP bar and affixes at the top of the
screen.

### Common (10)

| Monster | Behaviour |
|---|---|
| Risen | Shambles in, claws. |
| Crawling Sinner | Legless; fast, low, comes in groups. |
| Candle-Mourner | Keeps distance, lobs wax fire that lands on a telegraphed circle. |
| Bone Acolyte | Keeps distance, fires aimed bone shards. |
| Gravewarden | Tower shield blocks frontal bolts; shield-bash lunge. |
| Tithe Rats | Tiny, very fast swarm. |
| Bloated Votary | Waddles close, swells, bursts into a blood pool. |
| Scourger | Circles, then charges in a straight line. |
| Weeping Putto | Flies, fires a three-tear spread. |
| Choir Wisp | Blinks next to you and lunges. |

### Rare (10)

| Monster | Behaviour |
|---|---|
| Ossuary Knight | Long windup, wide cleave. |
| Tithe Collector | Swings a censer that sprays a ring of embers; whistles up rats. |
| Mother Wax | Lobs three wax bombs that leave fire. |
| Hollow Bishop | Raises Risen; aimed shots. |
| Chain Turnkey | Throws a chain along a telegraphed line and drags you in. |
| Bell Ringer | Tolls an expanding shockwave ring: dash through it. |
| Scourge Matron | Whip barrage in a cone. |
| Carrion Choirboy | Screams in a cone that slows; spits. |
| Gravedigger | Shovel slam; digs up Risen. |
| Lantern Shade | Teleports and fires a telegraphed beam. |

### Elite (10)

| Monster | Behaviour |
|---|---|
| Shackled Colossus | Ground-slam shockwave and a charge. |
| Seraph of Ash | Flies; feather volleys. |
| Ossuary Golem | Charges; hurls coffins. |
| The Thrice-Buried | Splits into three when killed. |
| Abbess of Brambles | Thorns erupt under you (telegraphed); thorn cone. |
| Censer Titan | Three burning censers orbit it. |
| The Many-Mouthed | Spiral bullet patterns. |
| Grave Leviathan | Burrows and bursts up under you. |
| Inquisitor | Three telegraphed dash-slashes in a row. |
| Weeping Effigy | Teleports; fires a fan of tear beams. |

## Affixes

Every affix is telegraphed and dodgeable ("Learn the fight").

| Affix | Effect |
|---|---|
| Hale | +60% HP |
| Swift | +40% speed, faster attacks |
| Swarming | Extra minions |
| Smoldering | Leaves a burning trail; erupts on death |
| Defiled | Blood pools open under you |
| Hoarfrost | Frost orbs burst after a delay and slow you |
| Venomous | Cross-shaped poison bursts |
| Shelling | Lobs bombs from range |
| Tolling | Bell-lightning strikes telegraphed circles |
| Shackling | A circle snaps shut and roots you |
| Beckoning | Drags you to it |
| Blinking | Teleports near you |
| Warded | Periodically invulnerable |
| Vengeful | Packmates grow stronger as others die |
| Mirrored | Splits off illusions when hurt |
| Smiting | Hits knock you back |
| Stonebound | Raises bone walls |
| Chained | Burning chains link pack members |
| Remorseful | Reflects a little damage back |

## Drops and pickups

- **Gold** spills from kills and breakables and is pulled in when near.
  Death tithes half the run's gold to the Choir.
- **Health orbs**: red orbs, heal 15% of max HP. Elites drop them more often.
- **Items** with rarity colours and light beams: Common (white), Blessed (blue),
  Consecrated (yellow), Hallowed (orange), Saint's Set (green). Found items
  go to the stash for the Vestment slice item.
- **Shrines**: Zeal (double damage), Haste (+50% speed), Warding (half damage
  taken), Plenty (a rain of gold). 20–30 s each.
- **Breakables**: urns and coffins burst into gold and the odd orb.
- **Collection Imp** (treasure goblin): flees with a sack; kill it before it
  opens a portal for a shower of gold and items.
- **Carnage**: chain kills within a second of each other for a gold bonus.

## Vael

A long, horizontal town in permanent twilight, built over older ruins, dark
and ominous but alive. Left to right: the Pilgrims' Gate with gallows and
cages; the market (Pell's Stall, the plush-Saint souvenir stand, carts); the
Gilded Lamb and the scrying pool, where a crowd watches the Saint; the Forge of
Reckoning; the graveyard with crows; then the cathedral steps and the Vestry,
whose lift takes you down. Fog, drifting ash, chimney smoke, flickering
windows, wandering townsfolk, children playing, crows that scatter, and dark
foreground silhouettes for depth.
