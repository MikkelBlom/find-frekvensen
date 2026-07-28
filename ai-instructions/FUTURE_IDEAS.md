# FUTURE IDEAS

Parked ideas, by category. Priority: (H)igh / (M)edium / (L)ow.

## Gameplay
- (M) Continuous warmth *tone* (per-field oscillator whose pitch rises with
  warmth) — a strong non-visual cue, but must stay optional (library noise).
- (M) A visible cue on the dial when the signal moves, so kids read a drifting
  station as the point of the level rather than as a bug. (The teleport "hop"
  this originally described was replaced by a sliding signal on 2026-07-23.)
- (L) Team/co-op mode: two fields must both lock the same frequency.
- ~~(L) Per-field difficulty~~ — **shipped 2026-07-23**: every field climbs its
  own green→yellow→red ladder.

## Field identity (Mikkel wanted configurable themes)
- (M) Let a child pick their icon via A/B on the micro:bit (needs the tray to
  show a chooser; firmware already sends button flags).
- (L) More themes (Danish scientists, instruments, weather).

## Message / reveal
- (M) More pictures for image mode; split a real portrait (e.g. Hedy) into tiles.
- (L) Mixed mode: some fields word, some picture, in one session.

## Robustness / ops
- (H) Visual regression baseline compare in `npm run shots` (spec §7.1.4).
- (M) On-screen "operator" mini-toolbar (difficulty + fields) separate from the
  full debug panel, for quick changes without exposing everything.
- ~~(M) Save/restore the last config to localStorage~~ — **shipped 2026-07-23**,
  versioned so a bump resets levels to new defaults.
- (L) Two-way radio: app → base-station → receiver "you locked!" smiley.

## Polish
- (L) Subtle CRT scanlines / bloom toggle for extra retro feel.
- (L) Idle attract-mode animation when no devices are connected for a while.
