import { ExerciseDemo } from './ExerciseDemo'
import { CardioLogger, HoldLogger, StrengthLogger } from './Loggers'
import type { Exercise, ExerciseLog } from '../types'

interface Props {
  exercise: Exercise
  log: ExerciseLog
  onSetField: (index: number, field: 'weight' | 'reps', value: string) => void
  onToggleSetDone: (index: number) => void
  onTick: (remaining: number) => void
  onToggleRun: (running: boolean) => void
  onReset: () => void
  onMarkDone: (done: boolean) => void
}

function volumeLine(exercise: Exercise): string {
  if (exercise.type === 'strength') return `${exercise.sets} × ${exercise.repRange} reps`
  if (exercise.type === 'hold') return `${exercise.duration}s hold`
  return exercise.duration ? `${exercise.duration}s` : '1 round'
}

export function ExerciseCard({
  exercise,
  log,
  onSetField,
  onToggleSetDone,
  onTick,
  onToggleRun,
  onReset,
  onMarkDone,
}: Props) {
  return (
    <>
      <div className="ex-head">
        <ExerciseDemo title={exercise.demoTitle ?? exercise.name} media={exercise.media} />
        <div className="ex-head-text">
          <h2 className="ex-name">{exercise.name}</h2>
          <div className="ex-meta">
            <span>{volumeLine(exercise)}</span>
            <span>Rest {exercise.rest ?? 30}s</span>
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
          onSetField={onSetField}
          onToggleDone={onToggleSetDone}
        />
      )}
      {log.type === 'hold' && (
        <HoldLogger
          log={log}
          onTick={onTick}
          onToggleRun={onToggleRun}
          onReset={onReset}
          onMarkDone={onMarkDone}
        />
      )}
      {log.type === 'cardio' && <CardioLogger done={log.done} onMarkDone={onMarkDone} />}
    </>
  )
}
