import type { Workout } from '../types'

interface Props {
  library: Workout[]
  onSelect: (id: string) => void
  onHistory: () => void
  onManage: () => void
}

function WorkoutCard({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  return (
    <button type="button" className="workout-card" onClick={onClick}>
      <div className="badge">{workout.letter}</div>
      <div className="card-text">
        <span className="card-name">{workout.name}</span>
        <span className="card-tag">{workout.tag}</span>
      </div>
      <span className="chevron" aria-hidden="true">
        &#8250;
      </span>
    </button>
  )
}

export function HomeScreen({ library, onSelect, onHistory, onManage }: Props) {
  const main = library.filter((w) => !w.lowBack)
  const lowBack = library.filter((w) => w.lowBack)

  return (
    <div className="app-shell">
      <div className="home">
        <div className="home-header">
          <h1 className="display home-title">CONDO GYM</h1>
          <p className="home-sub">Pick today’s session</p>
        </div>

        <div className="home-list">
          {main.map((w) => (
            <WorkoutCard key={w.id} workout={w} onClick={() => onSelect(w.id)} />
          ))}

          {lowBack.length > 0 && (
            <div className="section-divider">
              <span>Low-back friendly (temporary)</span>
              <span className="line" />
            </div>
          )}

          {lowBack.map((w) => (
            <WorkoutCard key={w.id} workout={w} onClick={() => onSelect(w.id)} />
          ))}

          {library.length === 0 && (
            <p className="history-empty">No workouts yet. Add one from Manage below.</p>
          )}
        </div>

        <div className="home-footer">
          <button type="button" className="history-link" onClick={onManage}>
            Manage
          </button>
          <button type="button" className="history-link" onClick={onHistory}>
            View history &#8594;
          </button>
        </div>
      </div>
    </div>
  )
}
