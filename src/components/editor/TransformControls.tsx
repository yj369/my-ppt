import type { Dispatch, MouseEvent as ReactMouseEvent, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef } from 'react'
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
  blockRef: RefObject<HTMLDivElement | null>
  localTransform: LocalTransform
  setLocalTransform: Dispatch<SetStateAction<LocalTransform>>
  commitTransform: (updates: Partial<BlockType>) => void
  disabled?: boolean
}

type TransformMode = 'none' | 'drag' | 'resize' | 'rotate'

export function TransformControls({
  blockRef,
  localTransform,
  setLocalTransform,
  commitTransform,
  disabled = false,
}: TransformControlsProps) {
  const camZoom = useEditorStore((state) => state.camZoom)
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

        setLocalTransform((prev) => ({
          ...prev,
          x,
          y,
          width: Math.max(48, width),
          height: Math.max(32, height),
        }))
        return
      }

      if (state.mode === 'rotate' && blockRef.current) {
        const rect = blockRef.current.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const angle = (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) / Math.PI + 90
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
  }, [blockRef, camZoom, commitTransform, disabled, setLocalTransform])

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
      stateRef.current = {
        mode,
        dir,
        startX: event.clientX,
        startY: event.clientY,
        startW: transformRef.current.width,
        startH: transformRef.current.height,
        startL: transformRef.current.x,
        startT: transformRef.current.y,
      }
    },
    [blockRef, disabled],
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
        target.classList.contains('rotate-handle') ||
        target.closest('.block-chip')
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
