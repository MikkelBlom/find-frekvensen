# SESSIONS

Chronological log. Newest at the bottom.

---

## 2026-07-21 — Claude Code (Opus 4.8) — Initial build

**Summary:** Built the whole app from the build-spec in one session.

- Scaffolded Next.js 16 + TS + Tailwind v4; removed `next/font/google` for
  offline safety; disabled the dev indicator.
- Game core: types, design tokens, field themes (numbers/animals/space/
  pioneers), difficulty presets (green/yellow/red), game factory (stations,
  decoys, hop), Zustand store.
- Engine: single rAF loop with hidden-tab timer fallback — device→field
  assignment, warmth/lock/reveal/complete/hop logic, canvas drawing, low-rate
  snapshots to the store.
- Renderer: retro dial (cached faceplate), needle, warmth halo, snow tiles that
  clear with signal, signal meter, lock ring, confetti.
- Inputs: simulator (sweep/solve/manual/idle) and Web Serial reader (tolerant
  parser, graceful reconnect) — both feed one device map.
- Optional WebAudio (lock pling / complete jingle), starts muted.
- UI: TopBar, FieldGrid, RadioField (canvas + DOM tray + celebration),
  MessageTray, PictureReveal, full DebugPanel; keyboard controls; `window.
  __frekvens` test API.
- Word mode **and** picture mode; fields 1–10; live difficulty/theme switching.
- Firmware: MakeCode receiver + base-station + `firmware/README.md`.
- `npm run shots` (Playwright) drives 11 states at 1080p and a subset at 4K.

**Issues encountered:**
- rAF is paused in the offscreen preview (tab hidden) → engine looked dead.
  Added a `setInterval` fallback that steps only when `document.hidden`.
- First-pass visuals: complete state showed heavy static (looked broken); lock
  flash + warmth halo + a circular clear-window were far too large. Fixed:
  clear/full-meter on complete, small flash, tight halo, removed the porthole
  clear-window in favour of global noise reduction + a soft vertical clear column.
- Lint: no `performance.now()` in render → engine stamps `debug.clockMs`.

**State:** `npm run build`, `npx tsc --noEmit`, and `npx eslint .` all clean.
UI reviewed via screenshots against the §7.1 checklist — passes. Runs fully in
the simulator with no hardware.

**Next steps:**
- Verify the real micro:bit → base-station → app chain and tune `SPEED`/
  `DEAD_ZONE` in `firmware/receiver.js` (see WORKING_NOTES "Not yet verified").
- Optional: visual-regression baseline compare in `shots`; a slim operator
  toolbar; persist config to localStorage.
- Separate Appendix task (not this app): Grace "Bug-jagten" Scratch `.sb3`
  projects.
