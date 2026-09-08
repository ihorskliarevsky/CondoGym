import { WORKOUTS as DEFAULT_WORKOUTS } from '../data/workouts'
import type { Workout } from '../types'

const LIBRARY_KEY = 'condogym.library.v1'

/**
 * The workout list lives on-device so it can be edited from the phone. The
 * bundled plan in `data/workouts.ts` is only a seed: it's copied in on first
 * run, and after that the stored library wins — including when it's empty,
 * so deleting everything sticks instead of re-seeding on the next load.
 */
export function loadLibrary(): Workout[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (raw === null) {
      saveLibrary(DEFAULT_WORKOUTS)
      return DEFAULT_WORKOUTS
    }
    const parsed = JSON.parse(raw) as Workout[]
    return Array.isArray(parsed) ? parsed.filter(isWorkout) : DEFAULT_WORKOUTS
  } catch {
    return DEFAULT_WORKOUTS
  }
}

function isWorkout(value: unknown): value is Workout {
  const w = value as Workout
  return !!w && typeof w.id === 'string' && typeof w.name === 'string' && Array.isArray(w.exercises)
}

export function saveLibrary(workouts: Workout[]): Workout[] {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(workouts))
  } catch {
    // Quota or private-mode failure — the change still applies for this session.
  }
  return workouts
}

export function addWorkouts(workouts: Workout[]): Workout[] {
  return saveLibrary([...loadLibrary(), ...workouts])
}

export function replaceWorkout(id: string, workout: Workout): Workout[] {
  return saveLibrary(loadLibrary().map((w) => (w.id === id ? { ...workout, id } : w)))
}

export function removeWorkout(id: string): Workout[] {
  return saveLibrary(loadLibrary().filter((w) => w.id !== id))
}

export function moveWorkout(id: string, direction: -1 | 1): Workout[] {
  const workouts = loadLibrary()
  const from = workouts.findIndex((w) => w.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= workouts.length) return workouts
  const next = [...workouts]
  ;[next[from], next[to]] = [next[to], next[from]]
  return saveLibrary(next)
}

/**
 * Swaps the library for the bundled plan. Editing `data/workouts.ts` only ever
 * seeds a fresh install, so this is how a new plan reaches a phone that already
 * has the old one stored. History is untouched.
 */
export function resetToDefaults(): Workout[] {
  return saveLibrary(DEFAULT_WORKOUTS)
}

/** How many workouts the bundled plan holds. */
export const DEFAULT_COUNT = DEFAULT_WORKOUTS.length

/** True when the stored library already matches the bundled plan exactly. */
export function matchesDefaults(library: Workout[]): boolean {
  return (
    library.length === DEFAULT_WORKOUTS.length &&
    DEFAULT_WORKOUTS.every((d, i) => library[i]?.name === d.name)
  )
}
