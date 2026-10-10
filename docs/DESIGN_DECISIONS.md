# The Scarlet Tether — Build Decisions

Source of truth for *what we're building*. Lore, tone and content come from the
original Design Bible; this file records the decisions that adapt it into an
iPhone game. Where the two disagree, this file wins.

## Platform & tech
- **Engine:** Phaser 3 + TypeScript, bundled with Vite.
- **Target:** iPhone, played in Safari / "Add to Home Screen" (PWA, fullscreen).
  Structured so it can later be wrapped with Capacitor for the App Store.
- **Orientation:** Landscape only (portrait shows a "rotate your device" screen).
- **Play-testing:** GitHub Pages, auto-deployed from the repo by a GitHub Actions workflow.

## Visual style
- **16-bit HD pixel art.** Native render **640×360**, integer-scaled. On wider
  iPhones the view extends horizontally (more of the room is visible) instead of
  letterboxing.
- **Perspective:** Top-down / 3/4 view, room-based roguelike (Hades-like structure).
- **Art source:** Original pixel art generated in code (sprite/tile data + scripts).
- **Lucidity rendering:** Every tile/sprite has a *marble* and a *rot* variant.
  As Lucidity falls, rot spreads through the room in patches, palette shifts toward
  desaturated red, hidden hazards fade in. Below 30% the UI starts lying.

## Controls (touch)
- Floating virtual joystick (left thumb).
- Right-side buttons: **Attack** (tap = combo, hold = charged heavy swing),
  **Dodge**, **Execute** (Rite of Absolution, shows on staggered enemies),
  **Stigma** ability.
- Soft-lock aim onto the nearest enemy in the facing direction.
- Keyboard fallback for desktop development only.

## Combat changes vs. the Bible
- **Parry is removed → Perfect Dodge.** A dodge timed at the last instant before a
  hit triggers a brief slow-mo flash, staggers the attacker, and fires Stigma
  effects. A mistimed dodge costs extra Censer stamina.
- **Weapon — The Severed Tether:** heavy chain flail. 3-hit combo with wide arcs and
  slow wind-ups + charged heavy swing. Deacon Vivisect upgrades extend the chain and
  add vertebrae effects.
- Incense Censer (stamina), Sanguine Reliquary (health), Lucidity, Rite of
  Absolution, Tears of Contrition all kept as written.
- **Difficulty:** punishing but fair — few hits kill, clear telegraphs.

## Vertical slice scope (Milestone 1)
- Intro: the tether snaps, the fall down the Echoing Chute.
- **Hub — Drain of Absolution:** Mother Magdalene (Stigmas), Deacon Vivisect
  (weapon upgrades), Brother Hollow (permanent upgrades for Tears).
- **Biome 1 — The Sunken Confessionals:** handmade rooms strung together randomly
  each run into a branching path; ~8–10 rooms, **10–15 min** to the boss.
  - Hazards: Whispering Grates, Coagulated Ponds, Censer Pendulums.
  - Enemy: The Blissful Blind (track sound) + a small supporting cast.
  - Weeping Confessionals: draft Sacraments (Vow of the Glutton, Spiteful Tongue,
    Blind Eye, + more).
- **Boss — Bartholomew, The Swollen Ear** with all three phases.
- **Stigmas in slice:** The Glutton's Maw, The Flayed Helix (reworked: perfect
  dodge emits a concussive shriek; drains Lucidity).
- **Death → next citizen:** generated name, look and one-line blissful surface life;
  short vignette of their tether snapping; Stigmas and Weight of Sin carry over.

## Narrative & content
- Full flavor: intro, hub dialogue, confessions, boss lines, item lore, in the
  archaic, zealous, violently poetic register of the Bible.
- **Gore: yes. Self-harm: softened.** The low-Lucidity whispers are dread and
  accusation, never explicit instructions to hurt oneself.
- No sci-fi, no magic: horror grounded in flesh and dogma.

## Audio
- Free sound packs, **CC0 / public domain only** (safe for a future paid release).
  Every source is recorded in `CREDITS.md` anyway.

## Persistence
- Auto-save meta progress (Stigmas, upgrades, Tears, citizen lineage) on device.
  Quitting mid-run forfeits that run.
