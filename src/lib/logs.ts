import type { Exercise, ExerciseLog, Session, Workout, WorkoutLogs } from '../types'

/** How many entries an exercise logs: its circuit rounds, or its own sets. */
export function roundCount(ex: Exercise): number {
  if (ex.circuit) return ex.circuit.rounds
  return ex.type === 'strength' ? ex.sets : 1
}

/** Fresh logging state for a workout, pre-filled with each exercise's targets. */
export function initLogs(workout: Workout): WorkoutLogs {
  const logs: WorkoutLogs = {}
  for (const ex of workout.exercises) {
    logs[ex.id] = initExerciseLog(ex)
  }
  return logs
}

function initExerciseLog(ex: Exercise): ExerciseLog {
  const count = roundCount(ex)
  if (ex.type === 'strength') {
    return {
      type: 'strength',
      // Weight starts empty — the planned figure shows as a placeholder instead,
      // so nothing gets logged that wasn't actually lifted.
      sets: Array.from({ length: count }, () => ({
        weight: '',
        reps: String(ex.repTarget),
        done: false,
      })),
    }
  }
  if (ex.type === 'hold') {
    return {
      type: 'hold',
      duration: ex.duration,
      rounds: Array.from({ length: count }, () => ({
        remaining: ex.duration,
        running: false,
        done: false,
      })),
    }
  }
  return { type: 'cardio', rounds: Array.from({ length: count }, () => false) }
}

/**
 * A restored draft is only trusted where it still lines up with the plan —
 * if an exercise changed in config, that exercise falls back to a fresh log.
 */
export function reconcileLogs(workout: Workout, saved: WorkoutLogs): WorkoutLogs {
  const logs: WorkoutLogs = {}
  for (const ex of workout.exercises) {
    const prev = saved[ex.id]
    const fresh = initExerciseLog(ex)
    logs[ex.id] = sameShape(prev, fresh) ? prev : fresh
  }
  return logs
}

function sameShape(prev: ExerciseLog | undefined, fresh: ExerciseLog): prev is ExerciseLog {
  if (!prev || prev.type !== fresh.type) return false
  if (prev.type === 'strength' && fresh.type === 'strength') {
    return prev.sets.length === fresh.sets.length
  }
  if (prev.type === 'hold' && fresh.type === 'hold') {
    return Array.isArray(prev.rounds) && prev.rounds.length === fresh.rounds.length
  }
  if (prev.type === 'cardio' && fresh.type === 'cardio') {
    return Array.isArray(prev.rounds) && prev.rounds.length === fresh.rounds.length
  }
  return false
}

export function hasProgress(logs: WorkoutLogs): boolean {
  return Object.values(logs).some((log) =>
    log.type === 'strength' ? log.sets.some((s) => s.done) : log.rounds.some(roundDone),
  )
}

function roundDone(round: boolean | { done: boolean }): boolean {
  return typeof round === 'boolean' ? round : round.done
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
        // Total time actually held, summed over every round.
        const heldFor = log.rounds.reduce((sum, r) => sum + (log.duration - r.remaining), 0)
        return {
          exerciseId: ex.id,
          name: ex.name,
          type: ex.type,
          heldFor,
          rounds: log.rounds.filter((r) => r.done).length,
          done: log.rounds.some((r) => r.done),
        }
      }
      return {
        exerciseId: ex.id,
        name: ex.name,
        type: ex.type,
        rounds: log.rounds.filter(Boolean).length,
        done: log.rounds.some(Boolean),
      }
    }),
  }
}
