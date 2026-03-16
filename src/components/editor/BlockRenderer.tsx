import type { CSSProperties } from 'react'
import { parseCssColor } from '../../lib/colors'
import type { EditorBlock } from '../../types/editor'
import { TipTapEditor } from './TipTapEditor'

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
  | '--block-text-stroke-color'
  | '--block-text-stroke-width'
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
  const { appearance } = block
  const marginTop = Math.max(0, appearance.marginTop ?? 0)
  const marginRight = Math.max(0, appearance.marginRight ?? 0)
  const marginBottom = Math.max(0, appearance.marginBottom ?? 0)
  const marginLeft = Math.max(0, appearance.marginLeft ?? 0)
  const paddingTop = Math.max(0, appearance.paddingTop ?? 0)
  const paddingRight = Math.max(0, appearance.paddingRight ?? 0)
  const paddingBottom = Math.max(0, appearance.paddingBottom ?? 0)
  const paddingLeft = Math.max(0, appearance.paddingLeft ?? 0)

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
    position: 'absolute',
    top: `${marginTop}px`,
    right: `${marginRight}px`,
    bottom: `${marginBottom}px`,
    left: `${marginLeft}px`,
    width: 'auto',
    height: 'auto',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent:
      appearance.verticalAlign === 'middle'
        ? 'center'
        : appearance.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'flex-start',
    paddingTop: `${paddingTop}px`,
    paddingRight: `${paddingRight}px`,
    paddingBottom: `${paddingBottom}px`,
    paddingLeft: `${paddingLeft}px`,
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
    '--block-text-stroke-color': appearance.textStrokeColor ?? 'transparent',
    '--block-text-stroke-width': `${appearance.textStrokeWidth ?? 0}px`,
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
      className={`tpl-wrapper tpl-wrapper--${block.type} ${isTextGradient ? 'tpl-wrapper--text-gradient' : ''}`.trim()}
      style={style}
    >
      <TipTapEditor block={block} slideId={slideId} isEditing={isEditing} />
    </div>
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
