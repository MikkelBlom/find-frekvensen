# Find Frekvensen 📡

An interactive drop-in station for **Ada Lovelace Day** (Coding Pirates Odense).
Children use a micro:bit as a "radio receiver": they tilt it to sweep a needle
across a radio dial on a big TV, hunt hidden signals by their signal strength,
lock onto them, and collect a secret message. The hardest level makes the signal
**hop between frequencies** — Hedy Lamarr's frequency-hopping idea.

4–8 (up to 10) children tune at once, each with their own micro:bit and their own
field on the screen.

![Six fields tuning](screenshots/e-reveal-progress.png)

## How it works

```
[Receiver micro:bit ×N]  --radio-->  [Base-station micro:bit] --USB/serial--> [Next.js app on TV]
   (a child holds it)                   (plugged into the PC)                   (split into N fields)
```

One-way data flow, kept deliberately simple for reliability. **All game content
(station positions, the secret message, hop behaviour) lives in the web app** —
the firmware is "dumb" and only reports its own needle position. So difficulty
and puzzles can be changed live with no re-flashing, and the whole game runs and
is tested **without any hardware** via the built-in simulator.

## Run it

Requirements: Node 20.9+ and **Chrome or Edge** (Web Serial API).

```bash
npm install
npm run dev      # http://localhost:3000
```

For the day, a production build runs fully offline on localhost:

```bash
npm run build
npm run start    # http://localhost:3000
```

Open in Chrome/Edge, press **F11** for fullscreen on the TV, and click
**Forbind base-station** to connect the micro:bit.

### Try it with no hardware

Add `?sim=1` to spin up virtual devices, e.g.:

- `http://localhost:3000/?sim=1&fields=6&mode=solve` — 6 fields that solve themselves
- `http://localhost:3000/?sim=1&fields=8&mode=sweep&preset=red` — 8 fields, red difficulty
- URL params: `sim`, `fields` (1–10), `devices`, `mode` (`sweep`/`solve`/`manual`/`idle`), `preset` (`green`/`yellow`/`red`), `theme`, `debug`

## Controls

| Key | Action |
|-----|--------|
| `d` | Toggle the debug / operator panel |
| `1`–`0` | Select the active field |
| `← →` | Move the active field's needle (with the simulator) |
| `r` | Reset all fields |

The **debug panel** (press `d`) is the operator cockpit: pick difficulty live,
set the number of fields (1–10), choose a theme, edit the secret message, switch
between word and picture mode, drive the simulator, connect/reconnect serial, and
watch the raw serial monitor, device table, and FPS. It hides completely so the
children never see it.

## Difficulty

- **Grøn** — 3 wide, clustered stations, no decoys. Spells `ADA`.
- **Gul** — 4 narrower, spread-out stations + 2 decoy "fake signals". Spells `HEDY`.
- **Rød** — 4 narrow stations, and the **last remaining signal hops** between
  frequencies. Spells `HEDY`.

Both **word mode** (a letter per station) and **picture mode** (a puzzle tile per
station) are supported and switchable per difficulty.

## Firmware

See [`firmware/README.md`](firmware/README.md) for flashing the receiver and
base-station micro:bits (MakeCode) and tuning the tilt feel.

## Screenshots & self-test

```bash
npm run dev          # in one terminal
npm run shots        # in another — writes /screenshots at 1080p and 4K
```

`npm run shots` drives the app (in simulator mode) through every key UI state —
waiting, static, warming up, locking, progress, complete, 4/6/8 layouts, picture
mode, red/hop, and the debug panel — and saves PNGs for review.

## Project notes

Working notes for AI assistants and future sessions live in
[`ai-instructions/`](ai-instructions/) (architecture, features, decisions,
session log).

## Tech

Next.js 16 (App Router) · TypeScript · React 19 · Tailwind v4 · Zustand ·
Canvas rendering · Web Serial API · Playwright. No backend, no internet needed
on the day.
