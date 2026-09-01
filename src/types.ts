/**
 * A demo visual for an exercise. Every exercise may declare one; those that
 * don't fall back to the designed play-button placeholder.
 *
 *  - `gif`     — a looping clip captured of the movement (file in /public/demos)
 *  - `youtube` — a video id, embedded on demand for movements without a GIF yet
 */
export type ExerciseMedia =
  | { kind: 'gif'; src: string }
  | { kind: 'youtube'; id: string }

interface ExerciseBase {
  id: string
  name: string
  /** Falls back to `name` when unset — used as the media caption. */
  demoTitle?: string
  media?: ExerciseMedia
  /** Form cue shown under the title. */
  cue: string
  /** Optional Ukrainian annotation, shown beneath the English cue. */
  cueUk?: string
  /** Rest between sets, in seconds. */
  rest?: number
  /**
   * Set when the exercise belongs to a circuit: one set of each exercise in the
   * group, then the whole group again. Exercises in a circuit are contiguous
   * and share an id; `rounds` replaces the exercise's own set count.
   */
  circuit?: { id: string; rounds: number }
}

export interface StrengthExercise extends ExerciseBase {
  type: 'strength'
  sets: number
  /** Pre-filled into every reps input. */
  repTarget: number
  /** Display string, e.g. "8-10" or "10 / side". */
  repRange: string
  /** Pre-filled weight in lb. 0 means bodyweight. */
  defaultWeight?: number
}

export interface HoldExercise extends ExerciseBase {
  type: 'hold'
  /** Hold length in seconds. */
  duration: number
}

export interface CardioExercise extends ExerciseBase {
  type: 'cardio'
  /** Optional round length in seconds. */
  duration?: number
}

export type Exercise = StrengthExercise | HoldExercise | CardioExercise

export interface Workout {
  id: string
  /** Single letter shown in the badge. */
  letter: string
  name: string
  /** One-line focus, e.g. "Pull + Legs". */
  tag: string
  /** Groups the workout under the low-back-friendly section on the home screen. */
  lowBack?: boolean
  swapNote?: string
  exercises: Exercise[]
}

/* ---------- logging state ---------- */

export interface SetLog {
  weight: string
  reps: string
  done: boolean
}

/** One pass at a timed hold. Non-circuit exercises simply have a single round. */
export interface HoldRound {
  remaining: number
  running: boolean
  done: boolean
}

export type ExerciseLog =
  | { type: 'strength'; sets: SetLog[] }
  | { type: 'hold'; duration: number; rounds: HoldRound[] }
  | { type: 'cardio'; rounds: boolean[] }

export type WorkoutLogs = Record<string, ExerciseLog>

/* ---------- history ---------- */

export interface SessionEntry {
  exerciseId: string
  name: string
  type: Exercise['type']
  /** Strength: the sets that were checked off. */
  sets?: { weight: string; reps: string }[]
  /** Hold: seconds actually held, summed over every round. */
  heldFor?: number
  /** Hold and cardio: how many rounds were completed. */
  rounds?: number
  done: boolean
}

export interface Session {
  id: string
  /** ISO timestamp of when the session was saved. */
  date: string
  workoutId: string
  workoutName: string
  workoutLetter: string
  entries: SessionEntry[]
}
