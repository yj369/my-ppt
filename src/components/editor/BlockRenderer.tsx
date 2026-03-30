import type { CSSProperties } from 'react'
import { parseCssColor } from '../../lib/colors'
import { parseTarotShowcaseContent } from '../../lib/tarotShowcase'
import type { EditorBlock } from '../../types/editor'
import { TipTapEditor } from './TipTapEditor'
import { EditableImage } from './EditableImage'
import { TarotShowcase } from '../shared/TarotShowcase'
import * as LucideIcons from 'lucide-react'

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
  | '--block-clip-path'
  | '--block-mask-image'
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

  // Compute specific shape constraints
  let computedRadius = `${appearance.radius ?? 0}px`
  let computedClipPath = 'none'

  let computedMaskImage: string | undefined

  if (block.type === 'shape-rect') {
    computedRadius = '0px'
  } else if (block.type === 'shape-circle') {
    computedRadius = '999px'
  } else if (block.type === 'shape-triangle') {
    computedRadius = '0px'
    computedClipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'
  } else if (block.type === 'shape-diamond') {
    computedRadius = '0px'
    computedClipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
  } else if (block.type === 'shape-pentagon') {
    computedRadius = '0px'
    computedClipPath = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)'
  } else if (block.type === 'shape-star') {
    computedRadius = '0px'
    computedClipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
  } else if (block.type === 'shape-arrow-right') {
    computedRadius = '0px'
    computedClipPath = 'polygon(0% 25%, 65% 25%, 65% 0%, 100% 50%, 65% 100%, 65% 75%, 0% 75%)'
  } else if (block.type === 'shape-arrow-double') {
    computedRadius = '0px'
    computedClipPath = 'polygon(0% 50%, 25% 0%, 25% 25%, 75% 25%, 75% 0%, 100% 50%, 75% 100%, 75% 75%, 25% 75%, 25% 100%)'
  } else if (block.type === 'shape-callout-oval') {
    computedRadius = '0px'
    // Dynamic SVG mask for perfect curves:
    // Oval body taking up top 85% of height, with a custom tail path at the bottom left.
    const w = block.width
    const h = block.height
    const cx = w / 2
    const cy = h * 0.425
    const rx = w / 2
    const ry = h * 0.425
    // Tail from bottom left of oval fading down to pure bottom left point, then back up.
    const tailSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="black" />
        <path d="M ${w * 0.15} ${h * 0.7} Q ${w * 0.1} ${h * 0.85} ${w * 0.05} ${h * 0.95} Q ${w * 0.15} ${h * 0.9} ${w * 0.3} ${h * 0.8}" fill="black" />
      </svg>
    `.replace(/\s+/g, ' ').trim()
    computedMaskImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(tailSvg)}")`
  } else if (block.type === 'shape-callout-rect') {
    computedRadius = '0px'
    const w = block.width
    const h = block.height
    const r = 16 // Corner radius
    const tailW = Math.min(24, w * 0.15) // Tail width (left side)
    const tailH = Math.min(32, h * 0.4)  // Tail height
    const tailY = h / 2
    const bodyW = w - tailW
    const tailSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect x="${tailW}" y="0" width="${bodyW}" height="${h}" rx="${r}" ry="${r}" fill="black" />
        <polygon points="${tailW},${tailY - tailH/2} 0,${tailY} ${tailW},${tailY + tailH/2}" fill="black" />
      </svg>
    `.replace(/\s+/g, ' ').trim()
    computedMaskImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(tailSvg)}")`
  }

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
    paddingTop: block.type === 'image' || block.type === 'tarot' ? '0px' : `${paddingTop}px`,
    paddingRight: block.type === 'image' || block.type === 'tarot' ? '0px' : `${paddingRight}px`,
    paddingBottom: block.type === 'image' || block.type === 'tarot' ? '0px' : `${paddingBottom}px`,
    paddingLeft: block.type === 'image' || block.type === 'tarot' ? '0px' : `${paddingLeft}px`,
    // Flip
    transform: flipScale || undefined,
    // CSS vars
    '--block-fill': fillValue || 'none',
    '--block-stroke-color': appearance.stroke || 'transparent',
    '--block-stroke-width': `${appearance.strokeWidth ?? 1}px`,
    '--block-stroke-style': appearance.strokeStyle || 'none',
    '--block-radius': computedRadius,
    '--block-clip-path': computedClipPath,
    '--block-mask-image': computedMaskImage || 'none',
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

  if (block.type === 'icon') {
    const iconName = block.content || 'Star'
    const IconComp = (LucideIcons as unknown as Record<string, React.FC<{ size?: number; color?: string; strokeWidth?: number; style?: CSSProperties }>>)[iconName]
    const iconSize = Math.min(block.width, block.height) * 0.7
    const gradId = `icg-${block.id}`
    const isGrad = !!appearance.textColor?.startsWith('linear-gradient')

    // Parse gradient stops and angle for SVG linearGradient
    let svgStops: { color: string; offset: string }[] = []
    let svgX1 = '0', svgY1 = '0', svgX2 = '1', svgY2 = '0'
    if (isGrad && appearance.textColor) {
      const degMatch = appearance.textColor.match(/linear-gradient\(\s*([\d.]+)deg/)
      const deg = degMatch ? parseFloat(degMatch[1]) : 90
      const rad = (deg - 90) * Math.PI / 180
      svgX1 = (0.5 + Math.cos(rad + Math.PI) / 2).toFixed(3)
      svgY1 = (0.5 + Math.sin(rad + Math.PI) / 2).toFixed(3)
      svgX2 = (0.5 + Math.cos(rad) / 2).toFixed(3)
      svgY2 = (0.5 + Math.sin(rad) / 2).toFixed(3)
      const colorMatches = [...appearance.textColor.matchAll(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*([\d.]+%)?/g)]
      svgStops = colorMatches.map((m, i) => ({
        color: m[1],
        offset: m[2] ?? (i === 0 ? '0%' : '100%'),
      }))
    }

    const solidColor = isGrad ? undefined : (appearance.textColor || '#ffffff')

    return (
      <div
        className="tpl-wrapper tpl-wrapper--icon"
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {isGrad && (
          <svg width={0} height={0} style={{ position: 'absolute', pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              <linearGradient id={gradId} x1={svgX1} y1={svgY1} x2={svgX2} y2={svgY2}>
                {svgStops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
              </linearGradient>
            </defs>
          </svg>
        )}
        {IconComp ? (
          <IconComp
            size={iconSize}
            color={solidColor}
            strokeWidth={1.5}
            style={isGrad ? { stroke: `url(#${gradId})`, color: `url(#${gradId})` } : undefined}
          />
        ) : (
          <span style={{ color: solidColor ?? '#fff', fontSize: '14px', opacity: 0.5 }}>?</span>
        )}
      </div>
    )
  }

  if (block.type === 'image') {
    return <EditableImage block={block} slideId={slideId} style={style} />
  }

  if (block.type === 'tarot') {
    const tarotConfig = parseTarotShowcaseContent(block.content)

    return (
      <div
        className="tpl-wrapper tpl-wrapper--tarot"
        style={{ ...style, overflow: 'hidden' }}
      >
        <TarotShowcase mode="component" config={tarotConfig} />
      </div>
    )
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
