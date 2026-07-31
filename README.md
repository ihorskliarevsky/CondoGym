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

## Editing the plan

Everything lives in [`src/data/workouts.ts`](src/data/workouts.ts). There is no
exercise database and no search — it's one person's fixed rotation. Types are in
[`src/types.ts`](src/types.ts).

To add a demo visual, set `media` on an exercise:

```ts
media: { kind: 'gif', src: '/demos/goblet-squat.gif' }  // file in public/demos/
media: { kind: 'youtube', id: 'MeIiIdhvXT4' }
```

Exercises without `media` show the play-button placeholder. GIFs loop in the
tile; a YouTube clip only loads its iframe once the tile is expanded, so
swiping through a workout doesn't pull an embed per exercise.

Exercises can also carry `cueUk`, a Ukrainian annotation shown under the English
form cue.

## Storage

Two `localStorage` keys, both handled in [`src/lib/storage.ts`](src/lib/storage.ts):

- `condogym.sessions.v1` — the saved history.
- `condogym.draft.v1` — the in-progress workout, so a refresh mid-session
  doesn't lose reps. Cleared when a session is saved or discarded.
