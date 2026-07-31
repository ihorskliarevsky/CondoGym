import { useMemo, useState } from 'react'
import { EXAMPLE_TEXT, parseWorkout } from '../lib/parseWorkout'
import type { Exercise, Workout } from '../types'

interface Props {
  /** Prefilled text when editing an existing workout. */
  initialText?: string
  /** Set when editing — the workout being replaced. */
  editingName?: string
  onCancel: () => void
  onSave: (workouts: Workout[]) => void
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

  const { workouts } = result
  // Editing replaces one specific workout, so a multi-workout paste is ambiguous.
  const tooMany = editingName !== undefined && workouts.length > 1
  const canSave = workouts.length > 0 && !tooMany
  const saveLabel = editingName
    ? 'Save changes'
    : workouts.length > 1
      ? `Add ${workouts.length} workouts`
      : 'Add to my workouts'

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
          Paste a workout in whatever shape you have it — plain text, a bulleted or numbered list,
          markdown, a table, or JSON. Check the preview below before saving.
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

        {tooMany && (
          <div className="notice error">
            <p>
              That’s {workouts.length} workouts, but you’re editing {editingName}. Paste a single
              workout here, or go back and use “Paste a new workout” to add them all.
            </p>
          </div>
        )}

        {workouts.length > 0 && (
          <div className="preview">
            <div className="section-divider">
              <span>{workouts.length > 1 ? `Preview · ${workouts.length} workouts` : 'Preview'}</span>
              <span className="line" />
            </div>

            {workouts.map((workout) => (
              <div className="preview-workout" key={workout.id}>
                <div className="workout-card static">
                  <div className="badge">{workout.letter}</div>
                  <div className="card-text">
                    <span className="card-name">{workout.name}</span>
                    <span className="card-tag">
                      {workout.tag}
                      {workout.lowBack ? ' · low-back' : ''}
                    </span>
                  </div>
                </div>

                <div className="preview-list">
                  {workout.exercises.map((ex) => (
                    <div className="entry" key={ex.id}>
                      <span className="entry-name">{ex.name}</span>
                      <span className="entry-detail">{specLine(ex)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="finish-btn"
          disabled={!canSave}
          onClick={() => canSave && onSave(workouts)}
        >
          {saveLabel}
        </button>

        <details className="format-help">
          <summary>What it understands</summary>
          <ul>
            <li>
              The first line names the workout. <code>Workout E — Push + Core</code> also sets the
              focus tag.
            </li>
            <li>
              Sets and reps in most shapes: <code>4 x 8-10</code>, <code>3 sets of 10</code>,{' '}
              <code>10 reps x 3 sets</code>, <code>3 x 10 / side</code>, <code>4 sets AMRAP</code>.
            </li>
            <li>
              <code>@ 20lb</code> or <code>bodyweight</code> for load, <code>rest 90s</code> for rest
              — both optional, anywhere on the line.
            </li>
            <li>
              <code>60s hold</code> gives a countdown; <code>40s cardio</code> or <code>cardio</code>{' '}
              gives a single "mark as done".
            </li>
            <li>
              Anything left over becomes the form cue. <code>ua: …</code> adds a Ukrainian note,{' '}
              <code>youtube: …</code> or <code>gif: …</code> adds the demo.
            </li>
            <li>
              A line reading <code>low-back</code> files it under the low-back section.
            </li>
            <li>
              JSON works too: an object with <code>name</code> and <code>exercises</code>, an array
              of exercises, or an array of whole workouts.
            </li>
            <li>
              Several workouts at once is fine — a JSON array of them, or plain text where each one
              starts with a <code>Workout …</code> or <code>Day …</code> line.
            </li>
          </ul>
        </details>
      </div>
    </div>
  )
}
