import { useState } from 'react'
import { HistoryScreen } from './screens/HistoryScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ImportScreen } from './screens/ImportScreen'
import { ManageScreen } from './screens/ManageScreen'
import { WorkoutScreen } from './screens/WorkoutScreen'
import { addWorkout, loadLibrary, replaceWorkout } from './lib/library'
import { workoutToText } from './lib/parseWorkout'
import type { Workout } from './types'

type Screen =
  | { view: 'home' }
  | { view: 'workout'; id: string }
  | { view: 'history' }
  | { view: 'manage' }
  | { view: 'import'; editing?: Workout }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ view: 'home' })
  const [library, setLibrary] = useState<Workout[]>(() => loadLibrary())

  const home = () => setScreen({ view: 'home' })
  const manage = () => setScreen({ view: 'manage' })

  const homeScreen = (
    <HomeScreen
      library={library}
      onSelect={(id) => setScreen({ view: 'workout', id })}
      onHistory={() => setScreen({ view: 'history' })}
      onManage={manage}
    />
  )

  switch (screen.view) {
    case 'workout': {
      // A stale id (the workout was deleted mid-flight) falls back to the list.
      const workout = library.find((w) => w.id === screen.id)
      return workout ? <WorkoutScreen workout={workout} onExit={home} /> : homeScreen
    }

    case 'history':
      return <HistoryScreen onBack={home} />

    case 'manage':
      return (
        <ManageScreen
          library={library}
          onLibraryChange={setLibrary}
          onAdd={() => setScreen({ view: 'import' })}
          onEdit={(workout) => setScreen({ view: 'import', editing: workout })}
          onBack={home}
        />
      )

    case 'import': {
      const editing = screen.editing
      return (
        <ImportScreen
          initialText={editing ? workoutToText(editing) : undefined}
          editingName={editing?.name}
          onCancel={manage}
          onSave={(workout) => {
            setLibrary(editing ? replaceWorkout(editing.id, workout) : addWorkout(workout))
            manage()
          }}
        />
      )
    }

    default:
      return homeScreen
  }
}
