import type { SelectionRect } from '../../lib/selection'
import { resolveSlideBackground } from '../../lib/presentation'
import { useEditorStore } from '../../store'
import { EditorBlock } from '../editor/EditorBlock'
import { SlideBackground } from './SlideBackground'
import { getBlockAnimations, getMoveActionPath } from '../../lib/animations'
import { useState, useEffect } from 'react'

type SlideFrameProps = {
  slideId: string | null
  interactive: boolean
  marqueeRect?: SelectionRect | null
}

function ActionPathVisualizer({ slideId, blockId, activeActionId }: { slideId: string, blockId: string, activeActionId: string | null }) {
  const { slides, camZoom, updateBlockAnimation, setActiveActionId } = useEditorStore()
  const slide = slides.find(s => s.id === slideId)
  const block = slide?.blocks.find(b => b.id === blockId)
  const animations = block ? getBlockAnimations(block) : null

  const [isDragging, setIsDragging] = useState<{ id: string, startToX: number, startToY: number, startMouseX: number, startMouseY: number } | null>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const dx = (e.clientX - isDragging.startMouseX) / camZoom
      const dy = (e.clientY - isDragging.startMouseY) / camZoom

      updateBlockAnimation(slideId, blockId, 'action', {
        config: { toX: isDragging.startToX + dx, toY: isDragging.startToY + dy }
      }, isDragging.id)
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, camZoom, slideId, blockId, updateBlockAnimation])

  if (!block || !animations) return null

  const moveActions = animations.action.filter(a => a.effect === 'move')
  if (moveActions.length === 0) return null

  return (
    <div className="action-path-overlay" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 1000 }}>
      <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orientation="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
          <marker id="arrowhead-inactive" markerWidth="8" markerHeight="6" refX="7" refY="3" orientation="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>
        {moveActions.map((action) => {
          const isActive = action.id === activeActionId
          if (!isActive) return null
          const path = getMoveActionPath(animations.action, action.id)
          if (!path) return null

          const centerX = block.width / 2
          const centerY = block.height / 2
          const startX = block.x + centerX + path.start.x
          const startY = block.y + centerY + path.start.y
          const endX = block.x + centerX + path.end.x
          const endY = block.y + centerY + path.end.y

          return (
            <g key={action.id}>
              <line
                x1={startX} y1={startY}
                x2={endX} y2={endY}
                stroke="#3b82f6"
                strokeWidth="2.5"
                markerEnd="url(#arrowhead-active)"
              />
              <circle cx={startX} cy={startY} r="4" fill="#3b82f6" />
              <circle cx={endX} cy={endY} r="6" fill="white" stroke="#3b82f6" strokeWidth="2" />
            </g>
          )
        })}
      </svg>

      {moveActions.map((action) => {
        const isActive = action.id === activeActionId
        if (!isActive) return null
        const path = getMoveActionPath(animations.action, action.id)
        if (!path) return null

        return (
          <div
            key={action.id}
            style={{
              position: 'absolute',
              left: block.x + path.end.x,
              top: block.y + path.end.y,
              width: block.width,
              height: block.height,
              transform: `rotate(${block.rotation}deg)`,
              opacity: 0.4,
              border: '2.5px solid #3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'auto',
              cursor: 'move',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: block.appearance.radius,
              zIndex: 2
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              setActiveActionId(action.id)
              setIsDragging({
                id: action.id,
                startToX: path.end.x,
                startToY: path.end.y,
                startMouseX: e.clientX,
                startMouseY: e.clientY
              })
            }}
          >
            <div style={{
              position: 'absolute',
              top: -32,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              fontSize: 11,
              fontWeight: 'bold',
              background: '#3b82f6',
              padding: '4px 12px',
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
              whiteSpace: 'nowrap'
            }}>
              动作终点 {path.end.x !== 0 || path.end.y !== 0 ? `(${Math.round(path.end.x)}, ${Math.round(path.end.y)})` : ''}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function SlideFrame({ slideId, interactive, marqueeRect = null }: SlideFrameProps) {
  const { slides, theme, showGuides, showGrid, isPlayMode, activeBlockId, activeActionId } = useEditorStore()
  const slide = slides.find((item) => item.id === slideId) ?? null
  const background = resolveSlideBackground(theme, slide?.bg ?? 'theme')

  return (
    <div
      id={interactive ? 'slideFrame' : undefined}
      className={`slide-frame ${interactive ? 'is-interactive' : 'is-thumbnail'}`}
      data-bg={background}
      data-theme={theme}
    >
      <SlideBackground theme={theme} bg={background} />

      {interactive && showGrid && !isPlayMode && (
        <div className="slide-grid" aria-hidden="true" />
      )}

      {interactive && showGuides && !isPlayMode && (
        <div className="slide-guides" aria-hidden="true">
          <span className="guide guide--vertical" />
          <span className="guide guide--horizontal" />
          <span className="safe-area" />
        </div>
      )}

      {/* Container for dynamic alignment guides */}
      {interactive && !isPlayMode && (
        <div id="dynamic-guides" className="dynamic-guides" aria-hidden="true" />
      )}
      <div
        id={interactive ? 'slideContent' : undefined}
        className="slide-content"
        key={interactive ? `${isPlayMode ? 'play' : 'edit'}-${slideId ?? 'none'}` : `thumb-${slideId ?? 'none'}`}
      >
        {slide?.blocks.map((block) => (
          <EditorBlock
            key={block.id}
            block={block}
            slideId={slide.id}
            interactive={interactive}
          />
        ))}

        {interactive && slideId && activeBlockId && (
          <ActionPathVisualizer slideId={slideId} blockId={activeBlockId} activeActionId={activeActionId} />
        )}

        {interactive && marqueeRect && (
          <div
            className="selection-marquee"
            style={{
              left: `${marqueeRect.x}px`,
              top: `${marqueeRect.y}px`,
              width: `${marqueeRect.width}px`,
              height: `${marqueeRect.height}px`,
            }}
          />
        )}
      </div>

      {interactive && (
        <div className="transition-layer" id="transitionLayer">
          <div className="transition-orb" />
        </div>
      )}
    </div>
  )
}
