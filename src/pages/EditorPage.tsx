import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CanvasViewport } from '../components/canvas/CanvasViewport'
import { PlayModeController } from '../components/canvas/PlayModeController'
import { SidebarLeft } from '../components/layout/SidebarLeft'
import { SidebarRight } from '../components/layout/SidebarRight'
import { Toolbar } from '../components/layout/Toolbar'
import { useEditorStore } from '../store'
import { db } from '../lib/db'

export function EditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isPlayMode = useEditorStore((state) => state.isPlayMode)
  const setProjectId = useEditorStore((state) => state.setProjectId)
  const importPresentation = useEditorStore((state) => state.importPresentation)

  useEffect(() => {
    async function loadProject() {
      if (!id) {
        navigate('/')
        return
      }

      const project = await db.projects.get(id)
      if (project) {
        setProjectId(id)
        importPresentation(project)
      } else {
        // Project not found
        navigate('/')
      }
    }

    loadProject()
  }, [id, setProjectId, importPresentation, navigate])

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
