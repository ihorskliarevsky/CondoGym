# Condo Gym

A personal, single-user mobile web app for logging home/condo gym workouts — a
digital workout card. No accounts, no cloud; everything is stored on-device in
`localStorage`.

## Running it

```bash
npm install
npm run dev
```

`npm run build` produces a static `dist/` that can be dropped on any host. The
app is a PWA — open it on a phone and "Add to Home Screen" for a standalone,
full-screen install.

## Screens

- **Home** (`src/screens/HomeScreen.tsx`) — the workout list, split into the
  main rotation and the temporary low-back-friendly section.
- **Workout** (`src/screens/WorkoutScreen.tsx`) — a swipeable, one-exercise-at-
  a-time deck. Swipe or use ←/→. Three logger types by exercise `type`:
  - `strength` — weight + reps per set with a done checkbox. Reps pre-fill with
    the exercise's target, and editing one set's reps carries that number
    forward into the later sets that haven't been logged yet.
  - `hold` — a countdown for timed holds.
  - `cardio` — a single "mark as done" button.
- **History** (`src/screens/HistoryScreen.tsx`) — past sessions, expandable to
  the weights and reps used.
- **Manage** (`src/screens/ManageScreen.tsx`) — add, edit, reorder, and delete
  workouts. Reached from the home screen footer.

## Managing workouts from the phone

Workouts live on-device. **Manage → Paste a new workout** takes plain text and
parses it into a workout, with a live preview of what it understood before you
save. Editing an existing workout opens the same screen with its text filled in,
so the format round-trips.

```
Workout E — Legs + Grip

Bulgarian Split Squat
3 x 8 / side @ 15lb, rest 75s
Front knee tracks over the foot, back foot elevated on the bench.

Farmer Carry
40s cardio
Walk tall, shoulders back, don't lean.

Hollow Hold
30s hold
Low back flat against the floor.
ua: Поперек притиснутий до підлоги.
```

Blank lines separate blocks. The first block names the workout (`Name — focus
tag`); every block after it is one exercise: name, then a spec line, then the
form cue. The spec line is matched loosely:

| Line | Becomes |
| --- | --- |
| `4 x 8-10 @ 20lb, rest 90s` | strength: 4 sets, 8–10 reps, 20 lb, 90s rest |
| `3 x 10 / side` | strength with per-side reps |
| `4x12 bodyweight` | strength with no load |
| `60s hold` | a timed hold with a countdown |
| `40s cardio` / `cardio` | a single "mark as done" |

Anything unrecognised becomes part of the cue rather than failing, and the
screen warns about what it couldn't read. Optional extra lines: `ua: …` for a
Ukrainian note, `youtube: <id or link>` or `gif: /demos/x.gif` for the demo
visual, `letter: E` to override the badge, and a bare `low-back` line to file it
under the low-back section.

The parser and its inverse live in
[`src/lib/parseWorkout.ts`](src/lib/parseWorkout.ts).

## Demo visuals

Exercises without `media` show the play-button placeholder. GIFs loop in the
tile; a YouTube clip only loads its iframe once the tile is expanded, so
swiping through a workout doesn't pull an embed per exercise. GIFs go in
`public/demos/` and are referenced as `/demos/name.gif`.

## Backup

**Manage → Export to file** downloads `condo-gym-YYYY-MM-DD.json` holding every
workout and every logged session. On iOS this opens the share sheet, so it can
go straight to Files or iCloud.

**Import from file** reads one back and asks how to apply it:

- **Merge** adds only what isn't already there, matched by id — safe to run
  against a phone that has its own sessions on it.
- **Replace** swaps both lists for the file's contents.

Malformed entries are dropped rather than failing the whole import, and the
screen names the problem when a file isn't a usable backup at all. See
[`src/lib/backup.ts`](src/lib/backup.ts).

## Storage

Three `localStorage` keys:

- `condogym.library.v1` — your workouts ([`src/lib/library.ts`](src/lib/library.ts)).
  Seeded once from [`src/data/workouts.ts`](src/data/workouts.ts); after that the
  stored copy wins, so deletions stick. "Restore built-in workouts" in Manage
  re-adds any of the original five that are missing.
- `condogym.sessions.v1` — the saved history.
- `condogym.draft.v1` — the in-progress workout, so a refresh mid-session
  doesn't lose reps. Cleared when a session is saved or discarded.

The last two are handled in [`src/lib/storage.ts`](src/lib/storage.ts). Types for
everything are in [`src/types.ts`](src/types.ts).
