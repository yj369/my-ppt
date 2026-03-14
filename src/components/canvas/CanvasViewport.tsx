import type { DragEvent, MouseEvent, WheelEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../../lib/presentation'
import { useEditorStore } from '../../store'
import type { ElementType } from '../../types/editor'
import { SlideFrame } from './SlideFrame'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

export function CanvasViewport() {
  const {
    camX,
    camY,
    camZoom,
    setCam,
    isPlayMode,
    showGrid,
    currentSlideId,
    activeBlockId,
    insertBlock,
    updateBlock,
    deleteBlock,
    duplicateBlock,
    duplicateSlide,
    togglePlayMode,
    setActiveBlock,
  } = useEditorStore()

  const viewportRef = useRef<HTMLElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [camStart, setCamStart] = useState({ x: 0, y: 0 })

  const fitCanvasCenter = () => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const viewportWidth = viewport.clientWidth
    const viewportHeight = viewport.clientHeight
    const zoom = Math.min((viewportWidth - 120) / SLIDE_WIDTH, (viewportHeight - 120) / SLIDE_HEIGHT)
    const x = (viewportWidth - SLIDE_WIDTH * zoom) / 2
    const y = (viewportHeight - SLIDE_HEIGHT * zoom) / 2
    setCam(x, y, zoom)
  }

  useEffect(() => {
    fitCanvasCenter()

    const handleResize = () => {
      if (isPlayMode) {
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const zoom = Math.min(viewportWidth / SLIDE_WIDTH, viewportHeight / SLIDE_HEIGHT)
        setCam(
          (viewportWidth - SLIDE_WIDTH * zoom) / 2,
          (viewportHeight - SLIDE_HEIGHT * zoom) / 2,
          zoom,
        )
        return
      }

      fitCanvasCenter()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlayMode])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isPlayMode && !isTypingTarget(event.target)) {
        setSpacePressed(true)
      }

      if (isPlayMode || isTypingTarget(event.target)) {
        return
      }

      const state = useEditorStore.getState()
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'enter') {
        event.preventDefault()
        togglePlayMode(true)
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault()
        if (state.currentSlideId && state.activeBlockId) {
          duplicateBlock(state.currentSlideId, state.activeBlockId)
        } else if (state.currentSlideId) {
          duplicateSlide(state.currentSlideId)
        }
        return
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && state.currentSlideId && state.activeBlockId) {
        event.preventDefault()
        deleteBlock(state.currentSlideId, state.activeBlockId)
        return
      }

      if (!state.currentSlideId || !state.activeBlockId) {
        return
      }

      const currentSlide = state.slides.find((slide) => slide.id === state.currentSlideId)
      const activeBlock = currentSlide?.blocks.find((block) => block.id === state.activeBlockId)
      if (!activeBlock || activeBlock.locked) {
        return
      }

      const distance = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        updateBlock(state.currentSlideId, state.activeBlockId, { y: activeBlock.y - distance })
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        updateBlock(state.currentSlideId, state.activeBlockId, { y: activeBlock.y + distance })
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        updateBlock(state.currentSlideId, state.activeBlockId, { x: activeBlock.x - distance })
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        updateBlock(state.currentSlideId, state.activeBlockId, { x: activeBlock.x + distance })
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [deleteBlock, duplicateBlock, duplicateSlide, isPlayMode, togglePlayMode, updateBlock])

  const handleMouseDown = (event: MouseEvent) => {
    if (isPlayMode) {
      return
    }

    if (spacePressed || event.button === 1) {
      setIsPanning(true)
      setPanStart({ x: event.clientX, y: event.clientY })
      setCamStart({ x: camX, y: camY })
      event.preventDefault()
    }
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!isPanning) {
      return
    }

    setCam(
      camStart.x + (event.clientX - panStart.x),
      camStart.y + (event.clientY - panStart.y),
      camZoom,
    )
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const adjustZoom = (delta: number) => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const centerX = viewport.clientWidth / 2
    const centerY = viewport.clientHeight / 2
    const nextZoom = Math.max(0.15, Math.min(camZoom + delta, 3))
    setCam(
      centerX - (centerX - camX) * (nextZoom / camZoom),
      centerY - (centerY - camY) * (nextZoom / camZoom),
      nextZoom,
    )
  }

  const handleWheel = (event: WheelEvent) => {
    if (isPlayMode) {
      return
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const viewport = viewportRef.current
      if (!viewport) {
        return
      }

      const rect = viewport.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const nextZoom = Math.max(0.15, Math.min(camZoom - event.deltaY * 0.004, 3))
      setCam(
        pointerX - (pointerX - camX) * (nextZoom / camZoom),
        pointerY - (pointerY - camY) * (nextZoom / camZoom),
        nextZoom,
      )
      return
    }

    setCam(camX - event.deltaX, camY - event.deltaY, camZoom)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    if (!currentSlideId) {
      return
    }

    const templateId = event.dataTransfer.getData('templateId') as ElementType
    if (!templateId) {
      return
    }

    const slideElement = document.getElementById('slideFrame')
    if (!slideElement) {
      return
    }

    const rect = slideElement.getBoundingClientRect()
    insertBlock(templateId, {
      x: Math.round((event.clientX - rect.left) / camZoom),
      y: Math.round((event.clientY - rect.top) / camZoom),
    })
  }

  const handleCanvasClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('.editor-block') || target.closest('.zoom-toolbar')) {
      return
    }

    setActiveBlock(null)
  }

  return (
    <main
      ref={viewportRef}
      className={`canvas-viewport ${showGrid ? 'has-grid' : ''} ${
        isPanning ? 'is-panning' : spacePressed ? 'can-pan' : ''
      }`}
      onWheel={handleWheel}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      <div
        className="canvas-camera"
        style={{
          transform: `translate(${camX}px, ${camY}px) scale(${camZoom})`,
        }}
      >
        <SlideFrame slideId={currentSlideId} interactive />
      </div>

      {!isPlayMode && (
        <div className="zoom-toolbar">
          <button onClick={() => adjustZoom(-0.1)}>缩小</button>
          <span>{Math.round(camZoom * 100)}%</span>
          <button onClick={() => adjustZoom(0.1)}>放大</button>
          <button onClick={fitCanvasCenter}>适应屏幕</button>
          {activeBlockId && <span className="zoom-toolbar__hint">Delete 删除 · Shift + 方向键 快移</span>}
        </div>
      )}
    </main>
  )
}
