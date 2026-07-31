import { useMemo, useState } from 'react'
import { EXAMPLE_TEXT, parseWorkout } from '../lib/parseWorkout'
import type { Exercise, Workout } from '../types'

interface Props {
  /** Prefilled text when editing an existing workout. */
  initialText?: string
  /** Set when editing — the workout being replaced. */
  editingName?: string
  onCancel: () => void
  onSave: (workout: Workout) => void
}

function specLine(ex: Exercise): string {
  if (ex.type === 'strength') {
    const weight = ex.defaultWeight === undefined ? '' : ex.defaultWeight === 0 ? ' · bodyweight' : ` · ${ex.defaultWeight} lb`
    return `${ex.sets} × ${ex.repRange} reps${weight} · rest ${ex.rest ?? 30}s`
  }
  if (ex.type === 'hold') return `${ex.duration}s hold`
  return ex.duration ? `${ex.duration}s` : 'mark as done'
}

export function ImportScreen({ initialText, editingName, onCancel, onSave }: Props) {
  const [text, setText] = useState(initialText ?? '')
  const result = useMemo(() => parseWorkout(text), [text])
  const touched = text.trim().length > 0

  return (
    <div className="app-shell">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancel">
          &#8592;
        </button>
        <div className="topbar-title">
          <span className="topbar-name">{editingName ? `Edit ${editingName}` : 'Paste a workout'}</span>
        </div>
      </div>

      <div className="import">
        <p className="import-hint">
          Paste your workout as plain text. Blank line between blocks: the first block is the workout
          name, each block after it is one exercise — name, then the sets line, then the form cue.
        </p>

        <textarea
          className="import-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE_TEXT}
          spellCheck={false}
          rows={12}
        />

        <div className="import-actions">
          <button type="button" className="text-btn" onClick={() => setText(EXAMPLE_TEXT)}>
            Fill with example
          </button>
          {touched && (
            <button type="button" className="text-btn" onClick={() => setText('')}>
              Clear
            </button>
          )}
        </div>

        {touched && result.errors.length > 0 && (
          <div className="notice error">
            {result.errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="notice warn">
            {result.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        )}

        {result.workout && (
          <div className="preview">
            <div className="section-divider">
              <span>Preview</span>
              <span className="line" />
            </div>

            <div className="workout-card static">
              <div className="badge">{result.workout.letter}</div>
              <div className="card-text">
                <span className="card-name">{result.workout.name}</span>
                <span className="card-tag">
                  {result.workout.tag}
                  {result.workout.lowBack ? ' · low-back' : ''}
                </span>
              </div>
            </div>

            <div className="preview-list">
              {result.workout.exercises.map((ex) => (
                <div className="entry" key={ex.id}>
                  <span className="entry-name">{ex.name}</span>
                  <span className="entry-detail">{specLine(ex)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className="finish-btn"
          disabled={!result.workout}
          onClick={() => result.workout && onSave(result.workout)}
        >
          {editingName ? 'Save changes' : 'Add to my workouts'}
        </button>

        <details className="format-help">
          <summary>Format cheat sheet</summary>
          <ul>
            <li>
              <code>Workout E — Push + Core</code> — first block: name, then an em dash or a pipe,
              then the focus tag.
            </li>
            <li>
              <code>4 x 8-10 @ 20lb, rest 90s</code> — strength. Weight and rest are optional; write{' '}
              <code>bodyweight</code> for no load, <code>3 x 10 / side</code> for per-side reps.
            </li>
            <li>
              <code>60s hold</code> — a timed hold with a countdown.
            </li>
            <li>
              <code>60s cardio</code> or just <code>cardio</code> — a single "mark as done".
            </li>
            <li>
              Any other line is the form cue. <code>ua: …</code> adds a Ukrainian note.
            </li>
            <li>
              <code>youtube: …</code> (id or link) or <code>gif: /demos/x.gif</code> adds the demo
              visual.
            </li>
            <li>
              Add a line reading <code>low-back</code> to file it under the low-back section.
            </li>
          </ul>
        </details>
      </div>
    </div>
  )
}
