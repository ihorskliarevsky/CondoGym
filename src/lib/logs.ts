import type { Exercise, ExerciseLog, Session, Workout, WorkoutLogs } from '../types'

/** Fresh logging state for a workout, pre-filled with each exercise's targets. */
export function initLogs(workout: Workout): WorkoutLogs {
  const logs: WorkoutLogs = {}
  for (const ex of workout.exercises) {
    logs[ex.id] = initExerciseLog(ex)
  }
  return logs
}

function initExerciseLog(ex: Exercise): ExerciseLog {
  if (ex.type === 'strength') {
    return {
      type: 'strength',
      sets: Array.from({ length: ex.sets }, () => ({
        weight: ex.defaultWeight !== undefined ? String(ex.defaultWeight) : '',
        reps: String(ex.repTarget),
        done: false,
      })),
    }
  }
  if (ex.type === 'hold') {
    return { type: 'hold', duration: ex.duration, remaining: ex.duration, running: false, done: false }
  }
  return { type: 'cardio', done: false }
}

/**
 * A restored draft is only trusted where it still lines up with the plan —
 * if an exercise was edited in config, that exercise falls back to a fresh log.
 */
export function reconcileLogs(workout: Workout, saved: WorkoutLogs): WorkoutLogs {
  const logs: WorkoutLogs = {}
  for (const ex of workout.exercises) {
    const prev = saved[ex.id]
    const fresh = initExerciseLog(ex)
    if (!prev || prev.type !== fresh.type) {
      logs[ex.id] = fresh
      continue
    }
    if (prev.type === 'strength' && fresh.type === 'strength' && prev.sets.length !== fresh.sets.length) {
      logs[ex.id] = fresh
      continue
    }
    logs[ex.id] = prev
  }
  return logs
}

export function hasProgress(logs: WorkoutLogs): boolean {
  return Object.values(logs).some((log) =>
    log.type === 'strength' ? log.sets.some((s) => s.done) : log.done,
  )
}

export function fmtTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60)
  const s = Math.max(0, seconds) % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Snapshot the current logs as a history entry. Only completed work is kept. */
export function toSession(workout: Workout, logs: WorkoutLogs): Session {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    workoutId: workout.id,
    workoutName: workout.name,
    workoutLetter: workout.letter,
    entries: workout.exercises.map((ex) => {
      const log = logs[ex.id]
      if (log.type === 'strength') {
        const sets = log.sets.filter((s) => s.done).map((s) => ({ weight: s.weight, reps: s.reps }))
        return { exerciseId: ex.id, name: ex.name, type: ex.type, sets, done: sets.length > 0 }
      }
      if (log.type === 'hold') {
        return {
          exerciseId: ex.id,
          name: ex.name,
          type: ex.type,
          heldFor: log.duration - log.remaining,
          done: log.done,
        }
      }
      return { exerciseId: ex.id, name: ex.name, type: ex.type, done: log.done }
    }),
  }
}
