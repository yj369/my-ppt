import type {
  ActionAnimation,
  AnimationPhase,
  BlockAnimations,
  BuildInAnimation,
  BuildOutAnimation,
  EditorBlock,
  Slide,
  TriggerType,
} from '../types/editor'

export const ANIMATION_PHASE_OPTIONS: Array<{ id: AnimationPhase; label: string; emptyLabel: string }> = [
  { id: 'buildIn', label: '入场', emptyLabel: '当前未设置入场效果' },
  { id: 'action', label: '动作', emptyLabel: '当前未设置动作效果' },
  { id: 'buildOut', label: '退场', emptyLabel: '当前未设置退场效果' },
]

export const BUILD_IN_OPTIONS = [
  { id: 'none', label: '无效果' },
  { id: 'fade-up', label: '向上浮入' },
  { id: 'fade-left', label: '向左滑入' },
  { id: 'scale-in', label: '弹入' },
  { id: 'rotate-in', label: '旋入' },
  { id: 'blur-in', label: '清晰显现' },
  { id: 'pop', label: '轻弹放大' },
] as const

export const ACTION_OPTIONS = [
  { id: 'none', label: '无效果' },
  { id: 'pulse', label: '脉冲' },
  { id: 'bounce', label: '弹跳' },
  { id: 'shake', label: '抖动' },
  { id: 'flip', label: '翻转' },
  { id: 'flash', label: '闪烁' },
] as const

export const BUILD_OUT_OPTIONS = [
  { id: 'none', label: '无效果' },
  { id: 'fade-out', label: '淡出' },
  { id: 'scale-out', label: '缩退' },
  { id: 'wipe-left', label: '向左移出' },
  { id: 'blur-out', label: '虚化消失' },
] as const

export const TRIGGER_OPTIONS: Array<{ id: TriggerType; label: string }> = [
  { id: 'onClick', label: '单击时' },
  { id: 'withPrev', label: '与上一项同时' },
  { id: 'afterPrev', label: '在上一项之后' },
]

const DEFAULT_BUILD_IN: BuildInAnimation = {
  effect: 'none',
  trigger: 'onClick',
  duration: 0.8,
  delay: 0,
  order: 0,
}

const DEFAULT_ACTION: ActionAnimation = {
  effect: 'none',
  trigger: 'onClick',
  duration: 0.7,
  delay: 0,
  order: 0,
  loop: false,
}

const DEFAULT_BUILD_OUT: BuildOutAnimation = {
  effect: 'none',
  trigger: 'onClick',
  duration: 0.7,
  delay: 0,
  order: 0,
}

export type BuildOrderItem = {
  blockId: string
  blockName: string
  phase: AnimationPhase
  animation: BlockAnimations[AnimationPhase]
}

type BlockAnimationPatch = Partial<{
  effect: string
  trigger: TriggerType
  duration: number
  delay: number
  order: number
  loop: boolean
}>

const PHASES: AnimationPhase[] = ['buildIn', 'action', 'buildOut']

function hasOrder(order: number) {
  return Number.isFinite(order) && order > 0
}

function isActiveEffect(effect: string) {
  return effect !== 'none'
}

export function createDefaultBlockAnimations(
  buildInOverrides: Partial<BuildInAnimation> = {},
): BlockAnimations {
  return {
    buildIn: { ...DEFAULT_BUILD_IN, ...buildInOverrides },
    action: { ...DEFAULT_ACTION },
    buildOut: { ...DEFAULT_BUILD_OUT },
  }
}

export function getBlockAnimations(block: Pick<EditorBlock, 'animations' | 'anim' | 'trigger' | 'duration' | 'delay'>) {
  const buildInLegacy: BuildInAnimation = {
    effect: block.anim ?? 'none',
    trigger: block.trigger ?? 'onClick',
    duration: block.duration ?? 0.8,
    delay: block.delay ?? 0,
    order: block.anim && block.anim !== 'none' ? 1 : 0,
  }

  return {
    buildIn: {
      ...DEFAULT_BUILD_IN,
      ...buildInLegacy,
      ...block.animations?.buildIn,
    },
    action: {
      ...DEFAULT_ACTION,
      ...block.animations?.action,
    },
    buildOut: {
      ...DEFAULT_BUILD_OUT,
      ...block.animations?.buildOut,
    },
  } satisfies BlockAnimations
}

export function hasAnyBlockAnimation(block: EditorBlock) {
  const animations = getBlockAnimations(block)
  return PHASES.some((phase) => isActiveEffect(animations[phase].effect))
}

export function getEffectOptions(phase: AnimationPhase) {
  if (phase === 'buildIn') {
    return BUILD_IN_OPTIONS
  }

  if (phase === 'action') {
    return ACTION_OPTIONS
  }

  return BUILD_OUT_OPTIONS
}

export function getEffectLabel(phase: AnimationPhase, effect: string) {
  return getEffectOptions(phase).find((option) => option.id === effect)?.label ?? '无效果'
}

export function getPhaseLabel(phase: AnimationPhase) {
  return ANIMATION_PHASE_OPTIONS.find((option) => option.id === phase)?.label ?? phase
}

export function getTriggerLabel(trigger: TriggerType) {
  return TRIGGER_OPTIONS.find((option) => option.id === trigger)?.label ?? trigger
}

export function normalizeBlockAnimations(block: EditorBlock) {
  return syncLegacyBuildIn(block, getBlockAnimations(block))
}

export function normalizeSlideAnimations(slide: Slide): Slide {
  const items = collectSlideBuildOrder(slide)
  const orderMap = new Map(items.map((item, index) => [`${item.blockId}:${item.phase}`, index + 1]))

  return {
    ...slide,
    blocks: slide.blocks.map((block) => {
      const animations = getBlockAnimations(block)
      const nextAnimations: BlockAnimations = {
        buildIn: {
          ...animations.buildIn,
          order: isActiveEffect(animations.buildIn.effect)
            ? (orderMap.get(`${block.id}:buildIn`) ?? 0)
            : 0,
        },
        action: {
          ...animations.action,
          order: isActiveEffect(animations.action.effect)
            ? (orderMap.get(`${block.id}:action`) ?? 0)
            : 0,
        },
        buildOut: {
          ...animations.buildOut,
          order: isActiveEffect(animations.buildOut.effect)
            ? (orderMap.get(`${block.id}:buildOut`) ?? 0)
            : 0,
        },
      }

      return syncLegacyBuildIn(block, nextAnimations)
    }),
  }
}

export function getSlideBuildOrder(slide: Slide) {
  return collectSlideBuildOrder(slide).map((item, index) => ({
    ...item,
    animation: {
      ...item.animation,
      order: index + 1,
    },
  }))
}

export function updateSlideBlockAnimation(
  slide: Slide,
  blockId: string,
  phase: AnimationPhase,
  updates: BlockAnimationPatch,
) {
  const nextOrder = collectSlideBuildOrder(slide).length + 1

  return normalizeSlideAnimations({
    ...slide,
    blocks: slide.blocks.map((block) => {
      if (block.id !== blockId) {
        return normalizeBlockAnimations(block)
      }

      const animations = getBlockAnimations(block)
      const current = animations[phase]
      const next = {
        ...current,
        ...updates,
      }

      if (!isActiveEffect(next.effect)) {
        next.order = 0
        next.delay = 0
      } else if (!hasOrder(next.order)) {
        next.order = nextOrder
      }

      return syncLegacyBuildIn(block, {
        ...animations,
        [phase]: next,
      } as BlockAnimations)
    }),
  })
}

export function moveSlideBlockAnimation(
  slide: Slide,
  blockId: string,
  phase: AnimationPhase,
  direction: -1 | 1,
) {
  const items = collectSlideBuildOrder(slide)
  const currentIndex = items.findIndex((item) => item.blockId === blockId && item.phase === phase)

  if (currentIndex < 0) {
    return normalizeSlideAnimations(slide)
  }

  const targetIndex = currentIndex + direction
  if (targetIndex < 0 || targetIndex >= items.length) {
    return normalizeSlideAnimations(slide)
  }

  const reordered = [...items]
  const [item] = reordered.splice(currentIndex, 1)
  reordered.splice(targetIndex, 0, item)

  const orderMap = new Map(reordered.map((entry, index) => [`${entry.blockId}:${entry.phase}`, index + 1]))

  return normalizeSlideAnimations({
    ...slide,
    blocks: slide.blocks.map((block) => {
      const animations = getBlockAnimations(block)
      return syncLegacyBuildIn(block, {
        buildIn: {
          ...animations.buildIn,
          order: isActiveEffect(animations.buildIn.effect)
            ? (orderMap.get(`${block.id}:buildIn`) ?? 0)
            : 0,
        },
        action: {
          ...animations.action,
          order: isActiveEffect(animations.action.effect)
            ? (orderMap.get(`${block.id}:action`) ?? 0)
            : 0,
        },
        buildOut: {
          ...animations.buildOut,
          order: isActiveEffect(animations.buildOut.effect)
            ? (orderMap.get(`${block.id}:buildOut`) ?? 0)
            : 0,
        },
      })
    }),
  })
}

function collectSlideBuildOrder(slide: Slide) {
  return slide.blocks
    .flatMap((block, blockIndex) => {
      const animations = getBlockAnimations(block)

      return PHASES.flatMap((phase, phaseIndex) => {
        const animation = animations[phase]
        if (!isActiveEffect(animation.effect)) {
          return []
        }

        const fallbackOrder = blockIndex * 10 + phaseIndex

        return [
          {
            blockId: block.id,
            blockName: block.name,
            phase,
            animation,
            fallbackOrder,
          },
        ]
      })
    })
    .sort((left, right) => {
      if (hasOrder(left.animation.order) && hasOrder(right.animation.order)) {
        return left.animation.order - right.animation.order
      }

      if (hasOrder(left.animation.order)) {
        return -1
      }

      if (hasOrder(right.animation.order)) {
        return 1
      }

      return left.fallbackOrder - right.fallbackOrder
    })
    .map((item) => ({
      blockId: item.blockId,
      blockName: item.blockName,
      phase: item.phase,
      animation: item.animation,
    }))
}

function syncLegacyBuildIn(block: EditorBlock, animations: BlockAnimations) {
  return {
    ...block,
    anim: animations.buildIn.effect,
    trigger: animations.buildIn.trigger,
    duration: animations.buildIn.duration,
    delay: animations.buildIn.delay,
    animations,
  }
}
