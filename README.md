# Hollow Saint

A top-down pixel auto-shooter for iPhone (landscape). You play a Saint sent into
the Wound again and again, for a city that profits from your suffering.

- **Design:** [`docs/GDD.md`](docs/GDD.md) is the source of truth.
- **Progress:** [`docs/ROADMAP.md`](docs/ROADMAP.md) tracks the vertical slice.

## Layout

| Path | What |
|---|---|
| `index.html` | The whole game: one file, Canvas 2D, no build step |
| `assets/sprites/` | Generated PNG sheets + JSON frame maps (committed) |
| `tools/palette.mjs` | The master palette; every sprite pixel must be on it |
| `tools/sprites.mjs` | Draws every sprite in code and exports the sheets |

## Run it

```sh
node tools/sprites.mjs        # regenerate sprites after editing tools/
python3 -m http.server 8000   # then open http://localhost:8000
```

Debug URL flags: `?town` starts in Vael, `?run` jumps straight into a descent (no tutorial), `?fps` shows frame rate.

## Controls

| Touch | Keyboard | Action |
|---|---|---|
| Left thumb | WASD / arrows | Move |
| Dash button | Space / Shift | Dash (2 charges). Dash just before a hit lands for a Perfect Dodge |
| Flask button | Q / 1 | Holy Water Flask (Miracle, 6 s cooldown) |
| Chain button | F / 2 | Chain of Penitence (Miracle, 8 s cooldown) |
| Sun button | R / 3 | Flagellant's Rain (Penance; charges from Fervor) |
| Tap an enemy | click | Lock target (tap again to release) |
| Dagger button / tap staggered elite | E | Execute |
| Talk / Descend button (appears) | E | Talk to townsfolk, take the Vestry doors, use the Waystone |

The Relic Weapon and the Thurible (an orbiting censer) work on their own; the crossbow fires: elites first, then the nearest enemy.
