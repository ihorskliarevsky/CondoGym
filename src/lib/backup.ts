import { loadLibrary, saveLibrary } from './library'
import { loadSessions, saveSessions } from './storage'
import type { Session, Workout } from '../types'

const FORMAT = 'condo-gym-backup'
const VERSION = 1

export interface Backup {
  format: typeof FORMAT
  version: number
  exportedAt: string
  workouts: Workout[]
  sessions: Session[]
}

export interface BackupSummary {
  backup: Backup
  /** Workouts in the file that aren't already here, by id. */
  newWorkouts: number
  newSessions: number
}

export function buildBackup(): Backup {
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    workouts: loadLibrary(),
    sessions: loadSessions(),
  }
}

export function backupFilename(date = new Date()): string {
  return `condo-gym-${date.toISOString().slice(0, 10)}.json`
}

/**
 * Hands the JSON to the browser as a download. On iOS this opens the share
 * sheet, which is the practical way to get it into Files or iCloud.
 */
export function downloadBackup(): void {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = backupFilename()
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the download a tick to start before the blob is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function isWorkout(value: unknown): value is Workout {
  const w = value as Workout
  return !!w && typeof w.id === 'string' && typeof w.name === 'string' && Array.isArray(w.exercises)
}

function isSession(value: unknown): value is Session {
  const s = value as Session
  return !!s && typeof s.id === 'string' && typeof s.date === 'string' && Array.isArray(s.entries)
}

/**
 * Reads a backup file. Unknown or malformed entries are dropped rather than
 * rejecting the whole file — a partial restore beats none.
 */
export function readBackup(text: string): { summary: BackupSummary | null; error: string | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { summary: null, error: "That file isn't valid JSON." }
  }

  const raw = parsed as Partial<Backup>
  if (!raw || raw.format !== FORMAT) {
    return { summary: null, error: "That doesn't look like a Condo Gym backup." }
  }
  if (typeof raw.version === 'number' && raw.version > VERSION) {
    return { summary: null, error: 'That backup was made by a newer version of the app.' }
  }

  const workouts = Array.isArray(raw.workouts) ? raw.workouts.filter(isWorkout) : []
  const sessions = Array.isArray(raw.sessions) ? raw.sessions.filter(isSession) : []
  if (workouts.length === 0 && sessions.length === 0) {
    return { summary: null, error: 'That backup is empty.' }
  }

  const currentWorkouts = new Set(loadLibrary().map((w) => w.id))
  const currentSessions = new Set(loadSessions().map((s) => s.id))

  return {
    summary: {
      backup: {
        format: FORMAT,
        version: VERSION,
        exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
        workouts,
        sessions,
      },
      newWorkouts: workouts.filter((w) => !currentWorkouts.has(w.id)).length,
      newSessions: sessions.filter((s) => !currentSessions.has(s.id)).length,
    },
    error: null,
  }
}

/**
 * `merge` adds what isn't already here, keyed by id, and leaves everything else
 * alone. `replace` swaps both lists for the file's contents.
 */
export function applyBackup(backup: Backup, mode: 'merge' | 'replace'): Workout[] {
  if (mode === 'replace') {
    saveSessions(backup.sessions)
    return saveLibrary(backup.workouts)
  }

  const workouts = loadLibrary()
  const knownWorkouts = new Set(workouts.map((w) => w.id))
  const sessions = loadSessions()
  const knownSessions = new Set(sessions.map((s) => s.id))

  saveSessions([...sessions, ...backup.sessions.filter((s) => !knownSessions.has(s.id))])
  return saveLibrary([...workouts, ...backup.workouts.filter((w) => !knownWorkouts.has(w.id))])
}
