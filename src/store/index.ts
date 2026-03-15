import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  moveSlideBlockAnimation,
  normalizeBlockAnimations,
  normalizeSlideAnimations,
  updateSlideBlockAnimation,
} from '../lib/animations'
import { uniqueIds } from '../lib/selection'
import {
  cloneBlock,
  cloneSlide,
  createDemoPresentation,
  createInsertedBlock,
  createSlideFromLayout,
  getNextZIndex,
  normalizePresentationSnapshot,
} from '../lib/presentation'
import type {
  AnimationPhase,
  BlockAppearance,
  EditorBlock,
  ElementType,
  InspectorTab,
  PresentationSnapshot,
  PresentationTheme,
  Slide,
  SlideLayout,
  TriggerType,
} from '../types/editor'

const STORAGE_KEY = 'tarot-keynote-lab-v5'

type BlockUpdate = Partial<Omit<EditorBlock, 'appearance'>> & {
  appearance?: Partial<BlockAppearance>
}

type BlockUpdateBatch = Array<{
  blockId: string
  updates: BlockUpdate
}>

export type EditorState = {
  presentationName: string
  theme: PresentationTheme
  slides: Slide[]
  currentSlideId: string | null
  activeBlockId: string | null
  selectedBlockIds: string[]
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
  updateBlocks: (slideId: string, updates: BlockUpdateBatch) => void
  updateBlockAnimation: (
    slideId: string,
    blockId: string,
    phase: AnimationPhase,
    updates: Partial<{
      effect: string
      trigger: TriggerType
      duration: number
      delay: number
      order: number
      loop: boolean
    }>,
  ) => void
  moveBlockAnimation: (slideId: string, blockId: string, phase: AnimationPhase, direction: -1 | 1) => void
  duplicateBlock: (slideId: string, blockId: string) => void
  deleteBlock: (slideId: string, blockId: string) => void
  deleteBlocks: (slideId: string, blockIds: string[]) => void
  bringBlockToFront: (slideId: string, blockId: string) => void
  sendBlockToBack: (slideId: string, blockId: string) => void
  bringBlockForward: (slideId: string, blockId: string) => void
  sendBlockBackward: (slideId: string, blockId: string) => void
  alignBlock: (slideId: string, blockId: string, mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  moveBlocksBy: (slideId: string, blockIds: string[], deltaX: number, deltaY: number) => void
  groupBlocks: (slideId: string, blockIds: string[]) => void
  ungroupBlocks: (slideId: string, blockIds: string[]) => void
  setActiveBlock: (id: string | null) => void
  setPrimarySelectedBlock: (id: string) => void
  setSelectedBlocks: (ids: string[], activeId?: string | null) => void
  toggleBlockSelection: (id: string) => void
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

function applyBlockUpdate(block: EditorBlock, updates: BlockUpdate) {
  const next = {
    ...block,
    ...updates,
    appearance: updates.appearance
      ? { ...block.appearance, ...updates.appearance }
      : block.appearance,
  }

  if (block.keepRatio) {
    if (updates.width !== undefined && updates.height === undefined) {
      const ratio = block.width / block.height
      next.height = updates.width / ratio
    } else if (updates.height !== undefined && updates.width === undefined) {
      const ratio = block.width / block.height
      next.width = updates.height * ratio
    }
  }

  return next
}

function buildSelectionState(ids: string[], activeId?: string | null) {
  const selectedBlockIds = uniqueIds(ids)
  const nextActiveId = selectedBlockIds.length === 0
    ? null
    : activeId && selectedBlockIds.includes(activeId)
    ? activeId
    : selectedBlockIds[selectedBlockIds.length - 1]

  return {
    selectedBlockIds,
    activeBlockId: nextActiveId,
    activeInspector: nextActiveId ? ('format' as const) : ('document' as const),
  }
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
    return normalizePresentationSnapshot(createDemoPresentation())
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return normalizePresentationSnapshot(createDemoPresentation())
    }

    const parsed = JSON.parse(raw) as PresentationSnapshot
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return normalizePresentationSnapshot(createDemoPresentation())
    }

    return normalizePresentationSnapshot(parsed)
  } catch {
    return normalizePresentationSnapshot(createDemoPresentation())
  }
}

const initialSnapshot = loadInitialSnapshot()

export const useEditorStore = create<EditorState>((set) => ({
  presentationName: initialSnapshot.presentationName,
  theme: initialSnapshot.theme,
  slides: initialSnapshot.slides,
  currentSlideId: initialSnapshot.currentSlideId,
  activeBlockId: null,
  selectedBlockIds: [],
  activeInspector: 'format',
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
        selectedBlockIds: [],
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
        selectedBlockIds: [],
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
        selectedBlockIds: [],
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
      selectedBlockIds: [],
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
        selectedBlockIds: [],
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
    set(() => {
      const normalized = normalizePresentationSnapshot(snapshot)

      return {
        presentationName: normalized.presentationName,
        theme: normalized.theme,
        slides: normalized.slides,
        currentSlideId: normalized.currentSlideId ?? normalized.slides[0]?.id ?? null,
        activeBlockId: null,
        selectedBlockIds: [],
        activeInspector: 'document',
        isPlayMode: false,
        navigationDirection: 0,
        showGrid: normalized.showGrid,
        showGuides: normalized.showGuides,
      }
    }),
  resetPresentation: () => {
    const demo = normalizePresentationSnapshot(createDemoPresentation())
    set(() => ({
      presentationName: demo.presentationName,
      theme: demo.theme,
      slides: demo.slides,
      currentSlideId: demo.currentSlideId,
      activeBlockId: null,
      selectedBlockIds: [],
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
        selectedBlockIds: [newBlock.id],
        activeInspector: 'format' as const,
      }
    }),
  addBlock: (slideId, block) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === slideId
          ? normalizeSlideAnimations({
              ...slide,
              blocks: [
                ...slide.blocks,
                normalizeBlockAnimations({
                  ...block,
                  zIndex: block.zIndex || getNextZIndex(slide.blocks),
                }),
              ],
            })
          : slide,
      ),
    })),
  updateBlock: (slideId, blockId, updates) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              blocks: slide.blocks.map((block) => (
                block.id === blockId ? applyBlockUpdate(block, updates) : block
              )),
            }
          : slide,
      ),
    })),
  updateBlocks: (slideId, updates) =>
    set((state) => {
      const updatesById = new Map(updates.map((entry) => [entry.blockId, entry.updates]))
      return {
        slides: state.slides.map((slide) =>
          slide.id === slideId
            ? {
                ...slide,
                blocks: slide.blocks.map((block) => {
                  const nextUpdates = updatesById.get(block.id)
                  return nextUpdates ? applyBlockUpdate(block, nextUpdates) : block
                }),
              }
            : slide,
        ),
      }
    }),
  updateBlockAnimation: (slideId, blockId, phase, updates) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === slideId
          ? updateSlideBlockAnimation(slide, blockId, phase, updates)
          : slide,
      ),
    })),
  moveBlockAnimation: (slideId, blockId, phase, direction) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === slideId
          ? moveSlideBlockAnimation(slide, blockId, phase, direction)
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

          return normalizeSlideAnimations({
            ...slide,
            blocks: [...slide.blocks, { ...duplicated, zIndex: getNextZIndex(slide.blocks) }],
          })
        }),
        ...buildSelectionState(duplicatedId ? [duplicatedId] : state.selectedBlockIds, duplicatedId ?? state.activeBlockId),
      }
    }),
  deleteBlock: (slideId, blockId) =>
    set((state) => {
      const nextSelectedIds = state.selectedBlockIds.filter((id) => id !== blockId)
      return {
        slides: state.slides.map((slide) =>
          slide.id === slideId
            ? normalizeSlideAnimations({
                ...slide,
                blocks: slide.blocks.filter((block) => block.id !== blockId),
              })
            : slide,
        ),
        ...buildSelectionState(nextSelectedIds, state.activeBlockId === blockId ? null : state.activeBlockId),
      }
    }),
  deleteBlocks: (slideId, blockIds) =>
    set((state) => {
      const blockIdSet = new Set(blockIds)
      const nextSelectedIds = state.selectedBlockIds.filter((id) => !blockIdSet.has(id))
      return {
        slides: state.slides.map((slide) =>
          slide.id === slideId
            ? normalizeSlideAnimations({
                ...slide,
                blocks: slide.blocks.filter((block) => !blockIdSet.has(block.id)),
              })
            : slide,
        ),
        ...buildSelectionState(
          nextSelectedIds,
          state.activeBlockId && blockIdSet.has(state.activeBlockId) ? null : state.activeBlockId,
        ),
      }
    }),
  bringBlockForward: (slideId: string, blockId: string) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const sorted = [...slide.blocks].sort((a, b) => a.zIndex - b.zIndex)
        const idx = sorted.findIndex((b) => b.id === blockId)
        if (idx < 0 || idx === sorted.length - 1) return slide
        const next = sorted[idx + 1]
        const current = sorted[idx]
        const currentZ = current.zIndex
        const nextZ = next.zIndex
        return {
          ...slide,
          blocks: slide.blocks.map((b) => {
            if (b.id === blockId) return { ...b, zIndex: nextZ }
            if (b.id === next.id) return { ...b, zIndex: currentZ }
            return b
          }),
        }
      }),
    })),
  sendBlockBackward: (slideId: string, blockId: string) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const sorted = [...slide.blocks].sort((a, b) => a.zIndex - b.zIndex)
        const idx = sorted.findIndex((b) => b.id === blockId)
        if (idx <= 0) return slide
        const prev = sorted[idx - 1]
        const current = sorted[idx]
        const currentZ = current.zIndex
        const prevZ = prev.zIndex
        return {
          ...slide,
          blocks: slide.blocks.map((b) => {
            if (b.id === blockId) return { ...b, zIndex: prevZ }
            if (b.id === prev.id) return { ...b, zIndex: currentZ }
            return b
          }),
        }
      }),
    })),
  bringBlockToFront: (slideId: string, blockId: string) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const maxZ = Math.max(...slide.blocks.map((b) => b.zIndex), 0)
        return {
          ...slide,
          blocks: slide.blocks.map((b) => (b.id === blockId ? { ...b, zIndex: maxZ + 1 } : b)),
        }
      }),
    })),
  sendBlockToBack: (slideId: string, blockId: string) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        const minZ = Math.min(...slide.blocks.map((b) => b.zIndex), 0)
        return {
          ...slide,
          blocks: slide.blocks.map((b) => (b.id === blockId ? { ...b, zIndex: minZ - 1 } : b)),
        }
      }),
    })),
  alignBlock: (slideId, blockId, mode) =>
    set((state) => ({
      slides: state.slides.map((slide) => {
        if (slide.id !== slideId) return slide
        return {
          ...slide,
          blocks: slide.blocks.map((block) => {
            if (block.id !== blockId) return block
            const SLIDE_W = 1280
            const SLIDE_H = 720
            switch (mode) {
              case 'left': return { ...block, x: 0 }
              case 'center': return { ...block, x: Math.round(SLIDE_W / 2 - block.width / 2) }
              case 'right': return { ...block, x: Math.round(SLIDE_W - block.width) }
              case 'top': return { ...block, y: 0 }
              case 'middle': return { ...block, y: Math.round(SLIDE_H / 2 - block.height / 2) }
              case 'bottom': return { ...block, y: Math.round(SLIDE_H - block.height) }
              default: return block
            }
          }),
        }
      }),
    })),
  moveBlocksBy: (slideId, blockIds, deltaX, deltaY) =>
    set((state) => {
      const blockIdSet = new Set(blockIds)
      return {
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            blocks: slide.blocks.map((block) => {
              if (!blockIdSet.has(block.id) || block.locked) return block
              return {
                ...block,
                x: block.x + deltaX,
                y: block.y + deltaY,
              }
            }),
          }
        }),
      }
    }),
  groupBlocks: (slideId, blockIds) =>
    set((state) => {
      const selectedIds = uniqueIds(blockIds)
      if (selectedIds.length < 2) return state
      const blockIdSet = new Set(selectedIds)
      const groupId = uuidv4()
      return {
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          return {
            ...slide,
            blocks: slide.blocks.map((block) => (
              blockIdSet.has(block.id)
                ? { ...block, groupId }
                : block
            )),
          }
        }),
      }
    }),
  ungroupBlocks: (slideId, blockIds) =>
    set((state) => {
      const targetIds = uniqueIds(blockIds)
      if (targetIds.length === 0) return state
      const blockIdSet = new Set(targetIds)
      return {
        slides: state.slides.map((slide) => {
          if (slide.id !== slideId) return slide
          const targetGroupIds = new Set(
            slide.blocks
              .filter((block) => blockIdSet.has(block.id) && block.groupId)
              .map((block) => block.groupId as string),
          )
          return {
            ...slide,
            blocks: slide.blocks.map((block) => (
              block.groupId && targetGroupIds.has(block.groupId)
                ? { ...block, groupId: null }
                : block
            )),
          }
        }),
      }
    }),
  setActiveBlock: (id) =>
    set(() => buildSelectionState(id ? [id] : [], id)),
  setPrimarySelectedBlock: (id) =>
    set((state) => ({
      ...buildSelectionState(
        state.selectedBlockIds.includes(id) ? state.selectedBlockIds : [id],
        id,
      ),
    })),
  setSelectedBlocks: (ids, activeId) =>
    set(() => buildSelectionState(ids, activeId)),
  toggleBlockSelection: (id) =>
    set((state) => {
      if (state.selectedBlockIds.includes(id)) {
        const nextSelectedIds = state.selectedBlockIds.filter((item) => item !== id)
        return buildSelectionState(
          nextSelectedIds,
          state.activeBlockId === id ? null : state.activeBlockId,
        )
      }

      return buildSelectionState([...state.selectedBlockIds, id], id)
    }),
  setActiveInspector: (tab) => set(() => ({ activeInspector: tab })),
  togglePlayMode: (force) =>
    set((state) => ({
      isPlayMode: typeof force === 'boolean' ? force : !state.isPlayMode,
      activeBlockId: null,
      selectedBlockIds: [],
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
        selectedBlockIds: [],
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
        selectedBlockIds: [],
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
