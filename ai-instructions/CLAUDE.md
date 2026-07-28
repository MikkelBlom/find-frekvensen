# CLAUDE.md — Find Frekvensen (project guide)

## What is this?

An interactive station for **Ada Lovelace Day** (Coding Pirates Odense, 12 Oct
2026). Children hold a micro:bit and tilt it to move a needle across a retro
radio dial shown on a big TV. They hunt hidden "stations" by signal strength,
hold to lock, and collect a secret message. Hardest level: the signal **hops**
between frequencies (Hedy Lamarr's frequency hopping). 4–8 (up to 10) kids tune
simultaneously, each with their own micro:bit and their own field on screen.

Three parts, one-way data flow:

```
Receiver micro:bit ×N --radio--> Base-station micro:bit --USB/serial--> Next.js web app on TV
```

## Critical invariants (do not violate)

1. **Firmware stays dumb.** The micro:bit only reports its own needle position
   (`<serial>|<pos>|<flags>`). ALL game logic (stations, warmth, lock, hop,
   message) lives in the web app. This is what lets us change puzzles without
   re-flashing and develop/test with zero hardware.
2. **The whole game must run in the simulator, no hardware.** Sim and serial
   both write into the same `devices` map the engine reads — they are
   interchangeable. Never add game logic that only works with real serial.
3. **Offline on the day.** No internet at the venue. No runtime network calls,
   no `next/font/google`, no CDNs. Everything is self-contained (inline SVG,
   WebAudio synth, system fonts). `npm run build && npm run start` must work
   offline.
4. **Sound is a pure plus.** The game must be fully playable and legible with
   sound off. Never gate progress, feedback, or clarity on audio.
5. **The debug panel must hide completely** (press `d`) so children never see
   operator controls.
6. **Chrome/Edge only** (Web Serial). Design for a bright library room and a TV
   viewed from 1.5–2 m: big fonts, strong contrast, uniform fields.

## Where things live

- `src/game/` — types, tokens (single source of design values), themes, presets,
  game factory, Zustand store, and the engine (the rAF loop + assignment + logic).
- `src/render/` — Canvas drawing (dial/needle/noise/confetti).
- `src/sim/`, `src/serial/`, `src/audio/` — input sources and optional sound.
- `src/components/`, `src/app/` — React UI.
- `firmware/` — MakeCode receiver + base-station.
- `scripts/shots.mjs` — Playwright screenshot self-test.

Design tokens are the single source of truth in `src/game/tokens.ts` (used by
both canvas and DOM). Adjust colours/sizes there.

## Working style

Keep the engine (imperative, 60fps, canvas) separate from React chrome (low-rate
snapshots). Don't push per-frame values through React. Verify visual changes with
`npm run shots` and actually look at the PNGs against the checklist in
`WORKING_NOTES.md`. Commit at milestones; never commit secrets or `node_modules`.

See `INDEX.md` for the rest of the notes files.

<!-- launchpad:begin -->
## Launchpad

This project is tracked in **Launchpad**, a local service on http://localhost:7420 that owns
Mikkel's notes, ideas, and tasks for every project. **It is Launchpad project #13 ("Ada Lovelace Day Program").**
Launchpad's database is the source of truth — not the markdown in this repo.

```bash
launchpad pull --json      # read this project's tasks/ideas/notes (nothing written to disk)
launchpad guide            # the full command set, with the push-plan schema
```

Every `launchpad` command run inside this folder targets project #13 automatically.
Write back with `launchpad task add "…"`, `launchpad idea add "…"`, `launchpad note add "…"`,
`launchpad set description "…"`, `launchpad tag add <name>`, or a batch `launchpad push plan.json`.

**Dev server port.** This project claims **7430** — `npm run dev` and `npm run serve`
both listen there, and `npm run shots` defaults to `http://localhost:7430`. Don't move
it without re-claiming (`launchpad set port <n>`); 3000, 3001 and 5000 are already taken
on this machine.

`ai-instructions/LAUNCHPAD.md` is a **read-only mirror** — editing it changes nothing.
Agents archive rather than delete; nothing you do here is unrecoverable.
<!-- launchpad:end -->
