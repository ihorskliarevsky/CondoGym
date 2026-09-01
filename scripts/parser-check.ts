/**
 * Regression checks for the paste parser. Run with `npm run check:parser`.
 *
 * The parser accepts deliberately loose input, so the only way to keep it
 * honest is a broad table of the shapes people actually paste.
 */
import { parseWorkout, workoutToText } from '../src/lib/parseWorkout.ts'
import { WORKOUTS } from '../src/data/workouts.ts'
import type { Exercise, Workout } from '../src/types.ts'

let passed = 0
const failures: string[] = []

function check(label: string, ok: boolean, detail = '') {
  if (ok) passed++
  else failures.push(`${label}${detail ? ` — ${detail}` : ''}`)
}

function only(text: string): Workout | undefined {
  return parseWorkout(text).workouts[0]
}

function names(w: Workout | undefined): string {
  return (w?.exercises ?? []).map((e) => e.name).join(' | ')
}

/* ---------- text shapes ---------- */

const VID = 'dQw4w9WgXcQ'

check(
  'markdown list with indented cues',
  names(
    only(`## Workout F — Upper

1. **Incline Press** — 4 x 8-10 @ 25lb, rest 90s
   - Cue: elbows at 45 degrees
2. **Pull-Ups** — 3 sets to failure
   - Cue: dead hang`),
  ) === 'Incline Press | Pull-Ups',
)

check(
  'no blank lines, no markers',
  names(only(`Leg Day\nBack Squat\n5 x 5 @ 135lb\nBrace hard.\nLeg Curl\n3 x 12 @ 40lb`)) ===
    'Back Squat | Leg Curl',
)

check(
  'markdown table with rest column',
  (() => {
    const w = only(`Workout H — Pull

| Exercise | Sets/Reps | Rest |
| --- | --- | --- |
| Lat Pulldown | 4 x 10 @ 50lb | 75s |
| Seated Row | 3 x 12 @ 45lb | 60s |`)
    const first = w?.exercises[0]
    return names(w) === 'Lat Pulldown | Seated Row' && first?.rest === 75
  })(),
)

check(
  'prose with "3 sets of"',
  names(only(`Recovery\nCat cow, 60 seconds\nGlute bridge, 3 sets of 15 reps\nSqueeze at the top.`)) ===
    'Cat cow | Glute bridge',
)

/* ---------- media ---------- */

const mediaForms: [string, string][] = [
  ['bare watch url', `https://www.youtube.com/watch?v=${VID}`],
  ['short url', `https://youtu.be/${VID}`],
  ['tracking param', `https://youtu.be/${VID}?si=AbCdEf`],
  ['timestamp', `https://www.youtube.com/watch?v=${VID}&t=42s`],
  ['mobile', `https://m.youtube.com/watch?v=${VID}`],
  ['shorts', `https://www.youtube.com/shorts/${VID}`],
  ['labelled', `youtube: https://www.youtube.com/watch?v=${VID}`],
  ['bare id', `youtube: ${VID}`],
  ['mid-sentence', `Watch https://youtu.be/${VID} first.`],
]
for (const [label, tail] of mediaForms) {
  const w = only(`Workout Z\n\nBench Press\n4 x 8 @ 20lb\nControl it.\n${tail}`)
  const media = w?.exercises[0]?.media
  check(`media/text: ${label}`, media?.kind === 'youtube' && media.id === VID, JSON.stringify(media))
}

const jsonMedia: [string, Record<string, unknown>][] = [
  ['video:{url}', { video: { url: `https://youtu.be/${VID}` } }],
  ['links:[url]', { links: [`https://youtu.be/${VID}`] }],
  ['videos:[{url}]', { videos: [{ url: `https://youtu.be/${VID}` }] }],
  ['deeply nested', { extra: { refs: { demo: { yt: `https://youtu.be/${VID}` } } } }],
  ['youtube_url', { youtube_url: `https://youtu.be/${VID}` }],
  ['media as string', { media: `https://youtu.be/${VID}` }],
  ['url in notes', { notes: `Form: https://youtu.be/${VID}` }],
]
for (const [label, extra] of jsonMedia) {
  const w = only(
    JSON.stringify({ name: 'W', exercises: [{ name: 'Bench', sets: 3, reps: 8, ...extra }] }),
  )
  const media = w?.exercises[0]?.media
  check(`media/json: ${label}`, media?.kind === 'youtube' && media.id === VID, JSON.stringify(media))
}

check(
  'media: unusable link warns',
  parseWorkout(
    JSON.stringify({
      name: 'W',
      exercises: [{ name: 'Bench', sets: 3, reps: 8, video: 'https://www.youtube.com/@channel' }],
    }),
  ).warnings.length > 0,
)

/* ---------- multiple workouts ---------- */

check(
  'json array of workouts',
  parseWorkout(
    JSON.stringify([
      { name: 'A', exercises: [{ name: 'Bench', sets: 4, reps: 8 }] },
      { name: 'B', exercises: [{ name: 'Row', sets: 4, reps: 8 }] },
      { name: 'C', exercises: [{ name: 'Squat', sets: 3, reps: 10 }] },
    ]),
  ).workouts.length === 3,
)

check(
  'backup-shaped {workouts:[…]}',
  parseWorkout(
    JSON.stringify({
      format: 'condo-gym-backup',
      workouts: [
        { name: 'A', exercises: [{ name: 'X', sets: 1, reps: 1 }] },
        { name: 'B', exercises: [{ name: 'Y', sets: 1, reps: 1 }] },
      ],
    }),
  ).workouts.length === 2,
)

check(
  'text with three Workout lines',
  parseWorkout(
    `Workout A — Push\nBench\n4 x 8\n\nWorkout B — Pull\nRow\n4 x 8\n\nWorkout C — Legs\nSquat\n3 x 10`,
  ).workouts.length === 3,
)

check(
  'one bad workout does not sink the batch',
  parseWorkout(
    JSON.stringify([
      { name: 'Good', exercises: [{ name: 'Squat', sets: 3, reps: 10 }] },
      { name: 'Broken' },
      { name: 'Also Good', exercises: [{ name: 'Curl', sets: 3, reps: 12 }] },
    ]),
  ).workouts.length === 2,
)

/* ---------- circuits ---------- */

function circuitOf(w: Workout | undefined, i: number) {
  return w?.exercises[i]?.circuit
}

const bulletCircuit = only(`Workout A — Full Body

Circuit x 3, rest 60s
- Goblet Squat — 10 @ 20lb
- Push-Ups — 12 bodyweight
- Bent Row — 10 @ 25lb

Plank
60s hold
Ribs down.`)

check('circuit: members grouped', names(bulletCircuit).startsWith('Goblet Squat | Push-Ups | Bent Row'))
check('circuit: rounds read', circuitOf(bulletCircuit, 0)?.rounds === 3)
check('circuit: same group id', circuitOf(bulletCircuit, 0)?.id === circuitOf(bulletCircuit, 2)?.id)
check('circuit: rounds become sets', (bulletCircuit?.exercises[0] as Exercise & { sets: number })?.sets === 3)
check('circuit: following block is standalone', circuitOf(bulletCircuit, 3) === undefined)

check(
  'circuit without bullets',
  names(only(`Workout B\n\nCircuit x 4\nGoblet Squat 10 @ 20lb\nPush-Ups 12\nBurpees 8`)) ===
    'Goblet Squat | Push-Ups | Burpees',
)

check(
  'circuit: "3 rounds" wording',
  circuitOf(only(`Workout C\n\n3 rounds\n- Squat — 12\n- Row — 12`), 0)?.rounds === 3,
)

check(
  'circuit: superset wording',
  circuitOf(only(`Workout D\n\nSuperset x 3\n- Curl — 12 @ 15lb\n- Dip — 12`), 0)?.rounds === 3,
)

check(
  'circuit: hold member keeps its type',
  only(`Workout E\n\nCircuit x 3\n- Plank — 30s hold\n- Squat — 15`)?.exercises[0]?.type === 'hold',
)

const twoCircuits = only(`Workout F\n\nCircuit x 2\n- A — 10\n- B — 10\n\nCircuit x 3\n- C — 8\n- D — 8`)
check(
  'circuit: two groups get distinct ids',
  circuitOf(twoCircuits, 0)?.id !== circuitOf(twoCircuits, 2)?.id &&
    circuitOf(twoCircuits, 2)?.rounds === 3,
)

check(
  'circuit: unindented cue stays a cue',
  names(only(`Workout G\n\nCircuit x 2\n- Squat — 10\nKeep the chest up.\n- Row — 10`)) ===
    'Squat | Row',
)

/* ---------- round-trips ---------- */

function shape(w: Workout): string {
  const clean = (e: Exercise) =>
    Object.fromEntries(
      Object.entries({ ...e, id: undefined, demoTitle: undefined, circuit: e.circuit?.rounds })
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b)),
    )
  return JSON.stringify({ n: w.name, t: w.tag, l: w.letter, e: w.exercises.map(clean) })
}

for (const original of WORKOUTS) {
  const again = only(workoutToText(original))
  check(`round-trip: ${original.name}`, !!again && shape(original) === shape(again))
}

if (bulletCircuit) {
  const again = only(workoutToText(bulletCircuit))
  check('round-trip: circuit workout', !!again && shape(bulletCircuit) === shape(again))
}

/* ---------- report ---------- */

console.log(`${passed} passed, ${failures.length} failed`)
for (const f of failures) console.log(`  FAIL ${f}`)
process.exit(failures.length === 0 ? 0 : 1)
