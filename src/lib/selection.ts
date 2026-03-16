import type { EditorBlock } from '../types/editor'

export type SelectionRect = {
  x: number
  y: number
  width: number
  height: number
}

type TransformBlock = Pick<EditorBlock, 'id' | 'x' | 'y' | 'width' | 'height' | 'rotation'>

export function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids))
}

function getSelectionBlocks(blocks: EditorBlock[], blockIds: string[]) {
  const blockIdSet = new Set(uniqueIds(blockIds))
  return blocks.filter((block) => blockIdSet.has(block.id))
}

export function getSelectionIdsForBlock(blocks: EditorBlock[], blockId: string) {
  const block = blocks.find((item) => item.id === blockId)
  if (!block) return []
  if (!block.groupId) return [block.id]
  return blocks.filter((item) => item.groupId === block.groupId).map((item) => item.id)
}

export function normalizeSelectionRect(startX: number, startY: number, endX: number, endY: number): SelectionRect {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  }
}

export function rectContainsPoint(rect: SelectionRect, x: number, y: number) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

export function getSelectionBounds(blocks: EditorBlock[], blockIds: string[]) {
  const selectedBlocks = getSelectionBlocks(blocks, blockIds)
  if (selectedBlocks.length === 0) {
    return null
  }

  const left = Math.min(...selectedBlocks.map((block) => block.x))
  const top = Math.min(...selectedBlocks.map((block) => block.y))
  const right = Math.max(...selectedBlocks.map((block) => block.x + block.width))
  const bottom = Math.max(...selectedBlocks.map((block) => block.y + block.height))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

export function rectIntersectsBlock(rect: SelectionRect, block: EditorBlock) {
  return !(
    block.x + block.width < rect.x ||
    block.x > rect.x + rect.width ||
    block.y + block.height < rect.y ||
    block.y > rect.y + rect.height
  )
}

export function getSelectionIdsForRect(blocks: EditorBlock[], rect: SelectionRect) {
  const hitIds = new Set<string>()

  blocks.forEach((block) => {
    if (!rectIntersectsBlock(rect, block)) return
    getSelectionIdsForBlock(blocks, block.id).forEach((id) => hitIds.add(id))
  })

  return Array.from(hitIds)
}

export function normalizeAngle(angle: number) {
  const normalized = angle % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function getAngleDelta(fromAngle: number, toAngle: number) {
  return ((toAngle - fromAngle + 540) % 360) - 180
}

function rotatePoint(x: number, y: number, centerX: number, centerY: number, angle: number) {
  const radians = (angle * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const offsetX = x - centerX
  const offsetY = y - centerY

  return {
    x: centerX + offsetX * cos - offsetY * sin,
    y: centerY + offsetX * sin + offsetY * cos,
  }
}

export function buildRotationUpdates(
  blocks: TransformBlock[],
  deltaAngle: number,
  center: { x: number; y: number },
) {
  return blocks.map((block) => {
    const blockCenter = {
      x: block.x + block.width / 2,
      y: block.y + block.height / 2,
    }
    const nextCenter = rotatePoint(blockCenter.x, blockCenter.y, center.x, center.y, deltaAngle)

    return {
      blockId: block.id,
      updates: {
        x: nextCenter.x - block.width / 2,
        y: nextCenter.y - block.height / 2,
        rotation: normalizeAngle(block.rotation + deltaAngle),
      },
    }
  })
}

export function buildRotateSelectionUpdates(blocks: EditorBlock[], blockIds: string[], deltaAngle: number) {
  const selectedBlocks = getSelectionBlocks(blocks, blockIds).filter((block) => !block.locked)
  const bounds = getSelectionBounds(blocks, blockIds)
  if (selectedBlocks.length === 0 || !bounds) {
    return []
  }

  return buildRotationUpdates(selectedBlocks, deltaAngle, {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  })
}

export function buildMoveSelectionUpdates(blocks: EditorBlock[], blockIds: string[], nextX: number, nextY: number) {
  const selectedBlocks = getSelectionBlocks(blocks, blockIds).filter((block) => !block.locked)
  const bounds = getSelectionBounds(blocks, blockIds)
  if (selectedBlocks.length === 0 || !bounds) {
    return []
  }

  const deltaX = nextX - bounds.x
  const deltaY = nextY - bounds.y
  return selectedBlocks.map((block) => ({
    blockId: block.id,
    updates: {
      x: block.x + deltaX,
      y: block.y + deltaY,
    },
  }))
}

export type SnapResult = {
  x: number
  y: number
  width: number
  height: number
  guides: Array<{ type: 'v' | 'h'; pos: number }>
  spacingGuides?: Array<{ type: 'v' | 'h'; start: number; end: number; pos: number }> // New for equal spacing
}

export function calculateSnap(
  currentRect: SelectionRect,
  otherBlocks: EditorBlock[],
  options: {
    gridSize?: number
    snapThreshold?: number
    slideWidth: number
    slideHeight: number
    resizeDir?: string
  }
): SnapResult {
  const { gridSize, snapThreshold = 5, slideWidth, slideHeight, resizeDir } = options
  const result: SnapResult = {
    ...currentRect,
    guides: [],
    spacingGuides: [],
  }

  const isResizing = !!resizeDir

  // 1. Size Snapping (During resize only)
  if (isResizing) {
    otherBlocks.forEach(block => {
      // Snap width
      if (resizeDir?.includes('e') || resizeDir?.includes('w')) {
        if (Math.abs(currentRect.width - block.width) < snapThreshold) {
          result.width = block.width
          if (resizeDir.includes('w')) {
            result.x = currentRect.x + (currentRect.width - block.width)
          }
        }
      }
      // Snap height
      if (resizeDir?.includes('n') || resizeDir?.includes('s')) {
        if (Math.abs(currentRect.height - block.height) < snapThreshold) {
          result.height = block.height
          if (resizeDir.includes('n')) {
            result.y = currentRect.y + (currentRect.height - block.height)
          }
        }
      }
    })
  }

  // 2. Alignment Snapping (Edges and Centers)
  const currentV = []
  if (!isResizing || resizeDir.includes('w')) currentV.push({ pos: currentRect.x, type: 'start' })
  if (!isResizing) currentV.push({ pos: currentRect.x + currentRect.width / 2, type: 'center' })
  if (!isResizing || resizeDir.includes('e')) currentV.push({ pos: currentRect.x + currentRect.width, type: 'end' })

  const currentH = []
  if (!isResizing || resizeDir.includes('n')) currentH.push({ pos: currentRect.y, type: 'start' })
  if (!isResizing) currentH.push({ pos: currentRect.y + currentRect.height / 2, type: 'center' })
  if (!isResizing || resizeDir.includes('s')) currentH.push({ pos: currentRect.y + currentRect.height, type: 'end' })

  let minDiffV = snapThreshold
  let bestV: number | null = null
  let bestVPoint: string | null = null

  const checkV = (pos: number, targetPos: number, pointType: string) => {
    const diff = Math.abs(pos - targetPos)
    if (diff < minDiffV) {
      minDiffV = diff
      bestV = targetPos
      bestVPoint = pointType
      return true
    }
    return false
  }

  // Slide Center V
  currentV.forEach(p => checkV(p.pos, slideWidth / 2, p.type))

  // Other Blocks V
  otherBlocks.forEach(block => {
    [block.x, block.x + block.width / 2, block.x + block.width].forEach(t => {
      currentV.forEach(p => checkV(p.pos, t, p.type))
    })
  })

  if (bestV !== null) {
    if (isResizing) {
      if (resizeDir?.includes('w')) {
        const delta = bestV - currentRect.x
        result.x = bestV
        result.width = Math.max(1, currentRect.width - delta)
      } else if (resizeDir?.includes('e')) {
        result.width = Math.max(1, bestV - currentRect.x)
      }
    } else {
      if (bestVPoint === 'start') result.x = bestV
      else if (bestVPoint === 'center') result.x = bestV - currentRect.width / 2
      else if (bestVPoint === 'end') result.x = bestV - currentRect.width
    }
    result.guides.push({ type: 'v', pos: bestV })
  }

  // Vertical Spacing (Check equal gaps)
  if (!isResizing && otherBlocks.length >= 2) {
    // Sort other blocks by X
    const sorted = [...otherBlocks].sort((a, b) => a.x - b.x)
    for (let i = 0; i < sorted.length - 1; i++) {
      const b1 = sorted[i]
      const b2 = sorted[i+1]
      const gap = b2.x - (b1.x + b1.width)
      if (gap <= 0) continue

      // Check if current block A can be placed to create same gap: B1 -- B2 -- A
      const targetX = b2.x + b2.width + gap
      if (Math.abs(currentRect.x - targetX) < snapThreshold) {
        result.x = targetX
        result.spacingGuides?.push({ type: 'v', start: b2.x + b2.width, end: b2.x + b2.width + gap, pos: currentRect.y + currentRect.height/2 })
        result.spacingGuides?.push({ type: 'v', start: b1.x + b1.width, end: b2.x, pos: currentRect.y + currentRect.height/2 })
      }
      // Or A -- B1 -- B2
      const targetX2 = b1.x - gap - currentRect.width
      if (Math.abs(currentRect.x - targetX2) < snapThreshold) {
        result.x = targetX2
        result.spacingGuides?.push({ type: 'v', start: targetX2 + currentRect.width, end: b1.x, pos: currentRect.y + currentRect.height/2 })
        result.spacingGuides?.push({ type: 'v', start: b1.x + b1.width, end: b2.x, pos: currentRect.y + currentRect.height/2 })
      }
    }
  }

  // Horizontal Snapping
  let minDiffH = snapThreshold
  let bestH: number | null = null
  let bestHPoint: string | null = null

  const checkH = (pos: number, targetPos: number, pointType: string) => {
    const diff = Math.abs(pos - targetPos)
    if (diff < minDiffH) {
      minDiffH = diff
      bestH = targetPos
      bestHPoint = pointType
      return true
    }
    return false
  }

  currentH.forEach(p => checkH(p.pos, slideHeight / 2, p.type))
  otherBlocks.forEach(block => {
    [block.y, block.y + block.height / 2, block.y + block.height].forEach(t => {
      currentH.forEach(p => checkH(p.pos, t, p.type))
    })
  })

  if (bestH !== null) {
    if (isResizing) {
      if (resizeDir?.includes('n')) {
        const delta = bestH - currentRect.y
        result.y = bestH
        result.height = Math.max(1, currentRect.height - delta)
      } else if (resizeDir?.includes('s')) {
        result.height = Math.max(1, bestH - currentRect.y)
      }
    } else {
      if (bestHPoint === 'start') result.y = bestH
      else if (bestHPoint === 'center') result.y = bestH - currentRect.height / 2
      else if (bestHPoint === 'end') result.y = bestH - currentRect.height
    }
    result.guides.push({ type: 'h', pos: bestH })
  }

  // Horizontal Spacing
  if (!isResizing && otherBlocks.length >= 2) {
    const sorted = [...otherBlocks].sort((a, b) => a.y - b.y)
    for (let i = 0; i < sorted.length - 1; i++) {
      const b1 = sorted[i]
      const b2 = sorted[i+1]
      const gap = b2.y - (b1.y + b1.height)
      if (gap <= 0) continue

      const targetY = b2.y + b2.height + gap
      if (Math.abs(currentRect.y - targetY) < snapThreshold) {
        result.y = targetY
        result.spacingGuides?.push({ type: 'h', start: b2.y + b2.height, end: b2.y + b2.height + gap, pos: currentRect.x + currentRect.width/2 })
        result.spacingGuides?.push({ type: 'h', start: b1.y + b1.height, end: b2.y, pos: currentRect.x + currentRect.width/2 })
      }
      const targetY2 = b1.y - gap - currentRect.height
      if (Math.abs(currentRect.y - targetY2) < snapThreshold) {
        result.y = targetY2
        result.spacingGuides?.push({ type: 'h', start: targetY2 + currentRect.height, end: b1.y, pos: currentRect.x + currentRect.width/2 })
        result.spacingGuides?.push({ type: 'h', start: b1.y + b1.height, end: b2.y, pos: currentRect.x + currentRect.width/2 })
      }
    }
  }

  return result
}


export function buildScaleSelectionUpdates(
  blocks: EditorBlock[],
  blockIds: string[],
  nextWidth?: number,
  nextHeight?: number,
) {
  const selectedBlocks = getSelectionBlocks(blocks, blockIds).filter((block) => !block.locked)
  const bounds = getSelectionBounds(blocks, blockIds)
  if (selectedBlocks.length === 0 || !bounds) {
    return []
  }

  const targetWidth = nextWidth ?? bounds.width
  const targetHeight = nextHeight ?? bounds.height
  const scaleX = nextWidth === undefined || bounds.width === 0 ? 1 : targetWidth / bounds.width
  const scaleY = nextHeight === undefined || bounds.height === 0 ? 1 : targetHeight / bounds.height

  return selectedBlocks.map((block) => ({
    blockId: block.id,
    updates: {
      x: bounds.x + (block.x - bounds.x) * scaleX,
      y: bounds.y + (block.y - bounds.y) * scaleY,
      width: Math.max(1, block.width * scaleX),
      height: Math.max(1, block.height * scaleY),
    },
  }))
}



