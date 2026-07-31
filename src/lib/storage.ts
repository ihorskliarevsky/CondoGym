import type { Session, WorkoutLogs } from '../types'

const SESSIONS_KEY = 'condogym.sessions.v1'
const DRAFT_KEY = 'condogym.draft.v1'

/**
 * Everything lives in localStorage — no accounts, no cloud. Reads are defensive
 * because a hand-edited or truncated value shouldn't brick the app.
 */
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota or private-mode failure — logging still works for this session.
  }
}

export function loadSessions(): Session[] {
  const sessions = read<Session[]>(SESSIONS_KEY, [])
  return Array.isArray(sessions) ? sessions : []
}

export function saveSession(session: Session): void {
  write(SESSIONS_KEY, [session, ...loadSessions()])
}

export function deleteSession(id: string): Session[] {
  const next = loadSessions().filter((s) => s.id !== id)
  write(SESSIONS_KEY, next)
  return next
}

/** An in-progress workout, so a refresh mid-session doesn't lose reps. */
export interface Draft {
  workoutId: string
  index: number
  logs: WorkoutLogs
}

export function loadDraft(workoutId: string): Draft | null {
  const draft = read<Draft | null>(DRAFT_KEY, null)
  return draft && draft.workoutId === workoutId ? draft : null
}

export function saveDraft(draft: Draft): void {
  write(DRAFT_KEY, draft)
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}
