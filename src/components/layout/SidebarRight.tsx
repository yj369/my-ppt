import {
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
} from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { previewBlockPhase, restoreBlockAfterPreview } from '../../lib/animation-runtime'
import {
  ANIMATION_PHASE_OPTIONS,
  TRIGGER_OPTIONS,
  getBlockAnimations,
  getEffectLabel,
  getEffectOptions,
  getPhaseLabel,
  getSlideBuildOrder,
  getTriggerLabel,
} from '../../lib/animations'
import {
  BACKGROUND_OPTIONS,
  LAYOUT_OPTIONS,
  TRANSITION_OPTIONS,
} from '../../lib/presentation'
import { formatCssColor, parseCssColor, rgbaToHex, withAlpha, type RgbaColor } from '../../lib/colors'
import {
  buildMoveSelectionUpdates,
  buildRotateSelectionUpdates,
  buildScaleSelectionUpdates,
  getAngleDelta,
  getSelectionBounds,
  normalizeAngle,
} from '../../lib/selection'
import { useEditorStore } from '../../store'
import type { AnimationPhase, EditorBlock, InspectorTab, TriggerType } from '../../types/editor'

function isEditableTarget() {
  const target = document.activeElement as HTMLElement | null
  return Boolean(target?.isContentEditable)
}

function runRichTextCommand(command: string) {
  if (isEditableTarget()) {
    document.execCommand(command, false)
  }
}

function getActiveEditableElement() {
  const activeElement = document.activeElement as HTMLElement | null
  if (activeElement?.isContentEditable) {
    return activeElement
  }

  const selection = window.getSelection()
  const anchorElement = selection?.anchorNode instanceof HTMLElement
    ? selection.anchorNode
    : selection?.anchorNode?.parentElement ?? null

  return anchorElement?.closest('[contenteditable="true"]') as HTMLElement | null
}

function normalizeRichTextFontSize(editableElement: HTMLElement, fontSize: number) {
  editableElement.querySelectorAll('font[size]').forEach((fontTag) => {
    const span = document.createElement('span')
    span.style.fontSize = `${fontSize}px`
    while (fontTag.firstChild) {
      span.appendChild(fontTag.firstChild)
    }
    fontTag.replaceWith(span)
  })
}

function applyRichTextFontSize(fontSize: number) {
  const editableElement = getActiveEditableElement()
  if (!editableElement) {
    return false
  }

  document.execCommand('styleWithCSS', false, 'false')
  document.execCommand('fontSize', false, '7')
  normalizeRichTextFontSize(editableElement, fontSize)
  return true
}

function updateEditableNodesHtml(
  html: string,
  updater: (element: HTMLElement) => void,
) {
  const container = document.createElement('div')
  container.innerHTML = html

  const editableNodes = Array.from(container.querySelectorAll<HTMLElement>('[contenteditable]'))
  const targets = editableNodes.length > 0
    ? editableNodes
    : container.firstElementChild instanceof HTMLElement
    ? [container.firstElementChild]
    : []

  targets.forEach((element) => updater(element))
  return container.innerHTML
}

function normalizeColor(value?: string) {
  return value || '#ffffff'
}

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
  width = 72,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
  width?: React.CSSProperties['width']
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const [draft, setDraft] = useState(String(value))
  const [isFocused, setIsFocused] = useState(false)

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
      <input
        className="kn2-stepper__input"
        type="text"
        inputMode="decimal"
        value={isFocused ? draft : String(value)}
        onFocus={(event) => {
          setIsFocused(true)
          setDraft(String(value))
          event.currentTarget.select()
        }}
        onChange={(e) => setDraft(e.target.value)}
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
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  inputWidth?: React.CSSProperties['width']
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
          onMouseDown={(e) => e.stopPropagation()}
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
    activeInspector,
    setActiveInspector,
    applySlideLayout,
    updateSlide,
    updateBlock,
    updateBlocks,
    updateBlockAnimation,
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
  const [isBuildOrderOpen, setBuildOrderOpen] = useState(false)
  const [previewLoopKey, setPreviewLoopKey] = useState<string | null>(null)

  const activeAnimations = activeBlock ? getBlockAnimations(activeBlock) : null
  const activeAnimation = activeAnimations?.[animationTab] ?? null
  const activeActionAnim = animationTab === 'action' ? activeAnimations?.action ?? null : null

  const syncAnimationTab = useEffectEvent(() => {
    if (activeInspector !== 'animate' || !activeBlock) return

    // If the currently selected tab has an animation, stay on it.
    if (activeAnimations?.[animationTab]?.effect !== 'none') return

    // Otherwise, find the first tab that has an animation and switch to it.
    const phases: AnimationPhase[] = ['buildIn', 'action', 'buildOut']
    const firstActive = phases.find((phase) => {
      const animation = activeAnimations?.[phase]
      return animation && animation.effect !== 'none'
    })

    if (firstActive && firstActive !== animationTab) {
      setAnimationTab(firstActive)
    }
  })

  useEffect(() => {
    syncAnimationTab()
  }, [activeInspector, activeBlock?.id])

  const previewRef = useRef<{ key: string; element: HTMLElement; block: typeof activeBlock } | null>(null)
  const currentPreviewKey = activeBlock ? `${activeBlock.id}:${animationTab}` : null
  const isPreviewing = currentPreviewKey !== null && previewLoopKey === currentPreviewKey

  /* ESC closes build order modal */
  useEffect(() => {
    if (!isBuildOrderOpen) return
    const h = (e: KeyboardEvent) => { if (e.code === 'Escape') setBuildOrderOpen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isBuildOrderOpen])

  const stopPreview = () => {
    if (previewRef.current?.block) {
      restoreBlockAfterPreview(previewRef.current.element, previewRef.current.block)
    }
    previewRef.current = null
    setPreviewLoopKey(null)
  }

  useEffect(() => () => stopPreview(), [activeBlockId, animationTab, currentSlideId])

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
    const started = previewBlockPhase(el, activeBlock, animationTab)
    if (!started) return
    if (animationTab === 'action' && activeActionAnim?.loop && currentPreviewKey) {
      previewRef.current = { key: currentPreviewKey, element: el, block: activeBlock }
      setPreviewLoopKey(currentPreviewKey)
    }
  }

  const updateAnim = (updates: Partial<{ effect: string; trigger: TriggerType; duration: number; delay: number; order: number; loop: boolean }>) => {
    if (!currentSlide || !activeBlock) return
    stopPreview()
    updateBlockAnimation(currentSlide.id, activeBlock.id, animationTab, updates)
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
  const persistActiveBlockContent = () => {
    if (!currentSlide || !activeBlock) return null
    const blockElement = Array.from(
      document.getElementById('slideContent')?.querySelectorAll<HTMLElement>('.editor-block') ?? [],
    ).find((element) => element.dataset.blockId === activeBlock.id)
    return blockElement?.querySelector<HTMLElement>('.tpl-wrapper')?.innerHTML ?? null
  }
  const applyFontSize = (fontSize: number) => {
    if (!currentSlide || !activeBlock) return

    if (applyRichTextFontSize(fontSize)) {
      const content = persistActiveBlockContent()
      updateBlock(currentSlide.id, activeBlock.id, {
        appearance: { fontSize },
        ...(content ? { content } : {}),
      })
      return
    }

    updateBlock(currentSlide.id, activeBlock.id, {
      appearance: { fontSize },
      content: updateEditableNodesHtml(activeBlock.content, (element) => {
        element.style.fontSize = `${fontSize}px`
      }),
    })
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
  const fillControl = activeBlock ? getFillControlState(activeBlock.appearance) : null

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

                        {/* Font family */}
                        <div className="kn2-select-wrap">
                          <select
                            className="kn2-select-mac kn2-select-native"
                            value={activeBlock.appearance.fontFamily || 'Helvetica Neue'}
                            onChange={(e) => updApp({ fontFamily: e.target.value })}
                          >
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
                          <div className="kn2-select-wrap" style={{ flex: 1 }}>
                            <select
                              className="kn2-select-mac kn2-select-native"
                              value={activeBlock.appearance.fontWeight || 'normal'}
                              onChange={(e) => updApp({ fontWeight: e.target.value })}
                            >
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
                            value={activeBlock.appearance.fontSize}
                            onChange={applyFontSize}
                            min={1}
                            max={999}
                            suffix="pt"
                            width={82}
                          />
                        </div>

                        {/* B / I / U / S toolbar + Color */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                          <KNPillGroup<string>
                            options={[
                              { value: 'bold', icon: <Bold size={14} strokeWidth={2.5} />, label: '粗体' },
                              { value: 'italic', icon: <Italic size={14} strokeWidth={2.5} />, label: '斜体' },
                              { value: 'underline', icon: <Underline size={14} strokeWidth={2.5} />, label: '下划线' },
                              { value: 'line-through', icon: <Strikethrough size={14} strokeWidth={2.5} />, label: '删除线' },
                            ]}
                            value={[
                              activeBlock.appearance.fontWeight === 'bold' ? 'bold' : '',
                              activeBlock.appearance.fontStyle === 'italic' ? 'italic' : '',
                              activeBlock.appearance.textDecoration === 'underline' ? 'underline' : '',
                              activeBlock.appearance.textDecoration === 'line-through' ? 'line-through' : '',
                            ].filter(Boolean)}
                            onChange={(cmd) => {
                              if (cmd === 'bold') {
                                runRichTextCommand('bold')
                                updApp({ fontWeight: activeBlock.appearance.fontWeight === 'bold' ? 'normal' : 'bold' })
                              } else if (cmd === 'italic') {
                                runRichTextCommand('italic')
                                updApp({ fontStyle: activeBlock.appearance.fontStyle === 'italic' ? 'normal' : 'italic' })
                              } else if (cmd === 'underline') {
                                runRichTextCommand('underline')
                                updApp({ textDecoration: activeBlock.appearance.textDecoration === 'underline' ? 'none' : 'underline' })
                              } else if (cmd === 'line-through') {
                                runRichTextCommand('strikeThrough')
                                updApp({ textDecoration: activeBlock.appearance.textDecoration === 'line-through' ? 'none' : 'line-through' })
                              }
                            }}
                          />
                          <ColorSwatch
                            value={normalizeColor(activeBlock.appearance.textColor)}
                            onChange={(v) => updApp({ textColor: v })}
                            label="text"
                          />
                        </div>
                      </div>

                      <Divider />

                      <div className="kn2-section">
                        <p className="kn2-section__title">对齐方式</p>

                        <div className="kn2-align-groups">
                          <KNPillGroup
                            options={[
                              { value: 'left', icon: <AlignLeft size={14} />, label: '左对齐' },
                              { value: 'center', icon: <AlignCenter size={14} />, label: '居中' },
                              { value: 'right', icon: <AlignRight size={14} />, label: '右对齐' },
                              { value: 'justify', icon: <AlignJustify size={14} />, label: '两端对齐' },
                            ]}
                            stretch
                            value={activeBlock.appearance.textAlign || 'left'}
                            onChange={(val) => {
                              const cmds: Record<string, string> = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' }
                              runRichTextCommand(cmds[val as string])
                              updApp({ textAlign: val as typeof activeBlock.appearance.textAlign })
                            }}
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
                        <div className="kn2-spacing-grid">
                          <KNSliderRow
                            label="字距"
                            value={activeBlock.appearance.letterSpacing ?? 0}
                            min={-2} max={10} step={0.5} unit="pt"
                            onChange={(v) => updApp({ letterSpacing: v })}
                          />
                          <KNSliderRow
                            label="行距"
                            value={activeBlock.appearance.lineHeight ?? 1.4}
                            min={0} max={3} step={0.1}
                            onChange={(v) => updApp({ lineHeight: v })}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── 样式 ──────────────────────────────────────────── */}
                  {formatTab === 'style' && (
                    <>
                      {/* ── Fill ─────────────────────────────────────── */}
                      <KNPanel title="填充">
                        <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="kn2-select-wrap">
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
                          <div className="kn2-select-wrap">
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
                          <div className="kn2-select-wrap">
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

                  {!activeAnimation || activeAnimation.effect === 'none' ? (
                    <div className="kn2-anim-empty">
                      <p>{ANIMATION_PHASE_OPTIONS.find((p) => p.id === animationTab)?.emptyLabel}</p>
                      <button
                        className="kn2-primary-btn"
                        onClick={() => updateAnim({ effect: getDefaultEffect(animationTab) })}
                      >
                        ＋ 添加效果
                      </button>
                    </div>
                  ) : (
                    <div className="kn2-anim-panel" style={{ padding: '0 12px 16px' }}>
                      <KNPanel title="动画设置" defaultOpen={true}>
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
                          {activeActionAnim && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 13, color: '#555' }}>循环</span>
                              <Toggle
                                checked={activeActionAnim.loop}
                                onChange={() => updateAnim({ loop: !activeActionAnim.loop })}
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
                          onClick={() => updateAnim({ effect: 'none' })}
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
            </>
          )}

        </div>
      </aside>

      {/* Build order modal */}
      {isBuildOrderOpen && currentSlide && (
        <BuildOrderModal
          activeBlockId={activeBlockId}
          animationTab={animationTab}
          buildOrder={buildOrder}
          onClose={() => setBuildOrderOpen(false)}
          onMove={(id, phase, dir) => moveBlockAnimation(currentSlide.id, id, phase, dir)}
          onSelect={(id, phase) => { setActiveBlock(id); setActiveInspector('animate'); setAnimationTab(phase) }}
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
  buildOrder: ReturnType<typeof getSlideBuildOrder>
  onClose: () => void
  onMove: (blockId: string, phase: AnimationPhase, direction: -1 | 1) => void
  onSelect: (blockId: string, phase: AnimationPhase) => void
  slideName: string
}

function BuildOrderModal({ activeBlockId, animationTab, buildOrder, onClose, onMove, onSelect, slideName }: BuildOrderModalProps) {
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
            {buildOrder.map((item, i) => (
              <div
                key={`${item.blockId}-${item.phase}`}
                className={item.blockId === activeBlockId && item.phase === animationTab ? 'bom__item bom__item--active' : 'bom__item'}
                onClick={() => onSelect(item.blockId, item.phase)}
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
                  <button onClick={() => onMove(item.blockId, item.phase, -1)} disabled={i === 0}><ChevronUp size={13} /></button>
                  <button onClick={() => onMove(item.blockId, item.phase, 1)} disabled={i === buildOrder.length - 1}><ChevronDown size={13} /></button>
                </div>
              </div>
            ))}
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
