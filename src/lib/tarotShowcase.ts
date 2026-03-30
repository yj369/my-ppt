import { formatCssColor, parseCssColor, withAlpha } from './colors'

export type TarotShowcaseEffectId = 'liquid' | 'slice' | 'frost' | 'ribbon'
export type TarotShowcaseRevealMode = 'manual' | 'revealed'

export type TarotShowcaseCard = {
  id: string
  title: string
  subtitle: string
  image: string
  accent: string
}

export type TarotShowcaseConfig = {
  version: 1
  effect: TarotShowcaseEffectId
  revealMode: TarotShowcaseRevealMode
  cards: TarotShowcaseCard[]
}

export const TAROT_SHOWCASE_EFFECT_OPTIONS: Array<{ value: TarotShowcaseEffectId; label: string }> = [
  { value: 'liquid', label: '流体空间' },
  { value: 'slice', label: '量子切割' },
  { value: 'frost', label: '霜冻溶解' },
  { value: 'ribbon', label: '缎带切幕' },
]

export const TAROT_SHOWCASE_REVEAL_OPTIONS: Array<{ value: TarotShowcaseRevealMode; label: string }> = [
  { value: 'manual', label: '手动翻牌' },
  { value: 'revealed', label: '直接展开' },
]

const DEFAULT_TAROT_SHOWCASE_CONFIG: TarotShowcaseConfig = {
  version: 1,
  effect: 'ribbon',
  revealMode: 'manual',
  cards: [
    {
      id: 'strawberry',
      title: '极品红颜草莓',
      subtitle: 'FRESH STRAWBERRY',
      image: 'https://images.unsplash.com/photo-1518635017498-87f514b751ba?q=80&w=800&auto=format&fit=crop',
      accent: '#fb7185',
    },
    {
      id: 'orange',
      title: '夏日鲜切香橙',
      subtitle: 'SUNSHINE ORANGE',
      image: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?q=80&w=800&auto=format&fit=crop',
      accent: '#fb923c',
    },
    {
      id: 'blueberry',
      title: '深山有机蓝莓',
      subtitle: 'WILD BLUEBERRY',
      image: 'https://images.unsplash.com/photo-1498557850523-fd3d118b962e?q=80&w=800&auto=format&fit=crop',
      accent: '#818cf8',
    },
  ],
}

function normalizeTarotCard(
  card: Partial<TarotShowcaseCard> | undefined,
  fallback: TarotShowcaseCard,
): TarotShowcaseCard {
  return {
    id: fallback.id,
    title: typeof card?.title === 'string' ? card.title : fallback.title,
    subtitle: typeof card?.subtitle === 'string' ? card.subtitle : fallback.subtitle,
    image: typeof card?.image === 'string' && card.image.trim().length > 0 ? card.image : fallback.image,
    accent: typeof card?.accent === 'string' && card.accent.trim().length > 0 ? card.accent : fallback.accent,
  }
}

export function createDefaultTarotShowcaseConfig(): TarotShowcaseConfig {
  return {
    ...DEFAULT_TAROT_SHOWCASE_CONFIG,
    cards: DEFAULT_TAROT_SHOWCASE_CONFIG.cards.map((card) => ({ ...card })),
  }
}

export function normalizeTarotShowcaseConfig(config?: Partial<TarotShowcaseConfig> | null): TarotShowcaseConfig {
  const fallback = createDefaultTarotShowcaseConfig()
  const rawCards = Array.isArray(config?.cards) ? config.cards : fallback.cards

  return {
    version: 1,
    effect: TAROT_SHOWCASE_EFFECT_OPTIONS.some((option) => option.value === config?.effect)
      ? (config?.effect as TarotShowcaseEffectId)
      : fallback.effect,
    revealMode: TAROT_SHOWCASE_REVEAL_OPTIONS.some((option) => option.value === config?.revealMode)
      ? (config?.revealMode as TarotShowcaseRevealMode)
      : fallback.revealMode,
    cards: fallback.cards.map((card, index) => normalizeTarotCard(rawCards[index], card)),
  }
}

export function createDefaultTarotShowcaseContent() {
  return serializeTarotShowcaseContent(createDefaultTarotShowcaseConfig())
}

export function parseTarotShowcaseContent(content?: string | null): TarotShowcaseConfig {
  if (!content || content === 'fruit-showcase') {
    return createDefaultTarotShowcaseConfig()
  }

  try {
    return normalizeTarotShowcaseConfig(JSON.parse(content) as Partial<TarotShowcaseConfig>)
  } catch {
    return createDefaultTarotShowcaseConfig()
  }
}

export function serializeTarotShowcaseContent(config: Partial<TarotShowcaseConfig>) {
  return JSON.stringify(normalizeTarotShowcaseConfig(config))
}

export function getTarotCardGlow(accent: string) {
  const rgba = parseCssColor(accent) ?? parseCssColor('#ffffff')
  if (!rgba) {
    return 'rgba(255, 255, 255, 0.55)'
  }
  return formatCssColor(withAlpha(rgba, 0.55), 'rgba')
}
