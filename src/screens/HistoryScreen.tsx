import { useState } from 'react'
import { deleteSession, loadSessions } from '../lib/storage'
import type { Session, SessionEntry } from '../types'

interface Props {
  onBack: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function entryDetail(entry: SessionEntry): string {
  if (!entry.done) return 'skipped'
  if (entry.type === 'strength') {
    const sets = entry.sets ?? []
    // Collapse identical sets: "3 × 8 @ 20 lb" beats three identical lines.
    const parts = sets.map((s) => `${s.reps}${s.weight && s.weight !== '0' ? ` @ ${s.weight}` : ''}`)
    const allSame = parts.length > 1 && parts.every((p) => p === parts[0])
    const body = allSame ? `${parts.length} × ${parts[0]}` : parts.join(', ')
    return sets.some((s) => s.weight && s.weight !== '0') ? `${body} lb` : body
  }
  if (entry.type === 'hold') return `${entry.heldFor ?? 0}s held`
  return 'done'
}

function summary(session: Session): string {
  const done = session.entries.filter((e) => e.done).length
  return `${done} of ${session.entries.length} exercises`
}

function SessionRow({ session, onDelete }: { session: Session; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="session">
      <button type="button" className="session-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <div className="badge">{session.workoutLetter}</div>
        <div className="card-text">
          <span className="session-date">{formatDate(session.date)}</span>
          <span className="session-sub">
            {session.workoutName} · {summary(session)}
          </span>
        </div>
        <span className="chevron" aria-hidden="true">
          {open ? '⌃' : '⌄'}
        </span>
      </button>

      {open && (
        <div className="session-body">
          {session.entries.map((entry) => (
            <div className="entry" key={entry.exerciseId}>
              <span className="entry-name">{entry.name}</span>
              <span className={`entry-detail${entry.done ? '' : ' skipped'}`}>{entryDetail(entry)}</span>
            </div>
          ))}
          <span className="session-sub">Finished {formatTime(session.date)}</span>
          <button type="button" className="delete-session" onClick={() => onDelete(session.id)}>
            Delete session
          </button>
        </div>
      )}
    </div>
  )
}

export function HistoryScreen({ onBack }: Props) {
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions())

  return (
    <div className="app-shell">
      <div className="history">
        <div className="history-head">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to workouts">
            &#8592;
          </button>
          <h1 className="display history-title">HISTORY</h1>
        </div>

        {sessions.length === 0 ? (
          <p className="history-empty">
            No sessions yet. Finish a workout and it’ll show up here.
          </p>
        ) : (
          <div className="session-list">
            {sessions.map((s) => (
              <SessionRow key={s.id} session={s} onDelete={(id) => setSessions(deleteSession(id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
