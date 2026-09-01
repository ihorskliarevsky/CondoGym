import { ExerciseDemo } from './ExerciseDemo'
import { CardioLogger, HoldLogger, StrengthLogger } from './Loggers'
import type { Exercise, ExerciseLog } from '../types'

interface Props {
  exercise: Exercise
  log: ExerciseLog
  /** Which round this card is for. Non-circuit exercises are always round 0. */
  round: number
  onSetField: (index: number, field: 'weight' | 'reps', value: string) => void
  onToggleSetDone: (index: number) => void
  onTick: (remaining: number) => void
  onToggleRun: (running: boolean) => void
  onReset: () => void
  onMarkDone: (done: boolean) => void
}

function volumeLine(exercise: Exercise): string {
  if (exercise.type === 'strength') {
    const sets = exercise.circuit ? exercise.circuit.rounds : exercise.sets
    return `${sets} × ${exercise.repRange} reps`
  }
  if (exercise.type === 'hold') return `${exercise.duration}s hold`
  return exercise.duration ? `${exercise.duration}s` : '1 round'
}

export function ExerciseCard({
  exercise,
  log,
  round,
  onSetField,
  onToggleSetDone,
  onTick,
  onToggleRun,
  onReset,
  onMarkDone,
}: Props) {
  const circuit = exercise.circuit

  return (
    <>
      {circuit && (
        <div className="round-banner">
          Circuit · Round {round + 1} of {circuit.rounds}
        </div>
      )}

      <div className="ex-head">
        <ExerciseDemo title={exercise.demoTitle ?? exercise.name} media={exercise.media} />
        <div className="ex-head-text">
          <h2 className="ex-name">{exercise.name}</h2>
          <div className="ex-meta">
            <span>{volumeLine(exercise)}</span>
            {/* Rest is between rounds, not between stations, so a circuit hides it. */}
            {!circuit && <span>Rest {exercise.rest ?? 30}s</span>}
          </div>
        </div>
      </div>

      <p className="ex-cue">{exercise.cue}</p>
      {exercise.cueUk && (
        <p className="ex-cue-uk" lang="uk">
          {exercise.cueUk}
        </p>
      )}

      {log.type === 'strength' && (
        <StrengthLogger
          sets={log.sets}
          weightHint={exercise.type === 'strength' ? exercise.defaultWeight : undefined}
          onlyIndex={circuit ? round : undefined}
          onSetField={onSetField}
          onToggleDone={onToggleSetDone}
        />
      )}
      {log.type === 'hold' && log.rounds[round] && (
        <HoldLogger
          round={log.rounds[round]}
          duration={log.duration}
          onTick={onTick}
          onToggleRun={onToggleRun}
          onReset={onReset}
          onMarkDone={onMarkDone}
        />
      )}
      {log.type === 'cardio' && <CardioLogger done={log.rounds[round]} onMarkDone={onMarkDone} />}
    </>
  )
}
