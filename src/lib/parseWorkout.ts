import type { Exercise, ExerciseMedia, Workout } from '../types'

/**
 * Turns whatever the user pasted into a Workout.
 *
 * The guiding rule is that nothing is rejected for formatting. Plain text,
 * markdown headings, numbered or bulleted lists, tables, one-line-per-exercise,
 * and JSON all go in. Anything unrecognised becomes part of the form cue rather
 * than an error, and the caller shows a preview so the result can be eyeballed
 * before it's saved.
 */

export interface ParseResult {
  /** Usually one, but a paste can carry a whole set of workouts. */
  workouts: Workout[]
  errors: string[]
  warnings: string[]
}

/** Keeps generated ids distinct when several workouts are built in one tick. */
let idCounter = 0

/* ---------------- shared helpers ---------------- */

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'exercise'
  )
}

/** "Workout E" → E; otherwise the first letter of the name. */
function deriveLetter(name: string, explicit?: string): string {
  const letter =
    explicit || /workout\s+([a-z0-9])\b/i.exec(name)?.[1] || name.replace(/[^a-z0-9]/gi, '')[0] || '?'
  return letter.slice(0, 1).toUpperCase()
}

interface Header {
  name: string
  tag: string
  letter: string
  lowBack: boolean
  swapNote?: string
}

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
 * A YouTube link anywhere in a line — most pastes just drop the URL in rather
 * than labelling it `youtube:`, so it has to be recognised on sight.
 */
const YOUTUBE_URL =
  /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^\s&]*&)*v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})[^\s]*/i

const GIF_URL = /https?:\/\/\S+\.gif\b|\/\S+\.gif\b/i

/** A line left holding nothing but its key, e.g. "youtube:" after the URL was taken. */
const EMPTY_FIELD = /^[a-zЀ-ӿ_-]+\s*:\s*$/i

function parseMedia(value: string, kind: 'youtube' | 'gif'): ExerciseMedia | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (kind === 'gif') return { kind: 'gif', src: trimmed }
  // Accept a bare id or any of the usual YouTube URL shapes.
  const id = /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(trimmed)?.[1] ?? trimmed
  return /^[A-Za-z0-9_-]{6,}$/.test(id) ? { kind: 'youtube', id } : null
}

/** Builds the typed Exercise from a resolved spec. */
function buildExercise(
  base: { name: string; cue: string; cueUk?: string; media?: ExerciseMedia },
  spec: Spec,
): Exercise {
  const common = { ...base, id: slugify(base.name), rest: spec.rest }
  if (spec.type === 'strength') {
    return {
      ...common,
      type: 'strength',
      sets: spec.sets ?? 3,
      repTarget: spec.repTarget ?? 10,
      repRange: spec.repRange ?? String(spec.repTarget ?? 10),
      defaultWeight: spec.weight,
    }
  }
  if (spec.type === 'hold') {
    return { ...common, type: 'hold', duration: spec.duration ?? 30 }
  }
  return { ...common, type: 'cardio', duration: spec.duration }
}

/** Shared tail of both parsers: unique ids, then the finished workout. */
function assemble(header: Header, exercises: Exercise[], warnings: string[]): ParseResult {
  if (exercises.length === 0) {
    const named = header.name ? `"${header.name}" has no exercises.` : "Couldn't find any exercises in that."
    return { workouts: [], errors: [named], warnings }
  }

  // Ids must be unique within a workout — they key the logging state.
  const seen = new Map<string, number>()
  const unique = exercises.map((exercise) => {
    const count = seen.get(exercise.id) ?? 0
    seen.set(exercise.id, count + 1)
    return count === 0 ? exercise : { ...exercise, id: `${exercise.id}-${count + 1}` }
  })

  const name = header.name || 'Pasted workout'
  return {
    workouts: [
      {
        id: `${slugify(name)}-${Date.now().toString(36)}-${idCounter++}`,
        letter: header.letter || deriveLetter(name),
        name,
        tag: header.tag || 'Custom',
        lowBack: header.lowBack || undefined,
        swapNote: header.swapNote,
        exercises: unique,
      },
    ],
    errors: [],
    warnings,
  }
}

/** Folds per-workout results into one, keeping every workout that parsed. */
function combine(results: ParseResult[]): ParseResult {
  const workouts = results.flatMap((r) => r.workouts)
  const warnings = results.flatMap((r) => r.warnings)
  // Errors from individual workouts only matter when nothing at all came through.
  const errors = results.flatMap((r) => r.errors)
  if (workouts.length > 0) {
    return { workouts, warnings: [...warnings, ...errors], errors: [] }
  }
  return { workouts, warnings, errors: errors.length ? errors : ["Couldn't find any workouts in that."] }
}

/* ---------------- the spec line ---------------- */

/** Where a spec starts inside a longer line, e.g. "Goblet Squat 4x10". */
const SPEC_ANCHOR =
  /\b(\d+\s*(?:sets?|x|×|\*)\s*(?:of\s*)?\d|\d+\s*(?:-\s*\d+\s*)?reps?\b|\d+\s*(?:s|sec|secs|seconds|min|mins|minutes?)\b|amrap|bodyweight|to failure)/i

/**
 * Recognises a volume spec in many shapes: "4x8-10", "3 sets of 10",
 * "10 reps x 3 sets", "60s hold", "40s cardio", each with optional
 * "@ 20lb" and "rest 90s". Returns null when the line is prose.
 */
function parseSpec(line: string): Spec | null {
  const text = line.toLowerCase()

  const restMatch = /rest\s*:?\s*(\d+)/.exec(text) ?? /(\d+)\s*s(?:ec)?\s*rest/.exec(text)
  const rest = restMatch ? Number(restMatch[1]) : undefined

  const perSide = /\/\s*side|per\s*side|each\s*side|\be\/s\b/.test(text)
  const weightMatch =
    /@\s*(\d+(?:\.\d+)?)/.exec(text) ?? /(\d+(?:\.\d+)?)\s*(?:lb|lbs|kg|pounds?)\b/.exec(text)
  const bodyweight = /\bbody\s*weight\b|\bbw\b/.test(text)
  const weight = weightMatch ? Number(weightMatch[1]) : bodyweight ? 0 : undefined

  const hold = /(\d+)\s*(?:s|sec|secs|seconds|min|mins|minutes?)?\s*(?:-?\s*second)?\s*hold/.exec(text)
    ?? /hold\s*(?:for\s*)?(\d+)/.exec(text)
  const isCardio = /\bcardio\b|\bround\b|\bflow\b|\bwalk\b|\bcarry\b/.test(text)

  // "4 x 8-10", "4x8", "3 sets of 10", "3 sets x 12"
  const setsFirst = /(\d+)\s*(?:sets?\s*(?:of|x|×)?|[x×*])\s*(\d+)\s*(?:-\s*(\d+))?/.exec(text)
  // "10 reps x 3 sets", "8-10 reps, 3 sets"
  const repsFirst = /(\d+)\s*(?:-\s*(\d+))?\s*reps?\b[^.]*?(\d+)\s*sets?/.exec(text)
  // "3 sets to failure", "4 sets AMRAP"
  const openEnded = /(\d+)\s*sets?\b/.exec(text)
  const failure = /\bamrap\b|to failure|max reps?/.test(text)

  if (hold && !setsFirst && !repsFirst) {
    const value = Number(hold[1])
    return { type: 'hold', duration: /min/.test(hold[0]) ? value * 60 : value, rest }
  }

  if (setsFirst || repsFirst) {
    const [sets, low, high] = setsFirst
      ? [Number(setsFirst[1]), Number(setsFirst[2]), setsFirst[3] ? Number(setsFirst[3]) : undefined]
      : [Number(repsFirst![3]), Number(repsFirst![1]), repsFirst![2] ? Number(repsFirst![2]) : undefined]
    const range = high ? `${low}-${high}` : String(low)
    return {
      type: 'strength',
      sets,
      repTarget: low,
      repRange: perSide ? `${range} / side` : range,
      rest,
      weight,
    }
  }

  if (openEnded && failure) {
    return { type: 'strength', sets: Number(openEnded[1]), repTarget: 10, repRange: 'AMRAP', rest, weight }
  }

  // A bare duration: "45s", "2 min".
  const bare = /(?:^|\s)(\d+)\s*(s|sec|secs|seconds|min|mins|minutes?)\b/.exec(text)
  if (bare) {
    const value = Number(bare[1])
    const seconds = bare[2].startsWith('min') ? value * 60 : value
    return { type: isCardio ? 'cardio' : 'hold', duration: seconds, rest }
  }

  if (isCardio) return { type: 'cardio', rest }
  if (openEnded) return { type: 'strength', sets: Number(openEnded[1]), rest, weight }

  return null
}

/* ---------------- text ---------------- */

interface Line {
  text: string
  /** Started with a bullet, number, or heading marker at the left margin. */
  marked: boolean
  heading: boolean
  blankBefore: boolean
}

/** Cells of a markdown table's column-header row. */
const TABLE_HEADING =
  /^(#|exercise|movement|name|sets?|reps?|sets?\s*[x×/]\s*reps?|rest|weight|load|tempo|notes?|cue|type|duration|time)$/i

/** Field lines are always part of the exercise above them, never a new one. */
const CONTINUATION_FIELDS = [
  'cue',
  'note',
  'notes',
  'tip',
  'form',
  'ua',
  'uk',
  'укр',
  'ua-cue',
  'youtube',
  'yt',
  'video',
  'link',
  'gif',
  'image',
  'img',
]

/** Strips markdown so the classifier sees plain sentences. */
function normalize(raw: string): Line[] {
  const lines: Line[] = []
  let blankBefore = false

  for (const original of raw.split(/\r?\n/)) {
    let text = original.trim()

    if (!text) {
      blankBefore = true
      continue
    }

    // An indented line is a sub-item of the line above — a cue under a bullet,
    // not a new exercise — so its own bullet marker doesn't count.
    const indented = /^\s{2,}|\t/.test(original)
    // Horizontal rules and markdown table separators carry no content.
    if (/^[-=_*]{3,}$/.test(text) || /^\|?[\s:|-]+\|?$/.test(text)) continue

    // A table row becomes "cell — cell — cell". Each row is its own exercise,
    // and the column-header row carries no workout content.
    let tableRow = false
    if (text.startsWith('|') && text.endsWith('|')) {
      const cells = text
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
      if (cells.every((cell) => TABLE_HEADING.test(cell))) continue
      text = cells.join(' — ')
      tableRow = true
    }

    const heading = /^#{1,6}\s+/.test(text)
    const bullet = /^([-*•+]|\d+[.)])\s+/.test(text)
    text = text
      .replace(/^#{1,6}\s+/, '')
      .replace(/^([-*•+]|\d+[.)])\s+/, '')
      .replace(/\*\*|__|`/g, '')
      .trim()

    if (!text) continue
    lines.push({
      text,
      marked: tableRow || ((heading || bullet) && !indented),
      heading: heading && !indented,
      blankBefore: blankBefore && !indented,
    })
    blankBefore = false
  }

  return lines
}

/** Pulls `key: value` off a line, case-insensitively. */
function fieldValue(line: string, keys: string[]): string | null {
  const match = /^([a-zЀ-ӿ_-]+)\s*:\s*(.*)$/i.exec(line)
  if (!match) return null
  return keys.includes(match[1].toLowerCase()) ? match[2].trim() : null
}

/**
 * A short, title-like line with no sentence punctuation — the shape of an
 * exercise name rather than a cue.
 */
function looksLikeName(text: string): boolean {
  return (
    text.length <= 48 &&
    text.split(/\s+/).length <= 6 &&
    !/[.!?;]$/.test(text) &&
    !/https?:\/\//i.test(text) &&
    !fieldValue(text, ['cue', 'note', 'notes', 'tip', 'ua', 'uk', 'youtube', 'video', 'gif'])
  )
}

/** Splits "Goblet Squat — 4x10 @ 20lb — chest up" into its pieces. */
function splitHeadLine(text: string): { name: string; rest: string[] } {
  const parts = text
    .split(/\s*[—–|·]\s*|\s+-\s+|\s*:\s+(?=\d)/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length > 1) return { name: parts[0], rest: parts.slice(1) }

  // No separator — look for where a spec starts inside the line.
  const anchor = SPEC_ANCHOR.exec(text)
  if (anchor && anchor.index > 0) {
    return {
      name: text.slice(0, anchor.index).replace(/[,:(\-–—\s]+$/, '').trim(),
      rest: [text.slice(anchor.index).replace(/\)$/, '')],
    }
  }
  return { name: text, rest: [] }
}

interface Chunk {
  head: string
  body: string[]
}

/**
 * Groups lines into one chunk per exercise. Blank lines and list markers are
 * used when present; when they aren't, a short title-like line following a
 * spec is taken as the start of the next exercise.
 */
function chunkExercises(lines: Line[]): Chunk[] {
  const chunks: Chunk[] = []
  let current: Chunk | null = null
  let sawSpec = false

  for (const line of lines) {
    const isSpec = parseSpec(line.text) !== null
    // A line carrying a link belongs to the exercise above it — on its own it
    // reads like a short title, which would otherwise split the exercise in two.
    const isMedia = YOUTUBE_URL.test(line.text) || GIF_URL.test(line.text)
    const isField = fieldValue(line.text, CONTINUATION_FIELDS) !== null || isMedia

    // "Hip Flexor Stretch — 45s hold" is a name *and* a spec: once the current
    // exercise has its own spec, that shape means the next exercise has begun.
    const split = splitHeadLine(line.text)
    const nameThenSpec = split.rest.length > 0 && looksLikeName(split.name)

    const startsNew =
      !current ||
      (!isField &&
        (line.marked ||
          line.blankBefore ||
          (sawSpec && (nameThenSpec || (!isSpec && looksLikeName(line.text))))))

    if (startsNew) {
      current = { head: line.text, body: [] }
      chunks.push(current)
      sawSpec = isSpec || SPEC_ANCHOR.test(line.text)
      continue
    }

    current!.body.push(line.text)
    if (isSpec) sawSpec = true
  }

  return chunks
}

function parseHeaderLines(lines: Line[]): Header {
  let name = ''
  let tag = ''
  let letter = ''
  let lowBack = false
  let swapNote: string | undefined

  for (const { text } of lines) {
    const nameField = fieldValue(text, ['name', 'workout', 'title'])
    const tagField = fieldValue(text, ['tag', 'focus', 'subtitle'])
    const letterField = fieldValue(text, ['letter', 'badge'])
    const noteField = fieldValue(text, ['note', 'swapnote'])

    if (nameField !== null) name = nameField
    else if (tagField !== null) tag = tagField
    else if (letterField !== null) letter = letterField
    else if (noteField !== null) swapNote = noteField
    else if (/^low[-\s]?back\b/i.test(text) && !text.includes(':')) lowBack = true
    else if (!name) {
      const [head, ...rest] = text.split(/\s*[—–|:]\s*|\s+-\s+/)
      name = head.trim()
      if (rest.length) tag = rest.join(' - ').trim()
    }
  }

  if (/low[-\s]?back/i.test(tag)) lowBack = true
  return { name, tag, letter: deriveLetter(name, letter), lowBack, swapNote }
}

/**
 * Folds a stray fragment into a spec we already have — a table that puts rest
 * or weight in its own column, say. Returns false when the fragment is prose,
 * so it lands in the cue instead.
 */
function absorbExtraSpec(spec: Spec, line: string): boolean {
  const text = line.toLowerCase().trim()

  // A lone duration next to a sets/reps spec is the rest period.
  const lone = /^(\d+)\s*(s|sec|secs|seconds|min|mins|minutes?)?$/.exec(text)
  if (lone && spec.rest === undefined && spec.type === 'strength') {
    const value = Number(lone[1])
    spec.rest = lone[2]?.startsWith('min') ? value * 60 : value
    return true
  }

  const parsed = parseSpec(text)
  if (!parsed) return false

  let absorbed = false
  if (spec.rest === undefined && parsed.rest !== undefined) {
    spec.rest = parsed.rest
    absorbed = true
  }
  if (spec.weight === undefined && parsed.weight !== undefined) {
    spec.weight = parsed.weight
    absorbed = true
  }
  return absorbed
}

function chunkToExercise(chunk: Chunk, warnings: string[]): Exercise | null {
  const { name, rest } = splitHeadLine(chunk.head)
  if (!name) return null

  let spec: Spec | null = null
  const cueLines: string[] = []
  let cueUk: string | undefined
  let media: ExerciseMedia | undefined

  for (const original of [...rest, ...chunk.body]) {
    // Take any link out of the line first, labelled or not, so it becomes the
    // demo rather than ending up as cue text.
    let line = original
    const video = YOUTUBE_URL.exec(line)
    if (video) {
      media ??= { kind: 'youtube', id: video[1] }
      line = line.replace(YOUTUBE_URL, '').trim()
    } else {
      const gif = GIF_URL.exec(line)
      if (gif) {
        media ??= { kind: 'gif', src: gif[0] }
        line = line.replace(GIF_URL, '').trim()
      }
    }
    if (!line || EMPTY_FIELD.test(line)) continue

    const youtube = fieldValue(line, ['youtube', 'yt', 'video', 'link'])
    const gif = fieldValue(line, ['gif', 'image', 'img'])
    const uk = fieldValue(line, ['ua', 'uk', 'укр', 'ua-cue'])
    const cueField = fieldValue(line, ['cue', 'note', 'notes', 'tip', 'form'])

    if (youtube !== null) {
      const parsed = parseMedia(youtube, 'youtube')
      if (parsed) media = parsed
      else warnings.push(`${name}: couldn't read the video link "${youtube}".`)
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
    } else if (absorbExtraSpec(spec, line)) {
      // A leftover column, e.g. a table's separate Rest or Weight cell.
      continue
    }
    cueLines.push(line)
  }

  if (!spec) {
    warnings.push(`${name}: no sets or duration found — logged as a single "mark as done".`)
    spec = { type: 'cardio' }
  }

  if (!media) {
    const suspect = cueLines.find((line) => /youtu|vimeo|\.mp4\b/i.test(line))
    if (suspect && !warnings.some((w) => w.includes(suspect))) {
      warnings.push(`${name}: couldn't read a video id from "${suspect}".`)
    }
  }

  return buildExercise({ name, cue: cueLines.join(' ').trim(), cueUk, media }, spec)
}

/**
 * A line that plainly announces a workout. Deliberately narrow — splitting on
 * any heading would tear a workout apart whenever exercises are headings too.
 */
const WORKOUT_TITLE = /^(workout|day|session)\b\s*\S/i

function parseText(raw: string): ParseResult {
  const lines = normalize(raw)
  if (lines.length === 0) return { workouts: [], errors: ['Nothing to import yet.'], warnings: [] }

  // Several "Workout B …" titles means several workouts in one paste.
  const starts = lines.reduce<number[]>((acc, line, i) => {
    if (WORKOUT_TITLE.test(line.text)) acc.push(i)
    return acc
  }, [])

  if (starts.length > 1) {
    const bounds = starts[0] === 0 ? starts : [0, ...starts]
    return combine(
      bounds.map((start, i) => parseTextSingle(lines.slice(start, bounds[i + 1] ?? lines.length))),
    )
  }

  return parseTextSingle(lines)
}

function parseTextSingle(lines: Line[]): ParseResult {
  const warnings: string[] = []
  if (lines.length === 0) return { workouts: [], errors: ['Nothing to import yet.'], warnings }

  // The title is the leading heading, or the first line when it doesn't itself
  // look like an exercise. Otherwise the workout goes unnamed.
  const headerLines: Line[] = []
  let index = 0
  const first = lines[0]
  const firstIsExercise = SPEC_ANCHOR.test(first.text) && !first.heading

  if (!firstIsExercise) {
    headerLines.push(first)
    index = 1
    // Keep pulling header lines that directly follow the title — `key: value`
    // fields and the bare low-back marker, in any order.
    while (index < lines.length && !lines[index].blankBefore && !lines[index].marked) {
      const { text } = lines[index]
      const isField = fieldValue(text, ['letter', 'badge', 'tag', 'focus', 'note', 'swapnote']) !== null
      const isLowBack = /^low[-\s]?back\b/i.test(text) && !text.includes(':')
      if (!isField && !isLowBack) break
      headerLines.push(lines[index])
      index++
    }
  } else {
    warnings.push('No workout name found at the top — call it something in the first line.')
  }

  const header = parseHeaderLines(headerLines)
  const exercises = chunkExercises(lines.slice(index))
    .map((chunk) => chunkToExercise(chunk, warnings))
    .filter((exercise): exercise is Exercise => exercise !== null)

  return assemble(header, exercises, warnings)
}

/* ---------------- JSON ---------------- */

type Bag = Record<string, unknown>

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** First present key, searched case- and underscore-insensitively. */
function field(bag: Bag, names: string[]): unknown {
  const normalized = new Map(Object.keys(bag).map((key) => [key.toLowerCase().replace(/[_\s-]/g, ''), key]))
  for (const name of names) {
    const key = normalized.get(name.toLowerCase().replace(/[_\s-]/g, ''))
    if (key !== undefined && bag[key] !== null && bag[key] !== undefined) return bag[key]
  }
  return undefined
}

/** Every string anywhere inside a value, at any nesting depth. */
function deepStrings(value: unknown, out: string[] = [], depth = 0): string[] {
  if (depth > 6) return out
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) deepStrings(item, out, depth + 1)
  else if (isBag(value)) for (const item of Object.values(value)) deepStrings(item, out, depth + 1)
  return out
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const match = /-?\d+(?:\.\d+)?/.exec(value)
    if (match) return Number(match[0])
  }
  return undefined
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return undefined
}

/** Reps as a number, "8-10", [8,10], or {min,max}. */
function reps(value: unknown): { target?: number; range?: string } {
  if (typeof value === 'number') return { target: value, range: String(value) }
  if (Array.isArray(value)) {
    const low = num(value[0])
    const high = num(value[1])
    if (low !== undefined) return { target: low, range: high ? `${low}-${high}` : String(low) }
  }
  if (isBag(value)) {
    const low = num(field(value, ['min', 'low', 'from', 'target']))
    const high = num(field(value, ['max', 'high', 'to']))
    if (low !== undefined) return { target: low, range: high ? `${low}-${high}` : String(low) }
  }
  if (typeof value === 'string') {
    const low = num(value)
    if (low !== undefined) {
      const perSide = /side/i.test(value)
      const high = num(value.split(/\s*-\s*/)[1] ?? '')
      const range = high ? `${low}-${high}` : String(low)
      return { target: low, range: perSide ? `${range} / side` : range }
    }
    return { range: value.trim() }
  }
  return {}
}

function jsonExercise(value: unknown, warnings: string[]): Exercise | null {
  // A bare string is treated as a line of text, so ["Squat 4x10"] works.
  if (typeof value === 'string') {
    return chunkToExercise({ head: value, body: [] }, warnings)
  }
  if (!isBag(value)) return null

  const name = str(field(value, ['name', 'exercise', 'title', 'movement']))
  if (!name) return null

  const cue = (
    str(field(value, ['cue', 'note', 'notes', 'instruction', 'instructions', 'description', 'form', 'tip'])) ?? ''
  )
    .replace(YOUTUBE_URL, '')
    .trim()
  const cueUk = str(field(value, ['cueUk', 'ua', 'uk', 'ukrainian']))

  const mediaField = field(value, ['media'])
  let media: ExerciseMedia | undefined
  if (isBag(mediaField)) {
    const kind = str(field(mediaField, ['kind', 'type']))
    const src = str(field(mediaField, ['src', 'id', 'url', 'href']))
    if (src) media = parseMedia(src, kind === 'gif' ? 'gif' : 'youtube') ?? undefined
  } else if (typeof mediaField === 'string') {
    media = parseMedia(mediaField, /\.gif\b/i.test(mediaField) ? 'gif' : 'youtube') ?? undefined
  } else {
    const youtube = str(
      field(value, [
        'youtube', 'youtubeId', 'youtubeUrl', 'youtubeLink', 'video', 'videoId', 'videoUrl',
        'videoLink', 'demo', 'demoUrl', 'clip', 'url', 'link', 'href',
      ]),
    )
    const gif = str(field(value, ['gif', 'gifUrl', 'image', 'img', 'imageUrl']))
    if (gif) media = parseMedia(gif, 'gif') ?? undefined
    else if (youtube) {
      media = parseMedia(youtube, 'youtube') ?? undefined
      if (!media) warnings.push(`${name}: couldn't read the video link "${youtube}".`)
    }
  }

  // Last resort: a link anywhere in the entry, however deeply it's nested —
  // `"video": {"url": …}` and `"links": [ … ]` are both common shapes.
  if (!media) {
    const haystack = deepStrings(value).join(' ')
    const found = YOUTUBE_URL.exec(haystack)
    if (found) {
      media = { kind: 'youtube', id: found[1] }
    } else {
      const gifFound = GIF_URL.exec(haystack)
      if (gifFound) media = { kind: 'gif', src: gifFound[0] }
    }
  }

  // Say so when something video-shaped was there but unusable, rather than
  // silently showing "no demo" and leaving the reason a mystery.
  if (!media) {
    const suspect = deepStrings(value).find((s) => /youtu|vimeo|\.mp4\b/i.test(s))
    if (suspect && !warnings.some((w) => w.includes(suspect))) {
      warnings.push(`${name}: couldn't read a video id from "${suspect}".`)
    }
  }

  const rest = num(field(value, ['rest', 'restSeconds', 'restS', 'restTime']))
  const weight = num(field(value, ['defaultWeight', 'weight', 'load', 'lb', 'lbs', 'kg']))
  const duration = num(field(value, ['duration', 'seconds', 'durationSeconds', 'time', 'hold', 'holdSeconds']))

  const rawSets = field(value, ['sets', 'setCount'])
  const setsFromArray = Array.isArray(rawSets) ? rawSets.length : undefined
  const sets = setsFromArray ?? num(rawSets)
  const repSource =
    field(value, ['repTarget', 'reps', 'repRange', 'repetitions']) ??
    (Array.isArray(rawSets) && isBag(rawSets[0]) ? field(rawSets[0], ['reps', 'repTarget']) : undefined)
  const { target, range } = reps(repSource)

  const declared = str(field(value, ['type', 'kind', 'category']))?.toLowerCase() ?? ''
  let type: Exercise['type']
  if (/strength|weight|lift|resistance/.test(declared)) type = 'strength'
  else if (/hold|isometric|static|stretch|plank/.test(declared)) type = 'hold'
  else if (/cardio|round|flow|mobility|conditioning/.test(declared)) type = 'cardio'
  else if (sets !== undefined || target !== undefined) type = 'strength'
  else if (duration !== undefined) type = 'hold'
  else {
    warnings.push(`${name}: no sets or duration found — logged as a single "mark as done".`)
    type = 'cardio'
  }

  // A "strength" entry that only carries a duration is really a timed hold.
  if (type === 'strength' && sets === undefined && target === undefined && duration !== undefined) {
    type = 'hold'
  }

  return buildExercise(
    { name, cue, cueUk, media },
    { type, sets, repTarget: target, repRange: range, duration, rest, weight },
  )
}

function jsonWorkout(value: unknown, warnings: string[]): ParseResult {
  if (!isBag(value)) return { workouts: [], errors: ['Expected a workout object.'], warnings }

  const rawExercises = field(value, ['exercises', 'items', 'moves', 'movements', 'list', 'steps'])
  if (!Array.isArray(rawExercises)) {
    const named = str(field(value, ['name', 'title']))
    return {
      workouts: [],
      errors: [named ? `"${named}" has no "exercises" array.` : 'That JSON has no "exercises" array.'],
      warnings,
    }
  }

  const name = str(field(value, ['name', 'title', 'workout', 'workoutName'])) ?? ''
  const tag = str(field(value, ['tag', 'focus', 'subtitle', 'description'])) ?? ''
  const letter = str(field(value, ['letter', 'badge']))
  const lowBackField = field(value, ['lowBack', 'lowBackFriendly'])
  const header: Header = {
    name,
    tag,
    letter: deriveLetter(name, letter),
    lowBack: lowBackField === true || /low[-\s]?back/i.test(tag),
    swapNote: str(field(value, ['swapNote', 'note'])),
  }

  const exercises = rawExercises
    .map((entry) => jsonExercise(entry, warnings))
    .filter((exercise): exercise is Exercise => exercise !== null)

  return assemble(header, exercises, warnings)
}

function parseJson(text: string): ParseResult {
  const warnings: string[] = []
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {
      workouts: [],
      errors: ["That looks like JSON but it isn't valid — check for a missing comma or bracket."],
      warnings,
    }
  }

  // A whole backup file, or anything else wrapping a list of workouts.
  if (isBag(value)) {
    const list = field(value, ['workouts', 'plan', 'program', 'routine', 'days'])
    if (Array.isArray(list)) {
      return combine(list.map((entry) => jsonWorkout(entry, warnings)))
    }
    return jsonWorkout(value, warnings)
  }

  if (Array.isArray(value)) {
    // An array of workout objects — each has its own exercises.
    if (value.some((entry) => isBag(entry) && field(entry, ['exercises', 'items', 'moves', 'movements']))) {
      return combine(value.map((entry) => jsonWorkout(entry, warnings)))
    }

    // Otherwise a bare list of exercises: usable, it just has no name.
    const exercises = value
      .map((entry) => jsonExercise(entry, warnings))
      .filter((exercise): exercise is Exercise => exercise !== null)
    if (exercises.length > 0) {
      warnings.push('That JSON had no workout name — add a "name" field, or rename it after saving.')
      return assemble({ name: '', tag: '', letter: '', lowBack: false }, exercises, warnings)
    }
  }

  return { workouts: [], errors: ["That JSON doesn't look like a workout."], warnings }
}

/* ---------------- entry point ---------------- */

export function parseWorkout(text: string): ParseResult {
  const trimmed = text.trim()
  if (!trimmed) return { workouts: [], errors: ['Nothing to import yet.'], warnings: [] }
  const isJson = trimmed.startsWith('{') || trimmed.startsWith('[')
  return isJson ? parseJson(trimmed) : parseText(trimmed)
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
      ex.cue ? `cue: ${ex.cue}` : null,
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
