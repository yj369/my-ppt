import type { EditorBlock, ImageBlockData, ImageObjectFit } from '../types/editor'

type ImageBlockLike = Pick<EditorBlock, 'type' | 'content' | 'image'>

const DEFAULT_IMAGE_OBJECT_FIT: ImageObjectFit = 'fill'
const IMAGE_SRC_PATTERN = /<img[^>]+src=["']([^"']+)["']/i

export function extractImageSourceFromContent(content: string) {
  const match = content.match(IMAGE_SRC_PATTERN)
  return match?.[1] ?? null
}

export function buildLegacyImageContent(src: string, objectFit: ImageObjectFit = DEFAULT_IMAGE_OBJECT_FIT) {
  return `<img src="${src}" alt="图片" style="width: 100%; height: 100%; object-fit: ${objectFit}; pointer-events: none; display: block;" />`
}

export function createImageBlockData({
  src,
  naturalWidth = null,
  naturalHeight = null,
  objectFit = DEFAULT_IMAGE_OBJECT_FIT,
}: {
  src: string
  naturalWidth?: number | null
  naturalHeight?: number | null
  objectFit?: ImageObjectFit
}): ImageBlockData {
  return {
    src,
    naturalWidth: naturalWidth && naturalWidth > 0 ? naturalWidth : null,
    naturalHeight: naturalHeight && naturalHeight > 0 ? naturalHeight : null,
    objectFit,
  }
}

export function getImageBlockData(block: ImageBlockLike): ImageBlockData | null {
  if (block.type !== 'image') {
    return null
  }

  const src = block.image?.src ?? extractImageSourceFromContent(block.content)
  if (!src) {
    return null
  }

  return createImageBlockData({
    src,
    naturalWidth: block.image?.naturalWidth ?? null,
    naturalHeight: block.image?.naturalHeight ?? null,
    objectFit: block.image?.objectFit ?? DEFAULT_IMAGE_OBJECT_FIT,
  })
}

export function getImageScalePercent(block: Pick<EditorBlock, 'type' | 'width' | 'height' | 'content' | 'image'>) {
  const image = getImageBlockData(block)
  if (!image?.naturalWidth || !image.naturalHeight) {
    return null
  }

  const widthScale = block.width / image.naturalWidth
  const heightScale = block.height / image.naturalHeight

  if (image.objectFit === 'contain') {
    return Math.min(widthScale, heightScale) * 100
  }

  return Math.max(widthScale, heightScale) * 100
}

export function isImageUpscaled(block: Pick<EditorBlock, 'type' | 'width' | 'height' | 'content' | 'image'>) {
  const scalePercent = getImageScalePercent(block)
  return scalePercent !== null && scalePercent > 100
}
