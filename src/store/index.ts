import { create } from 'zustand'
import {
  cloneBlock,
  cloneSlide,
  createDemoPresentation,
  createInsertedBlock,
  createSlideFromLayout,
  getNextZIndex,
} from '../lib/presentation'
import type {
  BlockAppearance,
  EditorBlock,
  ElementType,
  InspectorTab,
  PresentationSnapshot,
  PresentationTheme,
  Slide,
  SlideLayout,
} from '../types/editor'

const STORAGE_KEY = 'tarot-keynote-lab-v5'

type BlockUpdate = Partial<Omit<EditorBlock, 'appearance'>> & {
  appearance?: Partial<BlockAppearance>
}

export type EditorState = {
  presentationName: string
  theme: PresentationTheme
  slides: Slide[]
  currentSlideId: string | null
  activeBlockId: string | null
  activeInspector: InspectorTab
  isPlayMode: boolean
  navigationDirection: -1 | 0 | 1
  showGrid: boolean
  showGuides: boolean
  camX: number
  camY: number
  camZoom: number
  addSlide: (layout?: SlideLayout) => void
  duplicateSlide: (id: string) => void
  deleteSlide: (id: string) => void
  moveSlide: (id: string, direction: -1 | 1) => void
  toggleSkipSlide: (id: string) => void
  switchSlide: (id: string, direction?: -1 | 0 | 1) => void
  updateSlide: (id: string, updates: Partial<Omit<Slide, 'id' | 'blocks'>>) => void
  applySlideLayout: (id: string, layout: SlideLayout) => void
  updateNotes: (id: string, notes: string) => void
  updatePresentation: (
    updates: Partial<
      Pick<EditorState, 'presentationName' | 'theme' | 'showGrid' | 'showGuides'>
    >,
  ) => void
  importPresentation: (snapshot: PresentationSnapshot) => void
  resetPresentation: () => void
  insertBlock: (type: ElementType, position?: { x: number; y: number }) => void
  addBlock: (slideId: string, block: EditorBlock) => void
  updateBlock: (slideId: string, blockId: string, updates: BlockUpdate) => void
  duplicateBlock: (slideId: string, blockId: string) => void
  deleteBlock: (slideId: string, blockId: string) => void
  bringBlockForward: (slideId: string, blockId: string) => void
  sendBlockBackward: (slideId: string, blockId: string) => void
  setActiveBlock: (id: string | null) => void
  setActiveInspector: (tab: InspectorTab) => void
  togglePlayMode: (force?: boolean) => void
  nextSlide: () => void
  previousSlide: () => void
  setCam: (x: number, y: number, zoom: number) => void
}

function reorder<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

function getSnapshot(state: EditorState): PresentationSnapshot {
  return {
    presentationName: state.presentationName,
    theme: state.theme,
    slides: state.slides,
    currentSlideId: state.currentSlideId,
    showGrid: state.showGrid,
    showGuides: state.showGuides,
  }
}

function loadInitialSnapshot() {
  if (typeof window === 'undefined') {
    return createDemoPresentation()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createDemoPresentation()
    }

    const parsed = JSON.parse(raw) as PresentationSnapshot
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return createDemoPresentation()
    }

    return parsed
  } catch {
    return createDemoPresentation()
  }
}

const initialSnapshot = loadInitialSnapshot()

export const useEditorStore = create<EditorState>((set) => ({
  presentationName: initialSnapshot.presentationName,
  theme: initialSnapshot.theme,
  slides: initialSnapshot.slides,
  currentSlideId: initialSnapshot.currentSlideId,
  activeBlockId: null,
  activeInspector: 'document',
  isPlayMode: false,
  navigationDirection: 0,
  showGrid: initialSnapshot.showGrid,
  showGuides: initialSnapshot.showGuides,
  camX: 0,
  camY: 0,
  camZoom: 1,
  addSlide: (layout = 'blank') =>
    set((state) => {
      const currentIndex = state.currentSlideId
        ? state.slides.findIndex((slide) => slide.id === state.currentSlideId)
        : state.slides.length - 1
      const insertAt = currentIndex >= 0 ? currentIndex + 1 : state.slides.length
      const newSlide = createSlideFromLayout(layout, state.slides.length + 1, state.theme)
      const slides = [...state.slides]
      slides.splice(insertAt, 0, newSlide)

      return {
        slides,
        currentSlideId: newSlide.id,
        activeBlockId: null,
        navigationDirection: 1 as const,
      }
    }),
  duplicateSlide: (id) =>
    set((state) => {
      const index = state.slides.findIndex((slide) => slide.id === id)
      if (index < 0) {
        return state
      }

      const duplicated = cloneSlide(state.slides[index])
      const slides = [...state.slides]
      slides.splice(index + 1, 0, duplicated)

      return {
        slides,
        currentSlideId: duplicated.id,
        activeBlockId: null,
        navigationDirection: 1 as const,
      }
    }),
  deleteSlide: (id) =>
    set((state) => {
      if (state.slides.length <= 1) {
        return state
      }

      const index = state.slides.findIndex((slide) => slide.id === id)
      if (index < 0) {
        return state
      }

      const slides = state.slides.filter((slide) => slide.id !== id)
      const fallbackIndex = Math.min(index, slides.length - 1)
      return {
        slides,
        currentSlideId:
          state.currentSlideId === id ? slides[fallbackIndex]?.id ?? slides[0]?.id ?? null : state.currentSlideId,
        activeBlockId: null,
      }
    }),
  moveSlide: (id, direction) =>
    set((state) => {
      const index = state.slides.findIndex((slide) => slide.id === id)
      if (index < 0) {
        return state
      }

      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= state.slides.length) {
        return state
      }

      return {
        slides: reorder(state.slides, index, targetIndex),
      }
    }),
  toggleSkipSlide: (id) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === id ? { ...slide, skipped: !slide.skipped } : slide,
      ),
    })),
  switchSlide: (id, direction = 0) =>
    set(() => ({
      currentSlideId: id,
      activeBlockId: null,
      navigationDirection: direction,
    })),
  updateSlide: (id, updates) =>
    set((state) => ({
      slides: state.slides.map((slide) => (slide.id === id ? { ...slide, ...updates } : slide)),
    })),
  applySlideLayout: (id, layout) =>
    set((state) => {
      const index = state.slides.findIndex((slide) => slide.id === id)
      if (index < 0) {
        return state
      }

      const template = createSlideFromLayout(layout, index + 1, state.theme)

      return {
        slides: state.slides.map((slide) =>
          slide.id === id
            ? {
                ...slide,
                layout: template.layout,
                transition: template.transition,
                transitionDuration: template.transitionDuration,
                bg: slide.bg === 'theme' ? template.bg : slide.bg,
                blocks: template.blocks,
                notes: template.notes,
              }
            : slide,
        ),
        activeBlockId: null,
        activeInspector: 'document' as const,
      }
    }),
  updateNotes: (id, notes) =>
    set((state) => ({
      slides: state.slides.map((slide) => (slide.id === id ? { ...slide, notes } : slide)),
    })),
  updatePresentation: (updates) =>
    set((state) => ({
      ...('presentationName' in updates ? { presentationName: updates.presentationName ?? state.presentationName } : {}),
      ...('theme' in updates ? { theme: updates.theme ?? state.theme } : {}),
      ...('showGrid' in updates ? { showGrid: updates.showGrid ?? state.showGrid } : {}),
      ...('showGuides' in updates ? { showGuides: updates.showGuides ?? state.showGuides } : {}),
    })),
  importPresentation: (snapshot) =>
    set(() => ({
      presentationName: snapshot.presentationName,
      theme: snapshot.theme,
      slides: snapshot.slides,
      currentSlideId: snapshot.currentSlideId ?? snapshot.slides[0]?.id ?? null,
      activeBlockId: null,
      activeInspector: 'document',
      isPlayMode: false,
      navigationDirection: 0,
      showGrid: snapshot.showGrid,
      showGuides: snapshot.showGuides,
    })),
  resetPresentation: () => {
    const demo = createDemoPresentation()
    set(() => ({
      presentationName: demo.presentationName,
      theme: demo.theme,
      slides: demo.slides,
      currentSlideId: demo.currentSlideId,
      activeBlockId: null,
      activeInspector: 'document',
      isPlayMode: false,
      navigationDirection: 0,
      showGrid: demo.showGrid,
      showGuides: demo.showGuides,
    }))
  },
  insertBlock: (type, position) =>
    set((state) => {
      const currentSlide = state.slides.find((slide) => slide.id === state.currentSlideId)
      if (!currentSlide || !state.currentSlideId) {
        return state
      }

      const newBlock = createInsertedBlock(type, currentSlide.blocks, position)

      return {
        slides: state.slides.map((slide) =>
          slide.id === state.currentSlideId
            ? {
                ...slide,
                blocks: [...slide.blocks, newBlock],
              }
            : slide,
        ),
        activeBlockId: newBlock.id,
        activeInspector: 'format' as const,
      }
    }),
  addBlock: (slideId, block) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              blocks: [...slide.blocks, { ...block, zIndex: block.zIndex || getNextZIndex(slide.blocks) }],
            }
          : slide,
      ),
    })),
  updateBlock: (slideId, blockId, updates) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              blocks: slide.blocks.map((block) =>
                block.id === blockId
                  ? {
                      ...block,
                      ...updates,
                      appearance: updates.appearance
                        ? { ...block.appearance, ...updates.appearance }
                        : block.appearance,
                    }
                  : block,
              ),
            }
          : slide,
      ),
    })),
  duplicateBlock: (slideId, blockId) =>
    set((state) => {
      let duplicatedId: string | null = null

      return {
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) {
            return slide
          }

          const source = slide.blocks.find((block) => block.id === blockId)
          if (!source) {
            return slide
          }

          const duplicated = cloneBlock(source)
          duplicatedId = duplicated.id

          return {
            ...slide,
            blocks: [...slide.blocks, { ...duplicated, zIndex: getNextZIndex(slide.blocks) }],
          }
        }),
        activeBlockId: duplicatedId ?? state.activeBlockId,
      }
    }),
  deleteBlock: (slideId, blockId) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              blocks: slide.blocks.filter((block) => block.id !== blockId),
            }
          : slide,
      ),
      activeBlockId: state.activeBlockId === blockId ? null : state.activeBlockId,
    })),
  bringBlockForward: (slideId, blockId) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.id !== slideId) {
          return slide
        }

        const top = getNextZIndex(slide.blocks)
        return {
          ...slide,
          blocks: slide.blocks.map((block) =>
            block.id === blockId ? { ...block, zIndex: top } : block,
          ),
        }
      }),
    })),
  sendBlockBackward: (slideId, blockId) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.id !== slideId) {
          return slide
        }

        const min = slide.blocks.reduce((value, block) => Math.min(value, block.zIndex), 1)
        return {
          ...slide,
          blocks: slide.blocks.map((block) =>
            block.id === blockId ? { ...block, zIndex: min - 1 } : block,
          ),
        }
      }),
    })),
  setActiveBlock: (id) =>
    set(() => ({
      activeBlockId: id,
      activeInspector: id ? 'format' : 'document',
    })),
  setActiveInspector: (tab) => set(() => ({ activeInspector: tab })),
  togglePlayMode: (force) =>
    set((state) => ({
      isPlayMode: typeof force === 'boolean' ? force : !state.isPlayMode,
      activeBlockId: null,
      navigationDirection: 0,
    })),
  nextSlide: () =>
    set((state) => {
      const currentIndex = state.slides.findIndex((slide) => slide.id === state.currentSlideId)
      const nextIndex = state.slides.findIndex(
        (slide, index) => index > currentIndex && !slide.skipped,
      )

      if (nextIndex < 0) {
        return state
      }

      return {
        currentSlideId: state.slides[nextIndex].id,
        activeBlockId: null,
        navigationDirection: 1 as const,
      }
    }),
  previousSlide: () =>
    set((state) => {
      const currentIndex = state.slides.findIndex((slide) => slide.id === state.currentSlideId)
      let previousId: string | null = null
      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        if (!state.slides[index].skipped) {
          previousId = state.slides[index].id
          break
        }
      }

      if (!previousId) {
        return state
      }

      return {
        currentSlideId: previousId,
        activeBlockId: null,
        navigationDirection: -1 as const,
      }
    }),
  setCam: (camX, camY, camZoom) => set(() => ({ camX, camY, camZoom })),
}))

if (typeof window !== 'undefined') {
  useEditorStore.subscribe((state) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(getSnapshot(state)))
  })
}

export function exportPresentationSnapshot() {
  return getSnapshot(useEditorStore.getState())
}

export function getCurrentSlide(state: EditorState) {
  return state.slides.find((slide) => slide.id === state.currentSlideId) ?? null
}
