import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import type { EditorBlock } from '../../types/editor'
import { useEditorStore } from '../../store'

type BlockRendererProps = {
  block: EditorBlock
  slideId: string
  isEditing: boolean
}

export function BlockRenderer({ block, slideId, isEditing }: BlockRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const updateBlock = useEditorStore((state) => state.updateBlock)

  useEffect(() => {
    if (!contentRef.current) {
      return
    }

    const editableNodes = contentRef.current.querySelectorAll<HTMLElement>('[contenteditable]')
    editableNodes.forEach((node, index) => {
      node.setAttribute('contenteditable', isEditing ? 'true' : 'false')
      if (isEditing && index === 0) {
        node.focus()
      }
    })
  }, [isEditing])

  useEffect(() => {
    if (isEditing || !contentRef.current) {
      return
    }

    if (contentRef.current.innerHTML !== block.content) {
      updateBlock(slideId, block.id, { content: contentRef.current.innerHTML })
    }
  }, [block.content, block.id, isEditing, slideId, updateBlock])

  const style: CSSProperties & Record<string, string> = {
    color: block.appearance.textColor,
    fontSize: `${block.appearance.fontSize}px`,
    textAlign: block.appearance.textAlign,
    '--block-fill': block.appearance.fill,
    '--block-stroke': block.appearance.stroke,
    '--block-stroke-width': `${block.appearance.strokeWidth}px`,
    '--block-radius': `${block.appearance.radius}px`,
    '--block-shadow': block.appearance.shadow
      ? '0 1px 2px rgba(15, 23, 42, 0.08)'
      : 'none',
  }

  return (
    <div
      ref={contentRef}
      className={`tpl-wrapper tpl-wrapper--${block.type}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  )
}
