import type { DragEvent, MouseEvent, WheelEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { getSelectionIdsForRect, normalizeSelectionRect, uniqueIds, type SelectionRect } from '../../lib/selection'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../../lib/presentation'
import { useEditorStore } from '../../store'
import type { ElementType } from '../../types/editor'
import { saveLocalImage, getImageDimensions, calculateFitDimensions } from '../../lib/imageStorage'
import { SlideFrame } from './SlideFrame'

import { AlertTriangle, X } from 'lucide-react'

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
}

export function CanvasViewport() {
  const {
    slides,
    camX,
    camY,
    camZoom,
    setCam,
    isPlayMode,
    showGrid,
    currentSlideId,
    selectedBlockIds,
    insertBlock,
    deleteBlocks,
    duplicateBlock,
    duplicateSlide,
    moveBlocksBy,
    groupBlocks,
    ungroupBlocks,
    togglePlayMode,
    setActiveBlock,
    setSelectedBlocks,
    deleteSlide,
  } = useEditorStore()

  const viewportRef = useRef<HTMLElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const [isDeletingSlide, setIsDeletingSlide] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [camStart, setCamStart] = useState({ x: 0, y: 0 })
  const [marqueeRect, setMarqueeRect] = useState<SelectionRect | null>(null)
  const marqueeStateRef = useRef<{
    startX: number
    startY: number
    additive: boolean
    baseSelection: string[]
  } | null>(null)
  const suppressCanvasClickRef = useRef(false)
  const currentSlide = slides.find((slide) => slide.id === currentSlideId) ?? null

  const fitCanvasCenter = (playMode = false) => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const viewportWidth = viewport.clientWidth
    const viewportHeight = viewport.clientHeight
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return
    }

    const chromePadding = playMode ? 0 : 120
    const zoom = Math.max(
      0.15,
      Math.min(
        (viewportWidth - chromePadding) / SLIDE_WIDTH,
        (viewportHeight - chromePadding) / SLIDE_HEIGHT,
      ),
    )
    const x = (viewportWidth - SLIDE_WIDTH * zoom) / 2
    const y = (viewportHeight - SLIDE_HEIGHT * zoom) / 2
    setCam(x, y, zoom)
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      fitCanvasCenter(isPlayMode)
    })

    const handleResize = () => {
      fitCanvasCenter(isPlayMode)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
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

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'g' && state.currentSlideId) {
        event.preventDefault()
        if (event.shiftKey) {
          ungroupBlocks(state.currentSlideId, state.selectedBlockIds)
        } else {
          groupBlocks(state.currentSlideId, state.selectedBlockIds)
        }
        return
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && state.currentSlideId && state.selectedBlockIds.length > 0) {
        event.preventDefault()
        deleteBlocks(state.currentSlideId, state.selectedBlockIds)
        return
      }

      if ((event.key === 'Backspace' || event.key === 'Delete') && state.currentSlideId && state.selectedBlockIds.length === 0) {
        if (state.slides.length > 1) {
          event.preventDefault()
          setIsDeletingSlide(true)
        }
        return
      }

      if (!state.currentSlideId || state.selectedBlockIds.length === 0) {
        return
      }

      const currentSlide = state.slides.find((slide) => slide.id === state.currentSlideId)
      const selectedBlocks = currentSlide?.blocks.filter((block) => state.selectedBlockIds.includes(block.id)) ?? []
      const movableBlockIds = selectedBlocks.filter((block) => !block.locked).map((block) => block.id)
      if (movableBlockIds.length === 0) {
        return
      }

      const distance = event.shiftKey ? 10 : 1
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        moveBlocksBy(state.currentSlideId, movableBlockIds, 0, -distance)
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        moveBlocksBy(state.currentSlideId, movableBlockIds, 0, distance)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        moveBlocksBy(state.currentSlideId, movableBlockIds, -distance, 0)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveBlocksBy(state.currentSlideId, movableBlockIds, distance, 0)
      }
    }

    const handlePaste = async (event: ClipboardEvent) => {
      // Don't intercept if user is typing in an input
      if (isPlayMode || isTypingTarget(event.target)) {
        return
      }

      const items = event.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          event.preventDefault()
          const file = items[i].getAsFile()
          if (!file) continue
          
          const state = useEditorStore.getState()
          if (!state.currentSlideId) return

          try {
            const uri = await saveLocalImage(file)
            const objectUrl = URL.createObjectURL(file)
            getImageDimensions(objectUrl).then(({ width, height }) => {
              const fit = calculateFitDimensions(width, height)
              useEditorStore.getState().insertBlock('image', { src: uri, width: fit.width, height: fit.height })
              URL.revokeObjectURL(objectUrl)
            }).catch(() => {
              useEditorStore.getState().insertBlock('image', { src: uri })
              URL.revokeObjectURL(objectUrl)
            })
          } catch (e) {
            console.error("Paste image failed:", e)
          }
          break // Only handle the first pasted image
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('paste', handlePaste)
    }
  }, [deleteBlocks, duplicateBlock, duplicateSlide, groupBlocks, isPlayMode, moveBlocksBy, togglePlayMode, ungroupBlocks])

  const handleMouseDown = (event: MouseEvent) => {
    if (isPlayMode) {
      return
    }

    if (spacePressed || event.button === 1) {
      setIsPanning(true)
      setPanStart({ x: event.clientX, y: event.clientY })
      setCamStart({ x: camX, y: camY })
      event.preventDefault()
      return
    }

    if (event.button !== 0) {
      return
    }

    const target = event.target as HTMLElement
    if (target.closest('.editor-block') || target.closest('.zoom-toolbar') || isTypingTarget(target)) {
      return
    }

    const pointer = getSlidePointer(event.clientX, event.clientY)
    if (!pointer) {
      return
    }

    marqueeStateRef.current = {
      startX: pointer.x,
      startY: pointer.y,
      additive: event.metaKey || event.ctrlKey || event.shiftKey,
      baseSelection: event.metaKey || event.ctrlKey || event.shiftKey ? selectedBlockIds : [],
    }
    setMarqueeRect({
      x: pointer.x,
      y: pointer.y,
      width: 0,
      height: 0,
    })
    event.preventDefault()
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!isPanning) {
      const marqueeState = marqueeStateRef.current
      if (!marqueeState) {
        return
      }

      const pointer = getSlidePointer(event.clientX, event.clientY)
      if (!pointer) {
        return
      }

      setMarqueeRect(
        normalizeSelectionRect(marqueeState.startX, marqueeState.startY, pointer.x, pointer.y),
      )
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

    const marqueeState = marqueeStateRef.current
    if (!marqueeState) {
      return
    }

    const nextRect = marqueeRect ?? {
      x: marqueeState.startX,
      y: marqueeState.startY,
      width: 0,
      height: 0,
    }
    const nextIds = currentSlide
      ? getSelectionIdsForRect(currentSlide.blocks, nextRect)
      : []

    const isClickSelection = nextRect.width < 2 && nextRect.height < 2
    const selectedIds = marqueeState.additive
      ? uniqueIds([...marqueeState.baseSelection, ...nextIds])
      : nextIds

    setSelectedBlocks(
      isClickSelection && !marqueeState.additive ? [] : selectedIds,
      selectedIds[selectedIds.length - 1] ?? null,
    )
    setMarqueeRect(null)
    marqueeStateRef.current = null
    suppressCanvasClickRef.current = true
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

  const getSlidePointer = (clientX: number, clientY: number) => {
    const slideElement = document.getElementById('slideFrame')
    if (!slideElement) {
      return null
    }

    const rect = slideElement.getBoundingClientRect()
    return {
      x: (clientX - rect.left) / camZoom,
      y: (clientY - rect.top) / camZoom,
    }
  }

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault()
    if (!currentSlideId) {
      return
    }

    const slideElement = document.getElementById('slideFrame')
    if (!slideElement) {
      return
    }
    const rect = slideElement.getBoundingClientRect()
    const dropX = Math.round((event.clientX - rect.left) / camZoom)
    const dropY = Math.round((event.clientY - rect.top) / camZoom)

    // Handle File Drop (Images)
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0]
      if (file.type.startsWith('image/')) {
        try {
          const uri = await saveLocalImage(file)
          const objectUrl = URL.createObjectURL(file)
          getImageDimensions(objectUrl).then(({ width, height }) => {
            const fit = calculateFitDimensions(width, height)
            insertBlock('image', { x: dropX, y: dropY, src: uri, width: fit.width, height: fit.height })
            URL.revokeObjectURL(objectUrl)
          }).catch(() => {
            insertBlock('image', { x: dropX, y: dropY, src: uri })
            URL.revokeObjectURL(objectUrl)
          })
        } catch (e) {
          console.error("Drop image failed:", e)
        }
        return
      }
    }

    // Handle Template Drop (Sidebar shapes/blocks)
    const templateId = event.dataTransfer.getData('templateId') as ElementType
    if (templateId) {
      insertBlock(templateId, { x: dropX, y: dropY })
    }
  }

  const handleCanvasClick = (event: MouseEvent) => {
    if (suppressCanvasClickRef.current) {
      suppressCanvasClickRef.current = false
      return
    }

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
        <SlideFrame slideId={currentSlideId} interactive marqueeRect={marqueeRect} />
      </div>

      {!isPlayMode && (
        <div className="zoom-toolbar">
          <button onClick={() => adjustZoom(-0.1)}>缩小</button>
          <span>{Math.round(camZoom * 100)}%</span>
          <button onClick={() => adjustZoom(0.1)}>放大</button>
          <button onClick={() => fitCanvasCenter(false)}>适应屏幕</button>
        </div>
      )}

      {isDeletingSlide && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            width: '380px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(15, 23, 42, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            position: 'relative',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <button 
              onClick={() => setIsDeletingSlide(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>确定要删除当前幻灯片吗？</h3>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  您正在尝试删除包含内容的演示页面。此操作一旦执行将无法轻易撤销。
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setIsDeletingSlide(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--surface-sunken)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'var(--surface)' }
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'var(--surface-sunken)' }
              >
                取消
              </button>
              <button 
                onClick={() => {
                  if (currentSlideId) deleteSlide(currentSlideId)
                  setIsDeletingSlide(false)
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#ef4444', border: 'none', color: 'white', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}
                onMouseEnter={(e) => (e.target as HTMLElement).style.background = '#dc2626' }
                onMouseLeave={(e) => (e.target as HTMLElement).style.background = '#ef4444' }
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
