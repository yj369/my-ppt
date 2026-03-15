import { useEffect, useRef, useState } from 'react'
import { getSelectionIdsForBlock } from '../../lib/selection'
import type { EditorBlock as BlockType } from '../../types/editor'
import { useEditorStore } from '../../store'
import { BlockRenderer } from './BlockRenderer'
import { TransformControls } from './TransformControls'

type EditorBlockProps = {
  block: BlockType
  slideId: string
  interactive: boolean
}

export function EditorBlock({ block, slideId, interactive }: EditorBlockProps) {
  const {
    slides,
    activeBlockId,
    selectedBlockIds,
    setActiveBlock,
    setPrimarySelectedBlock,
    setSelectedBlocks,
    toggleBlockSelection,
    updateBlock,
    deleteBlock,
    isPlayMode,
  } = useEditorStore()

  const blockRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [localTransform, setLocalTransform] = useState({
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    rotation: block.rotation,
  })

  const slide = slides.find((item) => item.id === slideId) ?? null
  const blockSelectionIds = slide ? getSelectionIdsForBlock(slide.blocks, block.id) : [block.id]
  const isSelected = interactive && selectedBlockIds.includes(block.id)
  const isPrimarySelected = interactive && activeBlockId === block.id

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLocalTransform({
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        rotation: block.rotation,
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [block.height, block.rotation, block.width, block.x, block.y])

  useEffect(() => {
    if (!isSelected && isEditing) {
      const frame = window.requestAnimationFrame(() => {
        setIsEditing(false)
      })

      return () => window.cancelAnimationFrame(frame)
    }
  }, [isEditing, isSelected])

  const commitTransform = (updates: Partial<BlockType>) => {
    updateBlock(slideId, block.id, updates)
  }

  return (
    <div
      ref={blockRef}
      className={[
        'editor-block',
        interactive ? 'is-draggable' : 'is-static',
        isSelected ? 'is-selected' : '',
        isPrimarySelected ? 'is-primary-selected' : '',
        isEditing ? 'is-editing' : '',
        block.locked ? 'is-locked' : '',
        block.hidden ? 'is-hidden' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${localTransform.x}px`,
        top: `${localTransform.y}px`,
        width: `${localTransform.width}px`,
        height: `${localTransform.height}px`,
        zIndex: block.zIndex,
        opacity: block.hidden && !isPlayMode ? Math.min(block.opacity, 0.2) : block.opacity,
        transform: `rotate(${localTransform.rotation}deg)`,
      }}
      data-block-id={block.id}
      data-anim={block.anim}
      data-trigger={block.trigger}
      data-duration={block.duration}
      data-delay={block.delay}
      data-opacity={block.opacity}
      data-hidden={block.hidden ? 'true' : 'false'}
      data-z-index={block.zIndex}
      data-type={block.type}
      onDragStartCapture={(event) => {
        if (interactive && !isPlayMode) {
          event.preventDefault()
        }
      }}
      onMouseDownCapture={(event) => {
        if (!interactive || isPlayMode) {
          return
        }

        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          blockSelectionIds.forEach((blockId) => toggleBlockSelection(blockId))
          event.stopPropagation()
          return
        }

        if (block.groupId) {
          setSelectedBlocks(blockSelectionIds, block.id)
          return
        }

        if (isSelected) {
          setPrimarySelectedBlock(block.id)
          return
        }

        setActiveBlock(block.id)
      }}
      onDoubleClickCapture={(event) => {
        if (!interactive || isPlayMode || block.locked || selectedBlockIds.length > 1) {
          return
        }

        event.stopPropagation()
        setIsEditing(true)
      }}
    >
      <BlockRenderer block={block} slideId={slideId} isEditing={isEditing} />

      {interactive && !isPlayMode && (
        <>
          <TransformControls
            block={block}
            blockRef={blockRef}
            slideId={slideId}
            localTransform={localTransform}
            setLocalTransform={setLocalTransform}
            commitTransform={commitTransform}
            disabled={block.locked}
          />
          {isPrimarySelected && (
            <div className="block-chip-group">
              <span className="block-chip">{block.name}</span>
              <button
                className="block-chip block-chip--danger"
                onClick={(event) => {
                  event.stopPropagation()
                  deleteBlock(slideId, block.id)
                }}
              >
                删除
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
