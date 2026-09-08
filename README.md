# Gym

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
    the exercise's target; weight starts empty with a placeholder, so nothing is
    logged that wasn't lifted. Editing either field carries the number forward
    into the later sets that haven't been logged yet, and checking a set off
    with the weight still blank logs the placeholder.

    The placeholder is **the weight you last completed a set at**, falling back
    to the plan's figure only until you've lifted the movement once. Completing
    a set writes that weight to `condogym.weights.v1`
    ([`src/lib/weights.ts`](src/lib/weights.ts)), keyed by exercise id, so a
    correction sticks for next time instead of needing to be re-entered.
  - `hold` — a countdown for timed holds.
  - `cardio` — a single "mark as done" button.
- **History** (`src/screens/HistoryScreen.tsx`) — past sessions, expandable to
  the weights and reps used.
- **Manage** (`src/screens/ManageScreen.tsx`) — add, edit, reorder, and delete
  workouts. Reached from the home screen footer.

Editing `src/data/workouts.ts` only seeds a *fresh* install — a phone that
already has a library keeps showing the old one. **Manage → Load the built-in
plan** replaces the stored library with the bundled plan (history is kept), and
is how a new plan actually reaches a device.

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

In JSON, a link is found wherever it sits — any key name, and at any nesting
depth (`video: {url}`, `links: [ … ]`, buried in a description). When something
video-shaped can't yield an id (a channel or playlist link), the import warns and
names the exercise instead of silently showing no demo. The preview tags every
exercise that got one with a **▶ demo** badge, so it's visible before saving.

In text, a YouTube link is picked up wherever it appears — on its own line, labelled
`youtube:`/`video:`, appended to the exercise line, or mid-sentence in a cue —
in `watch?v=`, `youtu.be`, `shorts`, `embed`, mobile, and timestamped forms. A
`.gif` URL or path works the same way. Other optional lines: `ua: …` for a
Ukrainian note, `letter: E` to override the badge, and a bare `low-back` line to
file it under the low-back section.

**JSON is accepted too** — an object with `name` and `exercises`, a bare array
of exercises, an array of whole workouts, or anything wrapping one
(`{workouts: […]}`, `{program: […]}`, a backup file). Field names are matched
loosely (`exercise`/`title`/`name`, `reps`/`repRange`/`repetitions`,
`weight`/`load`/`lb`, `notes`/`instructions`/`cue`), reps may be `8`, `"8-10"`,
`[8,10]`, or `{min,max}`, and the exercise type is inferred when absent.

**Circuits** — when a workout is one set of each exercise, then the whole group
again, mark the group with a rounds header:

```
Circuit x 3
- Goblet Squat — 10 @ 20lb
- Push-Ups — 12 bodyweight
- Bent Row — 10 @ 25lb
```

`Circuit x 3`, `Superset x 3`, and `3 rounds` all work, and members can be
bulleted or plain (one per line; indent a cue under one). The header carries the
round count, so a member line only needs its reps. The group ends at the next
blank-line-separated unbulleted block. The workout screen then walks the deck in
performance order — Squat R1 → Push-Ups R1 → Row R1 → Squat R2 … — with a
"Round 2 of 3" banner, one logging row per card, and no rest shown between
stations.

**Several workouts in one paste** works either way: a JSON array of them, or
plain text where each starts with a `Workout …` / `Day …` line. One malformed
entry is reported as a warning and the rest still import.

The parser and its inverse live in
[`src/lib/parseWorkout.ts`](src/lib/parseWorkout.ts).

## Demo visuals

A YouTube demo shows its poster frame in the collapsed tile and starts playing
on that one tap — the iframe is only created then, so swiping through a workout
never pulls an embed per exercise. GIFs loop in the tile and expand on tap;
local ones go in `public/demos/` and are referenced **without a leading slash**
(`demos/press/01-bench.gif`) so they resolve against the site's base — an
absolute path would 404 on the Pages subpath.

Exercises with no `media` say so plainly and offer a YouTube search for the
movement, rather than showing a play button that can't play anything.

The play triangle is an inline SVG on purpose: the `▶` character falls back to
a different font on iOS and renders distorted.

## Checks

```bash
npm run check:parser
```

Runs [`scripts/parser-check.ts`](scripts/parser-check.ts) — a table of the
shapes people actually paste (markdown lists, tables, bare URLs, nested JSON,
circuits, multi-workout pastes) plus a round-trip of every bundled workout
through `workoutToText`. The parser is deliberately permissive, so this table is
the only thing keeping it honest.

## Backup

**Manage → Export to file** downloads `gym-YYYY-MM-DD.json` holding every
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
