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
| Left thumb, anywhere | A/D or arrows (Shift = creep), W/Up aims up, S/Down + jump drops | Run. Push lightly to creep. |
| Wings button | Space | Jump (hold for higher). |
| Chain button | J / Z | Tap: 3-hit combo. Hold and release: heavy swing. Up + chain: overhead. In the air: downward strike. |
| Wind button | K / X | Dodge (slide; one air dash). Dodge at the last instant for a Perfect Dodge. |
| Dagger button (appears) | L / C | Execute a staggered foe (marked ✞). |
| Tear button | H | Spend 6 Tears to heal (costs Lucidity). |
| Maw button (if sewn) | I / V | Devour a corpse. |
| Lips button (appears) | E / Enter | Speak / interact. |
| Pause | Esc | Settings, abandon descent. |

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks and writes the game to play/ (commit it)
```

Debug URLs: `?run` (jump into a descent), `?boss` (Bartholomew),
`?hub`, `?gallery` (every generated texture; `?gallery&tex=player&zoom=3`).
Art lab for sprite work: `/art.html`.

## Deploy

The page source is `web/index.html`; `npm run build` writes the playable game
to `play/`, which is committed. The root `index.html` forwards to `play/`.
GitHub Pages therefore serves a working game whether it is set to *Deploy from
a branch* (master, root) or to *GitHub Actions* (`.github/workflows/deploy.yml`,
which also warns if `play/` is stale). Always run `npm run build` before
committing.
