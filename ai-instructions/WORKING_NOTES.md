# WORKING NOTES

## Architecture decisions

- **Engine vs React split.** The engine (`src/game/engine.ts`) is plain,
  imperative TS running one loop. It owns all fast per-frame state (needle,
  warmth, noise) and draws straight to canvas. Only low-rate `PanelSnapshot`s go
  into the Zustand store for React chrome (titles, letters, banners). This keeps
  60fps drawing out of React entirely. **Don't** move needle/warmth into React.

- **Unified input map.** Sim and serial both call `store.upsertDevice(...)`. The
  engine only ever reads the `devices` map, so it can't tell them apart. This is
  the reason the whole game is testable without hardware. Preserve this.

- **Hidden-tab loop fallback.** Browsers pause `requestAnimationFrame` when the
  tab is hidden (this bit us in the offscreen preview and would bite a minimised
  kiosk). The engine also runs a `setInterval` that steps the frame only when
  `document.hidden`. rAF drives when visible; the timer covers hidden.

- **Design tokens once.** `src/game/tokens.ts` holds every colour and size, used
  by both the canvas renderer (imported) and DOM (inline styles). Re-theme there.

- **Container-query sizing.** Fields set `container-type: size` and size text in
  `cqmin`, so everything scales with the field — clean at 1–10 fields and at
  1080p/4K without media queries.

- **Faceplate cache.** The static dial (bezel, glass, scale) is rendered once per
  size into an offscreen canvas and blitted each frame; only dynamic layers
  redraw. Rebuild key = `${cssW}x${cssH}x${dpr}`.

## Gotchas / lessons learned

- **rAF paused when hidden** → engine looked dead in the preview. Fixed with the
  timer fallback (above). Real TVs and Playwright's headless-but-visible pages
  run rAF fine.
- **SSR hydration:** `navigator.serial` isn't available server-side. `serial.
  supported` starts `false` and is set by `SerialManager.init()` on the client
  to avoid a hydration mismatch.
- **Don't call `performance.now()` during render** (React purity lint). The
  engine stamps `debug.clockMs` into the store; the debug table reads that.
- **Complete state must read as a *clear* signal** (noise ≈ 0, meter full),
  otherwise a finished field looks broken under heavy static.
- **Lock flash / halo sizes** are relative to `band.h`; keep them small
  (`~0.5×band.h` flash, tight halo) or they fill the whole glass. A big radial
  clear-window around the needle also created an ugly "porthole ring" — removed
  in favour of global noise reduction + a soft vertical clear column.
- **micro:bit radio strings max 19 bytes.** `<id>|<pos>|<flags>|<checksum>` fits.
  If the serial format ever grows, shorten it — this is why `id` is the hardware
  serial reduced to `abs % 1_000_000`.
- **Only one program may touch the base station's serial port.** Leaving the
  MakeCode editor connected while the app reads the same port splits the byte
  stream and shreds both — this produced dozens of phantom players and looked
  exactly like hardware failure. Flash → close MakeCode → then connect the app.
  (The earlier theory that a V1 drops bytes at 115200 was wrong; a lone V1 is
  fine. Don't drop the baud — at 9600 the link can't carry 8–10 handhelds.)
- **Both `checksum()` implementations must stay byte-identical** —
  `firmware/receiver.js` and `src/serial/protocol.ts`. Change one, change both,
  and re-flash every handheld.
- **Short radio dropouts must not cost a child their progress** (2026-10-08).
  `tokens.timing`: `offlineMs` 2 s only pauses the field ("Mister signal …", no
  locking while paused); `releaseMs` 30 s frees it; `forgetMs` 120 s drops the
  device; `joinPackets` 3 before a new id gets a field (a corrupted line passes
  the 0–9999 checksum ~1 in 10 000 and used to spawn a phantom player).
- **Web Serial close order** (2026-10-08). `port.close()` fails while the
  decoder pipe still locks `port.readable`; that error was swallowed and left
  the port open, so Afbryd → Forbind failed with "already open". `readLoop` now
  owns the port: `pipeTo` promise kept, reader cancelled, pipe awaited, then
  close. `disconnect()` just stops the loop and awaits it.
- **Electron origin must be stable** (2026-10-08). The loopback server used a
  random port, so every launch had a new origin and empty localStorage (field
  count, theme, level edits lost). It now uses 7446 (claimed in Launchpad), with
  a random-port fallback if taken.
- **Station layout** (2026-10-08). Neighbouring capture windows are kept ≥
  1.15 × widest window apart; if the needle's dead-zone squeezes the spread too
  much, the spread widens (green then often uses the whole dial). Letters are
  shuffled across positions so the dial no longer reads left-to-right.
- **A moving signal must out-run a still needle.** Dwell time (window width ÷
  speed) is deliberately shorter than `lockMs` on yellow (0.53 s vs 0.65 s) and
  red (0.37 s vs 0.62 s), so you can only capture it by following it. Re-check
  this ratio whenever you retune speed or width.

## UI self-review checklist (spec §7.1)

Run `npm run shots`, then check each PNG:

- [x] Needle and scale clear; position unambiguous.
- [x] Noise vs clear signal is an obvious difference (`b-noise` vs `d-lock`/`f-complete`).
- [x] Text/tiles big enough to read at distance; no overflow/overlap.
- [x] Fields equal-sized, uniform, evenly distributed (4/6/8/10).
- [x] Reveal and complete are clearly celebratory (confetti + FÆRDIG card).
- [x] Works in both 1080p and 4K without breaking.

## Open questions for Mikkel (from spec §11) — answered

- Message: **both** word + picture (switchable per difficulty). ✔ built
- Field count default: **6**, adjustable 1–10. ✔
- Field identity: number by default, **configurable themes** (animals/space/
  pioneers). ✔
- Sound: included as a **pure plus**, starts muted, never required. ✔
- Tilt vs buttons: tilt is plan A; A/B also nudge (firmware). Re-tune `SPEED`/
  `DEAD_ZONE` in `firmware/receiver.js` on the day if tilt feels hard.

## Hardware status

**Verified.** The full micro:bit → base-station → app chain runs clean: one
handheld at ~9 packets/s with errors only at connect (2026-07-23), and two
handhelds simultaneously driving two separate fields with no id collisions
(2026-07-28).

**Still unverified:** radio range across a room the size of the venue, tilt feel
with actual children, and packet load with 8–10 handhelds at once. Tune `SPEED`,
`DEAD_ZONE` and `TICK_MS` at the top of `firmware/receiver.js` when you find out
(with 8–10 units at `TICK_MS = 100` that's ~100 packets/s and some will collide;
raise to 130–150 if needles feel laggy).

**Before the day:** re-flash all ~10 handhelds and the base station one final
time, so every unit is on the same build as the .exe you bring.
