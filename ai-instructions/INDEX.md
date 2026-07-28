# INDEX — AI notes for Find Frekvensen

Read this first if you're new to the project. These files are **working notes**
for AI assistants, separate from the polished docs and the code itself.

| File | What it's for | Update when |
|------|---------------|-------------|
| `CLAUDE.md` | Project identity + hard invariants. | Fundamentals change (rarely). |
| `INDEX.md` | This map of the notes. | You add/remove a notes file. |
| `FEATURES.md` | What's implemented vs. planned. | Feature status changes. |
| `FUTURE_IDEAS.md` | Ideas parked for later. | You think of something mid-task. |
| `WORKING_NOTES.md` | Architecture, decisions, the UI checklist, gotchas. | A decision/concern arises. |
| `SESSIONS.md` | Chronological log of work sessions. | End of a session. |
| `docs/architecture.md` | The data flow + module map in one place. | Architecture changes. |

## Fast orientation

- **Run it:** `npm run dev`, open `http://localhost:7430/?sim=1&fields=6&mode=solve`.
- **See every state:** `npm run shots` → look at `/screenshots`.
- **Change the game:** press `d` for the debug panel, or edit
  `src/game/presets.ts` (difficulty) / `src/game/themes.ts` (field identities) /
  `src/game/tokens.ts` (all colours & sizes).
- **The engine** (`src/game/engine.ts`) is the heart: one loop that reads device
  inputs, assigns them to fields, runs the game logic, draws the canvases, and
  pushes low-rate snapshots to the store for React.
- **Hard rules** are in `CLAUDE.md` — read them before changing architecture.
