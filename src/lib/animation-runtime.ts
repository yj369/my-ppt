import gsap from 'gsap'
import { getBlockAnimations } from './animations'
import type { AnimationPhase, BlockAnimations, EditorBlock } from '../types/editor'

export type RuntimeSequenceItem = {
  element: HTMLElement
  phase: AnimationPhase
  animation: BlockAnimations[AnimationPhase]
  opacity: number
}

function getBaseState(block: EditorBlock) {
  return {
    x: 0,
    y: 0,
    scale: 1,
    rotate: block.rotation,
    rotateY: 0,
    filter: 'blur(0px)',
    transformOrigin: '50% 50%',
  }
}

const activeRuntimeAnimations = new WeakMap<HTMLElement, gsap.core.Animation>()

function stopElementRuntime(element: HTMLElement) {
  gsap.killTweensOf(element)
  const runningAnimation = activeRuntimeAnimations.get(element)
  if (runningAnimation) {
    runningAnimation.kill()
    activeRuntimeAnimations.delete(element)
  }
}

function rememberRuntimeAnimation(element: HTMLElement, animation: gsap.core.Animation) {
  activeRuntimeAnimations.set(element, animation)
}

export function restoreBlockAfterPreview(element: HTMLElement, block: EditorBlock) {
  stopElementRuntime(element)
  gsap.set(element, getBaseState(block))
  gsap.set(element, {
    display: 'block',
    autoAlpha: block.hidden ? Math.min(block.opacity, 0.2) : block.opacity,
    pointerEvents: 'auto',
  })
}

export function initializeBlockForPlay(element: HTMLElement, block: EditorBlock) {
  const animations = getBlockAnimations(block)

  stopElementRuntime(element)
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
) {
  const animation = getBlockAnimations(block)[phase]
  if (animation.effect === 'none') {
    return false
  }

  const item: RuntimeSequenceItem = {
    element,
    phase,
    animation,
    opacity: block.opacity,
  }

  stopElementRuntime(element)
  gsap.set(element, getBaseState(block))
  gsap.set(element, { display: 'block', autoAlpha: block.opacity, pointerEvents: 'auto' })

  if (phase === 'buildIn') {
    gsap.set(element, { autoAlpha: 0 })
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
  stopElementRuntime(item.element)

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

function animateBuildIn(item: RuntimeSequenceItem) {
  const { element, animation, opacity } = item
  const blockRotation = Number(gsap.getProperty(element, 'rotation')) || 0

  gsap.set(element, { display: 'block', pointerEvents: 'auto' })

  if (animation.effect === 'fade-up') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { y: 28, autoAlpha: 0 },
      { y: 0, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power3.out' },
    ))
    return
  }

  if (animation.effect === 'fade-left') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { x: 28, autoAlpha: 0 },
      { x: 0, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power3.out' },
    ))
    return
  }

  if (animation.effect === 'scale-in' || animation.effect === 'pop') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { scale: animation.effect === 'pop' ? 0.92 : 0.96, autoAlpha: 0 },
      { scale: 1, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power3.out' },
    ))
    return
  }

  if (animation.effect === 'rotate-in') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { rotate: blockRotation + 8, autoAlpha: 0 },
      { rotate: blockRotation, autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power2.out' },
    ))
    return
  }

  if (animation.effect === 'blur-in') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { filter: 'blur(12px)', autoAlpha: 0 },
      { filter: 'blur(0px)', autoAlpha: opacity, duration: animation.duration, delay: animation.delay, ease: 'power2.out' },
    ))
    return
  }

  rememberRuntimeAnimation(element, gsap.to(element, {
    autoAlpha: opacity,
    duration: animation.duration,
    delay: animation.delay,
    ease: 'power2.out',
  }))
}

function animateAction(item: RuntimeSequenceItem) {
  const { element } = item
  const animation = item.animation as BlockAnimations['action']
  const half = Math.max(animation.duration / 2, 0.1)
  const repeatCount = animation.loop ? -1 : 1
  const timelineRepeat = animation.loop ? -1 : 0

  if (animation.effect === 'pulse') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { scale: 1 },
      { scale: 1.08, duration: half, delay: animation.delay, ease: 'power1.inOut', yoyo: true, repeat: repeatCount },
    ))
    return
  }

  if (animation.effect === 'bounce') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { y: 0 },
      { y: -18, duration: half, delay: animation.delay, ease: 'power2.out', yoyo: true, repeat: repeatCount },
    ))
    return
  }

  if (animation.effect === 'shake') {
    rememberRuntimeAnimation(element, gsap.timeline({ delay: animation.delay, repeat: timelineRepeat })
      .to(element, { x: -12, duration: animation.duration * 0.2, ease: 'power1.inOut' })
      .to(element, { x: 12, duration: animation.duration * 0.2, ease: 'power1.inOut' })
      .to(element, { x: -8, duration: animation.duration * 0.2, ease: 'power1.inOut' })
      .to(element, { x: 0, duration: animation.duration * 0.2, ease: 'power1.out' }))
    return
  }

  if (animation.effect === 'flip') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { rotateY: 0 },
      {
        rotateY: 180,
        duration: half,
        delay: animation.delay,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: repeatCount,
      },
    ))
    return
  }

  if (animation.effect === 'flash') {
    rememberRuntimeAnimation(element, gsap.fromTo(
      element,
      { autoAlpha: 1 },
      { autoAlpha: 0.18, duration: half, delay: animation.delay, ease: 'power1.inOut', yoyo: true, repeat: repeatCount },
    ))
    return
  }

  activeRuntimeAnimations.delete(element)
}

function animateBuildOut(item: RuntimeSequenceItem, restoreAfter: boolean) {
  const { element, animation, opacity } = item
  const config = {
    duration: animation.duration,
    delay: animation.delay,
    ease: 'power2.inOut',
    pointerEvents: 'none',
    onComplete: () => {
      if (restoreAfter) {
        const rotation = Number(gsap.getProperty(element, 'rotation')) || 0
        gsap.set(element, {
          x: 0,
          y: 0,
          scale: 1,
          rotate: rotation,
          rotateY: 0,
          filter: 'blur(0px)',
          transformOrigin: '50% 50%',
        })
        gsap.set(element, { display: 'block', autoAlpha: opacity, pointerEvents: 'auto' })
        return
      }

      gsap.set(element, { display: 'none', autoAlpha: 0 })
    },
  }

  if (animation.effect === 'scale-out') {
    rememberRuntimeAnimation(element, gsap.to(element, { ...config, scale: 0.88, autoAlpha: 0 }))
    return
  }

  if (animation.effect === 'wipe-left') {
    rememberRuntimeAnimation(element, gsap.to(element, { ...config, x: -36, autoAlpha: 0 }))
    return
  }

  if (animation.effect === 'blur-out') {
    rememberRuntimeAnimation(element, gsap.to(element, { ...config, filter: 'blur(10px)', autoAlpha: 0 }))
    return
  }

  rememberRuntimeAnimation(element, gsap.to(element, { ...config, autoAlpha: 0 }))
}
