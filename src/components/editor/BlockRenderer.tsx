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
  const lastSavedContentRef = useRef(block.content)
  const updateBlock = useEditorStore((state) => state.updateBlock)

  type BlockStyle = CSSProperties & Record<
    '--block-fill' | '--block-stroke' | '--block-stroke-width' | '--block-radius' | '--block-shadow',
    string
  >

  // 1. Synchronize external content changes (e.g., from store) into DOM when NOT editing
  useEffect(() => {
    if (!contentRef.current) return
    if (!isEditing && block.content !== lastSavedContentRef.current) {
      contentRef.current.innerHTML = block.content
      lastSavedContentRef.current = block.content
    }
  }, [block.content, isEditing])

  // 2. Initialize DOM exactly once on mount
  useEffect(() => {
    if (contentRef.current && contentRef.current.innerHTML === '') {
      contentRef.current.innerHTML = block.content
    }
  }, [block.content])

  // 3. Make nodes editable and listen for blur to save
  useEffect(() => {
    const wrapper = contentRef.current
    if (!wrapper) return

    const editableNodes = wrapper.querySelectorAll<HTMLElement>('[contenteditable]')
    const targets = editableNodes.length > 0 ? Array.from(editableNodes) : [wrapper]

    const handleBlur = () => {
      const currentHtml = wrapper.innerHTML
      if (currentHtml !== block.content) {
        updateBlock(slideId, block.id, { content: currentHtml })
        lastSavedContentRef.current = currentHtml
      }
    }

    targets.forEach((node, index) => {
      node.setAttribute('contenteditable', isEditing ? 'true' : 'false')
      if (isEditing) {
        node.addEventListener('blur', handleBlur, { once: true })
        if (index === 0) {
          node.focus()
        }
      } else {
        node.removeEventListener('blur', handleBlur)
      }
    })

    return () => {
      targets.forEach((node) => node.removeEventListener('blur', handleBlur))
    }
  }, [isEditing, block.content, block.id, slideId, updateBlock])

  const style: BlockStyle = {
    color: block.appearance.textColor,
    fontSize: `${block.appearance.fontSize}px`,
    textAlign: block.appearance.textAlign,
    fontFamily: block.appearance.fontFamily,
    fontWeight: block.appearance.fontWeight,
    fontStyle: block.appearance.fontStyle,
    textDecoration: block.appearance.textDecoration,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: block.appearance.verticalAlign === 'middle' ? 'center' : block.appearance.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
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
    />
  )
}
