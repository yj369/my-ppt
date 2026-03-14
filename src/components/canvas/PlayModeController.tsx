import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useEditorStore } from '../../store'
import type { SlideTransition } from '../../types/editor'

type SequenceStep = {
  elements: HTMLElement[]
  trigger: 'auto' | 'click'
}

export function PlayModeController() {
  const {
    isPlayMode,
    slides,
    currentSlideId,
    navigationDirection,
    nextSlide,
    previousSlide,
    togglePlayMode,
  } = useEditorStore()

  const stepIndexRef = useRef(0)
  const sequenceRef = useRef<SequenceStep[]>([])
  const autoAdvanceRef = useRef<number | null>(null)
  const currentSlideIndex = slides.findIndex((slide) => slide.id === currentSlideId)
  const currentSlide = slides[currentSlideIndex] ?? null

  useEffect(() => {
    if (!isPlayMode) {
      clearAutoAdvance(autoAdvanceRef)
      document.body.classList.remove('play-mode')
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      const transitionLayer = document.getElementById('transitionLayer')
      if (transitionLayer) {
        gsap.set(transitionLayer, { clearProps: 'all' })
      }
      return
    }

    document.body.classList.add('play-mode')
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    }

    const slideContent = document.getElementById('slideContent')
    const transitionLayer = document.getElementById('transitionLayer')
    if (!slideContent || !currentSlide) {
      return
    }

    const blocks = Array.from(
      slideContent.querySelectorAll<HTMLElement>('.editor-block'),
    )

    blocks.forEach((element) => {
      if (element.dataset.hidden === 'true') {
        gsap.set(element, { display: 'none' })
        return
      }

      if ((element.dataset.anim ?? 'none') === 'none') {
        gsap.set(element, { autoAlpha: Number(element.dataset.opacity ?? 1), clearProps: 'transform' })
      } else {
        gsap.set(element, { autoAlpha: 0, pointerEvents: 'none' })
      }
    })

    sequenceRef.current = buildSequenceSteps(blocks)
    stepIndexRef.current = 0
    clearAutoAdvance(autoAdvanceRef)
    playSlideTransition(
      slideContent,
      transitionLayer,
      currentSlide.transition,
      currentSlide.transitionDuration,
      navigationDirection,
    )
    if (sequenceRef.current[0]?.trigger === 'auto') {
      advanceSequence(sequenceRef.current, stepIndexRef, nextSlide, autoAdvanceRef)
    }

    const handleAdvance = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent) {
        if (!['Space', 'Enter', 'ArrowRight', 'ArrowDown'].includes(event.code)) {
          return
        }

        event.preventDefault()
      }

      if (event instanceof MouseEvent && event.button !== 0) {
        return
      }

      clearAutoAdvance(autoAdvanceRef)
      advanceSequence(sequenceRef.current, stepIndexRef, nextSlide, autoAdvanceRef)
    }

    const handleBack = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowUp', 'Backspace'].includes(event.code)) {
        return
      }

      event.preventDefault()
      clearAutoAdvance(autoAdvanceRef)
      previousSlide()
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') {
        return
      }

      event.preventDefault()
      clearAutoAdvance(autoAdvanceRef)
      togglePlayMode(false)
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && useEditorStore.getState().isPlayMode) {
        togglePlayMode(false)
      }
    }

    window.addEventListener('keydown', handleAdvance)
    window.addEventListener('mousedown', handleAdvance)
    window.addEventListener('keydown', handleBack)
    window.addEventListener('keydown', handleEscape)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      clearAutoAdvance(autoAdvanceRef)
      window.removeEventListener('keydown', handleAdvance)
      window.removeEventListener('mousedown', handleAdvance)
      window.removeEventListener('keydown', handleBack)
      window.removeEventListener('keydown', handleEscape)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [
    currentSlide,
    currentSlideId,
    isPlayMode,
    navigationDirection,
    nextSlide,
    previousSlide,
    slides,
    togglePlayMode,
  ])

  return null
}

function buildSequenceSteps(elements: HTMLElement[]) {
  const animated = elements
    .filter((element) => element.dataset.hidden !== 'true' && (element.dataset.anim ?? 'none') !== 'none')
    .sort((left, right) => Number(left.dataset.zIndex ?? 0) - Number(right.dataset.zIndex ?? 0))

  const steps: SequenceStep[] = []

  animated.forEach((element) => {
    const trigger = element.dataset.trigger

    if (trigger === 'withPrev' && steps.length > 0) {
      steps[steps.length - 1].elements.push(element)
      return
    }

    steps.push({
      elements: [element],
      trigger: trigger === 'onClick' ? 'click' : 'auto',
    })
  })

  return steps
}

function advanceSequence(
  sequence: SequenceStep[],
  stepIndexRef: MutableRefObject<number>,
  nextSlide: () => void,
  autoAdvanceRef: MutableRefObject<number | null>,
) {
  if (stepIndexRef.current >= sequence.length) {
    nextSlide()
    return
  }

  const step = sequence[stepIndexRef.current]
  step.elements.forEach((element) => animateBlock(element))
  stepIndexRef.current += 1

  if (stepIndexRef.current >= sequence.length) {
    return
  }

  if (sequence[stepIndexRef.current].trigger !== 'auto') {
    return
  }

  autoAdvanceRef.current = window.setTimeout(() => {
    autoAdvanceRef.current = null
    advanceSequence(sequence, stepIndexRef, nextSlide, autoAdvanceRef)
  }, getStepDuration(step))
}

function animateBlock(element: HTMLElement) {
  const duration = Number(element.dataset.duration ?? 0.8)
  const delay = Number(element.dataset.delay ?? 0)
  const opacity = Number(element.dataset.opacity ?? 1)
  const animation = element.dataset.anim ?? 'none'

  gsap.set(element, { pointerEvents: 'auto', display: 'block' })

  if (animation === 'fade-up') {
    gsap.fromTo(
      element,
      { y: 28, autoAlpha: 0 },
      { y: 0, autoAlpha: opacity, duration, delay, ease: 'power3.out' },
    )
    return
  }

  if (animation === 'fade-left') {
    gsap.fromTo(
      element,
      { x: 28, autoAlpha: 0 },
      { x: 0, autoAlpha: opacity, duration, delay, ease: 'power3.out' },
    )
    return
  }

  if (animation === 'scale-in' || animation === 'pop') {
    gsap.fromTo(
      element,
      { scale: animation === 'pop' ? 0.92 : 0.96, autoAlpha: 0 },
      { scale: 1, autoAlpha: opacity, duration, delay, ease: 'power3.out' },
    )
    return
  }

  if (animation === 'rotate-in') {
    gsap.fromTo(
      element,
      { rotate: '8deg', autoAlpha: 0 },
      { rotate: '0deg', autoAlpha: opacity, duration, delay, ease: 'power2.out' },
    )
    return
  }

  if (animation === 'blur-in') {
    gsap.fromTo(
      element,
      { filter: 'blur(12px)', autoAlpha: 0 },
      { filter: 'blur(0px)', autoAlpha: opacity, duration, delay, ease: 'power2.out' },
    )
    return
  }

  gsap.to(element, { autoAlpha: opacity, duration, delay, ease: 'power2.out' })
}

function getStepDuration(step: SequenceStep) {
  return Math.max(
    ...step.elements.map((element) => {
      const duration = Number(element.dataset.duration ?? 0.8)
      const delay = Number(element.dataset.delay ?? 0)
      return (duration + delay) * 1000
    }),
  )
}

function clearAutoAdvance(autoAdvanceRef: MutableRefObject<number | null>) {
  if (autoAdvanceRef.current === null) {
    return
  }

  window.clearTimeout(autoAdvanceRef.current)
  autoAdvanceRef.current = null
}

function playSlideTransition(
  slideContent: HTMLElement,
  transitionLayer: HTMLElement | null,
  transition: SlideTransition,
  duration: number,
  direction: -1 | 0 | 1,
) {
  gsap.killTweensOf(slideContent)
  if (transitionLayer) {
    gsap.killTweensOf(transitionLayer)
  }

  if (transition === 'magic' && transitionLayer) {
    gsap
      .timeline()
      .set(transitionLayer, { display: 'block', autoAlpha: 0 })
      .to(transitionLayer, { autoAlpha: 1, duration: 0.18 })
      .fromTo(
        slideContent,
        { scale: 0.985, autoAlpha: 0.35, filter: 'blur(10px)' },
        { scale: 1, autoAlpha: 1, filter: 'blur(0px)', duration, ease: 'power2.out' },
        0,
      )
      .to(transitionLayer, { autoAlpha: 0, duration: 0.24 }, duration * 0.5)
      .set(transitionLayer, { display: 'none' })
    return
  }

  if (transition === 'move-left') {
    gsap.fromTo(
      slideContent,
      { x: (direction >= 0 ? 120 : -120), autoAlpha: 0.2 },
      { x: 0, autoAlpha: 1, duration, ease: 'power3.out' },
    )
    return
  }

  if (transition === 'move-up') {
    gsap.fromTo(
      slideContent,
      { y: 80, autoAlpha: 0.2 },
      { y: 0, autoAlpha: 1, duration, ease: 'power3.out' },
    )
    return
  }

  if (transition === 'zoom') {
    gsap.fromTo(
      slideContent,
      { scale: 0.96, autoAlpha: 0.2 },
      { scale: 1, autoAlpha: 1, duration, ease: 'power2.out' },
    )
    return
  }

  if (transition === 'dissolve') {
    gsap.fromTo(
      slideContent,
      { filter: 'blur(8px)', autoAlpha: 0 },
      { filter: 'blur(0px)', autoAlpha: 1, duration, ease: 'power2.out' },
    )
    return
  }

  gsap.fromTo(
    slideContent,
    { autoAlpha: 0 },
    { autoAlpha: 1, duration, ease: 'power2.out' },
  )
}
