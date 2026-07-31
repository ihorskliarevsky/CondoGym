import { useState } from 'react'
import { countMissingDefaults, moveWorkout, removeWorkout, restoreDefaults } from '../lib/library'
import type { Workout } from '../types'

interface Props {
  library: Workout[]
  onLibraryChange: (workouts: Workout[]) => void
  onAdd: () => void
  onEdit: (workout: Workout) => void
  onBack: () => void
}

export function ManageScreen({ library, onLibraryChange, onAdd, onEdit, onBack }: Props) {
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null)
  const missing = countMissingDefaults(library)

  return (
    <div className="app-shell">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to workouts">
          &#8592;
        </button>
        <div className="topbar-title">
          <span className="topbar-name">Manage workouts</span>
        </div>
      </div>

      <div className="manage">
        {library.length === 0 ? (
          <p className="history-empty">
            No workouts yet. Paste one in, or restore the ones this app shipped with.
          </p>
        ) : (
          <div className="home-list">
            {library.map((w, i) => (
              <div className="manage-row" key={w.id}>
                <button type="button" className="workout-card" onClick={() => onEdit(w)}>
                  <div className="badge">{w.letter}</div>
                  <div className="card-text">
                    <span className="card-name">{w.name}</span>
                    <span className="card-tag">
                      {w.tag} · {w.exercises.length} exercises
                    </span>
                  </div>
                  <span className="chevron" aria-hidden="true">
                    &#8250;
                  </span>
                </button>
                <div className="manage-tools">
                  <button
                    type="button"
                    className="tool-btn"
                    aria-label={`Move ${w.name} up`}
                    disabled={i === 0}
                    onClick={() => onLibraryChange(moveWorkout(w.id, -1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    aria-label={`Move ${w.name} down`}
                    disabled={i === library.length - 1}
                    onClick={() => onLibraryChange(moveWorkout(w.id, 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="tool-btn danger"
                    aria-label={`Delete ${w.name}`}
                    onClick={() => setPendingDelete(w)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="finish-btn" onClick={onAdd}>
          Paste a new workout
        </button>

        {missing > 0 && (
          <button type="button" className="text-btn centered" onClick={() => onLibraryChange(restoreDefaults())}>
            Restore {missing} built-in workout{missing === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {pendingDelete && (
        <div className="sheet-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Delete {pendingDelete.name}?</p>
            <p className="sheet-body">
              It’s removed from your list. Sessions already in your history stay there.
            </p>
            <div className="sheet-actions">
              <button type="button" className="pill-ghost" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="pill-danger"
                onClick={() => {
                  onLibraryChange(removeWorkout(pendingDelete.id))
                  setPendingDelete(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
