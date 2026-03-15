import type { CSSProperties } from 'react'
import { useEffect, useEffectEvent, useRef } from 'react'
import { parseCssColor } from '../../lib/colors'
import type { EditorBlock } from '../../types/editor'
import { useEditorStore } from '../../store'

type BlockRendererProps = {
  block: EditorBlock
  slideId: string
  isEditing: boolean
}

type BlockStyle = CSSProperties & Record<
  | '--block-fill'
  | '--block-stroke-color'
  | '--block-stroke-width'
  | '--block-stroke-style'
  | '--block-radius'
  | '--block-shadow'
  | '--block-opacity'
  | '--block-text-gradient'
  | '--block-text-font-size'
  | '--block-text-line-height'
  | '--block-text-letter-spacing'
  | '--block-text-font-weight'
  | '--block-text-font-style'
  | '--block-text-decoration'
  | '--block-text-font-family',
  string
>

export function BlockRenderer({ block, slideId, isEditing }: BlockRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const lastSavedContentRef = useRef(block.content)
  const updateBlock = useEditorStore((state) => state.updateBlock)
  const persistContent = useEffectEvent(() => {
    const wrapper = contentRef.current
    if (!wrapper) return

    const currentHtml = wrapper.innerHTML
    if (currentHtml !== block.content) {
      updateBlock(slideId, block.id, { content: currentHtml })
      lastSavedContentRef.current = currentHtml
    }
  })

  // 1. Synchronize external content changes into DOM when NOT editing
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 3. Make nodes editable and listen for blur to save
  useEffect(() => {
    const wrapper = contentRef.current
    if (!wrapper) return

    const editableNodes = wrapper.querySelectorAll<HTMLElement>('[contenteditable]')
    const targets = editableNodes.length > 0 ? Array.from(editableNodes) : [wrapper]

    targets.forEach((node, index) => {
      node.setAttribute('contenteditable', isEditing ? 'true' : 'false')
      if (isEditing) {
        node.addEventListener('blur', persistContent, { once: true })
        if (index === 0) node.focus()
      } else {
        node.removeEventListener('blur', persistContent)
      }
    })

    return () => { targets.forEach((node) => node.removeEventListener('blur', persistContent)) }
  }, [isEditing])

  useEffect(() => {
    if (!isEditing) {
      persistContent()
    }
  }, [isEditing])

  useEffect(() => () => persistContent(), [])

  const { appearance } = block

  // Compute flip transform
  const flipScale = [
    appearance.flipX ? 'scaleX(-1)' : '',
    appearance.flipY ? 'scaleY(-1)' : '',
  ].filter(Boolean).join(' ')

  // Compute fill value
  const fillValue = appearance.fillType === 'none' ? 'none' : appearance.fill

  // Compute text color styles
  const isTextGradient = appearance.textColor?.startsWith('linear-gradient')
  const textStyles: CSSProperties = isTextGradient
    ? {}
    : {
        color: appearance.textColor,
      }

  // Shadow value - detailed Keynote-style
  const shadowValue = appearance.shadow
    ? buildShadow(appearance)
    : undefined

  // Pass everything through CSS custom properties.
  const style: BlockStyle = {
    // Typography
    ...textStyles,
    fontSize: `${appearance.fontSize}px`,
    textAlign: appearance.textAlign,
    fontFamily: appearance.fontFamily,
    fontWeight: appearance.fontWeight,
    fontStyle: appearance.fontStyle,
    textDecoration: appearance.textDecoration,
    letterSpacing: appearance.letterSpacing != null ? `${appearance.letterSpacing}px` : undefined,
    lineHeight: appearance.lineHeight != null ? String(appearance.lineHeight) : undefined,
    // Layout
    display: 'flex',
    flexDirection: 'column',
    justifyContent:
      appearance.verticalAlign === 'middle'
        ? 'center'
        : appearance.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start',
    // Flip
    transform: flipScale || undefined,
    // CSS vars
    '--block-fill': fillValue || 'none',
    '--block-stroke-color': appearance.stroke || 'transparent',
    '--block-stroke-width': `${appearance.strokeWidth ?? 1}px`,
    '--block-stroke-style': appearance.strokeStyle || 'none',
    '--block-radius': `${appearance.radius ?? 0}px`,
    '--block-shadow': shadowValue || 'none',
    '--block-opacity': String(appearance.fillOpacity ?? 1),
    '--block-text-gradient': isTextGradient ? appearance.textColor : 'none',
    '--block-text-font-size': `${appearance.fontSize}px`,
    '--block-text-line-height': appearance.lineHeight != null ? String(appearance.lineHeight) : 'normal',
    '--block-text-letter-spacing': appearance.letterSpacing != null ? `${appearance.letterSpacing}px` : 'normal',
    '--block-text-font-weight': appearance.fontWeight ?? 'normal',
    '--block-text-font-style': appearance.fontStyle ?? 'normal',
    '--block-text-decoration': appearance.textDecoration ?? 'none',
    '--block-text-font-family': appearance.fontFamily ?? 'inherit',
  }



  return (
    <div
      ref={contentRef}
      className={`tpl-wrapper tpl-wrapper--${block.type} ${isTextGradient ? 'tpl-wrapper--text-gradient' : ''}`.trim()}
      style={style}
    />
  )
}

/** Builds a CSS box-shadow string matching Keynote's drop shadow parameters */
function buildShadow(a: EditorBlock['appearance']): string {
  const blur = a.shadowBlur ?? 8
  const offset = a.shadowOffset ?? 2
  const opacity = a.shadowOpacity ?? 0.5
  const angle = ((a.shadowAngle ?? 270) * Math.PI) / 180
  const color = a.shadowColor ?? '#000000'
  const x = +(offset * Math.cos(angle)).toFixed(2)
  const y = +(offset * Math.sin(angle)).toFixed(2)
  const parsedColor = parseCssColor(color) ?? parseCssColor('#000000')
  const alpha = parsedColor ? Number((parsedColor.a * opacity).toFixed(3)) : opacity

  return `${x}px ${y}px ${blur}px rgba(${parsedColor?.r ?? 0},${parsedColor?.g ?? 0},${parsedColor?.b ?? 0},${alpha})`
}
