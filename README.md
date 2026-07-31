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

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Enable it once
under **Settings → Pages → Source: GitHub Actions**.

The build uses `base: './'` and every asset path in `index.html` and the
manifest is relative, so the site works from a project subpath
(`username.github.io/CondoGym/`) as well as a domain root. Keep it that way —
an absolute `/icon.svg` would 404 on Pages.

On iOS, Share → **Add to Home Screen** installs it as a standalone app:
`display: standalone` plus `apple-mobile-web-app-capable` means no Safari
chrome, and `apple-touch-icon` supplies the icon.

## Screens

- **Home** (`src/screens/HomeScreen.tsx`) — the workout list, split into the
  main rotation and the temporary low-back-friendly section.
- **Workout** (`src/screens/WorkoutScreen.tsx`) — a swipeable, one-exercise-at-
  a-time deck. Swipe or use ←/→. Three logger types by exercise `type`:
  - `strength` — weight + reps per set with a done checkbox. Reps pre-fill with
    the exercise's target; weight starts empty with the planned figure showing
    as a placeholder, so nothing is logged that wasn't lifted. Editing either
    field carries the number forward into the later sets that haven't been
    logged yet, and checking a set off with the weight still blank logs the
    planned figure.
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

**Nothing is rejected for formatting.** The first line names the workout
(`Name — focus tag`); everything after it is exercises. Blank lines, bullets,
numbers, markdown headings, indented sub-bullets, and table rows are all used as
exercise boundaries when present — and when none are present, a short title-like
line following a spec starts the next exercise. Anything left over becomes the
form cue, and the screen warns about what it couldn't read rather than failing.

Volume specs are matched loosely, anywhere on the line:

| Written | Becomes |
| --- | --- |
| `4 x 8-10 @ 20lb, rest 90s` | strength: 4 sets, 8–10 reps, 20 lb, 90s rest |
| `3 sets of 10` / `10 reps x 3 sets` | strength, either word order |
| `3 x 10 / side` | strength with per-side reps |
| `4x12 bodyweight` | strength with no load |
| `4 sets AMRAP` / `3 sets to failure` | strength, open-ended reps |
| `60s hold` / `60 second hold` | a timed hold with a countdown |
| `40s cardio` / `cardio` | a single "mark as done" |

Optional extra lines: `ua: …` for a Ukrainian note, `youtube: <id or link>` or
`gif: /demos/x.gif` for the demo visual, `letter: E` to override the badge, and
a bare `low-back` line to file it under the low-back section.

**JSON is accepted too** — an object with `name` and `exercises`, a bare array
of exercises, an array of whole workouts, or anything wrapping one
(`{workouts: […]}`, `{program: […]}`, a backup file). Field names are matched
loosely (`exercise`/`title`/`name`, `reps`/`repRange`/`repetitions`,
`weight`/`load`/`lb`, `notes`/`instructions`/`cue`), reps may be `8`, `"8-10"`,
`[8,10]`, or `{min,max}`, and the exercise type is inferred when absent.

**Several workouts in one paste** works either way: a JSON array of them, or
plain text where each starts with a `Workout …` / `Day …` line. One malformed
entry is reported as a warning and the rest still import.

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
