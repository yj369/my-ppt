import gsap from 'gsap'
import { getBlockAnimations, getMoveActionPath, resolveMoveTarget } from './animations'
import type { AnimationPhase, EditorBlock, BuildInAnimation, ActionAnimation, BuildOutAnimation } from '../types/editor'

export type RuntimeSequenceItem = {
  element: HTMLElement
  phase: AnimationPhase
  actionId?: string
  animation: BuildInAnimation | ActionAnimation | BuildOutAnimation
  opacity: number
}

function getBaseState(block: EditorBlock) {
  return {
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotate: block.rotation,
    rotateY: 0,
    filter: 'blur(0px)',
    clipPath: 'none',
    transformOrigin: '50% 50%',
  }
}

const activeRuntimeAnimations = new WeakMap<HTMLElement, gsap.core.Animation>()

function rememberRuntimeAnimation(element: HTMLElement, animation: gsap.core.Animation) {
  activeRuntimeAnimations.set(element, animation)
}

function stopElementRuntime(element: HTMLElement, phase?: AnimationPhase) {
  if (!phase) {
    gsap.killTweensOf(element)
  } else {
    // If we're starting a new phase, we might want to keep existing loops running
    // unless they are the same phase. For action animations, we often want multiple to stack.
    if (phase === 'buildIn' || phase === 'buildOut') {
      gsap.killTweensOf(element)
    }
  }

  const runningAnimation = activeRuntimeAnimations.get(element)
  if (runningAnimation) {
    // Only kill if it's a non-looping animation or if we're moving to a destructive phase like buildOut
    const tweenRepeat = 'vars' in runningAnimation
      ? (runningAnimation as gsap.core.Animation & { vars?: { repeat?: number } }).vars?.repeat
      : undefined
    const isLoop = tweenRepeat === -1 || (runningAnimation instanceof gsap.core.Timeline && runningAnimation.repeat() === -1)
    if (phase === 'buildOut' || !isLoop) {
      runningAnimation.kill()
      activeRuntimeAnimations.delete(element)
    }
  }
}

export function restoreBlockAfterPreview(element: HTMLElement, block: EditorBlock) {
  gsap.killTweensOf(element)
  activeRuntimeAnimations.delete(element)
  gsap.set(element, getBaseState(block))
  gsap.set(element, {
    display: 'block',
    autoAlpha: block.hidden ? Math.min(block.opacity, 0.2) : block.opacity,
    pointerEvents: 'auto',
  })
}

export function initializeBlockForPlay(element: HTMLElement, block: EditorBlock) {
  const animations = getBlockAnimations(block)

  gsap.killTweensOf(element)
  activeRuntimeAnimations.delete(element)
  gsap.set(element, getBaseState(block))

  if (block.hidden) {
    gsap.set(element, { display: 'none', autoAlpha: 0, pointerEvents: 'none' })
    return
  }

  if (animations.buildIn.effect !== 'none') {
    gsap.set(element, { display: 'block', autoAlpha: 0, pointerEvents: 'none' })
    return
  }

  gsap.set(element, { display: 'block', autoAlpha: block.opacity, pointerEvents: 'auto' })
}

export function playSequenceItem(item: RuntimeSequenceItem) {
  runPhaseAnimation(item)
}

export function previewBlockPhase(
  element: HTMLElement,
  block: EditorBlock,
  phase: AnimationPhase,
  actionId?: string,
) {
  const animations = getBlockAnimations(block)

  let animation: any
  if (phase === 'action') {
    if (actionId) {
      animation = animations.action.find(a => a.id === actionId)
    } else {
      animation = animations.action[0]
    }
  } else {
    animation = animations[phase]
  }

  if (!animation || animation.effect === 'none') {
    return false
  }

  const item: RuntimeSequenceItem = {
    element,
    phase,
    actionId,
    animation,
    opacity: block.opacity,
  }

  // For preview, we still want to clear to have a clean start
  gsap.killTweensOf(element)
  activeRuntimeAnimations.delete(element)

  gsap.set(element, getBaseState(block))
  gsap.set(element, { display: 'block', autoAlpha: block.opacity, pointerEvents: 'auto' })

  if (phase === 'buildIn') {
    gsap.set(element, { autoAlpha: 0 })
  } else if (phase === 'action' && actionId && animation.effect === 'move') {
    const movePath = getMoveActionPath(animations.action, actionId)
    if (movePath) {
      gsap.set(element, { x: movePath.start.x, y: movePath.start.y })
    }
  }

  runPhaseAnimation(item, {
    preview: true,
    restoreAfterBuildOut: phase === 'buildOut',
  })
  return true
}

function runPhaseAnimation(
  item: RuntimeSequenceItem,
  options: { preview?: boolean; restoreAfterBuildOut?: boolean } = {},
) {
  if (!options.preview) {
    stopElementRuntime(item.element, item.phase)
  }

  if (item.phase === 'buildIn') {
    animateBuildIn(item)
    return
  }

  if (item.phase === 'action') {
    animateAction(item)
    return
  }

  animateBuildOut(item, options.restoreAfterBuildOut === true)
}

function finalizeBuildInState(element: HTMLElement, opacity: number) {
  gsap.set(element, {
    x: 0,
    y: 0,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    rotateY: 0,
    filter: 'blur(0px)',
    clipPath: 'none',
    autoAlpha: opacity,
    transformOrigin: '50% 50%',
  })
}

function createKeyboardTimeline(
  element: HTMLElement,
  direction: 'in' | 'out',
  duration: number,
  delay: number,
  opacity: number,
  onComplete: () => void,
) {
  const steps = 12
  const timeline = gsap.timeline({ delay, onComplete })
  const segmentDuration = Math.max(duration / steps, 0.03)

  gsap.set(element, {
    autoAlpha: opacity,
    clipPath: direction === 'in' ? 'inset(0 100% 0 0)' : 'inset(0 0% 0 0)',
  })

  for (let index = 1; index <= steps; index += 1) {
    const reveal = direction === 'in'
      ? 100 - ((index * 100) / steps)
      : (index * 100) / steps

    timeline.to(element, {
      clipPath: `inset(0 ${Math.min(Math.max(reveal, 0), 100)}% 0 0)`,
      duration: segmentDuration,
      ease: 'none',
    })
  }

  return timeline
}

function getDirectionCoordinates(direction: string = 'right', distance: number = 100) {
  const x = 0
  const y = 0

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

function getEase(ease?: string, defaultEase: string = 'power2.out') {
  return ease || defaultEase
}

function animateBuildIn(item: RuntimeSequenceItem) {
  const { element, animation, opacity } = item
  const config = animation.config || {}
  const quickDuration = Math.min(Math.max(animation.duration * 0.15, 0.08), 0.16)
  const finish = () => finalizeBuildInState(element, opacity)
  const ease = getEase(config.ease, 'power3.out')

  gsap.set(element, { display: 'block', pointerEvents: 'auto' })

  if (animation.effect === 'appear') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { autoAlpha: 0 },
      { autoAlpha: opacity, duration: quickDuration, delay: animation.delay, ease: 'none', onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'blur') {
    const blurVal = config.blur !== undefined ? config.blur : 20
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { filter: `blur(${blurVal}px)`, autoAlpha: 0 },
      { filter: 'blur(0px)', autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease, onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'compress') {
    const scale = config.scale !== undefined ? config.scale : 1.25
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { scaleX: scale, scaleY: 1 / scale, autoAlpha: 0 },
      { scaleX: 1, scaleY: 1, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'back.out(1.7)', onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'dissolve') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { autoAlpha: 0 },
      { autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'none', onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'drift') {
    const { x, y } = getDirectionCoordinates(config.direction || 'right', config.distance !== undefined ? config.distance : 40)
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { x, y, autoAlpha: 0 },
      { x: 0, y: 0, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease, onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'drift-scale') {
    const { x, y } = getDirectionCoordinates(config.direction || 'right', config.distance !== undefined ? config.distance : 30)
    const scale = config.scale !== undefined ? config.scale : 0.9
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { x, y, scale, autoAlpha: 0 },
      { x: 0, y: 0, scale: 1, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power4.out', onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'drop') {
    const distance = config.distance !== undefined ? config.distance : 100
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { y: -distance, autoAlpha: 0 },
      { y: 0, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'bounce.out', onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'fade-move') {
    const { x, y } = getDirectionCoordinates(config.direction || 'bottom', config.distance !== undefined ? config.distance : 50)
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { x, y, autoAlpha: 0 },
      { x: 0, y: 0, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease, onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'fade-scale') {
    const scale = config.scale !== undefined ? config.scale : 1.15
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { scale, autoAlpha: 0 },
      { scale: 1, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease, onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'fly-in') {
    const { x, y } = getDirectionCoordinates(config.direction || 'right', config.distance !== undefined ? config.distance : 300)
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { x, y, autoAlpha: 0 },
      { x: 0, y: 0, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'expo.out', onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'iris') {
    const pos = config.direction === 'center' ? '50% 50%' :
                config.direction === 'top' ? '50% 0%' :
                config.direction === 'bottom' ? '50% 100%' :
                config.direction === 'left' ? '0% 50%' : '100% 50%'

    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { clipPath: `circle(0% at ${pos})`, autoAlpha: opacity },
      { clipPath: `circle(150% at ${pos})`, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease, onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'keyboard') {
    rememberRuntimeAnimation(
      element,
      createKeyboardTimeline(element, 'in', animation.duration, animation.delay, opacity, finish),
    )
    return
  }

  if (animation.effect === 'move-in') {
    const { x, y } = getDirectionCoordinates(config.direction || 'right', config.distance !== undefined ? config.distance : 100)
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { x, y, autoAlpha: opacity },
      { x: 0, y: 0, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power4.out', onComplete: finish },
    ))
    return
  }

  if (animation.effect === 'wipe') {
    const inset = config.direction === 'right' ? '0 100% 0 0' :
                  config.direction === 'left' ? '0 0 0 100%' :
                  config.direction === 'bottom' ? '0 0 100% 0' : '100% 0 0 0'

    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { clipPath: `inset(${inset})`, autoAlpha: opacity },
      { clipPath: 'inset(0 0 0 0)', autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power2.inOut', onComplete: finish },
    ))
    return
  }

  rememberRuntimeAnimation(element, gsap.to(element, {
    autoAlpha: opacity,
    duration: animation.duration,
    delay: animation.delay,
    ease: 'power2.out',
    onComplete: finish,
  }))
}

function animateAction(item: RuntimeSequenceItem) {
  const { element, opacity } = item
  const animation = item.animation as ActionAnimation
  const config = animation.config || {}
  const ease = getEase(config.ease, 'power2.inOut')

  if (animation.effect === 'none') {
    return
  }

  const duration = animation.duration
  const repeatCount = animation.loop ? -1 : (config.repeat !== undefined ? config.repeat : 1)
  const timelineRepeat = animation.loop ? -1 : 0
  const currentX = Number(gsap.getProperty(element, 'x')) || 0
  const currentY = Number(gsap.getProperty(element, 'y')) || 0
  const currentRotation = Number(gsap.getProperty(element, 'rotation')) || 0

  if (animation.effect === 'move') {
    const target = resolveMoveTarget(config, { x: currentX, y: currentY })

    rememberRuntimeAnimation(element, gsap.to(element, {
      x: target.x,
      y: target.y,
      duration,
      delay: animation.delay,
      ease,
      repeat: animation.loop ? -1 : 0,
      overwrite: false
    }))
    return
  }

  if (animation.effect === 'opacity') {
    const targetOpacity = config.opacity !== undefined ? config.opacity : (opacity * 0.2)
    rememberRuntimeAnimation(element, gsap.to(element, {
      autoAlpha: targetOpacity,
      duration,
      delay: animation.delay,
      ease,
      repeat: animation.loop ? -1 : 0,
      overwrite: false
    }))
    return
  }

  if (animation.effect === 'rotate') {
    const rot = config.rotate !== undefined ? config.rotate : 15
    const dir = config.direction === 'counter-clockwise' ? -1 : 1
    rememberRuntimeAnimation(element, gsap.to(element, {
      rotate: currentRotation + (rot * dir),
      duration,
      delay: animation.delay,
      ease,
      repeat: animation.loop ? -1 : 0,
      overwrite: false
    }))
    return
  }

  if (animation.effect === 'scale') {
    const scale = config.scale !== undefined ? config.scale : 1.2
    rememberRuntimeAnimation(element, gsap.to(element, {
      scale,
      duration,
      delay: animation.delay,
      ease,
      repeat: animation.loop ? -1 : 0,
      overwrite: false
    }))
    return
  }

  // 以下是强调动画，保持 yoyo 效果以便返回原状
  const half = Math.max(duration / 2, 0.1)

  if (animation.effect === 'blink') {
    const stepDuration = Math.max(animation.duration / 6, 0.05)
    const targetOpacity = config.opacity !== undefined ? config.opacity : 0
    rememberRuntimeAnimation(element, gsap.timeline({ delay: animation.delay, repeat: timelineRepeat })
      .to(element, { autoAlpha: targetOpacity, duration: stepDuration, ease: 'none' })
      .to(element, { autoAlpha: opacity, duration: stepDuration, ease: 'none' })
      .to(element, { autoAlpha: targetOpacity, duration: stepDuration, ease: 'none' })
      .to(element, { autoAlpha: opacity, duration: stepDuration, ease: 'none' }))
    return
  }

  if (animation.effect === 'bounce') {
    const strength = config.bounceStrength !== undefined ? config.bounceStrength : 20
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { y: 0 },
      { y: -strength, duration: half, delay: animation.delay, ease: 'power2.out', yoyo: true, repeat: repeatCount, overwrite: false },
    ))
    return
  }

  if (animation.effect === 'flip') {
    const isVertical = config.direction === 'top' || config.direction === 'bottom'
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { rotateY: 0, rotateX: 0 },
      {
        rotateY: isVertical ? 0 : 180,
        rotateX: isVertical ? 180 : 0,
        duration: half,
        delay: animation.delay,
        ease,
        yoyo: true,
        repeat: repeatCount,
        overwrite: false,
      },
    ))
    return
  }

  if (animation.effect === 'jiggle') {
    const strength = config.shakeStrength !== undefined ? config.shakeStrength : 10
    rememberRuntimeAnimation(element, gsap.timeline({ delay: animation.delay, repeat: timelineRepeat })
      .to(element, { x: -strength, rotate: currentRotation - 3, duration: animation.duration * 0.1, ease: 'none' })
      .to(element, { x: strength, rotate: currentRotation + 3, duration: animation.duration * 0.1, ease: 'none' })
      .to(element, { x: -strength * 0.8, rotate: currentRotation - 2, duration: animation.duration * 0.1, ease: 'none' })
      .to(element, { x: strength * 0.8, rotate: currentRotation + 2, duration: animation.duration * 0.1, ease: 'none' })
      .to(element, { x: 0, rotate: currentRotation, duration: animation.duration * 0.1, ease: 'power2.out' }))
    return
  }

  if (animation.effect === 'pop') {
    const scale = config.scale !== undefined ? config.scale : 1.3
    rememberRuntimeAnimation(element, gsap.timeline({ delay: animation.delay, repeat: timelineRepeat })
      .to(element, { scale, duration: animation.duration * 0.3, ease: 'power2.out' })
      .to(element, { scale: 0.9, duration: animation.duration * 0.2, ease: 'power2.inOut' })
      .to(element, { scale: 1, duration: animation.duration * 0.4, ease: 'back.out(2)' }))
    return
  }

  if (animation.effect === 'pulse') {
    const scale = config.scale !== undefined ? config.scale : 1.1
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { scale: 1 },
      { scale, duration: half, delay: animation.delay, ease, yoyo: true, repeat: repeatCount, overwrite: false },
    ))
    return
  }
}

function animateBuildOut(item: RuntimeSequenceItem, restoreAfter: boolean) {
  const { element, animation, opacity } = item
  const config = animation.config || {}
  const quickDuration = Math.min(Math.max(animation.duration * 0.15, 0.08), 0.16)

  // 出场动画通常使用 .in 类型的缓动，产生加速离开的感觉
  const ease = getEase(config.ease, 'power2.in')

  const config_gsap = {
    duration: animation.duration,
    delay: animation.delay,
    ease,
    pointerEvents: 'none',
    onComplete: () => {
      if (restoreAfter) {
        const rotation = Number(gsap.getProperty(element, 'rotation')) || 0
        gsap.set(element, {
          x: 0,
          y: 0,
          scale: 1,
          scaleX: 1,
          scaleY: 1,
          rotate: rotation,
          rotateY: 0,
          filter: 'blur(0px)',
          clipPath: 'none',
          transformOrigin: '50% 50%',
        })
        gsap.set(element, { display: 'block', autoAlpha: opacity, pointerEvents: 'auto' })
        return
      }

      gsap.set(element, { display: 'none', autoAlpha: 0, clipPath: 'none' })
    },
  }

  if (animation.effect === 'appear') {
    rememberRuntimeAnimation(element, gsap.to(element, { ...config_gsap, autoAlpha: 0, duration: quickDuration, ease: 'none' }))
    return
  }

  if (animation.effect === 'blur') {
    const blurVal = config.blur !== undefined ? config.blur : 20
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      filter: `blur(${blurVal}px)`,
      scale: 0.9,
      autoAlpha: 0,
      ease: 'power2.in'
    }))
    return
  }

  if (animation.effect === 'compress') {
    const scale = config.scale !== undefined ? config.scale : 0.75
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      scaleX: scale * 1.5,
      scaleY: scale * 0.5,
      autoAlpha: 0,
      ease: 'back.in(1.5)'
    }))
    return
  }

  if (animation.effect === 'dissolve') {
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      autoAlpha: 0,
      scale: 1.05,
      ease: 'none'
    }))
    return
  }

  if (animation.effect === 'drift') {
    const { x, y } = getDirectionCoordinates(config.direction || 'left', config.distance !== undefined ? config.distance : 40)
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      x,
      y,
      autoAlpha: 0,
      ease: 'power3.in'
    }))
    return
  }

  if (animation.effect === 'drift-scale') {
    const { x, y } = getDirectionCoordinates(config.direction || 'left', config.distance !== undefined ? config.distance : 30)
    const scale = config.scale !== undefined ? config.scale : 1.2
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      x,
      y,
      scale,
      autoAlpha: 0,
      ease: 'power3.in'
    }))
    return
  }

  if (animation.effect === 'drop') {
    const distance = config.distance !== undefined ? config.distance : 150
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      y: distance,
      autoAlpha: 0,
      ease: 'power4.in'
    }))
    return
  }

  if (animation.effect === 'fade-move') {
    const { x, y } = getDirectionCoordinates(config.direction || 'top', config.distance !== undefined ? config.distance : 50)
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      x,
      y,
      autoAlpha: 0,
      ease: 'power2.in'
    }))
    return
  }

  if (animation.effect === 'fade-scale') {
    const scale = config.scale !== undefined ? config.scale : 0.8
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      scale,
      autoAlpha: 0,
      ease: 'back.in(1.5)'
    }))
    return
  }

  if (animation.effect === 'fly-in') {
    const { x, y } = getDirectionCoordinates(config.direction || 'left', config.distance !== undefined ? config.distance : 400)
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      x,
      y,
      autoAlpha: 0,
      ease: 'expo.in'
    }))
    return
  }

  if (animation.effect === 'iris') {
    const pos = config.direction === 'center' ? '50% 50%' :
                config.direction === 'top' ? '50% 0%' :
                config.direction === 'bottom' ? '50% 100%' :
                config.direction === 'left' ? '0% 50%' : '100% 50%'
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      clipPath: `circle(0% at ${pos})`,
      autoAlpha: 0,
      ease: 'power2.in'
    }))
    return
  }

  if (animation.effect === 'keyboard') {
    rememberRuntimeAnimation(
      element,
      createKeyboardTimeline(element, 'out', animation.duration, animation.delay, opacity, config_gsap.onComplete),
    )
    return
  }

  if (animation.effect === 'move-in') {
    const { x, y } = getDirectionCoordinates(config.direction || 'left', config.distance !== undefined ? config.distance : 150)
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      x,
      y,
      autoAlpha: opacity,
      ease: 'power3.in'
    }))
    return
  }

  if (animation.effect === 'wipe') {
    const inset = config.direction === 'right' ? '0 100% 0 0' :
                  config.direction === 'left' ? '0 0 0 100%' :
                  config.direction === 'bottom' ? '0 0 100% 0' : '100% 0 0 0'
    rememberRuntimeAnimation(element, gsap.to(element, {
      ...config_gsap,
      clipPath: `inset(${inset})`,
      autoAlpha: opacity,
      ease: 'power2.inOut'
    }))
    return
  }

  rememberRuntimeAnimation(element, gsap.to(element, { ...config_gsap, autoAlpha: 0 }))
}
