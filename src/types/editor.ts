export type PresentationTheme = 'classic' | 'studio' | 'sunset' | 'paper'

export type SlideLayout =
  | 'title'
  | 'section'
  | 'two-column'
  | 'metrics'
  | 'media-left'
  | 'blank'

export type SlideTransition =
  | 'magic'
  | 'fade'
  | 'move-left'
  | 'move-up'
  | 'zoom'
  | 'dissolve'

export type SlideBg = 'theme' | 'aurora' | 'midnight' | 'paper' | 'sunset' | 'spotlight'

export type ElementType =
  | 'eyebrow'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bullet'
  | 'quote'
  | 'stat'
  | 'image'
  | 'video'
  | 'table'
  | 'chart'
  | 'timeline'
  | 'shape-rect'
  | 'shape-rounded'
  | 'shape-circle'
  | 'shape-triangle'
  | 'shape-diamond'
  | 'shape-pentagon'
  | 'shape-star'
  | 'shape-arrow-right'
  | 'shape-arrow-double'
  | 'shape-callout-oval'
  | 'shape-callout-rect'
  | 'divider'
  | '3d'

export type AnimationType =
  | 'none'
  | 'fade-up'
  | 'fade-left'
  | 'scale-in'
  | 'rotate-in'
  | 'blur-in'
  | 'pop'

export type ActionAnimationType =
  | 'none'
  | 'pulse'
  | 'bounce'
  | 'shake'
  | 'flip'
  | 'flash'

export type BuildOutAnimationType =
  | 'none'
  | 'fade-out'
  | 'scale-out'
  | 'wipe-left'
  | 'blur-out'

export type AnimationPhase = 'buildIn' | 'action' | 'buildOut'
export type TriggerType = 'onClick' | 'withPrev' | 'afterPrev'
export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type InspectorTab = 'document' | 'format' | 'animate'

export type BuildInAnimation = {
  effect: AnimationType
  trigger: TriggerType
  duration: number
  delay: number
  order: number
}

export type ActionAnimation = {
  effect: ActionAnimationType
  trigger: TriggerType
  duration: number
  delay: number
  order: number
  loop: boolean
}

export type BuildOutAnimation = {
  effect: BuildOutAnimationType
  trigger: TriggerType
  duration: number
  delay: number
  order: number
}

export type BlockAnimations = {
  buildIn: BuildInAnimation
  action: ActionAnimation
  buildOut: BuildOutAnimation
}

export type BlockAppearance = {
  // Fill
  fillType?: 'none' | 'color' | 'gradient'
  fill: string                   // primary color (also gradient-from)
  gradientTo?: string            // gradient end color
  gradientAngle?: number         // gradient angle in degrees (0–360)
  fillOpacity?: number           // 0–1 fill opacity
  // Stroke / Border
  stroke: string
  strokeWidth: number
  strokeStyle?: 'none' | 'solid' | 'dashed' | 'dotted'
  // Shape
  radius: number
  // Box model
  marginTop?: number
  marginRight?: number
  marginBottom?: number
  marginLeft?: number
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number
  // Shadow (detailed Keynote-style)
  shadow: boolean
  shadowBlur?: number            // blur radius in px (Keynote: 0–100)
  shadowOffset?: number          // distance in px
  shadowOpacity?: number         // 0–1
  shadowAngle?: number           // degrees (0–360)
  shadowColor?: string           // CSS color
  // Reflection
  reflection?: boolean
  // Typography
  textColor: string
  textStrokeColor?: string
  textStrokeWidth?: number
  fontSize: number
  textAlign: TextAlign
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  verticalAlign?: 'top' | 'middle' | 'bottom'
  letterSpacing?: number
  lineHeight?: number
  // Transform
  flipX?: boolean
  flipY?: boolean
}

export type EditorBlock = {
  id: string
  name: string
  type: ElementType
  groupId?: string | null
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  rotation: number
  opacity: number
  locked: boolean
  hidden: boolean
  keepRatio?: boolean
  content: string
  appearance: BlockAppearance
  anim: AnimationType
  trigger: TriggerType
  duration: number
  delay: number
  animations?: BlockAnimations
}

export type Slide = {
  id: string
  name: string
  layout: SlideLayout
  transition: SlideTransition
  transitionDuration: number
  bg: SlideBg
  notes: string
  skipped: boolean
  blocks: EditorBlock[]
}

export type PresentationSnapshot = {
  presentationName: string
  theme: PresentationTheme
  slides: Slide[]
  currentSlideId: string | null
  showGrid: boolean
  showGuides: boolean
}
