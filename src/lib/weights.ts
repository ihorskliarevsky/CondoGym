/**
 * The weight you last actually lifted for a movement, remembered across
 * sessions so the plan's starting figure stops being the suggestion once
 * you've corrected it.
 *
 * Keyed by exercise id, so the same movement in two workouts shares a memory.
 */
const KEY = 'condogym.weights.v1'

export type WeightMemory = Record<string, string>

export function loadWeights(): WeightMemory {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as WeightMemory) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Returns the updated map so callers can hold it in state. */
export function rememberWeight(exerciseId: string, weight: string): WeightMemory {
  const trimmed = weight.trim()
  if (!trimmed) return loadWeights()
  const next = { ...loadWeights(), [exerciseId]: trimmed }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Quota or private-mode failure — the value still applies this session.
  }
  return next
}

/** What to show in the empty weight field: what you last lifted, else the plan. */
export function weightHint(
  memory: WeightMemory,
  exerciseId: string,
  planned: number | undefined,
): number | undefined {
  const remembered = Number(memory[exerciseId])
  if (Number.isFinite(remembered)) return remembered
  return planned
}
