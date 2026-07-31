import { useState } from 'react'
import type { ExerciseMedia } from '../types'

interface Props {
  title: string
  media?: ExerciseMedia
}

/**
 * Drawn rather than typed: the ▶ character falls back to a different font on
 * iOS and comes out distorted.
 */
function PlayIcon() {
  return (
    <svg className="play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 6.2a1 1 0 0 1 1.53-.85l8.1 5.8a1 1 0 0 1 0 1.7l-8.1 5.8A1 1 0 0 1 9 17.8V6.2z" />
    </svg>
  )
}

/** YouTube's own still for a video — used as the poster so the tile isn't blank. */
function posterUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

function searchUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} form`)}`
}

/**
 * The demo visual. Collapsed it's a small square thumb beside the exercise
 * name; tapping expands it. A YouTube clip shows its poster frame and starts
 * playing on that same tap, so watching a movement is one touch. A GIF loops in
 * place. With nothing configured the tile says so and offers a search instead
 * of miming a player that can't play anything.
 */
export function ExerciseDemo({ title, media }: Props) {
  const [expanded, setExpanded] = useState(false)

  const collapse = () => setExpanded(false)
  const shellClass = `demo ${expanded ? 'demo-expanded' : 'demo-collapsed'}`

  if (media?.kind === 'youtube') {
    return (
      <div className={shellClass}>
        {expanded ? (
          <>
            <iframe
              className="demo-media"
              // A tap opened this, so autoplay is allowed.
              src={`https://www.youtube-nocookie.com/embed/${media.id}?rel=0&modestbranding=1&playsinline=1&autoplay=1`}
              title={`${title} demo`}
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button type="button" className="demo-collapse" onClick={collapse} aria-label="Close demo">
              &times;
            </button>
          </>
        ) : (
          <button
            type="button"
            className="demo-toggle"
            aria-label={`Play ${title} demo`}
            onClick={() => setExpanded(true)}
          >
            <img className="demo-media" src={posterUrl(media.id)} alt="" />
            <span className="play-btn">
              <PlayIcon />
            </span>
          </button>
        )}
      </div>
    )
  }

  if (media?.kind === 'gif') {
    return (
      <div className={shellClass}>
        <button
          type="button"
          className="demo-toggle"
          aria-label={expanded ? `Shrink ${title} demo` : `Enlarge ${title} demo`}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <img className="demo-media" src={media.src} alt={`${title} demo`} />
          {expanded && <span className="demo-label">{title}</span>}
        </button>
      </div>
    )
  }

  // Nothing configured for this exercise.
  return (
    <div className={`${shellClass} demo-empty`}>
      <button
        type="button"
        className="demo-toggle"
        aria-label={expanded ? 'Hide demo options' : 'No demo saved — show options'}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <span className="demo-empty-body">
            <span className="demo-empty-title">No demo saved</span>
            <span className="demo-empty-hint">
              Add one by editing this workout with a <code>youtube:</code> line.
            </span>
          </span>
        ) : (
          <span className="demo-empty-mark">
            <PlayIcon />
          </span>
        )}
      </button>
      {expanded && (
        <a
          className="demo-search"
          href={searchUrl(title)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          Search YouTube →
        </a>
      )}
    </div>
  )
}
