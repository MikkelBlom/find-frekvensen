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
- **micro:bit radio strings max 19 bytes.** `<serial>|<pos>|<flags>` fits (≤18).
  If the serial format ever grows, shorten it.

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

## Not yet verified on real hardware

The full micro:bit → base-station → app chain hasn't been run with physical
devices (none available in this session). Firmware is written to spec; verify
radio range, tilt feel, and 8-device packet load on the day and tune constants.
