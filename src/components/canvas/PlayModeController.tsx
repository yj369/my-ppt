import type { MutableRefObject } from 'react'
import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { getSlideBuildOrder } from '../../lib/animations'
import {
  initializeBlockForPlay,
  playSequenceItem,
} from '../../lib/animation-runtime'
import type { RuntimeSequenceItem } from '../../lib/animation-runtime'
import { useEditorStore } from '../../store'
import type { EditorBlock, SlideTransition } from '../../types/editor'

type SequenceStep = {
  items: RuntimeSequenceItem[]
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

    const blockElements = new Map(
      Array.from(slideContent.querySelectorAll<HTMLElement>('.editor-block')).map((element) => [
        element.dataset.blockId ?? '',
        element,
      ]),
    )

    currentSlide.blocks.forEach((block) => {
      const element = blockElements.get(block.id)
      if (!element) {
        return
      }

      initializeBlockForPlay(element, block)
    })

    sequenceRef.current = buildSequenceSteps(currentSlide.blocks, blockElements)
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

function buildSequenceSteps(blocks: EditorBlock[], blockElements: Map<string, HTMLElement>) {
  const steps: SequenceStep[] = []
  const blockMap = new Map(blocks.map((block) => [block.id, block]))

  getSlideBuildOrder({
    id: '',
    name: '',
    layout: 'blank',
    transition: 'fade',
    transitionDuration: 0.8,
    bg: 'theme',
    notes: '',
    skipped: false,
    blocks,
  }).forEach((item) => {
    const element = blockElements.get(item.blockId)
    const block = blockMap.get(item.blockId)

    if (!element || !block) {
      return
    }

    const nextItem: RuntimeSequenceItem = {
      element,
      phase: item.phase,
      actionId: item.actionId,
      animation: item.animation,
      opacity: block.opacity,
    }

    if (item.animation.trigger === 'withPrev' && steps.length > 0) {
      steps[steps.length - 1].items.push(nextItem)
      return
    }

    steps.push({
      items: [nextItem],
      trigger: item.animation.trigger === 'onClick' ? 'click' : 'auto',
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
  step.items.forEach((item) => playSequenceItem(item))
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

function getStepDuration(step: SequenceStep) {
  return Math.max(
    ...step.items.map((item) => {
      return (item.animation.duration + item.animation.delay) * 1000
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
