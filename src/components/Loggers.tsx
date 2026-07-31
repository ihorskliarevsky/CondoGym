import { useEffect } from 'react'
import { fmtTime } from '../lib/logs'
import type { ExerciseLog, SetLog } from '../types'

/* ---------------- strength ---------------- */

interface StrengthProps {
  sets: SetLog[]
  /** The planned weight, shown greyed in the empty field as a reminder. */
  weightHint?: number
  onSetField: (index: number, field: 'weight' | 'reps', value: string) => void
  onToggleDone: (index: number) => void
}

export function StrengthLogger({ sets, weightHint, onSetField, onToggleDone }: StrengthProps) {
  return (
    <div className="logger">
      <div className="set-row head">
        <span />
        <span className="field-label">Weight (lb)</span>
        <span className="field-label">Reps</span>
        <span />
      </div>
      {sets.map((s, i) => (
        <div className="set-row" key={i}>
          <span className="set-label">{i + 1}</span>
          <input
            className="set-input"
            type="number"
            inputMode="decimal"
            aria-label={`Set ${i + 1} weight`}
            placeholder={weightHint === undefined ? '' : String(weightHint)}
            value={s.weight}
            onChange={(e) => onSetField(i, 'weight', e.target.value)}
          />
          <input
            className="set-input"
            type="number"
            inputMode="numeric"
            aria-label={`Set ${i + 1} reps`}
            value={s.reps}
            onChange={(e) => onSetField(i, 'reps', e.target.value)}
          />
          <div className="check-wrap">
            <button
              type="button"
              className={`check${s.done ? ' done' : ''}`}
              aria-label={`Mark set ${i + 1} done`}
              aria-pressed={s.done}
              onClick={() => onToggleDone(i)}
            >
              {s.done ? '✓' : ''}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- timed hold ---------------- */

interface HoldProps {
  log: Extract<ExerciseLog, { type: 'hold' }>
  onTick: (remaining: number) => void
  onToggleRun: (running: boolean) => void
  onReset: () => void
  onMarkDone: (done: boolean) => void
}

export function HoldLogger({ log, onTick, onToggleRun, onReset, onMarkDone }: HoldProps) {
  useEffect(() => {
    if (!log.running) return
    if (log.remaining <= 0) {
      onMarkDone(true)
      return
    }
    const t = setTimeout(() => onTick(log.remaining - 1), 1000)
    return () => clearTimeout(t)
    // onTick/onMarkDone are stable per render of the parent; the countdown is
    // driven purely by the running flag and the remaining seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.running, log.remaining])

  const label = log.running ? 'Pause' : log.remaining < log.duration ? 'Resume' : 'Start'

  return (
    <div className="logger">
      <div className="hold-wrap">
        <div className="hold-time">{fmtTime(log.remaining)}</div>
        <div className="hold-btn-row">
          {!log.done && (
            <button type="button" className="pill-primary" onClick={() => onToggleRun(!log.running)}>
              {label}
            </button>
          )}
          <button type="button" className="pill-ghost" onClick={onReset}>
            Reset
          </button>
          {!log.done && (
            <button type="button" className="pill-ghost" onClick={() => onMarkDone(true)}>
              Mark done
            </button>
          )}
        </div>
        {log.done && <div className="hold-done">Done &#10003;</div>}
      </div>
    </div>
  )
}

/* ---------------- cardio ---------------- */

interface CardioProps {
  done: boolean
  onMarkDone: (done: boolean) => void
}

export function CardioLogger({ done, onMarkDone }: CardioProps) {
  return (
    <div className="logger">
      <button
        type="button"
        className={`cardio-btn${done ? ' done' : ''}`}
        onClick={() => onMarkDone(!done)}
      >
        {done ? 'Marked done ✓' : 'Mark as done'}
      </button>
    </div>
  )
}
