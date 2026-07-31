import { useRef, useState } from 'react'
import { applyBackup, downloadBackup, readBackup, type BackupSummary } from '../lib/backup'
import { countMissingDefaults, moveWorkout, removeWorkout, restoreDefaults } from '../lib/library'
import type { Workout } from '../types'

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

/**
 * An installed home-screen app serves index.html from cache, so a plain reload
 * can keep showing the old build. A one-off query string is a URL the cache has
 * never seen, which forces a fresh fetch of the HTML and its hashed assets.
 */
function reloadFresh(): void {
  const url = new URL(window.location.href)
  url.searchParams.set('v', Date.now().toString(36))
  window.location.replace(url.toString())
}

function buildStamp(): string {
  const date = new Date(__BUILD_TIME__)
  return Number.isNaN(date.getTime())
    ? 'dev'
    : `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

interface Props {
  library: Workout[]
  onLibraryChange: (workouts: Workout[]) => void
  onAdd: () => void
  onEdit: (workout: Workout) => void
  onBack: () => void
}

export function ManageScreen({ library, onLibraryChange, onAdd, onEdit, onBack }: Props) {
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null)
  const [pendingImport, setPendingImport] = useState<BackupSummary | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const missing = countMissingDefaults(library)

  async function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so picking the same file twice still fires a change.
    event.target.value = ''
    if (!file) return

    setImportError(null)
    setNote(null)
    const { summary, error } = readBackup(await file.text())
    if (error) setImportError(error)
    else setPendingImport(summary)
  }

  function runImport(mode: 'merge' | 'replace') {
    if (!pendingImport) return
    const { backup, newWorkouts, newSessions } = pendingImport
    onLibraryChange(applyBackup(backup, mode))
    setNote(
      mode === 'replace'
        ? `Replaced everything with the backup: ${count(backup.workouts.length, 'workout')} and ${count(backup.sessions.length, 'session')}.`
        : `Added ${count(newWorkouts, 'workout')} and ${count(newSessions, 'session')}.`,
    )
    setPendingImport(null)
  }

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

        <div className="section-divider">
          <span>Backup</span>
          <span className="line" />
        </div>

        <p className="import-hint">
          Your workouts and history live only in this browser. Export a file to keep a copy or move
          everything to another phone.
        </p>

        <div className="backup-actions">
          <button type="button" className="pill-ghost" onClick={downloadBackup}>
            Export to file
          </button>
          <button type="button" className="pill-ghost" onClick={() => fileInput.current?.click()}>
            Import from file
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={onFilePicked}
        />

        {importError && (
          <div className="notice error">
            <p>{importError}</p>
          </div>
        )}
        {note && (
          <div className="notice warn">
            <p>{note}</p>
          </div>
        )}

        <div className="section-divider">
          <span>App</span>
          <span className="line" />
        </div>

        <p className="import-hint">
          Installed to the home screen, this app keeps its own copy and won’t pick up a new version
          on its own.
        </p>

        <button type="button" className="pill-ghost" onClick={reloadFresh}>
          Check for a new version
        </button>

        <p className="build-stamp">Build {buildStamp()}</p>
      </div>

      {pendingImport && (
        <div className="sheet-backdrop" onClick={() => setPendingImport(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Import this backup?</p>
            <p className="sheet-body">
              It holds {count(pendingImport.backup.workouts.length, 'workout')} and{' '}
              {count(pendingImport.backup.sessions.length, 'session')} from{' '}
              {new Date(pendingImport.backup.exportedAt).toLocaleDateString()}.
              <br />
              <strong>Merge</strong> adds the {count(pendingImport.newWorkouts, 'workout')} and{' '}
              {count(pendingImport.newSessions, 'session')} you don’t already have.{' '}
              <strong>Replace</strong> discards what’s here now.
            </p>
            <div className="sheet-actions">
              <button type="button" className="pill-ghost" onClick={() => setPendingImport(null)}>
                Cancel
              </button>
              <button type="button" className="pill-danger" onClick={() => runImport('replace')}>
                Replace
              </button>
              <button type="button" className="pill-primary" onClick={() => runImport('merge')}>
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

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
