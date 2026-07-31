import type { Exercise, ExerciseMedia, Workout } from '../types'

/**
 * Turns pasted plain text into a Workout.
 *
 * The format is deliberately loose — it's meant to survive being typed by hand
 * or pasted out of a notes app. Blocks are separated by blank lines: the first
 * block names the workout, every block after it is one exercise.
 *
 *   Workout E — Push + Core
 *
 *   Dumbbell Bench Press
 *   4 x 8-10 @ 20lb, rest 90s
 *   Lower with control to chest level.
 *
 *   Plank
 *   60s hold
 *   Ribs down, glutes tight.
 *
 * An exercise can also be written on a single line with pipes:
 *
 *   Dumbbell Bench Press | 4x8-10 @ 20lb, rest 90s | Lower with control.
 */

export interface ParseResult {
  workout: Workout | null
  errors: string[]
  warnings: string[]
}

/* ---------------- helpers ---------------- */

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'exercise'
  )
}

/** Splits on blank lines, dropping comment lines and trailing whitespace. */
function toBlocks(text: string): string[][] {
  const blocks: string[][] = []
  let current: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('#') || line.startsWith('//')) continue
    if (!line) {
      if (current.length) blocks.push(current)
      current = []
      continue
    }
    current.push(line)
  }
  if (current.length) blocks.push(current)
  return blocks
}

/** Pulls `key: value` off a line, case-insensitively. */
function fieldValue(line: string, keys: string[]): string | null {
  const match = /^([a-zЀ-ӿ-]+)\s*:\s*(.*)$/i.exec(line)
  if (!match) return null
  return keys.includes(match[1].toLowerCase()) ? match[2].trim() : null
}

function parseMedia(value: string, kind: 'youtube' | 'gif'): ExerciseMedia | null {
  if (!value) return null
  if (kind === 'gif') return { kind: 'gif', src: value }
  // Accept a bare id or any of the usual YouTube URL shapes.
  const id = /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(value)?.[1] ?? value
  return /^[A-Za-z0-9_-]{6,}$/.test(id) ? { kind: 'youtube', id } : null
}

/* ---------------- the spec line ---------------- */

interface Spec {
  type: Exercise['type']
  sets?: number
  repTarget?: number
  repRange?: string
  duration?: number
  rest?: number
  weight?: number
}

/**
 * Recognises the "4 x 8-10 @ 20lb, rest 90s" line. Returns null for anything
 * that doesn't look like a spec, so prose falls through to the cue.
 */
function parseSpec(line: string): Spec | null {
  const text = line.toLowerCase()

  const rest = /rest\s*:?\s*(\d+)/.exec(text) ?? /(\d+)\s*s(?:ec)?\s*rest/.exec(text)
  const restSeconds = rest ? Number(rest[1]) : undefined

  // "3 x 10", "3x8-10", "3 × 10 / side"
  const setsReps = /(\d+)\s*[x×*]\s*(\d+)\s*(?:-\s*(\d+))?\s*(\/\s*side|per\s*side)?/.exec(text)
  const holdMatch =
    /(\d+)\s*(?:s|sec|secs|seconds)?\s*hold/.exec(text) ?? /hold\s*(?:for\s*)?(\d+)/.exec(text)
  const isCardio = /\bcardio\b|\bround\b|\bflow\b/.test(text)
  const bareSeconds = /^\s*(\d+)\s*(?:s|sec|secs|seconds|min|minutes?)\b/.exec(text)

  if (holdMatch) {
    return { type: 'hold', duration: Number(holdMatch[1]), rest: restSeconds }
  }

  if (setsReps) {
    const [, setsStr, lowStr, highStr, perSide] = setsReps
    const low = Number(lowStr)
    const range = highStr ? `${low}-${Number(highStr)}` : String(low)
    // Weight: "@ 20", "20lb", or an explicit bodyweight marker.
    const weightMatch = /@\s*(\d+(?:\.\d+)?)/.exec(text) ?? /(\d+(?:\.\d+)?)\s*(?:lb|lbs|kg)\b/.exec(text)
    const bodyweight = /\bbody\s*weight\b|\bbw\b/.test(text)
    return {
      type: 'strength',
      sets: Number(setsStr),
      repTarget: low,
      repRange: perSide ? `${range} / side` : range,
      rest: restSeconds,
      weight: weightMatch ? Number(weightMatch[1]) : bodyweight ? 0 : undefined,
    }
  }

  if (bareSeconds) {
    const value = Number(bareSeconds[1])
    const seconds = /min/.test(bareSeconds[0]) ? value * 60 : value
    return { type: isCardio ? 'cardio' : 'hold', duration: seconds, rest: restSeconds }
  }

  if (isCardio) return { type: 'cardio', rest: restSeconds }

  return null
}

/* ---------------- blocks ---------------- */

interface Header {
  name: string
  tag: string
  letter: string
  lowBack: boolean
  swapNote?: string
}

function parseHeader(lines: string[]): Header {
  let name = ''
  let tag = ''
  let letter = ''
  let lowBack = false
  let swapNote: string | undefined

  for (const line of lines) {
    const nameField = fieldValue(line, ['name', 'workout'])
    const tagField = fieldValue(line, ['tag', 'focus'])
    const letterField = fieldValue(line, ['letter', 'badge'])
    const noteField = fieldValue(line, ['note', 'swapnote'])

    if (nameField !== null) {
      name = nameField
      continue
    }
    if (tagField !== null) {
      tag = tagField
      continue
    }
    if (letterField !== null) {
      letter = letterField
      continue
    }
    if (noteField !== null) {
      swapNote = noteField
      continue
    }
    if (/^low[-\s]?back\b/i.test(line) && !line.includes(':')) {
      lowBack = true
      continue
    }
    if (!name) {
      // "Workout E — Push + Core" / "Workout E | Push + Core" / "Workout E - Push + Core"
      const [head, ...rest] = line.split(/\s*[—–|]\s*|\s+-\s+/)
      name = head.trim()
      if (rest.length) tag = rest.join(' - ').trim()
    }
  }

  if (/low[-\s]?back/i.test(tag)) lowBack = true
  if (!letter) {
    letter = (/workout\s+([a-z0-9])\b/i.exec(name)?.[1] ?? name.replace(/[^a-z0-9]/gi, '')[0] ?? '?')
  }

  return { name, tag, letter: letter.slice(0, 1).toUpperCase(), lowBack, swapNote }
}

function parseExercise(lines: string[], warnings: string[]): Exercise | null {
  // A single pipe-delimited line is expanded into the multi-line shape.
  const parts = lines.length === 1 && lines[0].includes('|') ? lines[0].split('|').map((p) => p.trim()) : lines

  const name = parts[0]?.replace(/^[-*•]\s*/, '').trim()
  if (!name) return null

  let spec: Spec | null = null
  const cueLines: string[] = []
  let cueUk: string | undefined
  let media: ExerciseMedia | undefined

  for (const line of parts.slice(1)) {
    const youtube = fieldValue(line, ['youtube', 'yt', 'video'])
    const gif = fieldValue(line, ['gif', 'image'])
    const uk = fieldValue(line, ['ua', 'uk', 'укр', 'ua-cue'])
    const cueField = fieldValue(line, ['cue', 'note'])

    if (youtube !== null) {
      const parsed = parseMedia(youtube, 'youtube')
      if (parsed) media = parsed
      else warnings.push(`${name}: couldn't read the YouTube link "${youtube}".`)
      continue
    }
    if (gif !== null) {
      media = parseMedia(gif, 'gif') ?? media
      continue
    }
    if (uk !== null) {
      cueUk = uk
      continue
    }
    if (cueField !== null) {
      cueLines.push(cueField)
      continue
    }
    if (!spec) {
      const parsed = parseSpec(line)
      if (parsed) {
        spec = parsed
        continue
      }
    }
    cueLines.push(line)
  }

  const cue = cueLines.join(' ').trim()

  if (!spec) {
    warnings.push(`${name}: no sets or duration found — logged as a single "mark as done".`)
    spec = { type: 'cardio' }
  }

  const base = { id: slugify(name), name, cue, cueUk, media, rest: spec.rest }

  if (spec.type === 'strength') {
    return {
      ...base,
      type: 'strength',
      sets: spec.sets ?? 3,
      repTarget: spec.repTarget ?? 10,
      repRange: spec.repRange ?? String(spec.repTarget ?? 10),
      defaultWeight: spec.weight,
    }
  }
  if (spec.type === 'hold') {
    return { ...base, type: 'hold', duration: spec.duration ?? 30 }
  }
  return { ...base, type: 'cardio', duration: spec.duration }
}

/* ---------------- entry point ---------------- */

export function parseWorkout(text: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const blocks = toBlocks(text)

  if (blocks.length === 0) return { workout: null, errors: ['Nothing to import yet.'], warnings }
  if (blocks.length === 1) {
    return {
      workout: null,
      errors: ['Add a blank line after the workout name, then one block per exercise.'],
      warnings,
    }
  }

  const header = parseHeader(blocks[0])
  if (!header.name) errors.push('The first block needs a workout name.')

  const exercises: Exercise[] = []
  const seen = new Map<string, number>()

  for (const block of blocks.slice(1)) {
    const exercise = parseExercise(block, warnings)
    if (!exercise) continue
    // Ids must be unique within a workout — they key the logging state.
    const count = seen.get(exercise.id) ?? 0
    seen.set(exercise.id, count + 1)
    exercises.push(count === 0 ? exercise : { ...exercise, id: `${exercise.id}-${count + 1}` })
  }

  if (exercises.length === 0) errors.push('No exercises found.')
  if (errors.length) return { workout: null, errors, warnings }

  return {
    workout: {
      id: `${slugify(header.name)}-${Date.now().toString(36)}`,
      letter: header.letter,
      name: header.name,
      tag: header.tag || 'Custom',
      lowBack: header.lowBack || undefined,
      swapNote: header.swapNote,
      exercises,
    },
    errors,
    warnings,
  }
}

/**
 * The inverse of `parseWorkout`, so an existing workout can be edited as text
 * and re-parsed. Round-trips: the output is valid input.
 */
export function workoutToText(workout: Workout): string {
  const header = [
    workout.tag ? `${workout.name} — ${workout.tag}` : workout.name,
    `letter: ${workout.letter}`,
    workout.lowBack ? 'low-back' : null,
    workout.swapNote ? `note: ${workout.swapNote}` : null,
  ].filter(Boolean)

  const blocks = workout.exercises.map((ex) => {
    const spec: string[] = []
    if (ex.type === 'strength') {
      spec.push(`${ex.sets} x ${ex.repRange}`)
      if (ex.defaultWeight !== undefined) spec.push(`@ ${ex.defaultWeight}lb`)
    } else if (ex.type === 'hold') {
      spec.push(`${ex.duration}s hold`)
    } else {
      spec.push(ex.duration ? `${ex.duration}s cardio` : 'cardio')
    }
    if (ex.rest !== undefined) spec.push(`rest ${ex.rest}s`)

    return [
      ex.name,
      spec.join(' '),
      ex.cue,
      ex.cueUk ? `ua: ${ex.cueUk}` : null,
      ex.media?.kind === 'youtube' ? `youtube: ${ex.media.id}` : null,
      ex.media?.kind === 'gif' ? `gif: ${ex.media.src}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [header.join('\n'), ...blocks].join('\n\n')
}

/** Shown in the import screen as a starting point. */
export const EXAMPLE_TEXT = `Workout E — Push + Core

Dumbbell Bench Press
4 x 8-10 @ 20lb, rest 90s
Lower with control to chest level, drive up without locking elbows hard.

Seated Dumbbell Press
3 x 8 @ 10lb, rest 90s
Back supported, press straight overhead.

Plank
60s hold
Ribs down, glutes tight, straight line from shoulders to heels.

Cat-Cow Flow
60s cardio
Slow continuous flow between arch and round.`
