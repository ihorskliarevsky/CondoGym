import { useState } from 'react'
import type { ExerciseMedia } from '../types'

interface Props {
  title: string
  media?: ExerciseMedia
}

/**
 * The demo visual. Collapsed it's a small square thumb beside the exercise
 * name; tapping expands it to a 16:9 panel. GIFs loop in place; a YouTube clip
 * only loads its iframe once expanded, so swiping the deck doesn't pull an
 * embed for every exercise.
 */
export function ExerciseDemo({ title, media }: Props) {
  const [expanded, setExpanded] = useState(false)
  const playingVideo = media?.kind === 'youtube' && expanded

  return (
    <div className={`demo ${expanded ? 'demo-expanded' : 'demo-collapsed'}`}>
      {media?.kind === 'gif' && <img className="demo-media" src={media.src} alt={`${title} demo`} />}

      {playingVideo && (
        <iframe
          className="demo-media"
          src={`https://www.youtube-nocookie.com/embed/${media.id}?rel=0&modestbranding=1`}
          title={`${title} demo`}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}

      {/* Once a real player owns the frame it takes the taps; until then the
          whole tile is the expand/collapse control. */}
      {playingVideo ? (
        <button type="button" className="demo-collapse" onClick={() => setExpanded(false)} aria-label="Collapse demo">
          &times;
        </button>
      ) : (
        <button
          type="button"
          className="demo-toggle"
          aria-label={expanded ? `Collapse ${title} demo` : `Expand ${title} demo`}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {!media || media.kind === 'youtube' ? <span className="play-btn">&#9658;</span> : null}
          {expanded && (
            <span className="demo-label">
              {media?.kind === 'gif' ? 'Demo' : 'YouTube demo'} &middot; {title}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
