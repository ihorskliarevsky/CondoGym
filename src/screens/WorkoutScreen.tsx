import { useEffect, useRef, useState } from 'react'
import { ExerciseCard } from '../components/ExerciseCard'
import { hasProgress, initLogs, reconcileLogs, toSession } from '../lib/logs'
import { clearDraft, loadDraft, saveDraft, saveSession } from '../lib/storage'
import type { Workout, WorkoutLogs } from '../types'

interface Props {
  workout: Workout
  onExit: () => void
}

/** Fraction of the deck width a drag must cover to flip to the next card. */
const SWIPE_THRESHOLD = 0.2
/** Past this, a gesture is a vertical scroll and not a card swipe. */
const SWIPE_SLOP = 10

export function WorkoutScreen({ workout, onExit }: Props) {
  const [logs, setLogs] = useState<WorkoutLogs>(() => {
    const draft = loadDraft(workout.id)
    return draft ? reconcileLogs(workout, draft.logs) : initLogs(workout)
  })
  const [index, setIndex] = useState(() => {
    const draft = loadDraft(workout.id)
    return draft && draft.index < workout.exercises.length ? draft.index : 0
  })
  const [confirmExit, setConfirmExit] = useState(false)

  const total = workout.exercises.length
  const deckRef = useRef<HTMLDivElement>(null)

  /* ---- swipe ---- */
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef({ startX: 0, startY: 0, width: 320, axis: '' as '' | 'x' | 'y' })

  useEffect(() => {
    saveDraft({ workoutId: workout.id, index, logs })
  }, [workout.id, index, logs])

  function onPointerDown(e: React.PointerEvent) {
    // Inputs and buttons own their own gestures.
    if ((e.target as HTMLElement).closest('input, button')) return
    setDragging(true)
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      width: deckRef.current?.offsetWidth ?? 320,
      axis: '',
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - gesture.current.startX
    const dy = e.clientY - gesture.current.startY

    if (!gesture.current.axis) {
      if (Math.abs(dx) < SWIPE_SLOP && Math.abs(dy) < SWIPE_SLOP) return
      gesture.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (gesture.current.axis === 'y') {
        setDragging(false)
        return
      }
    }

    // Rubber-band at the ends of the deck.
    let offset = dx
    if (index === 0 && offset > 0) offset *= 0.35
    if (index === total - 1 && offset < 0) offset *= 0.35
    setDragX(offset)
  }

  function endDrag() {
    if (!dragging) return
    setDragging(false)
    const threshold = gesture.current.width * SWIPE_THRESHOLD
    if (dragX < -threshold && index < total - 1) setIndex((i) => i + 1)
    else if (dragX > threshold && index > 0) setIndex((i) => i - 1)
    setDragX(0)
  }

  /* ---- keyboard nav (desktop) ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, total - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  /* ---- log updates ---- */
  function setSetField(exId: string, i: number, field: 'weight' | 'reps', value: string) {
    setLogs((prev) => {
      const log = prev[exId]
      if (log.type !== 'strength') return prev
      const sets = log.sets.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
      // Editing reps carries the number forward into every later set that
      // hasn't been logged yet — the usual case is doing the same reps again.
      if (field === 'reps') {
        for (let j = i + 1; j < sets.length; j++) {
          if (!sets[j].done) sets[j] = { ...sets[j], reps: value }
        }
      }
      return { ...prev, [exId]: { ...log, sets } }
    })
  }

  function toggleSetDone(exId: string, i: number) {
    setLogs((prev) => {
      const log = prev[exId]
      if (log.type !== 'strength') return prev
      const sets = log.sets.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s))
      return { ...prev, [exId]: { ...log, sets } }
    })
  }

  function patchLog(exId: string, patch: Record<string, unknown>) {
    setLogs((prev) => ({ ...prev, [exId]: { ...prev[exId], ...patch } as WorkoutLogs[string] }))
  }

  /* ---- finishing ---- */
  function finish() {
    saveSession(toSession(workout, logs))
    clearDraft()
    onExit()
  }

  function requestExit() {
    if (hasProgress(logs)) setConfirmExit(true)
    else {
      clearDraft()
      onExit()
    }
  }

  function discard() {
    clearDraft()
    onExit()
  }

  const slides = [index - 1, index, index + 1]
  const transition = dragging ? 'none' : 'transform .35s cubic-bezier(.2,.8,.2,1)'

  return (
    <div className="app-shell">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={requestExit} aria-label="Back to workouts">
          &#8592;
        </button>
        <div className="topbar-title">
          <span className="topbar-name">{workout.name}</span>
        </div>
        <span className="topbar-counter">
          {index + 1} / {total}
        </span>
      </div>

      <div
        className="deck"
        ref={deckRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {slides.map((pos) => {
          if (pos < 0 || pos >= total) return null
          const ex = workout.exercises[pos]
          const offset = (pos - index) * 100
          return (
            <div
              key={ex.id}
              className="slide"
              style={{ transform: `translateX(calc(${offset}% + ${dragX}px))`, transition }}
              aria-hidden={pos !== index}
            >
              <ExerciseCard
                exercise={ex}
                log={logs[ex.id]}
                onSetField={(i, field, val) => setSetField(ex.id, i, field, val)}
                onToggleSetDone={(i) => toggleSetDone(ex.id, i)}
                onTick={(remaining) => patchLog(ex.id, { remaining })}
                onToggleRun={(running) => patchLog(ex.id, { running })}
                onReset={() =>
                  patchLog(ex.id, {
                    remaining: ex.type === 'hold' ? ex.duration : 0,
                    running: false,
                    done: false,
                  })
                }
                onMarkDone={(done) => patchLog(ex.id, { done, running: false })}
              />
              {pos === total - 1 && (
                <button type="button" className="finish-btn" onClick={finish}>
                  Finish workout
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="dots">
        {workout.exercises.map((ex, i) => (
          <span key={ex.id} className={`dot${i === index ? ' active' : ''}`} />
        ))}
      </div>

      {confirmExit && (
        <div className="sheet-backdrop" onClick={() => setConfirmExit(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-title">Save this session?</p>
            <p className="sheet-body">You’ve logged work in {workout.name}. Save it to your history before leaving?</p>
            <div className="sheet-actions">
              <button type="button" className="pill-ghost" onClick={discard}>
                Discard
              </button>
              <button type="button" className="pill-primary" onClick={finish}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
