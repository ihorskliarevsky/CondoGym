import { useEffect, useMemo, useRef, useState } from 'react'
import { ExerciseCard } from '../components/ExerciseCard'
import { hasProgress, initLogs, reconcileLogs, toSession } from '../lib/logs'
import { clearDraft, loadDraft, saveDraft, saveSession } from '../lib/storage'
import { loadWeights, rememberWeight, weightHint } from '../lib/weights'
import type { Exercise, HoldRound, Workout, WorkoutLogs } from '../types'

interface Props {
  workout: Workout
  onExit: () => void
}

/** Fraction of the deck width a drag must cover to flip to the next card. */
const SWIPE_THRESHOLD = 0.2
/** Past this, a gesture is a vertical scroll and not a card swipe. */
const SWIPE_SLOP = 10

/** One card in the deck: an exercise, and which round of it this card logs. */
interface Step {
  exercise: Exercise
  round: number
}

/**
 * The order the workout is actually performed in. A plain exercise is one card.
 * A circuit is walked round-robin — one set of each exercise, then the group
 * again — so it contributes `rounds × members` cards.
 */
function buildSteps(workout: Workout): Step[] {
  const steps: Step[] = []
  let i = 0
  while (i < workout.exercises.length) {
    const circuit = workout.exercises[i].circuit
    if (!circuit) {
      steps.push({ exercise: workout.exercises[i], round: 0 })
      i++
      continue
    }
    const group: Exercise[] = []
    while (i < workout.exercises.length && workout.exercises[i].circuit?.id === circuit.id) {
      group.push(workout.exercises[i])
      i++
    }
    for (let round = 0; round < circuit.rounds; round++) {
      for (const exercise of group) steps.push({ exercise, round })
    }
  }
  return steps
}

export function WorkoutScreen({ workout, onExit }: Props) {
  const [logs, setLogs] = useState<WorkoutLogs>(() => {
    const draft = loadDraft(workout.id)
    return draft ? reconcileLogs(workout, draft.logs) : initLogs(workout)
  })
  const steps = useMemo(() => buildSteps(workout), [workout])
  const [index, setIndex] = useState(() => {
    const draft = loadDraft(workout.id)
    return draft && draft.index < steps.length ? draft.index : 0
  })
  const [confirmExit, setConfirmExit] = useState(false)
  // What you last lifted for each movement, which outranks the plan's figure.
  const [weights, setWeights] = useState(() => loadWeights())

  const total = steps.length
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
      // Editing a set carries the number forward into every later set that
      // hasn't been logged yet — the usual case is repeating the same figure.
      for (let j = i + 1; j < sets.length; j++) {
        if (!sets[j].done) sets[j] = { ...sets[j], [field]: value }
      }
      return { ...prev, [exId]: { ...log, sets } }
    })
  }

  function toggleSetDone(exId: string, i: number) {
    const exercise = workout.exercises.find((ex) => ex.id === exId)
    const planned = exercise?.type === 'strength' ? exercise.defaultWeight : undefined
    const hint = weightHint(weights, exId, planned)

    setLogs((prev) => {
      const log = prev[exId]
      if (log.type !== 'strength') return prev
      const sets = log.sets.map((s, idx) => {
        if (idx !== i) return s
        const done = !s.done
        // Checking off a set with the weight blank logs whatever the placeholder
        // was showing — last time's weight, or the plan's starting figure.
        const takeHint = done && !s.weight.trim() && hint !== undefined
        const weight = takeHint ? String(hint) : s.weight
        // Completing a set is the signal that this weight is the real one, so
        // it becomes the default the next time this movement comes round.
        if (done && weight.trim()) setWeights(rememberWeight(exId, weight))
        return { ...s, done, weight }
      })
      return { ...prev, [exId]: { ...log, sets } }
    })
  }

  function patchHold(exId: string, round: number, patch: Partial<HoldRound>) {
    setLogs((prev) => {
      const log = prev[exId]
      if (log.type !== 'hold') return prev
      const rounds = log.rounds.map((r, idx) => (idx === round ? { ...r, ...patch } : r))
      return { ...prev, [exId]: { ...log, rounds } }
    })
  }

  function setCardioDone(exId: string, round: number, done: boolean) {
    setLogs((prev) => {
      const log = prev[exId]
      if (log.type !== 'cardio') return prev
      const rounds = log.rounds.map((r, idx) => (idx === round ? done : r))
      return { ...prev, [exId]: { ...log, rounds } }
    })
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
          const { exercise: ex, round } = steps[pos]
          const offset = (pos - index) * 100
          return (
            <div
              key={`${ex.id}-${round}`}
              className="slide"
              style={{ transform: `translateX(calc(${offset}% + ${dragX}px))`, transition }}
              aria-hidden={pos !== index}
            >
              <ExerciseCard
                exercise={ex}
                log={logs[ex.id]}
                round={round}
                weightHint={weightHint(
                  weights,
                  ex.id,
                  ex.type === 'strength' ? ex.defaultWeight : undefined,
                )}
                onSetField={(i, field, val) => setSetField(ex.id, i, field, val)}
                onToggleSetDone={(i) => toggleSetDone(ex.id, i)}
                onTick={(remaining) => patchHold(ex.id, round, { remaining })}
                onToggleRun={(running) => patchHold(ex.id, round, { running })}
                onReset={() =>
                  patchHold(ex.id, round, {
                    remaining: ex.type === 'hold' ? ex.duration : 0,
                    running: false,
                    done: false,
                  })
                }
                onMarkDone={(done) =>
                  ex.type === 'cardio'
                    ? setCardioDone(ex.id, round, done)
                    : patchHold(ex.id, round, { done, running: false })
                }
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
        {steps.map((step, i) => (
          <span
            key={`${step.exercise.id}-${step.round}`}
            className={`dot${i === index ? ' active' : ''}`}
          />
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
