# Relic Rush

A Three.js 3D web game built for start.ng. Explore an island, collect all the relics, and beat the clock before the shades catch you.

## How to play

Open `index.html` in a modern browser:

```bash
open index.html
```

Or just double-click `index.html` in your file manager.

### Controls

| Action | Key / Input |
|--------|-------------|
| Move forward / backward | `W` `S` `↑` `↓` |
| Strafe left / right | `A` `D` `←` `→` |
| Sprint | Hold `Shift` |
| Look around | Click + drag on the canvas |
| Zoom | Mouse wheel |
| Start a round | Click **Play** |
| Sign in | Click **Sign in with start.ng** |

### Objective

Collect all 10 relics scattered across the island within 75 seconds. Avoid the floating shades — touching them drains your remaining time. Don't run off the edge into the water.

## Project structure

```
relic-rush/
├── index.html          # Entry point: loads Three.js from CDN and the game module
├── favicon.svg         # Site icon
├── cover.jpg           # Cover image
├── startng.json        # Leaderboard stat config for start.ng
└── src/
    ├── game.js         # Main game loop, world, relics, shades, UI, and round logic
    ├── character.js    # start.ng 3D character model and animation
    ├── platform.js     # start.ng sign-in, leaderboard, and score-save bridge
    └── styles.css      # UI styles (HUD, overlay, leaderboard board)
```

## Requirements

No install, no build step, no dependencies. The game loads Three.js (`three@0.185.1`) from a CDN via an importmap in `index.html`. You only need:

- A modern browser with WebGL support
- An internet connection (to load Three.js from the CDN)

## start.ng integration

When served on a `*.start.ng` domain (or `start.localhost:5173` locally), the game connects to start.ng for:

- **Sign in** — your start.ng character look, name, and face come with you
- **Leaderboard** — top scores for relics collected and time left
- **Score saving** — your best runs are saved to your start.ng account

Outside of start.ng, the game runs in guest mode and scores are not saved.

## Developing

The project is plain HTML/CSS/JS modules. Edit files in `src/` and reload `index.html` to see changes. No bundler or dev server is required, though any static file server works:

```bash
# Python 3
python3 -m http.server 8000

# Node (if you have http-server or similar)
npx serve .
```

Then visit `http://localhost:8000`.
