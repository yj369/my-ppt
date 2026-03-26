import {
  AlertTriangle,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  Bold,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FlipHorizontal,
  FlipVertical,
  Italic,
  Layers,
  Pause,
  Play,
  Strikethrough,
  Trash2,
  Underline,
  X,
  Link2,
} from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { previewBlockPhase, restoreBlockAfterPreview } from '../../lib/animation-runtime'
import {
  ANIMATION_PHASE_OPTIONS,
  TRIGGER_OPTIONS,
  DEFAULT_ACTION,
  getBlockAnimations,
  getEffectLabel,
  getEffectOptions,
  getPhaseLabel,
  getSlideBuildOrder,
  getTriggerLabel,
} from '../../lib/animations'
import {
  buildLegacyImageContent,
  getImageBlockData,
  getImageScalePercent,
  isImageUpscaled,
} from '../../lib/imageBlock'
import {
  BACKGROUND_OPTIONS,
  LAYOUT_OPTIONS,
  TRANSITION_OPTIONS,
} from '../../lib/presentation'
import type { SelectedTextStyles } from '../../lib/rich-text'
import { formatCssColor, parseCssColor, rgbaToHex, withAlpha, type RgbaColor } from '../../lib/colors'
import {
  getSelectionBounds,
  normalizeAngle,
  getAngleDelta,
  buildMoveSelectionUpdates,
  buildScaleSelectionUpdates,
  buildRotateSelectionUpdates,
} from '../../lib/selection'
import { useEditorStore } from '../../store'
import type { AnimationPhase, EditorBlock, InspectorTab, TriggerType } from '../../types/editor'
import type { Editor } from '@tiptap/react'

// const AUTO_HEIGHT_TEXT_BLOCKS = new Set<EditorBlock['type']>(['eyebrow', 'heading', 'subheading', 'body'])

function applyRichTextMark(mark: 'bold' | 'italic' | 'underline' | 'line-through' | 'subscript' | 'superscript', activeEditor: Editor | null) {
  if (!activeEditor) return false
  if (mark === 'bold') activeEditor.chain().toggleBold().run()
  if (mark === 'italic') activeEditor.chain().toggleItalic().run()
  if (mark === 'underline') activeEditor.chain().toggleUnderline().run()
  if (mark === 'line-through') activeEditor.chain().toggleStrike().run()
  if (mark === 'subscript') activeEditor.chain().toggleSubscript().run()
  if (mark === 'superscript') activeEditor.chain().toggleSuperscript().run()
  return true
}

function applyRichTextTextFill(value: string, activeEditor: Editor | null) {
  if (!activeEditor) return false
  activeEditor.chain().setMark('textStyle', { textFill: value }).run()
  return true
}

function applyRichTextFontSize(fontSize: number, activeEditor: Editor | null) {
  if (!activeEditor) return false
  activeEditor.chain().setMark('textStyle', { fontSize: `${fontSize}px` }).run()
  return true
}

function applyRichTextFontFamily(fontFamily: string, activeEditor: Editor | null) {
  if (!activeEditor) return false
  activeEditor.chain().setFontFamily(fontFamily).run()
  return true
}

function applyRichTextTextAlign(align: 'left' | 'center' | 'right' | 'justify', activeEditor: Editor | null) {
  if (!activeEditor) return false
  activeEditor.chain().setTextAlign(align).run()
  return true
}

function applyRichTextFontWeight(fontWeight: string, activeEditor: Editor | null) {
  if (!activeEditor) return false
  activeEditor.chain().setMark('textStyle', { fontWeight }).run()
  return true
}

function applyRichTextLetterSpacing(letterSpacing: number, activeEditor: Editor | null) {
  if (!activeEditor) return false
  activeEditor.chain().setMark('textStyle', { letterSpacing: `${letterSpacing}px` }).run()
  return true
}

function applyRichTextLineHeight(lineHeight: number, activeEditor: Editor | null) {
  if (!activeEditor) return false
  activeEditor.chain().setMark('textStyle', { lineHeight: String(lineHeight) }).run()
  return true
}

function applyRichTextTextStroke(
  {
    color,
    width,
  }: {
    color?: string
    width?: number
  },
  activeEditor: Editor | null,
) {
  if (!activeEditor) return false

  const nextWidth = Math.max(0, width ?? 0)
  activeEditor.chain().setMark('textStyle', {
    textStrokeColor: nextWidth > 0 ? (color ?? 'transparent') : 'transparent',
    textStrokeWidth: `${nextWidth}px`,
  }).run()
  return true
}

function preventMouseFocusSteal(event: React.MouseEvent<HTMLElement>) {
  const target = event.target as HTMLElement
  if (target.closest('input, select, textarea, [contenteditable="true"]')) return
  event.preventDefault()
}

function parseTextDecorationTokens(value: string) {
  const tokens = new Set<string>()
  if (value.includes('underline')) tokens.add('underline')
  if (value.includes('line-through')) tokens.add('line-through')
  return tokens
}

function buildTextDecorationValue(tokens: Set<string>) {
  return tokens.size > 0 ? Array.from(tokens).join(' ') : 'none'
}

function normalizeColor(value?: string) { return value || '#ffffff' }

function parseEditorNumericStyle(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatColorControlDetail(value: string, { mixed = false, transparentLabel = '透明' } = {}) {
  if (mixed) return '混合'
  if (isGradientValue(value)) {
    const p = parseGradient(value); return p ? `${p.stops.length} 个色标 · ${Math.round(p.angle)}°` : '渐变'
  }
  const p = parseCssColor(value)
  if (!p) return value
  return p.a <= 0 ? transparentLabel : formatCssColor(p, p.a < 1 ? 'rgba' : 'hex')
}

function getTextStrokeFallbackColor(...values: Array<string | null | undefined>) {
  for (const v of values) {
    if (!v) continue
    const p = parseCssColor(isGradientValue(v) ? getPrimaryGradientColor(parseGradient(v)?.stops ?? []) : v)
    if (p && p.a > 0) return formatCssColor(p, p.a < 1 ? 'rgba' : 'hex')
  }
  return '#ffffff'
}

/*
function getBlockElement(blockId: string | null) {
  if (!blockId) return null
  return Array.from(document.getElementById('slideContent')?.querySelectorAll<HTMLElement>('.editor-block') ?? []).find(el => el.dataset.blockId === blockId) ?? null
}
*/

/*
function getBlockEditableElement(blockId: string | null) {
  return getBlockElement(blockId)?.querySelector<HTMLElement>('[contenteditable="true"]') ?? null
}
*/

/*
function shouldRefocusEditableAfterInlineEdit() {
  const activeElement = document.activeElement as HTMLElement | null
  if (!activeElement) return true
  if (activeElement.isContentEditable) return true
  if (activeElement.closest('.kn2-sidebar, .gcp-popover')) return false
  return !activeElement.matches('input, select, textarea, button')
}

function measureAutoHeightTextBlock(blockId: string | null) {
  if (!blockId) return null
  const el = getBlockElement(blockId)
  const wrapper = el?.querySelector<HTMLElement>('.tpl-wrapper')
  const content = wrapper?.querySelector<HTMLElement>('.ProseMirror') ?? wrapper
  if (!wrapper || !content) return null
  const h = Math.max(Math.ceil(content.getBoundingClientRect().height), Math.ceil(content.scrollHeight))
  return Number.isFinite(h) && h > 0 ? h : null
}
*/

type TextInspectorState = {
  isEditing: boolean
  hasSelection: boolean
  styles: SelectedTextStyles | null
  baseFontSize: number | null
}

const MIXED_CONTROL_VALUE = '__mixed__'

/* ────────────────────────────────────────────────────────────────────────── */
/*  Sub-components                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

/** Stepper number input with ▲▼ arrows */
function StepperInput({
  value,
  onChange,
  min = -9999,
  max = 9999,
  suffix,
  prefix,
  width = 72,
  displayValue,
  liveOnInput = false,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  prefix?: React.ReactNode
  width?: React.CSSProperties['width']
  displayValue?: string
  liveOnInput?: boolean
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  // Determine the "real" underlying value being displayed. When displayValue is provided (e.g. from multiple selections showing "__mixed__" or similar),
  // we still want the internal draft to default to `value` so increment/decrement works logically from the base value,
  // but if the user *just* focuses, they might expect to see `value`.
  const [draft, setDraft] = useState(String(value))
  const [isFocused, setIsFocused] = useState(false)

  // Sync draft when external value changes, but only if we are not focused.
  // This fixes the issue where changing selection updates the parent value, but the stepper still holds the old draft.
  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value))
    }
  }, [value, isFocused])

  const commitDraft = () => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      setDraft(String(value))
      return
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }

    const nextValue = clamp(parsed)
    onChange(nextValue)
    setDraft(String(nextValue))
  }

  const adjustValue = (delta: number) => {
    const parsed = Number(draft)
    const baseValue = Number.isFinite(parsed) ? parsed : value
    const nextValue = clamp(baseValue + delta)
    setDraft(String(nextValue))
    onChange(nextValue)
  }

  return (
    <div className="kn2-stepper" style={{ width }}>
      {prefix && <span className="kn2-stepper__prefix">{prefix}</span>}
      <input
        className="kn2-stepper__input"
        type="text"
        inputMode="decimal"
        value={isFocused ? draft : (displayValue ?? String(value))}
        onFocus={(event) => {
          setIsFocused(true)
          // When focusing a mixed state, start draft from an empty string or the base value
          setDraft(String(value))
          // requestAnimationFrame ensures the select happens after the browser's default focus behavior (which might place the cursor at the end)
          const target = event.currentTarget
          requestAnimationFrame(() => target.select())
        }}
        onChange={(e) => {
          const nextDraft = e.target.value
          setDraft(nextDraft)

          if (!liveOnInput) {
            return
          }

          const trimmed = nextDraft.trim()
          if (trimmed === '' || trimmed === '-' || trimmed === '.' || trimmed === '-.') {
            return
          }

          const parsed = Number(trimmed)
          if (!Number.isFinite(parsed)) {
            return
          }

          onChange(clamp(parsed))
        }}
        onBlur={() => {
          setIsFocused(false)
          commitDraft()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setDraft(String(value))
            setIsFocused(false)
            event.currentTarget.blur()
          }
        }}
      />
      {suffix && <span className="kn2-stepper__suffix">{suffix}</span>}
      <div className="kn2-stepper__arrows">
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adjustValue(1)}
        >
          ▴
        </button>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => adjustValue(-1)}
        >
          ▾
        </button>
      </div>
    </div>
  )
}

/** iOS-style toggle */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={`kn2-toggle ${checked ? 'kn2-toggle--checked' : ''}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChange}
    >
      <span className="kn2-toggle__knob" />
    </button>
  )
}

/** macOS Keynote Segmented Control */
function KNSegmentControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (val: T) => void
}) {
  return (
    <div className="kn2-segment">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`kn2-segment__btn ${value === opt.value ? 'kn2-segment__btn--active' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Collapsible property panel with optional enabler toggle */
function KNPanel({
  title,
  enabled,
  onToggle,
  defaultOpen = true,
  children,
}: {
  title: string
  enabled?: boolean
  onToggle?: (val: boolean) => void
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  // If panel is disabled via toggle, we might auto-collapse, 
  // but let's just let it be independently togglable
  const handleHeaderClick = (e: React.MouseEvent) => {
    // don't collapse if clicking the toggle switch
    if ((e.target as HTMLElement).closest('.kn2-toggle')) return
    setIsOpen(!isOpen)
  }

  return (
    <div className="kn2-panel">
      <div className="kn2-panel__header" onClick={handleHeaderClick}>
        <ChevronRight 
          size={14} 
          className={`kn2-panel__chevron ${isOpen ? 'kn2-panel__chevron--open' : ''}`} 
        />
        <span className="kn2-panel__title">{title}</span>
        {onToggle && (
          <div className="kn2-panel__toggle">
            <Toggle checked={!!enabled} onChange={() => onToggle(!enabled)} />
          </div>
        )}
      </div>
      {isOpen && (
        <div className="kn2-panel__content">
          {children}
        </div>
      )}
    </div>
  )
}

type GradientStop = { color: string; offset: number }
type FormatTab = 'style' | 'text' | 'arrange'
type ArrangeMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** Parse a CSS linear-gradient string into { stops[], angle } or null */
function parseGradient(val: string): { stops: GradientStop[]; angle: number } | null {
  if (!val || !val.startsWith('linear-gradient')) return null

  // 1. Extract angle
  const angleMatch = val.match(/linear-gradient\(\s*([\d.]+)deg/)
  const angle = angleMatch ? Number(angleMatch[1]) : 135

  // 2. Extract stops
  // Standard format: linear-gradient(135deg, #color offset%, #color offset%, ...)
  const stopsPart = val.substring(val.indexOf(',') + 1, val.lastIndexOf(')')).trim()
  
  // This regex matches colors (hex or rgba) followed by an optional percentage offset
  const stopRegex = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s*([\d.]+)?%/g
  const stops: GradientStop[] = []
  let match
  while ((match = stopRegex.exec(stopsPart)) !== null) {
    stops.push({
      color: match[1],
      offset: match[2] !== undefined ? Number(match[2]) : 0
    })
  }

  // Fallback for the simple 2-color format we were using previously: linear-gradient(deg, col1, col2)
  if (stops.length === 0) {
    const simpleStops = stopsPart.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g)
    if (simpleStops && simpleStops.length >= 2) {
      return {
        angle,
        stops: simpleStops.map((color, index) => ({
          color,
          offset: simpleStops.length === 1 ? 0 : (index / (simpleStops.length - 1)) * 100,
        })),
      }
    }
  }

  if (stops.length < 2) return null
  return { stops, angle }
}

function buildGradientCss(stops: GradientStop[], angle: number) {
  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset)
  const stopsStr = sortedStops.map((s) => `${s.color} ${s.offset.toFixed(1)}%`).join(', ')
  return `linear-gradient(${angle}deg, ${stopsStr})`
}

function getPreferredGradientStopIndex(stops: GradientStop[]) {
  const opaqueIndex = stops.findIndex((stop) => (parseCssColor(stop.color)?.a ?? 1) > 0)
  return opaqueIndex >= 0 ? opaqueIndex : 0
}

function getPrimaryGradientColor(stops: GradientStop[]) {
  return stops[getPreferredGradientStopIndex(stops)]?.color ?? '#ffffff'
}

function getTwoStopGradientState(appearance: EditorBlock['appearance']) {
  const parsed = parseGradient(appearance.fill)
  if (parsed) {
    return {
      from: parsed.stops[0]?.color ?? '#ffffff',
      to: parsed.stops[parsed.stops.length - 1]?.color ?? parsed.stops[0]?.color ?? '#ffffff',
      angle: appearance.gradientAngle ?? parsed.angle,
    }
  }

  return {
    from: appearance.fill || '#ffffff',
    to: appearance.gradientTo ?? appearance.fill ?? '#ffffff',
    angle: appearance.gradientAngle ?? 135,
  }
}

function isGradientValue(val: string) { return val.startsWith('linear-gradient') }

function getFillControlState(appearance: EditorBlock['appearance']) {
  const parsedGradient = parseGradient(appearance.fill)
  const isGradient = appearance.fillType === 'gradient' || !!parsedGradient

  if (isGradient) {
    const fallbackGradient = getTwoStopGradientState(appearance)
    const stops = parsedGradient?.stops ?? [
      { color: fallbackGradient.from, offset: 0 },
      { color: fallbackGradient.to, offset: 100 },
    ]
    const angle = appearance.gradientAngle ?? parsedGradient?.angle ?? fallbackGradient.angle

    return {
      value: parsedGradient ? appearance.fill : buildGradientCss(stops, angle),
      detail: `${stops.length} 个色标 · ${Math.round(angle)}°`,
      primaryColor: stops[0]?.color ?? fallbackGradient.from,
      gradientTo: stops[stops.length - 1]?.color ?? fallbackGradient.to,
      angle,
    }
  }

  const value = normalizeColor(appearance.fill)
  const parsedColor = parseCssColor(value)
  return {
    value,
    detail: parsedColor ? formatCssColor(parsedColor, parsedColor.a < 1 ? 'rgba' : 'hex') : value,
    primaryColor: value,
    gradientTo: appearance.gradientTo ?? value,
    angle: appearance.gradientAngle ?? 135,
  }
}

type ColorFormat = 'hex' | 'rgba'

const DEFAULT_RGBA: RgbaColor = { r: 255, g: 255, b: 255, a: 1 }

function parsePickerColor(value?: string | null) {
  return parseCssColor(value) ?? DEFAULT_RGBA
}

function prefersRgbaFormat(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === 'transparent'
    || normalized.startsWith('rgb')
    || normalized.startsWith('#') && normalized.length === 9
}

const PALETTE = [
  '#ffffff','#d1d5db','#6b7280','#111827',
  '#ef4444','#f97316','#eab308','#22c55e',
  '#06b6d4','#3b82f6','#8b5cf6','#ec4899',
  '#0f172a','#1e3a5f','#1a1a2e','#0d0d0d',
]

const GRADIENT_PRESETS: { stops: GradientStop[]; angle: number }[] = [
  { stops: [{ color: '#60a5fa', offset: 0 }, { color: '#a78bfa', offset: 100 }], angle: 135 },
  { stops: [{ color: '#f97316', offset: 0 }, { color: '#ef4444', offset: 100 }], angle: 135 },
  { stops: [{ color: '#34d399', offset: 0 }, { color: '#06b6d4', offset: 100 }], angle: 135 },
  { stops: [{ color: '#fbbf24', offset: 0 }, { color: '#f97316', offset: 100 }], angle: 135 },
  { stops: [{ color: '#e879f9', offset: 0 }, { color: '#818cf8', offset: 100 }], angle: 135 },
  { stops: [{ color: '#f0abfc', offset: 0 }, { color: '#fda4af', offset: 100 }], angle: 135 },
  { stops: [{ color: '#ffffff', offset: 0 }, { color: 'rgba(255,255,255,0)', offset: 100 }], angle: 180 },
  { stops: [{ color: '#0f172a', offset: 0 }, { color: '#1e40af', offset: 100 }], angle: 135 },
]

/** Grouped buttons for alignments, font styles, etc. */
function KNPillGroup<T extends string>({
  options,
  value, // can be a single string or an array for multiple selections
  onChange,
  stretch = false,
}: {
  options: { icon: React.ReactNode; value: T; label?: string }[]
  value: T | T[]
  onChange: (val: T) => void
  stretch?: boolean
}) {
  const isSelected = (val: T) => Array.isArray(value) ? value.includes(val) : value === val
  return (
    <div className={`kn2-pill-group ${stretch ? 'kn2-pill-group--stretch' : ''}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          title={opt.label}
          onMouseDown={preventMouseFocusSteal}
          onClick={() => onChange(opt.value)}
          className={`kn2-pill-btn ${stretch ? 'kn2-pill-btn--stretch' : ''} ${isSelected(opt.value) ? 'kn2-pill-btn--active' : ''}`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}

/** A sliding row for precise numeric properties: Label + Slider + Numeric Input */
function KNSliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  inputWidth,
  displayValue,
  liveOnInput = false,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  inputWidth?: React.CSSProperties['width']
  displayValue?: string
  liveOnInput?: boolean
  onChange: (val: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const safeValue = clamp(value)
  const percent = max === min ? 0 : ((safeValue - min) / (max - min)) * 100
  const thumbSize = 14

  return (
    <div className={`kn2-slider-row ${!label ? 'kn2-slider-row--no-label' : ''}`}>
      {label && <span className="kn2-slider-row__label">{label}</span>}
      <div className="kn2-slider-row__track-shell">
        <div className="kn2-slider-row__track-core">
          <div className="kn2-slider-row__rail" />
          <div
            className="kn2-slider-row__fill"
            style={{ width: `${percent}%` }}
          />
          <div
            className="kn2-slider-row__thumb"
            style={{ left: `calc(${percent}% - ${thumbSize / 2}px)` }}
          />
        </div>
        <input
          type="range"
          className="kn2-slider-row__track"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          aria-label={label || '调节数值'}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <StepperInput
        value={safeValue}
        onChange={(nextValue) => onChange(clamp(nextValue))}
        min={min}
        max={max}
        suffix={unit}
        width={inputWidth ?? (!label ? 46 : (unit === '%' ? 58 : 52))}
        displayValue={displayValue}
        liveOnInput={liveOnInput}
      />
    </div>
  )
}

/** A specialized row for angle properties: Dial + Numeric Input */
function KNAngleRow({
  label,
  value,
  stepperWidth,
  onChange,
}: {
  label: string
  value: number
  stepperWidth?: React.CSSProperties['width']
  onChange: (val: number) => void
}) {
  const safeValue = Math.round(value || 0) % 360
  return (
    <div className={`kn2-angle-row ${!label ? 'kn2-angle-row--no-label' : ''}`}>
      {label && <span className="kn2-angle-row__label">{label}</span>}
      <div className="kn2-angle-control-group">
        <RotationDial angle={safeValue} onChange={onChange} />
        <div className="kn2-angle-input-shell">
          <StepperInput
            value={safeValue}
            onChange={(v) => onChange(((v % 360) + 360) % 360)}
            min={-360}
            max={720}
            suffix="°"
            width={stepperWidth ?? '100%'}
          />
        </div>
      </div>
    </div>
  )
}

function BoxModelControl({
  title,
  values,
  onChange,
}: {
  title: string
  values: {
    top: number
    right: number
    bottom: number
    left: number
  }
  onChange: (updates: Partial<{ top: number; right: number; bottom: number; left: number }>) => void
}) {
  const [isLinked, setIsLinked] = useState(false)

  const fields: Array<{ key: 'top' | 'bottom' | 'left' | 'right'; label: string }> = [
    { key: 'top', label: '上' },
    { key: 'bottom', label: '下' },
    { key: 'left', label: '左' },
    { key: 'right', label: '右' },
  ]

  const handleChange = (key: 'top' | 'bottom' | 'left' | 'right', value: number) => {
    if (isLinked) {
      onChange({ top: value, right: value, bottom: value, left: value })
    } else {
      onChange({ [key]: value })
    }
  }

  return (
    <div className="kn2-box-model" onMouseDown={preventMouseFocusSteal}>
      <div className="kn2-box-model__header">
        <div className="kn2-box-model__title">{title}</div>
        <button
          type="button"
          className={`kn2-link-btn ${isLinked ? 'kn2-link-btn--active' : ''}`}
          onClick={() => setIsLinked(!isLinked)}
          title={isLinked ? '取消关联' : '关联边距'}
        >
          <Link2 size={12} />
        </button>
      </div>
      <div className="kn2-box-model__grid">
        {fields.map((field) => (
          <div key={field.key} className="kn2-box-model__field">
            <StepperInput
              prefix={<span style={{ fontWeight: 500 }}>{field.label}</span>}
              value={values[field.key]}
              onChange={(value) => handleChange(field.key, value)}
              min={0}
              max={999}
              width="100%"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/** A visual bar for managing many color stops */
function GradientBar({
  stops,
  activeStopIndex,
  onSetActiveStop,
  onAddStop,
  onUpdateStop,
  onRemoveStop,
}: {
  stops: GradientStop[]
  activeStopIndex: number
  onSetActiveStop: (i: number) => void
  onAddStop: (offset: number) => void
  onUpdateStop: (i: number, offset: number) => void
  onRemoveStop: (i: number) => void
}) {
  const barRef = useRef<HTMLDivElement>(null)

  const handleBarClick = (e: React.MouseEvent) => {
    if (!barRef.current) return
    const rect = barRef.current.getBoundingClientRect()
    const offset = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    onAddStop(Math.max(0, Math.min(100, offset)))
  }

  return (
    <div className="gcp-bar-container">
      <div
        className="gcp-bar-track"
        ref={barRef}
        style={{ background: buildGradientCss(stops, 90) }}
        onClick={handleBarClick}
      />
      {stops.map((s, i) => (
        <div
          key={i}
          className={`gcp-bar-stop ${activeStopIndex === i ? 'gcp-bar-stop--active' : ''}`}
          style={{ left: `${s.offset}%` }}
          onMouseDown={(e) => {
            e.stopPropagation()
            onSetActiveStop(i)
            const startX = e.clientX
            const startOffset = s.offset
            const handleMove = (em: MouseEvent) => {
              if (!barRef.current) return
              const rect = barRef.current.getBoundingClientRect()
              const deltaX = em.clientX - startX
              const deltaOffset = (deltaX / rect.width) * 100
              onUpdateStop(i, Math.max(0, Math.min(100, startOffset + deltaOffset)))
            }
            const handleUp = (eu: MouseEvent) => {
              if (stops.length > 2 && Math.abs(eu.clientY - e.clientY) > 60) {
                onRemoveStop(i)
              }
              window.removeEventListener('mousemove', handleMove)
              window.removeEventListener('mouseup', handleUp)
            }
            window.addEventListener('mousemove', handleMove)
            window.addEventListener('mouseup', handleUp)
          }}
        >
          <div className="gcp-bar-stop-inner" style={{ backgroundColor: s.color }} />
        </div>
      ))}
    </div>
  )
}

/** A full-featured color+gradient picker with popover */
function GradientColorPicker({
  value,
  onChange,
  allowGradient = true,
  triggerVariant = 'swatch',
  triggerLabel,
  triggerDetail,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
  allowGradient?: boolean
  triggerVariant?: 'swatch' | 'field'
  triggerLabel?: string
  triggerDetail?: string
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'solid' | 'gradient'>(allowGradient && isGradientValue(value) ? 'gradient' : 'solid')
  const ref = useRef<HTMLDivElement>(null)
  const swatchRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const fallbackGradient = { stops: [{ color: '#3b82f6', offset: 0 }, { color: '#8b5cf6', offset: 100 }], angle: 135 }
  const externalGradient = parseGradient(value)
  const [stops, setStops] = useState<GradientStop[]>(externalGradient?.stops ?? fallbackGradient.stops)
  const [angle, setAngle] = useState(externalGradient?.angle ?? fallbackGradient.angle)
  const [activeIndex, setActiveIndex] = useState(() => getPreferredGradientStopIndex(externalGradient?.stops ?? fallbackGradient.stops))
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  const gradientStops = externalGradient?.stops ?? stops
  const activeStop = stops[activeIndex] || stops[0] || fallbackGradient.stops[0]
  const solidSource = isGradientValue(value) ? getPrimaryGradientColor(gradientStops) : (value || '#ffffff')
  const solidParsed = parsePickerColor(solidSource)
  const solidFormat: ColorFormat = solidParsed.a < 1 || prefersRgbaFormat(solidSource) ? 'rgba' : 'hex'
  const activeStopParsed = parsePickerColor(activeStop.color)
  const activeStopFormat: ColorFormat = activeStopParsed.a < 1 || prefersRgbaFormat(activeStop.color) ? 'rgba' : 'hex'
  const [solidDraft, setSolidDraft] = useState(() => formatCssColor(solidParsed, solidFormat))
  const [activeStopDraft, setActiveStopDraft] = useState(() => formatCssColor(activeStopParsed, activeStopFormat))

  const syncExternalState = useEffectEvent((nextValue: string) => {
    const nextGradient = parseGradient(nextValue)
    const nextTab: 'solid' | 'gradient' = allowGradient && isGradientValue(nextValue) ? 'gradient' : 'solid'
    setTab((current) => (current === nextTab ? current : nextTab))

    if (!nextGradient) return

    setStops(nextGradient.stops)
    setAngle(nextGradient.angle)
    setActiveIndex((current) => {
      if (current >= 0 && current < nextGradient.stops.length) {
        return current
      }
      return getPreferredGradientStopIndex(nextGradient.stops)
    })
  })

  const syncSolidDraft = useEffectEvent(() => {
    setSolidDraft(formatCssColor(solidParsed, solidFormat))
  })

  const syncActiveStopDraft = useEffectEvent(() => {
    setActiveStopDraft(formatCssColor(activeStopParsed, activeStopFormat))
  })

  useEffect(() => {
    syncExternalState(value)
  }, [allowGradient, value])

  useEffect(() => {
    syncSolidDraft()
  }, [solidSource, solidParsed.a, solidParsed.b, solidParsed.g, solidParsed.r, solidFormat])

  useEffect(() => {
    syncActiveStopDraft()
  }, [
    activeIndex,
    activeStop.color,
    activeStopFormat,
    activeStopParsed.a,
    activeStopParsed.b,
    activeStopParsed.g,
    activeStopParsed.r,
  ])

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent) => {
      const target = event.target as Node
      const insideTrigger = ref.current?.contains(target) ?? false
      const insidePopover = popoverRef.current?.contains(target) ?? false
      if (!insideTrigger && !insidePopover) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const syncPopoverPosition = useEffectEvent(() => {
    const trigger = swatchRef.current
    if (!trigger) return

    const viewportPadding = 12
    const gutter = 10
    const preferredWidth = 316
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(preferredWidth, window.innerWidth - viewportPadding * 2)
    let left = rect.right - width
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - viewportPadding - width))

    const measuredHeight = popoverRef.current?.offsetHeight ?? 0
    let top = rect.bottom + gutter
    if (measuredHeight > 0 && top + measuredHeight > window.innerHeight - viewportPadding) {
      const topAbove = rect.top - gutter - measuredHeight
      top = topAbove >= viewportPadding
        ? topAbove
        : Math.max(viewportPadding, window.innerHeight - viewportPadding - measuredHeight)
    }

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      width,
    })
  })

  useEffect(() => {
    if (!open) return
    syncPopoverPosition()

    const update = () => syncPopoverPosition()
    const frame = window.requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  const emitGradient = (nextStops = stops, nextAngle = angle) => {
    onChange(buildGradientCss(nextStops, nextAngle))
  }

  const applySolidColor = (nextColor: RgbaColor, preferred = solidFormat) => {
    const nextValue = formatCssColor(nextColor, nextColor.a < 1 ? 'rgba' : preferred)
    setSolidDraft(nextValue)
    onChange(nextValue)
  }

  const commitSolidDraft = () => {
    const parsedColor = parseCssColor(solidDraft)
    if (!parsedColor) {
      setSolidDraft(formatCssColor(solidParsed, solidFormat))
      return
    }

    applySolidColor(
      parsedColor,
      parsedColor.a < 1 || prefersRgbaFormat(solidDraft) ? 'rgba' : 'hex',
    )
  }

  const applyActiveStopColor = (nextColor: RgbaColor, preferred = activeStopFormat) => {
    const nextValue = formatCssColor(nextColor, nextColor.a < 1 ? 'rgba' : preferred)
    const nextStops = stops.map((stop, index) => (
      index === activeIndex ? { ...stop, color: nextValue } : stop
    ))
    setStops(nextStops)
    setActiveStopDraft(nextValue)
    emitGradient(nextStops)
  }

  const commitActiveStopDraft = () => {
    const parsedColor = parseCssColor(activeStopDraft)
    if (!parsedColor) {
      setActiveStopDraft(formatCssColor(activeStopParsed, activeStopFormat))
      return
    }

    applyActiveStopColor(
      parsedColor,
      parsedColor.a < 1 || prefersRgbaFormat(activeStopDraft) ? 'rgba' : 'hex',
    )
  }

  const openPopover = () => {
    if (allowGradient && isGradientValue(value)) {
      setActiveIndex(getPreferredGradientStopIndex(gradientStops))
    }
    setOpen((current) => !current)
  }

  const isFieldTrigger = triggerVariant === 'field'

  return (
    <div className={`gcp-root ${isFieldTrigger ? 'gcp-root--field' : ''}`} ref={ref}>
      <button
        type="button"
        className={isFieldTrigger ? 'gcp-trigger gcp-trigger--field' : 'gcp-swatch'}
        onMouseDown={preventMouseFocusSteal}
        onClick={openPopover}
        title={value}
        ref={swatchRef}
      >
        {isFieldTrigger ? (
          <>
            <span className="gcp-trigger__preview">
              <span className="gcp-trigger__preview-fill" style={{ background: value || 'transparent' }} />
            </span>
            <span className="gcp-trigger__meta">
              <span className="gcp-trigger__title">{triggerLabel || '编辑填充'}</span>
              <span className="gcp-trigger__detail">{triggerDetail || value}</span>
            </span>
            <ChevronRight size={14} className="gcp-trigger__chevron" />
          </>
        ) : (
          <span className="gcp-swatch__fill" style={{ background: value || 'transparent' }} />
        )}
      </button>

      {open && createPortal(
        <div
          className="gcp-popover"
          ref={popoverRef}
          style={popoverStyle}
          // CRITICAL: Prevent clicks inside the color picker from stealing focus from the editable text
          onMouseDown={(e) => {
            const isInput = (e.target as HTMLElement)?.tagName === 'INPUT'
            if (!isInput) {
              e.preventDefault()
            }
            e.stopPropagation() // Also stop propagation for the popover itself
          }}
        >
          {allowGradient && (
            <div className="gcp-tabs">
              <button type="button" className={`gcp-tab ${tab === 'solid' ? 'gcp-tab--active' : ''}`} onClick={() => setTab('solid')}>实色</button>
              <button type="button" className={`gcp-tab ${tab === 'gradient' ? 'gcp-tab--active' : ''}`} onClick={() => setTab('gradient')}>渐变</button>
            </div>
          )}

          <div className="gcp-body">
            {tab === 'solid' ? (
              <div className="gcp-stack">
                <div className="gcp-field-row">
                  <span className="gcp-field-label">颜色</span>
                  <div className="gcp-native-row">
                    <input
                      type="color"
                      className="gcp-native-color"
                      value={rgbaToHex(solidParsed)}
                      onChange={(e) => applySolidColor(withAlpha(parsePickerColor(e.target.value), solidParsed.a), solidFormat)}
                    />
                    <input
                      type="text"
                      className="gcp-hex-input"
                      value={solidDraft}
                      onChange={(e) => setSolidDraft(e.target.value)}
                      onBlur={commitSolidDraft}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitSolidDraft()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          setSolidDraft(formatCssColor(solidParsed, solidFormat))
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="gcp-field-row">
                  <span className="gcp-field-label">不透明</span>
                  <KNSliderRow
                    label=""
                    value={Math.round(solidParsed.a * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    inputWidth={92}
                    onChange={(nextValue) => applySolidColor(withAlpha(solidParsed, nextValue / 100), 'rgba')}
                  />
                </div>
                <div className="gcp-palette">
                  {PALETTE.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="gcp-palette-sw"
                      onClick={() => applySolidColor(withAlpha(parsePickerColor(color), solidParsed.a), solidParsed.a < 1 ? 'rgba' : 'hex')}
                    >
                      <span
                        className="gcp-palette-sw__fill"
                        style={{ background: formatCssColor(withAlpha(parsePickerColor(color), solidParsed.a), solidParsed.a < 1 ? 'rgba' : 'hex') }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="gcp-stack gcp-stack--gradient">
                <GradientBar
                  stops={stops}
                  activeStopIndex={activeIndex}
                  onSetActiveStop={setActiveIndex}
                  onAddStop={(off) => {
                    const nextStops = [...stops, { color: activeStop.color, offset: off }].sort((a, b) => a.offset - b.offset)
                    setStops(nextStops)
                    setActiveIndex(nextStops.findIndex((stop) => stop.offset === off))
                    emitGradient(nextStops)
                  }}
                  onUpdateStop={(idx, off) => {
                    const nextStops = [...stops]
                    nextStops[idx] = { ...nextStops[idx], offset: off }
                    setStops(nextStops)
                    emitGradient(nextStops)
                  }}
                  onRemoveStop={(idx) => {
                    if (stops.length <= 2) return
                    const nextStops = stops.filter((_, index) => index !== idx)
                    setStops(nextStops)
                    setActiveIndex(Math.min(activeIndex, nextStops.length - 1))
                    emitGradient(nextStops)
                  }}
                />
                <div className="gcp-field-row">
                  <span className="gcp-field-label">颜色</span>
                  <div className="gcp-native-row">
                    <input
                      type="color"
                      className="gcp-native-color"
                      value={rgbaToHex(activeStopParsed)}
                      onChange={(e) => applyActiveStopColor(withAlpha(parsePickerColor(e.target.value), activeStopParsed.a), activeStopFormat)}
                    />
                    <input
                      type="text"
                      className="gcp-hex-input"
                      value={activeStopDraft}
                      onChange={(e) => setActiveStopDraft(e.target.value)}
                      onBlur={commitActiveStopDraft}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitActiveStopDraft()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          setActiveStopDraft(formatCssColor(activeStopParsed, activeStopFormat))
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="gcp-field-row">
                  <span className="gcp-field-label">不透明</span>
                  <KNSliderRow
                    label=""
                    value={Math.round(activeStopParsed.a * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    inputWidth={92}
                    onChange={(nextValue) => applyActiveStopColor(withAlpha(activeStopParsed, nextValue / 100), 'rgba')}
                  />
                </div>
                <div className="gcp-field-row">
                  <span className="gcp-field-label">角度</span>
                  <KNAngleRow
                    label=""
                    value={angle}
                    stepperWidth={104}
                    onChange={(nextValue) => {
                      setAngle(nextValue)
                      emitGradient(stops, nextValue)
                    }}
                  />
                </div>
                <div className="gcp-palette">
                  {GRADIENT_PRESETS.map((preset, index) => (
                    <button
                      key={index}
                      type="button"
                      className="gcp-palette-sw"
                      onClick={() => {
                        setStops(preset.stops)
                        setAngle(preset.angle)
                        setActiveIndex(getPreferredGradientStopIndex(preset.stops))
                        emitGradient(preset.stops, preset.angle)
                      }}
                    >
                      <span className="gcp-palette-sw__fill" style={{ background: buildGradientCss(preset.stops, preset.angle) }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}


/** Keep old name as alias so existing JSX doesn't break */
const ColorSwatch = GradientColorPicker


/** Generic pill select (full-width) */
type KNSelectProps = {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
  disabled?: boolean
}

function KNSelect({ value, onChange, children, style, className, disabled }: KNSelectProps) {
  return (
    <div className={`kn2-select-wrap ${className || ''} ${disabled ? 'kn2-select-wrap--disabled' : ''}`} style={style}>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled}
        className="kn2-select-mac kn2-select-native"
      >
        {children}
      </select>
      <ChevronDown size={14} className="kn2-select-chevron" />
    </div>
  )
}

/** Section divider */
function Divider() {
  return <div className="kn2-divider" />
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main Component                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function SidebarRight() {
  const {
    slides,
    currentSlideId,
    activeBlockId,
    selectedBlockIds,
    editingTextBlockId,
    activeInspector,
    setActiveInspector,
    applySlideLayout,
    updateSlide,
    updateBlock,
    updateBlocks,
    updateBlockAnimation,
    addBlockAction,
    removeBlockAction,
    moveBlockAnimation,
    setActiveBlock,
    bringBlockToFront,
    sendBlockToBack,
    bringBlockForward,
    sendBlockBackward,
    alignBlock,
    groupBlocks,
    deleteBlocks,
    ungroupBlocks,
    activeEditor,
    showGrid,
    showGuides,
    updatePresentation,
  } = useEditorStore()

  const currentSlide = slides.find((s) => s.id === currentSlideId)
  const activeBlock = currentSlide?.blocks.find((b) => b.id === activeBlockId)
  const selectedBlocks = currentSlide?.blocks.filter((block) => selectedBlockIds.includes(block.id)) ?? []
  const selectedBlockIdsOnSlide = selectedBlocks.map((block) => block.id)
  const selectionIds = selectedBlockIdsOnSlide.length > 0
    ? selectedBlockIdsOnSlide
    : activeBlock
    ? [activeBlock.id]
    : []
  const selectionBounds = currentSlide ? getSelectionBounds(currentSlide.blocks, selectionIds) : null
  const isGroupSelection = selectionIds.length > 1 && !!selectionBounds
  const canGroupSelection = selectionIds.length > 1
  const canUngroupSelection = selectedBlocks.some((block) => block.groupId)
  const unlockSelection = selectedBlocks.length > 0 && selectedBlocks.every((block) => block.locked)
  const buildOrder = currentSlide ? getSlideBuildOrder(currentSlide) : []

  const [formatTab, setFormatTab] = useState<FormatTab>('text')
  const [animationTab, setAnimationTab] = useState<AnimationPhase>('buildIn')
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [isBuildOrderOpen, setBuildOrderOpen] = useState(false)
  const [previewLoopKey, setPreviewLoopKey] = useState<string | null>(null)
  const [textInspector, setTextInspector] = useState<TextInspectorState>({
    isEditing: false,
    hasSelection: false,
    styles: null,
    baseFontSize: null,
  })

  const activeAnimations = activeBlock ? getBlockAnimations(activeBlock) : null
  
  const isActionTab = animationTab === 'action'
  const actionList = activeAnimations?.action ?? []
  const selectedAction = isActionTab ? (actionList.find(a => a.id === activeActionId) || actionList[0] || null) : null
  
  const activeAnimation = isActionTab ? selectedAction : (activeAnimations?.[animationTab] ?? null)
  const activeActionAnim = isActionTab ? selectedAction : null

  const syncAnimationTab = useEffectEvent(() => {
    if (activeInspector !== 'animate' || !activeBlock || !activeAnimations) return

    // If the currently selected tab has an animation, stay on it.
    if (animationTab === 'action' ? activeAnimations.action.some(a => a.effect !== 'none') : (activeAnimations[animationTab] as any)?.effect !== 'none') return

    // Otherwise, find the first tab that has an animation and switch to it.
    const phases: AnimationPhase[] = ['buildIn', 'action', 'buildOut']
    const firstActive = phases.find((phase) => {
      if (phase === 'action') return activeAnimations.action.some(a => a.effect !== 'none')
      const animation = activeAnimations[phase] as any
      return animation && animation.effect !== 'none'
    })

    if (firstActive && firstActive !== animationTab) {
      setAnimationTab(firstActive)
    }
  })

  useEffect(() => {
    syncAnimationTab()
  }, [activeInspector, activeBlock?.id])

  const currentPreviewKey = activeBlock ? `${activeBlock.id}:${animationTab}${isActionTab && activeActionId ? `:${activeActionId}` : ''}` : null
  const isPreviewing = currentPreviewKey !== null && previewLoopKey === currentPreviewKey

  /* ESC closes build order modal */
  useEffect(() => {
    if (!isBuildOrderOpen) return
    const h = (e: KeyboardEvent) => { if (e.code === 'Escape') setBuildOrderOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isBuildOrderOpen])

  useEffect(() => {
    const handleSelectionChange = () => {
      // @ts-ignore
      if (typeof rememberEditableSelection !== 'undefined') rememberEditableSelection()
    }
    const handleMouseDownCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('.kn2-sidebar, .gcp-popover')) {
        // @ts-ignore
        if (typeof requestEditableSelectionPreservation !== 'undefined') requestEditableSelectionPreservation()
      }
    }

    document.addEventListener('mousedown', handleMouseDownCapture, true)
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('mousedown', handleMouseDownCapture, true)
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [])

  const syncTextInspector = useEffectEvent(() => {
    if (!activeEditor) {
      setTextInspector({ isEditing: false, hasSelection: false, styles: null, baseFontSize: null })
      return
    }

    const { from, to } = activeEditor.state.selection
    const hasSelection = from !== to
    const attributes = activeEditor.getAttributes('textStyle')
    const decorationTokens = new Set<string>()
    if (activeEditor.isActive('underline')) decorationTokens.add('underline')
    if (activeEditor.isActive('strike')) decorationTokens.add('line-through')
    
    // In mixed font size states, `attributes.fontSize` is undefined, but we still need the size of the first text node.
    let baseFontSize: number | null = null
    activeEditor.state.doc.nodesBetween(from, to, (node) => {
      if (node.isText && baseFontSize === null) {
        // Tiptap's TextStyle mark stores styles in node.marks
        const textStyleMark = node.marks.find((m) => m.type.name === 'textStyle')
        if (textStyleMark && textStyleMark.attrs.fontSize) {
          baseFontSize = parseEditorNumericStyle(textStyleMark.attrs.fontSize)
        }
      }
    })

    // Convert TipTap attributes to SelectedTextStyles format
    const styles: SelectedTextStyles = {
      fontFamily: attributes.fontFamily || null,
      fontSize: parseEditorNumericStyle(attributes.fontSize),
      fontWeight: attributes.fontWeight || (activeEditor.isActive('bold') ? 'bold' : 'normal'),
      fontStyle: activeEditor.isActive('italic') ? 'italic' : 'normal',
      textDecoration: buildTextDecorationValue(decorationTokens),
      textAlign: (activeEditor.getAttributes('paragraph').textAlign || activeEditor.getAttributes('heading').textAlign || 'left') as any,
      letterSpacing: parseEditorNumericStyle(attributes.letterSpacing),
      lineHeight: parseEditorNumericStyle(attributes.lineHeight),
      textColor: attributes.textFill || null,
      textStrokeColor: attributes.textStrokeColor || null,
      textStrokeWidth: parseEditorNumericStyle(attributes.textStrokeWidth),
      isBold: activeEditor.isActive('bold') || ['bold', '600', '700', '800', '900'].includes(String(attributes.fontWeight || '')),
      isItalic: activeEditor.isActive('italic'),
      isUnderline: activeEditor.isActive('underline'),
      isStrikeThrough: activeEditor.isActive('strike'),
    }

    setTextInspector({
      isEditing: true,
      hasSelection,
      styles,
      baseFontSize,
    })
  })

  useEffect(() => {
    if (!activeEditor) {
      syncTextInspector()
      return
    }

    activeEditor.on('selectionUpdate', syncTextInspector)
    activeEditor.on('transaction', syncTextInspector)
    syncTextInspector()

    return () => {
      activeEditor.off('selectionUpdate', syncTextInspector)
      activeEditor.off('transaction', syncTextInspector)
    }
  }, [activeEditor])

  useEffect(() => {
    // @ts-ignore
    if (!editingTextBlockId || (typeof savedEditableSelection !== 'undefined' && savedEditableSelection?.blockId !== editingTextBlockId)) {
      // @ts-ignore
      if (typeof clearSavedEditableSelections !== 'undefined') clearSavedEditableSelections()
    }
  }, [editingTextBlockId, currentSlideId])

  useEffect(() => () => {
    // @ts-ignore
    if (typeof clearSavedEditableSelections !== 'undefined') clearSavedEditableSelections()
  }, [])

  const previewRef = useRef<{ key: string; element: HTMLElement; block: typeof activeBlock } | null>(null)

  const stopPreview = () => {
    if (previewRef.current?.block) {
      restoreBlockAfterPreview(previewRef.current.element, previewRef.current.block)
    }
    previewRef.current = null
    setPreviewLoopKey(null)
  }

  useEffect(() => () => stopPreview(), [activeBlockId, animationTab, activeActionId, currentSlideId])

  const handleTabChange = (tab: InspectorTab) => {
    if (tab !== 'animate') { stopPreview(); setBuildOrderOpen(false) }
    setActiveInspector(tab)
  }

  const handlePreview = () => {
    if (!activeBlock) return
    const el = Array.from(
      document.getElementById('slideContent')?.querySelectorAll<HTMLElement>('.editor-block') ?? []
    ).find((c) => c.dataset.blockId === activeBlock.id)
    if (!el) return
    if (isPreviewing) { stopPreview(); return }
    stopPreview()
    const targetActionId = isActionTab ? (activeActionId ?? actionList[0]?.id) : undefined
    const started = previewBlockPhase(el, activeBlock, animationTab, targetActionId)
    if (!started) return
    if (animationTab === 'action' && activeActionAnim?.loop && currentPreviewKey) {
      previewRef.current = { key: currentPreviewKey, element: el, block: activeBlock }
      setPreviewLoopKey(currentPreviewKey)
    }
  }

  const updateAnim = (updates: Partial<{ effect: string; trigger: TriggerType; duration: number; delay: number; order: number; loop: boolean }>) => {
    if (!currentSlide || !activeBlock) return
    stopPreview()
    const targetActionId = isActionTab ? (activeActionId ?? actionList[0]?.id) : undefined
    updateBlockAnimation(currentSlide.id, activeBlock.id, animationTab, updates, targetActionId)
  }

  const upd = (field: Parameters<typeof updateBlock>[2]) => {
    if (currentSlide && activeBlock) updateBlock(currentSlide.id, activeBlock.id, field)
  }
  const updApp = (app: Partial<EditorBlock['appearance']>) => upd({ appearance: app })
  const setFillType = (nextType: 'none' | 'color' | 'gradient') => {
    if (!activeBlock) return

    if (nextType === 'none') {
      updApp({ fillType: 'none' })
      return
    }

    const fillControl = getFillControlState(activeBlock.appearance)

    if (nextType === 'color') {
      updApp({
        fillType: 'color',
        fill: fillControl.primaryColor,
      })
      return
    }

    const gradientState = getTwoStopGradientState(activeBlock.appearance)
    const gradientValue = isGradientValue(fillControl.value)
      ? fillControl.value
      : buildGradientCss(
          [
            { color: gradientState.from, offset: 0 },
            { color: gradientState.to, offset: 100 },
          ],
          gradientState.angle,
        )

    updApp({
      fillType: 'gradient',
      fill: gradientValue,
      gradientTo: gradientState.to,
      gradientAngle: gradientState.angle,
    })
  }
  const updateFillColorValue = (nextValue: string) => {
    if (!activeBlock) return

    if (isGradientValue(nextValue)) {
      const parsed = parseGradient(nextValue)
      const lastStop = parsed?.stops[parsed.stops.length - 1]
      updApp({
        fillType: 'gradient',
        fill: nextValue,
        gradientTo: lastStop?.color ?? activeBlock.appearance.gradientTo ?? activeBlock.appearance.fill,
        gradientAngle: parsed?.angle ?? activeBlock.appearance.gradientAngle ?? 135,
      })
      return
    }

    updApp({ fillType: 'color', fill: nextValue })
  }
  /*
  const restoreInlineSelection = () => {
    if (!activeBlock) return
    if (editingTextBlockId !== activeBlock.id) return

    if (activeEditor) {
      activeEditor.commands.focus()
    }
  }

  const canApplyToSelectedText = () => (
    activeBlock &&
    editingTextBlockId === activeBlock.id &&
    activeEditor &&
    textInspector.isEditing &&
    textInspector.hasSelection
  )
  */
  const applyTextFill = (color: string) => {
    if (!activeBlock) return
    if (isInlineTextEditing) {
      applyRichTextTextFill(color, activeEditor)
    } else {
      updApp({ textColor: color })
    }
  }

  const applyTextStroke = ({
    color,
    width,
  }: {
    color?: string
    width?: number
  }) => {
    if (!activeBlock) return
    const nextWidth = Math.max(0, width ?? displayedTextStrokeWidth)
    const nextColor = nextWidth > 0
      ? (color ?? getTextStrokeFallbackColor(
          displayedTextStrokeColor,
          displayedTextColor,
          activeBlock.appearance.textStrokeColor,
          activeBlock.appearance.textColor,
        ))
      : 'transparent'

    if (isInlineTextEditing) {
      applyRichTextTextStroke({ color: nextColor, width: nextWidth }, activeEditor)
    } else {
      updApp({
        textStrokeColor: nextColor,
        textStrokeWidth: nextWidth,
      })
    }
  }

  const applyFontSize = (fontSize: number) => {
    if (!activeBlock) return
    if (isInlineTextEditing) {
      applyRichTextFontSize(fontSize, activeEditor)
    } else {
      updApp({ fontSize })
    }
  }

  const applyFontFamily = (fontFamily: string) => {
    if (!activeBlock) return
    if (isInlineTextEditing) {
      applyRichTextFontFamily(fontFamily, activeEditor)
    } else {
      updApp({ fontFamily })
    }
  }

  const applyFontWeight = (fontWeight: string) => {
    if (!activeBlock) return
    if (isInlineTextEditing) {
      applyRichTextFontWeight(fontWeight, activeEditor)
    } else {
      updApp({ fontWeight })
    }
  }

  const applyTextAlign = (textAlign: NonNullable<EditorBlock['appearance']['textAlign']>) => {
    if (!activeBlock) return
    if (isInlineTextEditing) {
      applyRichTextTextAlign(textAlign, activeEditor)
    } else {
      updApp({ textAlign })
    }
  }

  const applyLetterSpacing = (letterSpacing: number) => {
    if (!activeBlock) return
    if (isInlineTextEditing) {
      applyRichTextLetterSpacing(letterSpacing, activeEditor)
    } else {
      updApp({ letterSpacing })
    }
  }

  const applyLineHeight = (lineHeight: number) => {
    if (!activeBlock) return
    if (isInlineTextEditing) {
      applyRichTextLineHeight(lineHeight, activeEditor)
    } else {
      updApp({ lineHeight })
    }
  }
  const applyArrangeX = (nextX: number) => {
    if (!currentSlide || !activeBlock) return
    if (!isGroupSelection || !selectionBounds) {
      upd({ x: nextX })
      return
    }

    updateBlocks(currentSlide.id, buildMoveSelectionUpdates(currentSlide.blocks, selectionIds, nextX, selectionBounds.y))
  }
  const applyArrangeY = (nextY: number) => {
    if (!currentSlide || !activeBlock) return
    if (!isGroupSelection || !selectionBounds) {
      upd({ y: nextY })
      return
    }

    updateBlocks(currentSlide.id, buildMoveSelectionUpdates(currentSlide.blocks, selectionIds, selectionBounds.x, nextY))
  }
  const applyArrangeWidth = (nextWidth: number) => {
    if (!currentSlide || !activeBlock) return
    const width = Math.max(1, nextWidth)
    if (!isGroupSelection) {
      upd({ width })
      return
    }

    updateBlocks(currentSlide.id, buildScaleSelectionUpdates(currentSlide.blocks, selectionIds, width))
  }
  const applyArrangeHeight = (nextHeight: number) => {
    if (!currentSlide || !activeBlock) return
    const height = Math.max(1, nextHeight)
    if (!isGroupSelection) {
      upd({ height })
      return
    }

    updateBlocks(currentSlide.id, buildScaleSelectionUpdates(currentSlide.blocks, selectionIds, undefined, height))
  }
  const applyArrangeRotation = (nextRotation: number) => {
    if (!currentSlide || !activeBlock) return
    const normalized = normalizeAngle(nextRotation)
    if (!isGroupSelection) {
      upd({ rotation: normalized })
      return
    }

    const delta = getAngleDelta(normalizeAngle(activeBlock.rotation), normalized)
    const updates = buildRotateSelectionUpdates(currentSlide.blocks, selectionIds, delta)
    if (updates.length > 0) {
      updateBlocks(currentSlide.id, updates)
    }
  }
  const updSelection = (field: Parameters<typeof updateBlock>[2]) => {
    if (!currentSlide || selectionIds.length === 0) return
    updateBlocks(
      currentSlide.id,
      selectionIds.map((blockId) => ({
        blockId,
        updates: field,
      })),
    )
  }
  const toggleSelectionLock = () => {
    if (!currentSlide || selectionIds.length === 0) return
    updSelection({ locked: !unlockSelection })
  }
  const deleteSelection = () => {
    if (!currentSlide || selectionIds.length === 0) return
    deleteBlocks(currentSlide.id, selectionIds)
  }
  const arrangeMetrics = selectionBounds && isGroupSelection
    ? selectionBounds
    : activeBlock
    ? {
        x: activeBlock.x,
        y: activeBlock.y,
        width: activeBlock.width,
        height: activeBlock.height,
      }
    : null
  const arrangeRotation = activeBlock ? normalizeAngle(activeBlock.rotation) : 0
  const activeImage = !isGroupSelection && activeBlock?.type === 'image'
    ? getImageBlockData(activeBlock)
    : null
  const activeImageScale = activeBlock && !isGroupSelection
    ? getImageScalePercent(activeBlock)
    : null
  const activeImageIsUpscaled = activeBlock && !isGroupSelection
    ? isImageUpscaled(activeBlock)
    : false
  const activeImageNaturalSizeLabel = activeImage?.naturalWidth && activeImage?.naturalHeight
    ? `${activeImage.naturalWidth} × ${activeImage.naturalHeight} px`
    : '读取中'
  const activeImageDisplaySizeLabel = activeBlock && activeImage
    ? `${Math.round(activeBlock.width)} × ${Math.round(activeBlock.height)} px`
    : ''
  const activeImageScaleLabel = activeImageScale === null
    ? '读取中'
    : `${Math.round(activeImageScale)}%`
  const fillControl = activeBlock ? getFillControlState(activeBlock.appearance) : null
  const isInlineTextEditing = !!(
    activeBlock
    && editingTextBlockId === activeBlock.id
    && activeEditor
  )
  const displayedTextStyles = textInspector.styles
  const displayedFontFamily = textInspector.isEditing
    ? displayedTextStyles?.fontFamily ?? MIXED_CONTROL_VALUE
    : activeBlock?.appearance.fontFamily || 'Helvetica Neue'
  const displayedFontWeight = textInspector.isEditing
    ? displayedTextStyles?.fontWeight ?? MIXED_CONTROL_VALUE
    : activeBlock?.appearance.fontWeight || 'normal'
  const displayedFontSize = textInspector.isEditing
    ? displayedTextStyles?.fontSize ?? textInspector.baseFontSize ?? activeBlock?.appearance.fontSize ?? 1
    : activeBlock?.appearance.fontSize ?? 1
  const displayedFontSizeLabel = textInspector.isEditing && displayedTextStyles?.fontSize === null ? '混合' : undefined
  const displayedTextAlign = textInspector.isEditing
    ? displayedTextStyles?.textAlign ?? activeBlock?.appearance.textAlign ?? 'left'
    : activeBlock?.appearance.textAlign ?? 'left'
  const displayedTextColor = textInspector.isEditing
    ? displayedTextStyles?.textColor ?? normalizeColor(activeBlock?.appearance.textColor)
    : normalizeColor(activeBlock?.appearance.textColor)
  const displayedTextStrokeColor = textInspector.isEditing
    ? displayedTextStyles?.textStrokeColor ?? activeBlock?.appearance.textStrokeColor ?? 'transparent'
    : activeBlock?.appearance.textStrokeColor ?? 'transparent'
  const displayedTextStrokeWidth = textInspector.isEditing
    ? displayedTextStyles?.textStrokeWidth ?? activeBlock?.appearance.textStrokeWidth ?? 0
    : activeBlock?.appearance.textStrokeWidth ?? 0
  const displayedLetterSpacing = textInspector.isEditing
    ? displayedTextStyles?.letterSpacing ?? activeBlock?.appearance.letterSpacing ?? 0
    : activeBlock?.appearance.letterSpacing ?? 0
  const displayedLineHeight = textInspector.isEditing
    ? displayedTextStyles?.lineHeight ?? activeBlock?.appearance.lineHeight ?? 1.4
    : activeBlock?.appearance.lineHeight ?? 1.4
  const displayedTextFillDetail = formatColorControlDetail(displayedTextColor, {
    mixed: textInspector.isEditing && displayedTextStyles?.textColor === null,
    transparentLabel: '透明填充',
  })
  const displayedTextStrokeDetail = formatColorControlDetail(displayedTextStrokeColor, {
    mixed: textInspector.isEditing && displayedTextStyles?.textStrokeColor === null,
    transparentLabel: displayedTextStrokeWidth > 0 ? '透明描边' : '未启用',
  })
  const displayedTextStrokeWidthLabel = textInspector.isEditing && displayedTextStyles?.textStrokeWidth === null ? '混合' : undefined
  const displayedLetterSpacingLabel = textInspector.isEditing && displayedTextStyles?.letterSpacing === null ? '混合' : undefined
  const displayedLineHeightLabel = textInspector.isEditing && displayedTextStyles?.lineHeight === null ? '混合' : undefined
  const displayedTextStrokeEnabled = displayedTextStrokeWidth > 0
  const displayedMargin = {
    top: activeBlock?.appearance.marginTop ?? 0,
    right: activeBlock?.appearance.marginRight ?? 0,
    bottom: activeBlock?.appearance.marginBottom ?? 0,
    left: activeBlock?.appearance.marginLeft ?? 0,
  }
  const displayedPadding = {
    top: activeBlock?.appearance.paddingTop ?? 0,
    right: activeBlock?.appearance.paddingRight ?? 0,
    bottom: activeBlock?.appearance.paddingBottom ?? 0,
    left: activeBlock?.appearance.paddingLeft ?? 0,
  }
  const blockTextDecorationTokens = parseTextDecorationTokens(activeBlock?.appearance.textDecoration ?? 'none')
  const toolbarSelection = textInspector.isEditing
    ? [
        displayedTextStyles?.isBold ? 'bold' : '',
        displayedTextStyles?.isItalic ? 'italic' : '',
        displayedTextStyles?.isUnderline ? 'underline' : '',
        displayedTextStyles?.isStrikeThrough ? 'line-through' : '',
      ].filter(Boolean)
    : [
        activeBlock?.appearance.fontWeight === 'bold' ? 'bold' : '',
        activeBlock?.appearance.fontStyle === 'italic' ? 'italic' : '',
        blockTextDecorationTokens.has('underline') ? 'underline' : '',
        blockTextDecorationTokens.has('line-through') ? 'line-through' : '',
      ].filter(Boolean)

  const handleTextMarkToggle = (mark: 'bold' | 'italic' | 'underline' | 'line-through') => {
    if (!activeBlock) return

    if (isInlineTextEditing) {
      applyRichTextMark(mark, activeEditor)
      return
    }

    // Block level fallback if no active editor
    const nextEnabled = !toolbarSelection.includes(mark)
    if (mark === 'bold') {
      updApp({ fontWeight: nextEnabled ? 'bold' : 'normal' })
    } else if (mark === 'italic') {
      updApp({ fontStyle: nextEnabled ? 'italic' : 'normal' })
    } else {
      const currentTokens = parseTextDecorationTokens(activeBlock.appearance.textDecoration ?? 'none')
      if (nextEnabled) currentTokens.add(mark)
      else currentTokens.delete(mark)
      updApp({ textDecoration: buildTextDecorationValue(currentTokens) })
    }
  }

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <>
      <aside className="kn2-sidebar">

        {/* Top segmented control */}
        <div style={{ padding: '16px 16px 0 16px' }}>
          <KNSegmentControl<InspectorTab>
            options={[
              { label: '格式', value: 'format' },
              { label: '动画', value: 'animate' },
              { label: '文稿', value: 'document' },
            ]}
            value={activeInspector}
            onChange={handleTabChange}
          />
        </div>

        {/* Scrollable body */}
        <div className="kn2-body">

          {/* ════════════════ FORMAT ════════════════════════════════════ */}
          {activeInspector === 'format' && (
            <>
              {!activeBlock || !currentSlide ? (
                <div className="kn2-empty">
                  <p>选中画布中的对象以查看格式选项</p>
                  <p className="kn2-empty__sub">文本可双击进入编辑，拖动对象可移动位置。</p>
                </div>
              ) : (
                <>
                  {/* Sub-tabs */}
                  <div style={{ padding: '0 16px' }}>
                    <KNSegmentControl<FormatTab>
                      options={[
                        { label: '样式', value: 'style' },
                        { label: '文本', value: 'text' },
                        { label: '排列', value: 'arrange' },
                      ]}
                      value={formatTab}
                      onChange={setFormatTab}
                    />
                  </div>

                  {/* Object context strip */}
                  <div className="kn2-ctx">
                    <span className="kn2-ctx__name">{activeBlock.name}</span>
                    <span className="kn2-ctx__badge">
                      {formatTab === 'style' ? '样式' : formatTab === 'text' ? '文本' : '排列'}
                    </span>
                  </div>

                  {/* ── 文本 ──────────────────────────────────────────── */}
                  {formatTab === 'text' && (
                    <>
                      <div className="kn2-section">
                        <p className="kn2-section__title">字体</p>

                        {textInspector.isEditing && (
                          <div className="kn2-text-editing-strip">
                            <span className="kn2-text-editing-strip__eyebrow">
                              {textInspector.hasSelection ? '正在编辑选中文字' : '正在编辑文字'}
                            </span>
                            <strong className="kn2-text-editing-strip__title">
                              {textInspector.hasSelection ? '右侧控件将作用于当前选区' : '右侧控件将直接排版整个文本块'}
                            </strong>
                          </div>
                        )}

                        {/* Font family */}
                        <div className="kn2-select-wrap" onMouseDown={preventMouseFocusSteal}>
                          <select
                            className="kn2-select-mac kn2-select-native"
                            value={displayedFontFamily}
                            onChange={(e) => {
                              const nextFontFamily = e.target.value
                              if (nextFontFamily === MIXED_CONTROL_VALUE) return
                              applyFontFamily(nextFontFamily)
                            }}
                          >
                            {displayedFontFamily === MIXED_CONTROL_VALUE && (
                              <option value={MIXED_CONTROL_VALUE}>混合字体</option>
                            )}
                            <option value="Helvetica Neue">Helvetica Neue</option>
                            <option value="PingFang SC">PingFang SC</option>
                            <option value="SF Pro Display">SF Pro Display</option>
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Courier New">Courier New</option>
                          </select>
                          <ChevronDown className="kn2-select-chevron" />
                        </div>

                        {/* Weight + size in one row */}
                        <div className="kn2-font-row" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <div className="kn2-select-wrap" style={{ flex: 1 }} onMouseDown={preventMouseFocusSteal}>
                            <select
                              className="kn2-select-mac kn2-select-native"
                              value={displayedFontWeight}
                              onChange={(e) => {
                                const nextFontWeight = e.target.value
                                if (nextFontWeight === MIXED_CONTROL_VALUE) return
                                applyFontWeight(nextFontWeight)
                              }}
                            >
                              {displayedFontWeight === MIXED_CONTROL_VALUE && (
                                <option value={MIXED_CONTROL_VALUE}>混合字重</option>
                              )}
                              <option value="300">细体</option>
                              <option value="normal">常规</option>
                              <option value="500">中等</option>
                              <option value="600">半粗</option>
                              <option value="bold">粗体</option>
                              <option value="800">特粗</option>
                            </select>
                            <ChevronDown className="kn2-select-chevron" />
                          </div>
                          <StepperInput
                            value={displayedFontSize}
                            onChange={applyFontSize}
                            min={1}
                            max={999}
                            suffix="pt"
                            width={82}
                            displayValue={displayedFontSizeLabel}
                            liveOnInput={textInspector.isEditing}
                          />
                        </div>

                        {/* B / I / U / S toolbar */}
                        <div style={{ marginTop: 12 }}>
                          <KNPillGroup<string>
                            options={[
                              { value: 'bold', icon: <Bold size={14} strokeWidth={2.5} />, label: '粗体' },
                              { value: 'italic', icon: <Italic size={14} strokeWidth={2.5} />, label: '斜体' },
                              { value: 'underline', icon: <Underline size={14} strokeWidth={2.5} />, label: '下划线' },
                              { value: 'line-through', icon: <Strikethrough size={14} strokeWidth={2.5} />, label: '删除线' },
                            ]}
                            value={toolbarSelection}
                            onChange={(cmd) => handleTextMarkToggle(cmd as 'bold' | 'italic' | 'underline' | 'line-through')}
                          />
                        </div>
                      </div>

                      <Divider />

                      <div className="kn2-section">
                        <p className="kn2-section__title">文字外观</p>
                        <div className="kn2-text-paint-stack" onMouseDown={preventMouseFocusSteal}>
                          <div>
                            <ColorSwatch
                              value={displayedTextColor}
                              onChange={applyTextFill}
                              label="text-fill"
                              triggerVariant="field"
                              triggerLabel="填充"
                              triggerDetail={displayedTextFillDetail}
                            />
                          </div>

                          <div className="kn2-text-paint-head">
                            <span className="kn2-text-paint-label">描边</span>
                            <Toggle
                              checked={displayedTextStrokeEnabled}
                              onChange={() => {
                                if (displayedTextStrokeEnabled) {
                                  applyTextStroke({ width: 0 })
                                  return
                                }

                                applyTextStroke({
                                  width: Math.max(1, Math.round(displayedTextStrokeWidth) || 1),
                                })
                              }}
                            />
                          </div>

                          {displayedTextStrokeEnabled && (
                            <div className="kn2-text-paint-body">
                              <ColorSwatch
                                value={displayedTextStrokeColor}
                                onChange={(value) => applyTextStroke({
                                  color: value,
                                  width: Math.max(1, displayedTextStrokeWidth || 1),
                                })}
                                label="text-stroke"
                                allowGradient={false}
                                triggerVariant="field"
                                triggerLabel="描边颜色"
                                triggerDetail={displayedTextStrokeDetail}
                              />

                              <div className="kn2-text-paint-row">
                                <span className="kn2-text-paint-label">粗细</span>
                                <StepperInput
                                  value={displayedTextStrokeWidth}
                                  onChange={(value) => applyTextStroke({ width: value })}
                                  min={0}
                                  max={24}
                                  suffix="pt"
                                  width={86}
                                  displayValue={displayedTextStrokeWidthLabel}
                                  liveOnInput={textInspector.isEditing}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <Divider />

                      <div className="kn2-section">
                        <p className="kn2-section__title">对齐方式</p>

                        <div className="kn2-align-groups" onMouseDown={preventMouseFocusSteal}>
                          <KNPillGroup
                            options={[
                              { value: 'left', icon: <AlignLeft size={14} />, label: '左对齐' },
                              { value: 'center', icon: <AlignCenter size={14} />, label: '居中' },
                              { value: 'right', icon: <AlignRight size={14} />, label: '右对齐' },
                              { value: 'justify', icon: <AlignJustify size={14} />, label: '两端对齐' },
                            ]}
                            stretch
                            value={displayedTextAlign}
                            onChange={(val) => applyTextAlign(val as NonNullable<typeof activeBlock.appearance.textAlign>)}
                          />
                          <KNPillGroup
                            options={[
                              { value: 'top', icon: <AlignStartVertical size={14} />, label: '顶部' },
                              { value: 'middle', icon: <AlignCenterVertical size={14} />, label: '居中' },
                              { value: 'bottom', icon: <AlignEndVertical size={14} />, label: '底部' },
                            ]}
                            stretch
                            value={activeBlock.appearance.verticalAlign || 'top'}
                            onChange={(val) => updApp({ verticalAlign: val as typeof activeBlock.appearance.verticalAlign })}
                          />
                        </div>
                      </div>

                      <Divider />

                      <div className="kn2-section">
                        <p className="kn2-section__title">间距</p>
                        <div className="kn2-spacing-grid" onMouseDown={preventMouseFocusSteal}>
                          <KNSliderRow
                            label="字距"
                            value={displayedLetterSpacing}
                            min={-2} max={10} step={0.5} unit="pt"
                            onChange={applyLetterSpacing}
                            displayValue={displayedLetterSpacingLabel}
                            liveOnInput={textInspector.isEditing}
                          />
                          <KNSliderRow
                            label="行距"
                            value={displayedLineHeight}
                            min={0} max={3} step={0.1}
                            onChange={applyLineHeight}
                            displayValue={displayedLineHeightLabel}
                            liveOnInput={textInspector.isEditing}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── 样式 ──────────────────────────────────────────── */}
                  {formatTab === 'style' && (
                    <>
                      {/* ── Table Settings ─────────────────────────────── */}
                      {activeBlock.type === 'table' && (
                        <KNPanel title="表格设置">
                          <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                              <div className="kn2-hint" style={{ marginBottom: 4 }}>插入</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button className="kn2-btn kn2-btn--secondary" onClick={() => activeEditor?.chain().focus().addRowBefore().run()}>上方加行</button>
                                <button className="kn2-btn kn2-btn--secondary" onClick={() => activeEditor?.chain().focus().addRowAfter().run()}>下方加行</button>
                                <button className="kn2-btn kn2-btn--secondary" onClick={() => activeEditor?.chain().focus().addColumnBefore().run()}>左侧加列</button>
                                <button className="kn2-btn kn2-btn--secondary" onClick={() => activeEditor?.chain().focus().addColumnAfter().run()}>右侧加列</button>
                              </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />

                            <div>
                              <div className="kn2-hint" style={{ marginBottom: 4 }}>单元格与删除</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <button className="kn2-btn kn2-btn--secondary" onClick={() => activeEditor?.chain().focus().mergeCells().run()}>合并</button>
                                <button className="kn2-btn kn2-btn--secondary" onClick={() => activeEditor?.chain().focus().splitCell().run()}>拆分</button>
                                <button className="kn2-btn kn2-btn--secondary" style={{ color: '#ef4444' }} onClick={() => activeEditor?.chain().focus().deleteRow().run()}>删行</button>
                                <button className="kn2-btn kn2-btn--secondary" style={{ color: '#ef4444' }} onClick={() => activeEditor?.chain().focus().deleteColumn().run()}>删列</button>
                              </div>
                            </div>
                          </div>
                        </KNPanel>
                      )}

                      {/* ── Fill ─────────────────────────────────────── */}
                      <KNPanel title="填充">
                        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="kn2-select-wrap" onMouseDown={preventMouseFocusSteal}>
                            <select
                              className="kn2-select-mac kn2-select-native"
                              value={activeBlock.appearance.fillType ?? 'none'}
                              onChange={(e) => setFillType(e.target.value as 'none'|'color'|'gradient')}
                            >
                              <option value="none">无</option>
                              <option value="color">颜色填充</option>
                              <option value="gradient">渐变填充</option>
                            </select>
                            <ChevronDown className="kn2-select-chevron" />
                          </div>
                          {activeBlock.appearance.fillType !== 'none' && fillControl && (
                            <>
                              <ColorSwatch
                                value={fillControl.value}
                                onChange={updateFillColorValue}
                                label="fill-color"
                                triggerVariant="field"
                                triggerLabel={activeBlock.appearance.fillType === 'gradient' ? '渐变填充' : '颜色填充'}
                                triggerDetail={fillControl.detail}
                              />
                              {activeBlock.appearance.fillType === 'gradient' && (
                                <p className="kn2-hint">点击上方填充卡片，直接编辑色标、透明度和角度。</p>
                              )}
                            </>
                          )}
                        </div>
                      </KNPanel>

                      {/* ── Border ───────────────────────────────────── */}
                      <KNPanel 
                        title="描边" 
                        enabled={activeBlock.appearance.strokeStyle && activeBlock.appearance.strokeStyle !== 'none'}
                        onToggle={(enabled) => updApp({ strokeStyle: enabled ? 'solid' : 'none' })}
                        defaultOpen={activeBlock.appearance.strokeStyle && activeBlock.appearance.strokeStyle !== 'none'}
                      >
                        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="kn2-select-wrap" onMouseDown={preventMouseFocusSteal}>
                            <select
                              className="kn2-select-mac kn2-select-native"
                              value={activeBlock.appearance.strokeStyle ?? 'none'}
                              onChange={(e) => updApp({ strokeStyle: e.target.value as 'none'|'solid'|'dashed'|'dotted' })}
                            >
                              <option value="none">无</option>
                              <option value="solid">实线</option>
                              <option value="dashed">虚线</option>
                              <option value="dotted">点线</option>
                            </select>
                            <ChevronDown className="kn2-select-chevron" />
                          </div>
                          {(activeBlock.appearance.strokeStyle && activeBlock.appearance.strokeStyle !== 'none') && (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 13, color: '#555' }}>颜色</span>
                                <ColorSwatch
                                  value={normalizeColor(activeBlock.appearance.stroke)}
                                  onChange={(v) => updApp({ stroke: v })}
                                  label="stroke-color"
                                  allowGradient={false}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 13, color: '#555' }}>粗细</span>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <StepperInput
                                    value={activeBlock.appearance.strokeWidth ?? 1}
                                    onChange={(v) => updApp({ strokeWidth: Math.max(1, v) })}
                                    min={1}
                                  />
                                  <span style={{ fontSize: 11, color: 'var(--kn2-ink-3)', marginLeft: 4 }}>pt</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </KNPanel>

                      {/* ── Shadow ───────────────────────────────────── */}
                      <KNPanel 
                        title="阴影" 
                        enabled={!!activeBlock.appearance.shadow}
                        onToggle={(enabled) => updApp({ shadow: enabled })}
                        defaultOpen={!!activeBlock.appearance.shadow}
                      >
                        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="kn2-select-wrap" onMouseDown={preventMouseFocusSteal}>
                            <select className="kn2-select-mac kn2-select-native" defaultValue="drop">
                              <option value="drop">投影</option>
                              <option value="contact">接触阴影</option>
                            </select>
                            <ChevronDown className="kn2-select-chevron" />
                          </div>
                          <KNSliderRow
                            label="模糊"
                            value={activeBlock.appearance.shadowBlur ?? 8}
                            min={0} max={50} step={1} unit="pt"
                            onChange={(v) => updApp({ shadowBlur: v })}
                          />
                          <KNSliderRow
                            label="偏移"
                            value={activeBlock.appearance.shadowOffset ?? 2}
                            min={0} max={30} step={1} unit="pt"
                            onChange={(v) => updApp({ shadowOffset: v })}
                          />
                          <KNSliderRow
                            label="不透明"
                            value={Math.round((activeBlock.appearance.shadowOpacity ?? 0.5) * 100)}
                            min={0} max={100} step={1} unit="%"
                            onChange={(v) => updApp({ shadowOpacity: v / 100 })}
                          />
                          <KNAngleRow
                            label="角度"
                            value={activeBlock.appearance.shadowAngle ?? 270}
                            onChange={(v) => updApp({ shadowAngle: v })}
                          />

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, color: '#555' }}>颜色</span>
                            <ColorSwatch
                              value={activeBlock.appearance.shadowColor ?? '#000000'}
                              onChange={(v) => updApp({ shadowColor: v })}
                              label="shadow-color"
                              allowGradient={false}
                            />
                          </div>
                        </div>
                      </KNPanel>


                      {/* ── Opacity & Radius ───────────────────────── */}
                      <KNPanel title="效果" defaultOpen={true}>
                        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <KNSliderRow
                            label="不透明"
                            value={Math.round(activeBlock.opacity * 100)}
                            min={0} max={100} step={5} unit="%"
                            onChange={(v) => upd({ opacity: v / 100 })}
                          />
                          <KNSliderRow
                            label="圆角"
                            value={activeBlock.appearance.radius}
                            min={0} max={80} step={1} unit="pt"
                            onChange={(v) => updApp({ radius: v })}
                          />
                        </div>
                      </KNPanel>

                      <KNPanel title="盒模型">
                        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <BoxModelControl
                            title="外边距"
                            values={displayedMargin}
                            onChange={(updates) => {
                              const patch: Partial<EditorBlock['appearance']> = {}
                              if (updates.top !== undefined) patch.marginTop = updates.top
                              if (updates.right !== undefined) patch.marginRight = updates.right
                              if (updates.bottom !== undefined) patch.marginBottom = updates.bottom
                              if (updates.left !== undefined) patch.marginLeft = updates.left
                              updApp(patch)
                            }}
                          />
                          <BoxModelControl
                            title="内边距"
                            values={displayedPadding}
                            onChange={(updates) => {
                              const patch: Partial<EditorBlock['appearance']> = {}
                              if (updates.top !== undefined) patch.paddingTop = updates.top
                              if (updates.right !== undefined) patch.paddingRight = updates.right
                              if (updates.bottom !== undefined) patch.paddingBottom = updates.bottom
                              if (updates.left !== undefined) patch.paddingLeft = updates.left
                              updApp(patch)
                            }}
                          />
                        </div>
                      </KNPanel>
                    </>
                  )}


                  {/* ── 排列 (Arrange) ─────────────────────────────────── */}
                  {formatTab === 'arrange' && activeBlock && currentSlide && (
                    <>
                      <KNPanel title="层级与对齐">
                        <div className="kn2-arrange-stack">
                          <div className="kn2-arrange-z-grid">
                            <button type="button" className="kn2-arrange-z-btn" title="置于顶层" onClick={() => bringBlockToFront(currentSlide.id, activeBlock.id)}>
                              <Layers size={14} />
                              <span>置于顶层</span>
                            </button>
                            <button type="button" className="kn2-arrange-z-btn" title="置于底层" onClick={() => sendBlockToBack(currentSlide.id, activeBlock.id)}>
                              <Layers size={14} style={{ transform: 'rotate(180deg)' }} />
                              <span>置于底层</span>
                            </button>
                            <button type="button" className="kn2-arrange-z-btn" title="上移一层" onClick={() => bringBlockForward(currentSlide.id, activeBlock.id)}>
                              <ChevronUp size={14} />
                              <span>上移一层</span>
                            </button>
                            <button type="button" className="kn2-arrange-z-btn" title="下移一层" onClick={() => sendBlockBackward(currentSlide.id, activeBlock.id)}>
                              <ChevronDown size={14} />
                              <span>下移一层</span>
                            </button>
                          </div>

                          <div className="kn2-arrange-actions kn2-arrange-actions--single">
                          <KNSelect
                            value=""
                            onChange={(v) => {
                              selectionIds.forEach((blockId) => {
                                alignBlock(currentSlide.id, blockId, v as ArrangeMode)
                              })
                            }}
                          >
                              <option value="" disabled>对齐</option>
                              <option value="left">左对齐</option>
                              <option value="center">居中对齐</option>
                              <option value="right">右对齐</option>
                              <option value="top">顶部对齐</option>
                              <option value="middle">垂直居中</option>
                              <option value="bottom">底部对齐</option>
                            </KNSelect>
                          </div>
                        </div>
                      </KNPanel>

                      <KNPanel title="尺寸与位置">
                        <div className="kn2-arrange-stack">
                          {/* Size Section - 2 Columns */}
                          <div style={{ position: 'relative' }}>
                            <div className="kn2-metrics-grid">
                              <div className="kn2-metrics-row">
                                <span className="kn2-metrics-label">宽</span>
                                <StepperInput
                                  value={Math.round(arrangeMetrics?.width ?? activeBlock.width)}
                                  onChange={applyArrangeWidth}
                                  width="100%"
                                />
                              </div>
                              <div className="kn2-metrics-row">
                                <span className="kn2-metrics-label">高</span>
                                <StepperInput
                                  value={Math.round(arrangeMetrics?.height ?? activeBlock.height)}
                                  onChange={applyArrangeHeight}
                                  width="100%"
                                />
                              </div>
                            </div>
                            {!isGroupSelection && activeBlock.keepRatio && (
                              <div className="kn2-ratio-link" />
                            )}
                          </div>

                          <div className="kn2-constrain-row">
                            <input
                              type="checkbox"
                              id="constrain"
                              className="kn2-checkbox"
                              checked={!isGroupSelection && (activeBlock.keepRatio || false)}
                              disabled={isGroupSelection}
                              onChange={(e) => upd({ keepRatio: e.target.checked })}
                            />
                            <label htmlFor="constrain">约束比例</label>
                          </div>

                          <div style={{ height: 4 }} />

                          {/* Position Section - 2 Columns */}
                          <div className="kn2-metrics-grid">
                            <div className="kn2-metrics-row">
                              <span className="kn2-metrics-label">X</span>
                              <StepperInput
                                value={Math.round(arrangeMetrics?.x ?? activeBlock.x)}
                                onChange={applyArrangeX}
                                width="100%"
                              />
                            </div>
                            <div className="kn2-metrics-row">
                              <span className="kn2-metrics-label">Y</span>
                              <StepperInput
                                value={Math.round(arrangeMetrics?.y ?? activeBlock.y)}
                                onChange={applyArrangeY}
                                width="100%"
                              />
                            </div>
                          </div>
                        </div>
                      </KNPanel>

                      {activeImage && (
                        <KNPanel title="图片">
                          <div className="kn2-image-meta">
                            <div className="kn2-image-meta-row">
                              <span className="kn2-image-meta-label">原始尺寸</span>
                              <span className="kn2-image-meta-value">{activeImageNaturalSizeLabel}</span>
                            </div>
                            <div className="kn2-image-meta-row">
                              <span className="kn2-image-meta-label">画布显示</span>
                              <span className="kn2-image-meta-value">{activeImageDisplaySizeLabel}</span>
                            </div>
                            <div className="kn2-image-meta-row">
                              <span className="kn2-image-meta-label">缩放比例</span>
                              <span className="kn2-image-meta-value">{activeImageScaleLabel}</span>
                            </div>

                            <div className="kn2-image-fit-row">
                              <span className="kn2-image-meta-label">适配方式</span>
                              <KNSelect
                                value={activeImage.objectFit}
                                onChange={(value) => {
                                  upd({
                                    image: { objectFit: value as typeof activeImage.objectFit },
                                    content: buildLegacyImageContent(activeImage.src, value as typeof activeImage.objectFit),
                                  })
                                }}
                              >
                                <option value="fill">拉伸填满</option>
                                <option value="contain">完整显示</option>
                                <option value="cover">裁切填充</option>
                              </KNSelect>
                            </div>

                            <p className="kn2-image-note">
                              蓝框表示当前画布里的交互边界，也就是这张图当前可拖拽、可缩放的容器尺寸。
                            </p>

                            {activeImageIsUpscaled && (
                              <div className="kn2-image-warning">
                                <AlertTriangle size={14} />
                                <span>当前显示尺寸已超过原图像素上限，导出时可能变糊。</span>
                              </div>
                            )}
                          </div>
                        </KNPanel>
                      )}

                      <KNPanel title="旋转与翻转">
                        <div className="kn2-arrange-stack">
                          <KNAngleRow
                            label="旋转"
                            value={arrangeRotation}
                            onChange={applyArrangeRotation}
                          />
                          <div className="kn2-flip-group" style={{ marginTop: 8, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className={`kn2-style-tool ${activeBlock.appearance.flipX ? 'kn2-style-tool--active' : ''}`}
                                title="水平翻转"
                                onClick={() => updApp({ flipX: !activeBlock.appearance.flipX })}
                              >
                                <FlipHorizontal size={14} />
                              </button>
                              <button
                                type="button"
                                className={`kn2-style-tool ${activeBlock.appearance.flipY ? 'kn2-style-tool--active' : ''}`}
                                title="垂直翻转"
                                onClick={() => updApp({ flipY: !activeBlock.appearance.flipY })}
                              >
                                <FlipVertical size={14} />
                              </button>
                            </div>
                          </div>
                      </KNPanel>

                      <KNPanel title="对象操作">
                        <div className="kn2-arrange-stack">
                          <div className="kn2-group-actions">
                            <button type="button" className="kn2-arrange-action-btn" onClick={toggleSelectionLock}>
                              {unlockSelection ? '解锁' : '锁定'}
                            </button>
                            <button
                              type="button"
                              className="kn2-arrange-action-btn"
                              onClick={() => currentSlide && groupBlocks(currentSlide.id, selectionIds)}
                              disabled={!canGroupSelection}
                            >
                              组合
                            </button>
                            <button
                              type="button"
                              className="kn2-arrange-action-btn"
                              onClick={() => currentSlide && ungroupBlocks(currentSlide.id, selectionIds)}
                              disabled={!canUngroupSelection}
                            >
                              取消组合
                            </button>
                          </div>
                          <button
                            type="button"
                            className="kn2-danger-btn"
                            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                            onClick={deleteSelection}
                          >
                            <Trash2 size={13} />
                            {selectionIds.length > 1 ? `删除 ${selectionIds.length} 个对象` : '删除对象'}
                          </button>
                        </div>
                      </KNPanel>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ════════════════ ANIMATE ═══════════════════════════════════ */}
          {activeInspector === 'animate' && currentSlide && (
            <>
              {/* Object animations */}
              <div className="kn2-anim-head">
                <span className="kn2-anim-head__title">对象动画</span>
                {activeBlock && (
                  <span className="kn2-anim-head__obj">{activeBlock.name}</span>
                )}
              </div>

              {!activeBlock ? (
                <div className="kn2-empty">
                  <p>先在画布中选中一个对象</p>
                  <p className="kn2-empty__sub">然后为它添加入场、动作或退场动画。</p>
                </div>
              ) : (
                <>
                  {/* Phase tabs: 入场 / 动作 / 退场 */}
                  <div style={{ padding: '8px 12px' }}>
                    <KNSegmentControl
                      options={[
                        { value: 'buildIn', label: '入场' },
                        { value: 'action', label: '动作' },
                        { value: 'buildOut', label: '退场' },
                      ]}
                      value={animationTab}
                      onChange={(v) => setAnimationTab(v as AnimationPhase)}
                    />
                  </div>

                  {isActionTab && (
                    <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: actionList.length > 0 ? 12 : 0 }}>
                      {actionList.map((a, i) => {
                        const isActive = activeActionId === a.id || (!activeActionId && i === 0 && selectedAction?.id === a.id)
                        return (
                          <div
                            key={a.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
                              background: isActive ? 'var(--kn2-active-bg, rgba(0, 122, 255, 0.1))' : 'var(--kn2-bg-secondary)',
                              border: `1px solid ${isActive ? 'var(--kn2-active-border, #007aff)' : 'transparent'}`,
                            }}
                            onClick={() => setActiveActionId(a.id)}
                          >
                            <span style={{ fontSize: 13, color: 'var(--kn2-text-primary)' }}>
                              动作 {i + 1}: {getEffectLabel('action', a.effect)}
                            </span>
                            <button
                              className="kn2-icon-btn"
                              style={{ padding: 4 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                removeBlockAction(currentSlide.id, activeBlock.id, a.id)
                                if (activeActionId === a.id) setActiveActionId(null)
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )
                      })}
                      <button
                        className={actionList.length === 0 ? "kn2-primary-btn" : "kn2-secondary-btn"}
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => {
                          const newId = Math.random().toString(36).substring(2, 11)
                          addBlockAction(currentSlide.id, activeBlock.id, { ...DEFAULT_ACTION, id: newId, effect: getDefaultEffect('action') } as any)
                          setActiveActionId(newId)
                        }}
                      >
                        ＋ 添加动作
                      </button>
                    </div>
                  )}

                  {!activeAnimation || activeAnimation.effect === 'none' ? (
                    <div className="kn2-anim-empty">
                      <p>{ANIMATION_PHASE_OPTIONS.find((p) => p.id === animationTab)?.emptyLabel}</p>
                      {!isActionTab && (
                        <button
                          className="kn2-primary-btn"
                          onClick={() => updateAnim({ effect: getDefaultEffect(animationTab) })}
                        >
                          ＋ 添加效果
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="kn2-anim-panel" style={{ padding: '0 12px 16px' }}>
                      <KNPanel title={isActionTab ? `设置 (动作 ${actionList.findIndex(a => 'id' in a && 'id' in activeAnimation && a.id === activeAnimation.id) + 1})` : "动画设置"} defaultOpen={true}>
                        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Effect + preview */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="kn2-select-wrap" style={{ flex: 1 }}>
                              <select
                                className="kn2-select-mac kn2-select-native"
                                value={activeAnimation.effect}
                                onChange={(e) => updateAnim({ effect: e.target.value })}
                              >
                                {getEffectOptions(animationTab).map((o) => (
                                  <option key={o.id} value={o.id}>{o.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="kn2-select-chevron" />
                            </div>
                            <button
                              className={isPreviewing ? 'kn2-preview-btn kn2-preview-btn--active' : 'kn2-preview-btn'}
                              onClick={handlePreview}
                            >
                              {isPreviewing ? <Pause size={12} /> : <Play size={12} />}
                              {isPreviewing ? '停止' : '预览'}
                            </button>
                          </div>

                          {/* Trigger */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, color: '#555' }}>开始</span>
                            <div className="kn2-select-wrap" style={{ width: 130 }}>
                              <select
                                className="kn2-select-mac kn2-select-native"
                                value={activeAnimation.trigger}
                                onChange={(e) => updateAnim({ trigger: e.target.value as TriggerType })}
                              >
                                {TRIGGER_OPTIONS.map((o) => (
                                  <option key={o.id} value={o.id}>{o.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="kn2-select-chevron" />
                            </div>
                          </div>

                          {/* Loop (action only) */}
                          {isActionTab && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, color: '#555' }}>循环</span>
                              <Toggle
                                checked={(activeAnimation as any).loop ?? false}
                                onChange={() => updateAnim({ loop: !(activeAnimation as any).loop })}
                              />
                            </div>
                          )}

                          <div style={{ height: 1, background: 'var(--kn2-border)' }} />

                          {/* Duration + Delay */}
                          <KNSliderRow
                            label="时长"
                            value={activeAnimation.duration}
                            min={0} max={2} step={0.1} unit="秒"
                            onChange={(v) => updateAnim({ duration: v })}
                          />
                          <KNSliderRow
                            label="延迟"
                            value={activeAnimation.delay}
                            min={0} max={1.5} step={0.1} unit="秒"
                            onChange={(v) => updateAnim({ delay: v })}
                          />
                        </div>
                      </KNPanel>

                      {/* Footer */}
                      <div className="kn2-anim-footer" style={{ marginTop: 12 }}>
                        <button className="kn2-secondary-btn" onClick={() => setBuildOrderOpen(true)}>
                          构建顺序
                        </button>
                        <button
                          className="kn2-ghost-danger-btn"
                          onClick={() => {
                            if (isActionTab && (activeAnimation as any).id) {
                              removeBlockAction(currentSlide.id, activeBlock.id, (activeAnimation as any).id)
                              setActiveActionId(null)
                            } else {
                              updateAnim({ effect: 'none' })
                            }
                          }}
                        >
                          移除效果
                        </button>
                      </div>

                      {activeAnimation.order ? (
                        <p className="kn2-order-hint" style={{ marginTop: 8 }}>当前位于第 {activeAnimation.order} 步</p>
                      ) : null}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ════════════════ DOCUMENT ══════════════════════════════════ */}
          {activeInspector === 'document' && currentSlide && (
            <>
              <KNPanel title="布局">
                <div style={{ padding: '0 4px' }}>
                  <div className="kn2-select-wrap">
                    <select
                      className="kn2-select-mac kn2-select-native"
                      value={currentSlide.layout}
                      onChange={(e) => applySlideLayout(currentSlide.id, e.target.value as typeof currentSlide.layout)}
                    >
                      {LAYOUT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <ChevronDown className="kn2-select-chevron" />
                  </div>
                  <p className="kn2-hint" style={{ marginTop: 8 }}>切换布局会重新应用该页的占位符。</p>
                </div>
              </KNPanel>

              <KNPanel title="背景">
                <div style={{ padding: '0 4px' }}>
                  <div className="kn2-select-wrap">
                    <select
                      className="kn2-select-mac kn2-select-native"
                      value={currentSlide.bg}
                      onChange={(e) => updateSlide(currentSlide.id, { bg: e.target.value as typeof currentSlide.bg })}
                    >
                      {BACKGROUND_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <ChevronDown className="kn2-select-chevron" />
                  </div>
                </div>
              </KNPanel>

              <KNPanel title="过渡效果">
                <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#555' }}>效果</span>
                    <div className="kn2-select-wrap" style={{ width: 120 }}>
                      <select
                        className="kn2-select-mac kn2-select-native"
                        value={currentSlide.transition}
                        onChange={(e) => updateSlide(currentSlide.id, { transition: e.target.value as typeof currentSlide.transition })}
                      >
                        {TRANSITION_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                      <ChevronDown className="kn2-select-chevron" />
                    </div>
                  </div>
                  <KNSliderRow
                    label="时长"
                    value={currentSlide.transitionDuration}
                    min={0} max={1.8} step={0.1} unit="秒"
                    onChange={(v) => updateSlide(currentSlide.id, { transitionDuration: v })}
                  />
                </div>
              </KNPanel>

              <KNPanel title="参考">
                <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#555' }}>显示参考线</span>
                    <Toggle
                      checked={showGuides}
                      onChange={() => updatePresentation({ showGuides: !showGuides })}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: '#555' }}>显示网格</span>
                    <Toggle
                      checked={showGrid}
                      onChange={() => updatePresentation({ showGrid: !showGrid })}
                    />
                  </div>
                </div>
              </KNPanel>
            </>
          )}

        </div>
      </aside>

      {/* Build order modal */}
      {isBuildOrderOpen && currentSlide && (
        <BuildOrderModal
          activeBlockId={activeBlockId}
          animationTab={animationTab}
          activeActionId={activeActionId}
          buildOrder={buildOrder}
          onClose={() => setBuildOrderOpen(false)}
          onMove={(id, phase, dir, actionId) => moveBlockAnimation(currentSlide.id, id, phase, dir, actionId)}
          onSelect={(id, phase, actionId) => { setActiveBlock(id); setActiveInspector('animate'); setAnimationTab(phase); if (actionId) setActiveActionId(actionId) }}
          slideName={currentSlide.name}
        />
      )}
    </>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Build Order Modal                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

type BuildOrderModalProps = {
  activeBlockId: string | null
  animationTab: AnimationPhase
  activeActionId?: string | null
  buildOrder: ReturnType<typeof getSlideBuildOrder>
  onClose: () => void
  onMove: (blockId: string, phase: AnimationPhase, direction: -1 | 1, actionId?: string) => void
  onSelect: (blockId: string, phase: AnimationPhase, actionId?: string) => void
  slideName: string
}

function BuildOrderModal({ activeBlockId, animationTab, activeActionId, buildOrder, onClose, onMove, onSelect, slideName }: BuildOrderModalProps) {
  return (
    <div className="bom-backdrop" onClick={onClose}>
      <div className="bom" role="dialog" aria-modal="true" aria-labelledby="bomTitle" onClick={(e) => e.stopPropagation()}>
        <div className="bom__header">
          <div>
            <p className="bom__eyebrow">动画编排</p>
            <h2 className="bom__title" id="bomTitle">构建顺序</h2>
            <p className="bom__sub">{slideName} · 共 {buildOrder.length} 步</p>
          </div>
          <button className="bom__close" onClick={onClose} aria-label="关闭"><X size={16} /></button>
        </div>

        {buildOrder.length === 0 ? (
          <div className="bom__empty">
            <strong>当前页面还没有任何对象动画</strong>
            <p>先为对象添加入场、动作或退场效果。</p>
          </div>
        ) : (
          <div className="bom__list">
            {buildOrder.map((item, i) => {
              const isActive = item.blockId === activeBlockId && item.phase === animationTab && (item.phase !== 'action' || item.actionId === activeActionId)
              return (
                <div
                  key={`${item.blockId}-${item.phase}${item.actionId ? `-${item.actionId}` : ''}`}
                  className={isActive ? 'bom__item bom__item--active' : 'bom__item'}
                  onClick={() => onSelect(item.blockId, item.phase, item.actionId)}
                >
                  <div className="bom__num">{i + 1}</div>
                  <div className="bom__copy">
                    <div className="bom__topline">
                      <strong>{item.blockName}</strong>
                      <span className={`bom__phase bom__phase--${item.phase}`}>{getPhaseLabel(item.phase)}</span>
                    </div>
                    <div className="bom__meta">
                      <span>{getEffectLabel(item.phase, item.animation.effect)}</span>
                      <span>·</span>
                      <span>{getTriggerLabel(item.animation.trigger)}</span>
                      {'loop' in item.animation && item.animation.loop && <><span>·</span><span>循环</span></>}
                      <span>·</span>
                      <span>{item.animation.duration.toFixed(1)} 秒</span>
                    </div>
                  </div>
                  <div className="bom__controls" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onMove(item.blockId, item.phase, -1, item.actionId)} disabled={i === 0}><ChevronUp size={13} /></button>
                    <button onClick={() => onMove(item.blockId, item.phase, 1, item.actionId)} disabled={i === buildOrder.length - 1}><ChevronDown size={13} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

/* ────────────────────────────────────────────────────────────────────────── */
/*  Arrange Helpers                                                           */
/* ────────────────────────────────────────────────────────────────────────── */

function RotationDial({ angle, onChange }: { angle: number; onChange: (v: number) => void }) {
  const dialRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (event: React.MouseEvent) => {
    const dial = dialRef.current
    if (!dial) return

    const updateAngle = (moveEvent: MouseEvent) => {
      const rect = dial.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const dx = moveEvent.clientX - centerX
      const dy = moveEvent.clientY - centerY
      let nextAngle = Math.round(Math.atan2(dy, dx) * (180 / Math.PI)) + 90
      if (nextAngle < 0) nextAngle += 360
      onChange(nextAngle % 360)
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', updateAngle)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', updateAngle)
    window.addEventListener('mouseup', handleMouseUp)
    updateAngle(event.nativeEvent)
  }

  return (
    <div
      ref={dialRef}
      className="kn2-rotate-dial"
      onMouseDown={handleMouseDown}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={Math.round(angle) % 360}
      aria-label="旋转角度"
      tabIndex={0}
    >
      <div
        className="kn2-rotate-dial__knob"
        style={{ transform: `rotate(${angle}deg)` }}
      />
    </div>
  )
}

function getDefaultEffect(phase: AnimationPhase) {
  return getEffectOptions(phase).find((o) => o.id !== 'none')?.id ?? 'none'
}
