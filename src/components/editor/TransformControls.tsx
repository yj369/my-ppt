import type { Dispatch, MouseEvent as ReactMouseEvent, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import {
  buildRotationUpdates,
  getSelectionBounds,
  getSelectionIdsForBlock,
  normalizeAngle,
} from '../../lib/selection'
import type { EditorBlock as BlockType } from '../../types/editor'
import { useEditorStore } from '../../store'

type LocalTransform = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

type TransformControlsProps = {
  block: BlockType
  blockRef: RefObject<HTMLDivElement | null>
  slideId: string
  localTransform: LocalTransform
  setLocalTransform: Dispatch<SetStateAction<LocalTransform>>
  commitTransform: (updates: Partial<BlockType>) => void
  disabled?: boolean
}

type TransformMode = 'none' | 'drag' | 'resize' | 'rotate'

export function TransformControls({
  block,
  blockRef,
  slideId,
  localTransform,
  setLocalTransform,
  commitTransform,
  disabled = false,
}: TransformControlsProps) {
  const camZoom = useEditorStore((state) => state.camZoom)
  const selectedBlockIds = useEditorStore((state) => state.selectedBlockIds)
  const updateBlocks = useEditorStore((state) => state.updateBlocks)
  const transformRef = useRef(localTransform)
  const stateRef = useRef({
    mode: 'none' as TransformMode,
    dir: '',
    startX: 0,
    startY: 0,
    startW: 0,
    startH: 0,
    startL: 0,
    startT: 0,
    linkedBlocks: [] as Array<{ id: string; x: number; y: number }>,
    rotateBlocks: [] as Array<Pick<BlockType, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'>>,
    rotateCenterX: 0,
    rotateCenterY: 0,
    rotateClientCenterX: 0,
    rotateClientCenterY: 0,
    rotateStartAngle: 0,
  })

  useEffect(() => {
    transformRef.current = localTransform
  }, [localTransform])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const state = stateRef.current
      if (state.mode === 'none' || disabled) {
        return
      }

      const deltaX = (event.clientX - state.startX) / camZoom
      const deltaY = (event.clientY - state.startY) / camZoom

      if (state.mode === 'drag') {
        setLocalTransform((prev) => ({
          ...prev,
          x: state.startL + deltaX,
          y: state.startT + deltaY,
        }))

        if (state.linkedBlocks.length > 0) {
          updateBlocks(
            slideId,
            state.linkedBlocks.map((linkedBlock) => ({
              blockId: linkedBlock.id,
              updates: {
                x: linkedBlock.x + deltaX,
                y: linkedBlock.y + deltaY,
              },
            })),
          )
        }
        return
      }

      if (state.mode === 'resize') {
        let width = state.startW
        let height = state.startH
        let x = state.startL
        let y = state.startT

        if (state.dir.includes('e')) {
          width = state.startW + deltaX
        }
        if (state.dir.includes('s')) {
          height = state.startH + deltaY
        }
        if (state.dir.includes('w')) {
          width = state.startW - deltaX
          x = state.startL + deltaX
        }
        if (state.dir.includes('n')) {
          height = state.startH - deltaY
          y = state.startT + deltaY
        }

        // Lock aspect ratio for circles: use the primary drag axis as canonical size
        if (block.type === 'shape-circle') {
          // Determine which axis the user is primarily dragging
          const dragH = state.dir.includes('e') || state.dir.includes('w')
          const dragV = state.dir.includes('n') || state.dir.includes('s')

          let size: number
          if (dragH && !dragV) {
            // Pure horizontal drag - use width
            size = Math.max(48, Math.abs(width))
          } else if (dragV && !dragH) {
            // Pure vertical drag - use height
            size = Math.max(48, Math.abs(height))
          } else {
            // Corner drag - use the larger delta
            size = Math.max(48, Math.abs(deltaX) >= Math.abs(deltaY) ? Math.abs(width) : Math.abs(height))
          }

          height = size
          width = size

          // Re-anchor x if resizing from the left
          if (state.dir.includes('w')) {
            x = state.startL + state.startW - size
          }
          // Re-anchor y if resizing from the top
          if (state.dir.includes('n')) {
            y = state.startT + state.startH - size
          }
        }

        setLocalTransform((prev) => ({
          ...prev,
          x,
          y,
          width: Math.max(48, width),
          height: Math.max(48, height),
        }))
        return
      }

      if (state.mode === 'rotate' && blockRef.current) {
        if (state.rotateBlocks.length > 1) {
          const pointerAngle = (Math.atan2(event.clientY - state.rotateClientCenterY, event.clientX - state.rotateClientCenterX) * 180) / Math.PI
          const deltaAngle = pointerAngle - state.rotateStartAngle
          const rotationUpdates = buildRotationUpdates(state.rotateBlocks, deltaAngle, {
            x: state.rotateCenterX,
            y: state.rotateCenterY,
          })
          const primaryUpdate = rotationUpdates.find((item) => item.blockId === block.id)
          if (primaryUpdate) {
            setLocalTransform((prev) => ({
              ...prev,
              x: primaryUpdate.updates.x,
              y: primaryUpdate.updates.y,
              rotation: primaryUpdate.updates.rotation,
            }))
          }

          const linkedUpdates = rotationUpdates.filter((item) => item.blockId !== block.id)
          if (linkedUpdates.length > 0) {
            updateBlocks(slideId, linkedUpdates)
          }
          return
        }

        const rect = blockRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const angle = normalizeAngle((Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI + 90)
        setLocalTransform((prev) => ({
          ...prev,
          rotation: angle,
        }))
      }
    }

    const handleMouseUp = () => {
      if (stateRef.current.mode === 'none' || disabled) {
        return
      }

      stateRef.current.mode = 'none'
      const next = transformRef.current
      commitTransform({
        x: next.x,
        y: next.y,
        width: next.width,
        height: next.height,
        rotation: next.rotation,
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [block.id, blockRef, camZoom, commitTransform, disabled, setLocalTransform, slideId, updateBlocks])

  const initTransform = useCallback(
    (
      event: ReactMouseEvent | MouseEvent,
      mode: TransformMode,
      dir = '',
      stopPropagation = true,
    ) => {
      if (disabled || !blockRef.current) {
        return
      }

      event.preventDefault()
      if (stopPropagation) {
        event.stopPropagation()
      }

      const editorState = useEditorStore.getState()
      const currentSlide = editorState.slides.find((slide) => slide.id === slideId)
      const dragIds = mode !== 'drag' || !currentSlide
        ? []
        : (
          selectedBlockIds.includes(block.id) && selectedBlockIds.length > 1
            ? selectedBlockIds
            : getSelectionIdsForBlock(currentSlide.blocks, block.id)
        )
      const selectionIds = !currentSlide
        ? []
        : (
          selectedBlockIds.includes(block.id) && selectedBlockIds.length > 1
            ? selectedBlockIds
            : getSelectionIdsForBlock(currentSlide.blocks, block.id)
        )
      const linkedBlocks = currentSlide
        ? currentSlide.blocks
            .filter((item) => dragIds.includes(item.id) && item.id !== block.id && !item.locked)
            .map((item) => ({ id: item.id, x: item.x, y: item.y }))
        : []
      const selectionBounds = currentSlide ? getSelectionBounds(currentSlide.blocks, selectionIds) : null
      const rotateBlocks = mode !== 'rotate' || !currentSlide
        ? []
        : currentSlide.blocks
            .filter((item) => selectionIds.includes(item.id) && !item.locked)
            .map((item) => ({
              id: item.id,
              x: item.x,
              y: item.y,
              width: item.width,
              height: item.height,
              rotation: item.rotation,
            }))
      const rotateElements = mode !== 'rotate'
        ? []
        : Array.from(document.getElementById('slideContent')?.querySelectorAll<HTMLElement>('.editor-block') ?? [])
            .filter((element) => selectionIds.includes(element.dataset.blockId ?? ''))
      const primaryRect = blockRef.current?.getBoundingClientRect() ?? null
      const rotateClientBounds = rotateElements.length === 0
        ? null
        : {
            left: Math.min(...rotateElements.map((element) => element.getBoundingClientRect().left)),
            top: Math.min(...rotateElements.map((element) => element.getBoundingClientRect().top)),
            right: Math.max(...rotateElements.map((element) => element.getBoundingClientRect().right)),
            bottom: Math.max(...rotateElements.map((element) => element.getBoundingClientRect().bottom)),
          }

      stateRef.current = {
        mode,
        dir,
        startX: event.clientX,
        startY: event.clientY,
        startW: transformRef.current.width,
        startH: transformRef.current.height,
        startL: transformRef.current.x,
        startT: transformRef.current.y,
        linkedBlocks,
        rotateBlocks,
        rotateCenterX: selectionBounds ? selectionBounds.x + selectionBounds.width / 2 : transformRef.current.x + transformRef.current.width / 2,
        rotateCenterY: selectionBounds ? selectionBounds.y + selectionBounds.height / 2 : transformRef.current.y + transformRef.current.height / 2,
        rotateClientCenterX: rotateClientBounds
          ? (rotateClientBounds.left + rotateClientBounds.right) / 2
          : primaryRect
          ? primaryRect.left + primaryRect.width / 2
          : event.clientX,
        rotateClientCenterY: rotateClientBounds
          ? (rotateClientBounds.top + rotateClientBounds.bottom) / 2
          : primaryRect
          ? primaryRect.top + primaryRect.height / 2
          : event.clientY,
        rotateStartAngle: (Math.atan2(
          event.clientY - (
            rotateClientBounds
              ? (rotateClientBounds.top + rotateClientBounds.bottom) / 2
              : primaryRect
              ? primaryRect.top + primaryRect.height / 2
              : event.clientY
          ),
          event.clientX - (
            rotateClientBounds
              ? (rotateClientBounds.left + rotateClientBounds.right) / 2
              : primaryRect
              ? primaryRect.left + primaryRect.width / 2
              : event.clientX
          ),
        ) * 180) / Math.PI,
      }
    },
    [block.id, blockRef, disabled, selectedBlockIds, slideId],
  )

  useEffect(() => {
    const element = blockRef.current
    if (!element || disabled) {
      return
    }

    const handleBlockMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (
        target.classList.contains('resize-handle') ||
        target.classList.contains('rotate-handle')
      ) {
        return
      }

      if (target.closest('[contenteditable="true"]') || element.classList.contains('is-editing')) {
        return
      }

      initTransform(event, 'drag', '', false)
    }

    element.addEventListener('mousedown', handleBlockMouseDown)
    return () => element.removeEventListener('mousedown', handleBlockMouseDown)
  }, [blockRef, disabled, initTransform])

  return (
    <>
      <div className="resize-handle nw" onMouseDown={(event) => initTransform(event, 'resize', 'nw')} />
      <div className="resize-handle n" onMouseDown={(event) => initTransform(event, 'resize', 'n')} />
      <div className="resize-handle ne" onMouseDown={(event) => initTransform(event, 'resize', 'ne')} />
      <div className="resize-handle e" onMouseDown={(event) => initTransform(event, 'resize', 'e')} />
      <div className="resize-handle se" onMouseDown={(event) => initTransform(event, 'resize', 'se')} />
      <div className="resize-handle s" onMouseDown={(event) => initTransform(event, 'resize', 's')} />
      <div className="resize-handle sw" onMouseDown={(event) => initTransform(event, 'resize', 'sw')} />
      <div className="resize-handle w" onMouseDown={(event) => initTransform(event, 'resize', 'w')} />
      <div className="rotate-link" />
      <div className="rotate-handle" onMouseDown={(event) => initTransform(event, 'rotate')} />
    </>
  )
}
