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
