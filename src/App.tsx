import { useState } from 'react'
import { HistoryScreen } from './screens/HistoryScreen'
import { HomeScreen } from './screens/HomeScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { findWorkout } from './data/workouts'

type Screen = { view: 'home' } | { view: 'workout'; id: string } | { view: 'history' }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ view: 'home' })

  const home = () => setScreen({ view: 'home' })
  const openWorkout = (id: string) => setScreen({ view: 'workout', id })
  const openHistory = () => setScreen({ view: 'history' })

  // A stale workout id (config edited between sessions) falls back to the list.
  const workout = screen.view === 'workout' ? findWorkout(screen.id) : undefined

  if (workout) return <WorkoutScreen workout={workout} onExit={home} />
  if (screen.view === 'history') return <HistoryScreen onBack={home} />
  return <HomeScreen onSelect={openWorkout} onHistory={openHistory} />
}
