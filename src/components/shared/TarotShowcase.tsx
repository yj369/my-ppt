import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { Fingerprint } from 'lucide-react'
import { getLocalImageUrl } from '../../lib/imageStorage'
import {
  createDefaultTarotShowcaseConfig,
  getTarotCardGlow,
  normalizeTarotShowcaseConfig,
  TAROT_SHOWCASE_EFFECT_OPTIONS,
  type TarotShowcaseCard,
  type TarotShowcaseConfig,
  type TarotShowcaseEffectId,
} from '../../lib/tarotShowcase'

export type TarotShowcaseProps = {
  mode?: 'preview' | 'component'
  config?: TarotShowcaseConfig
  enableKeyboard?: boolean
  onEscape?: () => void
  showKeyboardHint?: boolean
}

type TarotCardProps = {
  data: TarotShowcaseCard
  effect: TarotShowcaseEffectId
  isFocused: boolean
  isRevealed: boolean
}

type TarotEffectStyles = {
  wrapper: CSSProperties
  image: CSSProperties
}

function TarotShowcaseStyles() {
  return (
    <style>{`
      .tarot-showcase .tarot-content-slide-up {
        transition: transform 1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s ease-out;
        will-change: transform, opacity;
      }

      .tarot-showcase .tarot-layout-spring {
        transition: all 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      }

      @keyframes tarot-ambient-pulse {
        0%, 100% { opacity: 0.3; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.2); }
      }

      .tarot-showcase .tarot-ambient {
        animation: tarot-ambient-pulse 6s ease-in-out infinite;
      }

      .tarot-showcase .tarot-bg-modern-grid {
        background-image:
          linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 50px 50px;
      }

      .tarot-showcase .tarot-scrollbar-hidden::-webkit-scrollbar {
        display: none;
      }

      @keyframes tarot-ribbon-band-from-left {
        0% { transform: translateX(-120%) skewX(-14deg) scaleX(1.08); opacity: 0; }
        70% { transform: translateX(6%) skewX(-2deg) scaleX(1.01); opacity: 1; }
        100% { transform: translateX(0%) skewX(0deg) scaleX(1); opacity: 1; }
      }

      @keyframes tarot-ribbon-band-from-right {
        0% { transform: translateX(120%) skewX(14deg) scaleX(1.08); opacity: 0; }
        70% { transform: translateX(-6%) skewX(2deg) scaleX(1.01); opacity: 1; }
        100% { transform: translateX(0%) skewX(0deg) scaleX(1); opacity: 1; }
      }

      @keyframes tarot-ribbon-base-in {
        0% { opacity: 0; transform: scale(1.02); }
        100% { opacity: 1; transform: scale(1); }
      }
    `}</style>
  )
}

function TarotCard({ data, effect, isFocused, isRevealed }: TarotCardProps) {
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5, active: false })
  const [resolvedImageSrc, setResolvedImageSrc] = useState(data.image)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isCancelled = false

    getLocalImageUrl(data.image)
      .then((nextSrc) => {
        if (!isCancelled) {
          setResolvedImageSrc(nextSrc)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setResolvedImageSrc(data.image)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [data.image])

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isRevealed || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    setMousePos({ x, y, active: true })
  }

  const handleMouseLeave = () => {
    setMousePos({ x: 0.5, y: 0.5, active: false })
  }

  const moveX = mousePos.active ? (mousePos.x - 0.5) * -15 : 0
  const moveY = mousePos.active ? (mousePos.y - 0.5) * -15 : 0
  const glareX = mousePos.x * 100
  const glareY = mousePos.y * 100
  const springTransition = '1.2s cubic-bezier(0.16, 1, 0.3, 1)'
  const sharpTransition = '1s cubic-bezier(0.8, 0, 0.2, 1)'
  const activeHoverTransition = '0.1s ease-out'

  const getEffectStyles = (): TarotEffectStyles => {
    const mouseTransformTransition = mousePos.active ? activeHoverTransition : springTransition

    switch (effect) {
      case 'liquid':
        return {
          wrapper: {
            clipPath: isRevealed ? 'circle(150% at 50% 85%)' : 'circle(0% at 50% 85%)',
            transition: `clip-path ${springTransition}`,
            opacity: 1,
          },
          image: {
            transform: `scale(${isRevealed ? (mousePos.active ? 1.05 : 1) : 1.6}) translate(${moveX}px, ${moveY}px)`,
            filter: isRevealed ? 'blur(0px)' : 'blur(20px)',
            transition: `transform ${mouseTransformTransition}, filter ${springTransition}`,
          },
        }
      case 'slice':
        return {
          wrapper: {
            clipPath: isRevealed ? 'inset(0% 0% 0% 0%)' : 'inset(50% 0% 50% 0%)',
            transition: `clip-path ${sharpTransition}`,
            opacity: 1,
          },
          image: {
            transform: `scale(${isRevealed ? (mousePos.active ? 1.05 : 1) : 0.8}) translate(${moveX}px, ${moveY}px)`,
            filter: isRevealed ? 'grayscale(0%)' : 'grayscale(100%)',
            transition: `transform ${mouseTransformTransition}, filter ${springTransition}`,
          },
        }
      case 'frost':
        return {
          wrapper: {
            clipPath: 'inset(0% 0% 0% 0%)',
            opacity: isRevealed ? 1 : 0,
            transition: 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          image: {
            transform: `scale(${isRevealed ? (mousePos.active ? 1.05 : 1) : 1.25}) translate(${moveX}px, ${moveY}px)`,
            filter: isRevealed ? 'blur(0px) brightness(1)' : 'blur(30px) brightness(1.5)',
            transition: `transform ${mouseTransformTransition}, filter 1.5s ease-out`,
          },
        }
      default:
        return {
          wrapper: {},
          image: {},
        }
    }
  }

  const styles = getEffectStyles()

  const renderCardContent = (customImageStyle: CSSProperties = {}, isDimmed: boolean = false) => (
    <div className="relative h-full w-full overflow-hidden tarot-layout-spring">
      <img
        src={resolvedImageSrc}
        alt={data.title}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ ...customImageStyle, willChange: 'transform, filter' }}
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/95 via-zinc-950/20 to-transparent" />

      <div
        className="pointer-events-none absolute inset-0 z-40 mix-blend-overlay opacity-0 transition-opacity duration-500"
        style={{
          opacity: mousePos.active && !isDimmed ? (isFocused ? 0.6 : 0.4) : 0,
          background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.8) 0%, transparent 60%)`,
        }}
      />

      <div className="relative z-20 flex h-full flex-col p-8 pointer-events-none">
        <div className="mt-auto">
          <div
            className="tarot-content-slide-up mb-2"
            style={{
              transform: isRevealed ? 'translateY(0)' : 'translateY(20px)',
              opacity: isRevealed ? 1 : 0,
              transitionDelay: isRevealed ? '0.4s' : '0s',
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: data.accent }}
            >
              {data.subtitle}
            </span>
          </div>

          <h3
            className="tarot-content-slide-up mb-4 text-3xl font-extrabold tracking-tight text-white drop-shadow-2xl"
            style={{
              transform: isRevealed ? 'translateY(0)' : 'translateY(30px)',
              opacity: isRevealed ? 1 : 0,
              transitionDelay: isRevealed ? '0.5s' : '0s',
            }}
          >
            {data.title}
          </h3>

          <div
            className="tarot-content-slide-up h-[2px] w-full overflow-hidden rounded-full bg-white/10"
            style={{
              transform: isRevealed ? 'scaleX(1)' : 'scaleX(0)',
              transformOrigin: 'left center',
              opacity: isRevealed ? 1 : 0,
              transitionDelay: isRevealed ? '0.7s' : '0s',
            }}
          >
            <div
              className="h-full w-1/3"
              style={{
                backgroundColor: data.accent,
                boxShadow: `0 0 15px ${data.accent}`,
              }}
            />
          </div>
        </div>
      </div>

      {isDimmed && <div className="pointer-events-none absolute inset-0 z-50 bg-black/40" />}
    </div>
  )

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="tarot-layout-spring relative h-full w-full overflow-hidden rounded-[2rem]"
      style={{ boxShadow: isFocused ? `0 0 60px -15px ${getTarotCardGlow(data.accent)}` : 'none' }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden border border-white/5 bg-zinc-900">
        <div className="tarot-ambient absolute h-64 w-64 rounded-full bg-white/5 blur-[60px]" />

        <div className={`absolute bottom-[15%] flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 backdrop-blur-md transition-all duration-700 ${isRevealed ? 'scale-50 opacity-0' : 'scale-100 opacity-100 delay-300'}`}>
          <Fingerprint className="h-8 w-8 text-white/30" />
        </div>

        <div className={`absolute bottom-[8%] text-[10px] font-mono tracking-[0.3em] text-white/20 transition-opacity duration-500 ${isRevealed ? 'opacity-0' : 'opacity-100'}`}>
          AWAITING UNLOCK
        </div>
      </div>

      {effect === 'ribbon' ? (
        <div className={`absolute inset-0 z-10 ${isRevealed ? 'pointer-events-auto' : 'pointer-events-none'}`}>
          <div
            className="absolute inset-0 z-0 bg-zinc-950"
            style={{
              animation: isRevealed ? 'tarot-ribbon-base-in .8s ease-out forwards' : 'none',
              opacity: isRevealed ? 1 : 0,
              transition: isRevealed ? 'none' : 'opacity 0.4s ease-out',
            }}
          >
            {renderCardContent({
              transform: `scale(${mousePos.active ? 1.05 : 1}) translate(${moveX}px, ${moveY}px)`,
              transition: `transform ${mousePos.active ? activeHoverTransition : springTransition}`,
            }, true)}
          </div>

          {Array.from({ length: 5 }).map((_, band) => {
            const top = band * (100 / 5)
            const bottom = 100 - top - (100 / 5)
            const fromLeft = band % 2 === 0

            return (
              <div
                key={band}
                className="absolute inset-0 z-20 overflow-hidden"
                style={{ clipPath: `inset(${top}% 0 ${bottom}% 0 round 0px)` }}
              >
                <div
                  className="absolute inset-0 bg-zinc-950"
                  style={{
                    animation: isRevealed
                      ? `${fromLeft ? 'tarot-ribbon-band-from-left' : 'tarot-ribbon-band-from-right'} ${650 + band * 45}ms cubic-bezier(.16,1,.3,1) forwards`
                      : 'none',
                    opacity: isRevealed ? 1 : 0,
                    transform: isRevealed
                      ? 'none'
                      : (fromLeft ? 'translateX(-120%) skewX(-14deg) scaleX(1.08)' : 'translateX(120%) skewX(14deg) scaleX(1.08)'),
                    transition: isRevealed ? 'none' : 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {renderCardContent({
                    transform: `scale(${mousePos.active ? 1.05 : 1}) translate(${moveX}px, ${moveY}px)`,
                    transition: `transform ${mousePos.active ? activeHoverTransition : springTransition}`,
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className="absolute inset-0 z-10 overflow-hidden bg-zinc-950"
          style={{ ...styles.wrapper, willChange: 'clip-path, opacity' }}
        >
          {renderCardContent(styles.image)}
        </div>
      )}
    </div>
  )
}

export function TarotShowcase({
  mode = 'preview',
  config,
  enableKeyboard = false,
  onEscape,
  showKeyboardHint = enableKeyboard,
}: TarotShowcaseProps) {
  const isComponentMode = mode === 'component'
  const resolvedConfig = useMemo(
    () => config ? normalizeTarotShowcaseConfig(config) : createDefaultTarotShowcaseConfig(),
    [config],
  )
  const cards = resolvedConfig.cards
  const manualReveal = resolvedConfig.revealMode === 'manual'
  const [revealedCount, setRevealedCount] = useState(() => (
    manualReveal ? 0 : cards.length
  ))
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const [activeEffect, setActiveEffect] = useState<TarotShowcaseEffectId>(resolvedConfig.effect)

  useEffect(() => {
    setActiveEffect(resolvedConfig.effect)
  }, [resolvedConfig.effect])

  useEffect(() => {
    setRevealedCount(manualReveal ? 0 : cards.length)
    setFocusedIndex(-1)
  }, [cards.length, manualReveal])

  useEffect(() => {
    if (!enableKeyboard || isComponentMode) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (focusedIndex !== -1) {
          setFocusedIndex(-1)
          return
        }
        onEscape?.()
        return
      }

      if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft' && event.code !== 'Space') {
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (focusedIndex !== -1) {
        return
      }

      if (!manualReveal) {
        return
      }

      if (event.code === 'ArrowRight' || event.code === 'Space') {
        setRevealedCount((prev) => Math.min(prev + 1, cards.length))
        return
      }

      setRevealedCount((prev) => Math.max(prev - 1, 0))
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [cards.length, enableKeyboard, focusedIndex, isComponentMode, manualReveal, onEscape])

  return (
    <div
      className={`tarot-showcase relative h-full w-full overflow-hidden ${isComponentMode ? 'bg-transparent' : 'bg-zinc-950'}`}
      data-play-interactive={isComponentMode ? 'true' : undefined}
      onClick={() => setFocusedIndex(-1)}
    >
      <TarotShowcaseStyles />

      {!isComponentMode && (
        <>
          <div className="tarot-bg-modern-grid pointer-events-none absolute inset-0 opacity-20" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 h-[50vh] w-[80vw] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[150px]" />
        </>
      )}

      {!isComponentMode && (
        <div className={`pointer-events-none absolute inset-0 z-20 bg-black/80 backdrop-blur-xl tarot-layout-spring ${focusedIndex !== -1 ? 'opacity-100' : 'opacity-0'}`} />
      )}

      {!isComponentMode && (
        <div className={`absolute left-1/2 top-10 z-40 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 transition-all duration-700 ${focusedIndex !== -1 ? 'pointer-events-none -translate-y-10 opacity-0' : 'translate-y-0 opacity-100'}`}>
          <div className="flex flex-col items-center space-y-4">
            <div className="tarot-scrollbar-hidden flex w-full max-w-full overflow-x-auto rounded-2xl border border-white/5 bg-zinc-900/80 p-1.5 shadow-2xl backdrop-blur-xl">
              {TAROT_SHOWCASE_EFFECT_OPTIONS.map((effectOption) => (
                <button
                  key={effectOption.value}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setActiveEffect(effectOption.value)
                    setFocusedIndex(-1)
                    setRevealedCount(manualReveal ? 0 : cards.length)
                  }}
                  className={`relative whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300 ${activeEffect === effectOption.value ? 'text-white shadow-lg' : 'text-white/40 hover:bg-white/5 hover:text-white/80'}`}
                >
                  {activeEffect === effectOption.value && (
                    <div className="tarot-layout-spring absolute inset-0 -z-10 rounded-xl bg-zinc-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]" />
                  )}
                  {effectOption.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={`relative z-30 flex h-full w-full flex-col items-center justify-center px-6 pb-10 ${isComponentMode ? 'pt-10 md:px-8 md:pb-12 md:pt-12' : 'pt-28 md:px-8 md:pb-12 md:pt-32'} ${focusedIndex !== -1 ? 'md:pt-20' : ''}`}>
        <div className={`tarot-layout-spring flex h-full w-full max-w-7xl flex-col items-center justify-center md:flex-row ${focusedIndex !== -1 ? 'z-30' : 'z-10'}`}>
          {cards.map((card, index) => {
            const isRevealed = manualReveal ? revealedCount > index : true
            const isFocused = focusedIndex === index
            const hasFocus = focusedIndex !== -1
            const isHidden = hasFocus && !isFocused
            const cardClass = `tarot-layout-spring relative flex items-center justify-center ${isFocused ? 'mx-4 h-[550px] w-full max-w-lg scale-100 opacity-100 shadow-2xl z-50' : ''} ${isHidden ? 'pointer-events-none mx-0 h-[440px] w-0 scale-75 opacity-0' : ''} ${!hasFocus ? 'mx-2 h-[360px] w-72 scale-100 opacity-100 shadow-black/50 hover:-translate-y-3 hover:shadow-xl md:mx-6 md:h-[440px]' : ''}`

            return (
              <button
                key={card.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (isRevealed) {
                    setFocusedIndex(isFocused ? -1 : index)
                    return
                  }
                  if (manualReveal && revealedCount === index) {
                    setRevealedCount((prev) => prev + 1)
                  }
                }}
                aria-label={isRevealed ? `${card.title}卡片预览` : `解锁${card.title}`}
                aria-pressed={isFocused}
                className={`${cardClass} cursor-pointer`}
              >
                <TarotCard
                  data={card}
                  effect={activeEffect}
                  isFocused={isFocused}
                  isRevealed={isRevealed}
                />
              </button>
            )
          })}
        </div>
      </div>

      {showKeyboardHint && !isComponentMode && manualReveal && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-[11px] font-medium tracking-[0.2em] text-white/45 backdrop-blur-xl">
          <span>←</span>
          <span>逐张解锁</span>
          <span>空格</span>
          <span>展开</span>
          <span>ESC</span>
          <span>返回</span>
        </div>
      )}
    </div>
  )
}
