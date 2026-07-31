import { WORKOUTS } from '../data/workouts'
import type { Workout } from '../types'

interface Props {
  onSelect: (id: string) => void
  onHistory: () => void
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

export function HomeScreen({ onSelect, onHistory }: Props) {
  const main = WORKOUTS.filter((w) => !w.lowBack)
  const lowBack = WORKOUTS.filter((w) => w.lowBack)

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

          <div className="section-divider">
            <span>Low-back friendly (temporary)</span>
            <span className="line" />
          </div>

          {lowBack.map((w) => (
            <WorkoutCard key={w.id} workout={w} onClick={() => onSelect(w.id)} />
          ))}
        </div>

        <div className="home-footer">
          <button type="button" className="history-link" onClick={onHistory}>
            View history &#8594;
          </button>
        </div>
      </div>
    </div>
  )
}
