import type {
  ActionAnimation,
  AnimationType,
  AnimationPhase,
  BlockAnimations,
  BuildInAnimation,
  BuildOutAnimationType,
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
  { id: 'appear', label: '出现' },
  { id: 'blur', label: '模糊' },
  { id: 'compress', label: '压缩' },
  { id: 'dissolve', label: '溶解' },
  { id: 'drift', label: '漂移' },
  { id: 'drift-scale', label: '漂移与缩放' },
  { id: 'drop', label: '掉落' },
  { id: 'fade-move', label: '淡入并移动' },
  { id: 'fade-scale', label: '淡入并缩放' },
  { id: 'fly-in', label: '飞入' },
  { id: 'iris', label: '光圈' },
  { id: 'keyboard', label: '键盘' },
  { id: 'move-in', label: '移入' },
  { id: 'wipe', label: '擦入' },
] as const satisfies ReadonlyArray<{ id: AnimationType; label: string }>

const ACTION_BASIC_OPTIONS = [
  { id: 'move', label: '移动' },
  { id: 'opacity', label: '不透明度' },
  { id: 'rotate', label: '旋转' },
  { id: 'scale', label: '缩放' },
] as const satisfies ReadonlyArray<{ id: ActionAnimation['effect']; label: string }>

const ACTION_EMPHASIS_OPTIONS = [
  { id: 'blink', label: '闪烁' },
  { id: 'bounce', label: '弹跳' },
  { id: 'flip', label: '翻转' },
  { id: 'jiggle', label: '晃动' },
  { id: 'pop', label: '弹出' },
  { id: 'pulse', label: '脉冲' },
] as const satisfies ReadonlyArray<{ id: ActionAnimation['effect']; label: string }>

export const ACTION_OPTION_GROUPS = [
  { id: 'basic', label: '基础', options: ACTION_BASIC_OPTIONS },
  { id: 'emphasis', label: '强调', options: ACTION_EMPHASIS_OPTIONS },
] as const

export const ACTION_OPTIONS = [
  { id: 'none', label: '无效果' },
  ...ACTION_BASIC_OPTIONS,
  ...ACTION_EMPHASIS_OPTIONS,
] as const

export const BUILD_OUT_OPTIONS = [
  { id: 'none', label: '无效果' },
  { id: 'appear', label: '消失' },
  { id: 'blur', label: '模糊' },
  { id: 'compress', label: '压缩' },
  { id: 'dissolve', label: '溶解' },
  { id: 'drift', label: '漂移' },
  { id: 'drift-scale', label: '漂移与缩放' },
  { id: 'drop', label: '掉落' },
  { id: 'fade-move', label: '淡出并移动' },
  { id: 'fade-scale', label: '淡出并缩放' },
  { id: 'fly-in', label: '飞出' },
  { id: 'iris', label: '光圈' },
  { id: 'keyboard', label: '键盘' },
  { id: 'move-in', label: '移出' },
  { id: 'wipe', label: '擦除' },
] as const satisfies ReadonlyArray<{ id: BuildOutAnimationType; label: string }>

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
  config: {},
}

export const DEFAULT_ACTION: Omit<ActionAnimation, 'id'> = {
  effect: 'none',
  trigger: 'onClick',
  duration: 0.7,
  delay: 0,
  order: 0,
  loop: false,
  config: {},
}

const DEFAULT_BUILD_OUT: BuildOutAnimation = {
  effect: 'none',
  trigger: 'onClick',
  duration: 0.7,
  delay: 0,
  order: 0,
  config: {},
}

export type BuildOrderItem = {
  blockId: string
  blockName: string
  phase: AnimationPhase
  actionId?: string
  animation: BuildInAnimation | ActionAnimation | BuildOutAnimation
}

type BlockAnimationPatch = Partial<{
  effect: string
  trigger: TriggerType
  duration: number
  delay: number
  order: number
  loop: boolean
  config: any
}>

const VALID_TRIGGERS = new Set<TriggerType>(TRIGGER_OPTIONS.map((option) => option.id))
const VALID_BUILD_IN_EFFECTS = new Set<string>(BUILD_IN_OPTIONS.map((option) => option.id))
const VALID_BUILD_OUT_EFFECTS = new Set<string>(BUILD_OUT_OPTIONS.map((option) => option.id))
const VALID_ACTION_EFFECTS = new Set<string>(ACTION_OPTIONS.map((option) => option.id))

export type AnimationPoint = {
  x: number
  y: number
}

function hasOrder(order: number) {
  return Number.isFinite(order) && order > 0
}

function isActiveEffect(effect: string) {
  return effect !== 'none'
}

function sanitizeTrigger(trigger: string | undefined, fallback: TriggerType) {
  return VALID_TRIGGERS.has(trigger as TriggerType) ? (trigger as TriggerType) : fallback
}

function sanitizeTime(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, value as number) : fallback
}

function sanitizeOrder(order: number | undefined, effect: string) {
  if (!isActiveEffect(effect)) {
    return 0
  }
  return Number.isFinite(order) ? Math.max(0, order as number) : 0
}

function sanitizeEffect<T extends string>(effect: string | undefined, validEffects: Set<string>, fallback: T) {
  return validEffects.has(effect ?? '') ? (effect as T) : fallback
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function getDirectionOffset(direction: string = 'right', distance: number = 100): AnimationPoint {
  switch (direction) {
    case 'left': return { x: -distance, y: 0 }
    case 'right': return { x: distance, y: 0 }
    case 'top': return { x: 0, y: -distance }
    case 'bottom': return { x: 0, y: distance }
    case 'top-left': return { x: -distance, y: -distance }
    case 'top-right': return { x: distance, y: -distance }
    case 'bottom-left': return { x: -distance, y: distance }
    case 'bottom-right': return { x: distance, y: distance }
    default: return { x: distance, y: 0 }
  }
}

export function resolveMoveTarget(
  config: ActionAnimation['config'] | undefined,
  start: AnimationPoint = { x: 0, y: 0 },
  fallbackDistance: number = 50,
): AnimationPoint {
  const toX = getFiniteNumber(config?.toX)
  const toY = getFiniteNumber(config?.toY)

  if (toX !== undefined || toY !== undefined) {
    return {
      x: toX ?? start.x,
      y: toY ?? start.y,
    }
  }

  const distance = getFiniteNumber(config?.distance) ?? fallbackDistance
  const offset = getDirectionOffset(config?.direction || 'right', distance)

  return {
    x: start.x + offset.x,
    y: start.y + offset.y,
  }
}

function getMoveStartPoint(actions: ActionAnimation[], stopBeforeIndex: number) {
  let current: AnimationPoint = { x: 0, y: 0 }

  for (let index = 0; index < stopBeforeIndex; index += 1) {
    const action = actions[index]
    if (action.effect !== 'move') {
      continue
    }
    current = resolveMoveTarget(action.config, current)
  }

  return current
}

function buildDefaultMoveConfig(actions: ActionAnimation[], stopBeforeIndex: number) {
  const start = getMoveStartPoint(actions, stopBeforeIndex)
  return {
    toX: start.x + 50,
    toY: start.y,
  }
}

export function getMoveActionPath(actions: ActionAnimation[], actionId: string) {
  let current: AnimationPoint = { x: 0, y: 0 }

  for (const action of actions) {
    if (action.effect !== 'move') {
      continue
    }

    const start = current
    const end = resolveMoveTarget(action.config, start)

    if (action.id === actionId) {
      return {
        start,
        end,
      }
    }

    current = end
  }

  return null
}

function sanitizeBuildInAnimation(animation: Partial<BuildInAnimation> = {}): BuildInAnimation {
  const effect = sanitizeEffect(animation.effect, VALID_BUILD_IN_EFFECTS, DEFAULT_BUILD_IN.effect)
  if (!isActiveEffect(effect)) {
    return { ...DEFAULT_BUILD_IN }
  }

  return {
    effect,
    trigger: sanitizeTrigger(animation.trigger, DEFAULT_BUILD_IN.trigger),
    duration: sanitizeTime(animation.duration, DEFAULT_BUILD_IN.duration),
    delay: sanitizeTime(animation.delay, DEFAULT_BUILD_IN.delay),
    order: sanitizeOrder(animation.order, effect),
    config: animation.config ?? {},
  }
}

function sanitizeBuildOutAnimation(animation: Partial<BuildOutAnimation> = {}): BuildOutAnimation {
  const effect = sanitizeEffect(animation.effect, VALID_BUILD_OUT_EFFECTS, DEFAULT_BUILD_OUT.effect)
  if (!isActiveEffect(effect)) {
    return { ...DEFAULT_BUILD_OUT }
  }

  return {
    effect,
    trigger: sanitizeTrigger(animation.trigger, DEFAULT_BUILD_OUT.trigger),
    duration: sanitizeTime(animation.duration, DEFAULT_BUILD_OUT.duration),
    delay: sanitizeTime(animation.delay, DEFAULT_BUILD_OUT.delay),
    order: sanitizeOrder(animation.order, effect),
    config: animation.config ?? {},
  }
}

function sanitizeActionAnimation(animation: Partial<ActionAnimation>): ActionAnimation | null {
  const effect = sanitizeEffect(animation.effect, VALID_ACTION_EFFECTS, DEFAULT_ACTION.effect)
  if (!isActiveEffect(effect)) {
    return null
  }

  return {
    id: animation.id ?? Math.random().toString(36).substring(2, 11),
    effect,
    trigger: sanitizeTrigger(animation.trigger, DEFAULT_ACTION.trigger),
    duration: sanitizeTime(animation.duration, DEFAULT_ACTION.duration),
    delay: sanitizeTime(animation.delay, DEFAULT_ACTION.delay),
    order: sanitizeOrder(animation.order, effect),
    loop: animation.loop === true,
    config: animation.config ?? {},
  }
}

export function createDefaultBlockAnimations(
  buildInOverrides: Partial<BuildInAnimation> = {},
): BlockAnimations {
  return {
    buildIn: { ...DEFAULT_BUILD_IN, ...buildInOverrides },
    action: [],
    buildOut: { ...DEFAULT_BUILD_OUT },
  }
}

export function getBlockAnimations(block: Pick<EditorBlock, 'animations' | 'anim' | 'trigger' | 'duration' | 'delay'>) {
  const buildInLegacy: Partial<BuildInAnimation> = {
    effect: block.anim ?? 'none',
    trigger: block.trigger ?? 'onClick',
    duration: block.duration ?? 0.8,
    delay: block.delay ?? 0,
    order: block.anim && block.anim !== 'none' ? 1 : 0,
  }

  let actionArray: ActionAnimation[] = []
  if (block.animations?.action) {
    if (Array.isArray(block.animations.action)) {
      actionArray = block.animations.action
        .map((action) => sanitizeActionAnimation(action))
        .filter((action): action is ActionAnimation => action !== null)
    } else {
      const legacyAction: any = block.animations.action
      if (legacyAction.effect) {
        const sanitizedLegacyAction = sanitizeActionAnimation({
          ...DEFAULT_ACTION,
          id: legacyAction.id || Math.random().toString(36).substring(2, 11),
          ...legacyAction,
        })
        if (sanitizedLegacyAction) {
          actionArray = [sanitizedLegacyAction]
        }
      }
    }
  }

  return {
    buildIn: sanitizeBuildInAnimation({
      ...buildInLegacy,
      ...block.animations?.buildIn,
    }),
    action: actionArray,
    buildOut: sanitizeBuildOutAnimation({
      ...block.animations?.buildOut,
    }),
  } satisfies BlockAnimations
}

export function hasAnyBlockAnimation(block: EditorBlock) {
  const animations = getBlockAnimations(block)
  return isActiveEffect(animations.buildIn.effect) ||
         animations.action.some(a => isActiveEffect(a.effect)) ||
         isActiveEffect(animations.buildOut.effect)
}

export const EASE_OPTIONS = [
  { id: 'power1.out', label: '轻微淡出' },
  { id: 'power2.out', label: '标准淡出' },
  { id: 'power3.out', label: '强调淡出' },
  { id: 'power4.out', label: '强烈淡出' },
  { id: 'expo.out', label: '极速淡出' },
  { id: 'back.out(1.7)', label: '回弹淡出' },
  { id: 'bounce.out', label: '弹跳淡出' },
  { id: 'power2.inOut', label: '平滑进出' },
  { id: 'none', label: '匀速' },
] as const

export const DIRECTION_OPTIONS = [
  { id: 'left', label: '从左侧' },
  { id: 'right', label: '从右侧' },
  { id: 'top', label: '从顶部' },
  { id: 'bottom', label: '从底部' },
  { id: 'top-left', label: '从左上' },
  { id: 'top-right', label: '从右上' },
  { id: 'bottom-left', label: '从左下' },
  { id: 'bottom-right', label: '从右下' },
  { id: 'center', label: '从中心' },
  { id: 'clockwise', label: '顺时针' },
  { id: 'counter-clockwise', label: '逆时针' },
] as const

export function getEffectConfigFields(phase: AnimationPhase, effect: string): string[] {
  if (effect === 'none') return []

  const common = ['ease']

  if (phase === 'buildIn' || phase === 'buildOut') {
    switch (effect) {
      case 'appear':
      case 'dissolve':
        return [...common]
      case 'blur':
        return [...common, 'blur']
      case 'compress':
        return [...common, 'scale']
      case 'drift':
      case 'drift-scale':
        return [...common, 'direction', 'distance']
      case 'drop':
        return [...common, 'distance']
      case 'fade-move':
      case 'move-in':
      case 'fly-in':
        return [...common, 'direction', 'distance']
      case 'fade-scale':
        return [...common, 'scale']
      case 'wipe':
      case 'iris':
        return [...common, 'direction']
      default:
        return common
    }
  }

  if (phase === 'action') {
    switch (effect) {
      case 'move':
        return [...common, 'direction', 'distance']
      case 'opacity':
        return [...common, 'opacity']
      case 'rotate':
        return [...common, 'rotate', 'direction']
      case 'scale':
      case 'pulse':
      case 'pop':
        return [...common, 'scale']
      case 'blink':
        return [...common, 'opacity']
      case 'bounce':
        return [...common, 'bounceStrength']
      case 'jiggle':
        return [...common, 'shakeStrength']
      case 'flip':
        return [...common, 'direction']
      default:
        return common
    }
  }

  return common
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
  const orderMap = new Map(items.map((item, index) => [`${item.blockId}:${item.phase}${item.actionId ? `:${item.actionId}` : ''}`, index + 1]))

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
        action: animations.action.map(a => ({
          ...a,
          order: isActiveEffect(a.effect) ? (orderMap.get(`${block.id}:action:${a.id}`) ?? 0) : 0
        })),
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
  actionId?: string,
) {
  const nextOrder = collectSlideBuildOrder(slide).length + 1

  return normalizeSlideAnimations({
    ...slide,
    blocks: slide.blocks.map((block) => {
      if (block.id !== blockId) {
        return normalizeBlockAnimations(block)
      }

      const animations = getBlockAnimations(block)

      if (phase === 'action') {
        if (!actionId) return normalizeBlockAnimations(block)
        const currentActionIndex = animations.action.findIndex(a => a.id === actionId)
        if (currentActionIndex < 0) return normalizeBlockAnimations(block)

        const current = animations.action[currentActionIndex]
        const nextConfig = updates.config === undefined
          ? (current.config ?? {})
          : { ...(current.config ?? {}), ...updates.config }
        const next = { ...current, ...updates, config: nextConfig }

        if (updates.effect === 'move' && next.config?.toX === undefined && next.config?.toY === undefined) {
          next.config = {
            ...next.config,
            ...buildDefaultMoveConfig(animations.action, currentActionIndex),
          }
        }

        if (!isActiveEffect(next.effect)) {
          next.order = 0
          next.delay = 0
        } else if (!hasOrder(next.order)) {
          next.order = nextOrder
        }

        const nextActions = [...animations.action]
        nextActions[currentActionIndex] = next as ActionAnimation

        return syncLegacyBuildIn(block, {
          ...animations,
          action: nextActions
        })
      }

      const current = animations[phase]
      const nextConfig = updates.config === undefined
        ? (current.config ?? {})
        : { ...(current.config ?? {}), ...updates.config }
      const next = {
        ...current,
        ...updates,
        config: nextConfig,
      } as any

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

export function addSlideBlockAction(slide: Slide, blockId: string, action: ActionAnimation) {
  const nextOrder = collectSlideBuildOrder(slide).length + 1
  return normalizeSlideAnimations({
    ...slide,
    blocks: slide.blocks.map((block) => {
      if (block.id !== blockId) return normalizeBlockAnimations(block)
      const animations = getBlockAnimations(block)
      const nextAction = action.effect === 'move' && action.config?.toX === undefined && action.config?.toY === undefined
        ? {
            ...action,
            config: {
              ...(action.config ?? {}),
              ...buildDefaultMoveConfig(animations.action, animations.action.length),
            },
          }
        : action
      return syncLegacyBuildIn(block, {
        ...animations,
        action: [...animations.action, { ...nextAction, order: nextOrder }]
      })
    })
  })
}

export function removeSlideBlockAction(slide: Slide, blockId: string, actionId: string) {
  return normalizeSlideAnimations({
    ...slide,
    blocks: slide.blocks.map((block) => {
      if (block.id !== blockId) return normalizeBlockAnimations(block)
      const animations = getBlockAnimations(block)
      return syncLegacyBuildIn(block, {
        ...animations,
        action: animations.action.filter(a => a.id !== actionId)
      })
    })
  })
}

export function moveSlideBlockAnimation(
  slide: Slide,
  blockId: string,
  phase: AnimationPhase,
  direction: -1 | 1,
  actionId?: string,
) {
  const items = collectSlideBuildOrder(slide)
  const currentIndex = items.findIndex((item) => item.blockId === blockId && item.phase === phase && (phase !== 'action' || item.actionId === actionId))

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

  const orderMap = new Map(reordered.map((entry, index) => [`${entry.blockId}:${entry.phase}${entry.actionId ? `:${entry.actionId}` : ''}`, index + 1]))

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
        action: animations.action.map(a => ({
          ...a,
          order: isActiveEffect(a.effect) ? (orderMap.get(`${block.id}:action:${a.id}`) ?? 0) : 0
        })),
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

function collectSlideBuildOrder(slide: Slide): (BuildOrderItem & { fallbackOrder: number })[] {
  return slide.blocks
    .flatMap((block, blockIndex) => {
      const animations = getBlockAnimations(block)
      const items: (BuildOrderItem & { fallbackOrder: number })[] = []

      if (isActiveEffect(animations.buildIn.effect)) {
        items.push({
          blockId: block.id,
          blockName: block.name,
          phase: 'buildIn',
          animation: animations.buildIn,
          fallbackOrder: blockIndex * 10 + 0,
        })
      }

      animations.action.forEach((action, actionIndex) => {
        if (isActiveEffect(action.effect)) {
          items.push({
            blockId: block.id,
            blockName: block.name,
            phase: 'action',
            actionId: action.id,
            animation: action,
            fallbackOrder: blockIndex * 10 + 1 + (actionIndex * 0.1),
          })
        }
      })

      if (isActiveEffect(animations.buildOut.effect)) {
        items.push({
          blockId: block.id,
          blockName: block.name,
          phase: 'buildOut',
          animation: animations.buildOut,
          fallbackOrder: blockIndex * 10 + 2,
        })
      }

      return items
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
      actionId: item.actionId,
      animation: item.animation,
      fallbackOrder: item.fallbackOrder,
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
