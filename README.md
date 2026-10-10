# The Scarlet Tether

A 16-bit HD pixel-art body-horror roguelike for iPhone (played in the browser).
To keep Sanctum sinless, every citizen's soul is tethered to a mutant in the
Under-Naves below. Your tether has snapped.

- Design source: the original Design Bible, plus `docs/DESIGN_DECISIONS.md`
  (which wins where they differ).
- Built with Phaser 3 + TypeScript + Vite. All art is generated in code
  (`src/art/`); all audio is CC0 (see `CREDITS.md`).

## Play

Open the GitHub Pages link on an iPhone, turn it sideways, and for fullscreen
use **Share → Add to Home Screen**.

| Touch | Keyboard (desktop) | Action |
|---|---|---|
| Left thumb, anywhere | WASD / arrows (Shift = sneak) | Move. Push lightly to sneak. |
| Chain button | J / Z | Tap: 3-hit combo. Hold and release: heavy swing. |
| Wind button | K / X / Space | Dodge. Dodge at the last instant for a Perfect Dodge. |
| Dagger button (appears) | L / C | Execute a staggered foe (marked ✞). |
| Tear button | H | Spend 6 Tears to heal (costs Lucidity). |
| Maw button (if sewn) | I / V | Devour a corpse. |
| Lips button (appears) | E / Enter | Speak / interact. |
| Pause | Esc | Settings, abandon descent. |

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs dist/
```

Debug URLs: `?run` (jump into a descent), `?boss` (Bartholomew),
`?hub`, `?gallery` (every generated texture; `?gallery&tex=player&zoom=3`).

## Deploy

Pushing to `master` runs `.github/workflows/deploy.yml`, which builds and
publishes to GitHub Pages. One-time setup: repo **Settings → Pages →
Build and deployment → Source: GitHub Actions**.
