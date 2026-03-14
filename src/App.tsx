import { CanvasViewport } from './components/canvas/CanvasViewport'
import { PlayModeController } from './components/canvas/PlayModeController'
import { SidebarLeft } from './components/layout/SidebarLeft'
import { SidebarRight } from './components/layout/SidebarRight'
import { Toolbar } from './components/layout/Toolbar'
import { useEditorStore } from './store'

function App() {
  const isPlayMode = useEditorStore((state) => state.isPlayMode)

  return (
    <>
      <PlayModeController />
      {!isPlayMode && <Toolbar />}
      <div className={`workspace ${isPlayMode ? 'workspace--play' : ''}`}>
        {!isPlayMode && <SidebarLeft />}
        <CanvasViewport />
        {!isPlayMode && <SidebarRight />}
      </div>
    </>
  )
}

export default App
