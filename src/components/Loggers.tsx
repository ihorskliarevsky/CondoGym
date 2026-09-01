import { useEffect } from 'react'
import { fmtTime } from '../lib/logs'
import type { HoldRound, SetLog } from '../types'

/* ---------------- strength ---------------- */

interface StrengthProps {
  sets: SetLog[]
  /** The planned weight, shown greyed in the empty field as a reminder. */
  weightHint?: number
  /** In a circuit only this round's row is shown; the rest belong to other cards. */
  onlyIndex?: number
  onSetField: (index: number, field: 'weight' | 'reps', value: string) => void
  onToggleDone: (index: number) => void
}

export function StrengthLogger({
  sets,
  weightHint,
  onlyIndex,
  onSetField,
  onToggleDone,
}: StrengthProps) {
  // Indices stay absolute so carry-forward still reaches the later rounds.
  const rows = sets.map((set, index) => ({ set, index }))
  const shown = onlyIndex === undefined ? rows : rows.filter((r) => r.index === onlyIndex)

  return (
    <div className="logger">
      <div className="set-row head">
        <span />
        <span className="field-label">Weight (lb)</span>
        <span className="field-label">Reps</span>
        <span />
      </div>
      {shown.map(({ set, index }) => (
        <div className="set-row" key={index}>
          <span className="set-label">{index + 1}</span>
          <input
            className="set-input"
            type="number"
            inputMode="decimal"
            aria-label={`Set ${index + 1} weight`}
            placeholder={weightHint === undefined ? '' : String(weightHint)}
            value={set.weight}
            onChange={(e) => onSetField(index, 'weight', e.target.value)}
          />
          <input
            className="set-input"
            type="number"
            inputMode="numeric"
            aria-label={`Set ${index + 1} reps`}
            value={set.reps}
            onChange={(e) => onSetField(index, 'reps', e.target.value)}
          />
          <div className="check-wrap">
            <button
              type="button"
              className={`check${set.done ? ' done' : ''}`}
              aria-label={`Mark set ${index + 1} done`}
              aria-pressed={set.done}
              onClick={() => onToggleDone(index)}
            >
              {set.done ? '✓' : ''}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------- timed hold ---------------- */

interface HoldProps {
  round: HoldRound
  duration: number
  onTick: (remaining: number) => void
  onToggleRun: (running: boolean) => void
  onReset: () => void
  onMarkDone: (done: boolean) => void
}

export function HoldLogger({ round, duration, onTick, onToggleRun, onReset, onMarkDone }: HoldProps) {
  useEffect(() => {
    if (!round.running) return
    if (round.remaining <= 0) {
      onMarkDone(true)
      return
    }
    const t = setTimeout(() => onTick(round.remaining - 1), 1000)
    return () => clearTimeout(t)
    // onTick/onMarkDone are stable per render of the parent; the countdown is
    // driven purely by the running flag and the remaining seconds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.running, round.remaining])

  const label = round.running ? 'Pause' : round.remaining < duration ? 'Resume' : 'Start'

  return (
    <div className="logger">
      <div className="hold-wrap">
        <div className="hold-time">{fmtTime(round.remaining)}</div>
        <div className="hold-btn-row">
          {!round.done && (
            <button type="button" className="pill-primary" onClick={() => onToggleRun(!round.running)}>
              {label}
            </button>
          )}
          <button type="button" className="pill-ghost" onClick={onReset}>
            Reset
          </button>
          {!round.done && (
            <button type="button" className="pill-ghost" onClick={() => onMarkDone(true)}>
              Mark done
            </button>
          )}
        </div>
        {round.done && <div className="hold-done">Done &#10003;</div>}
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
