import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { getLocalImageUrl, isLocalImage } from '../../lib/imageStorage'
import { getImageBlockData } from '../../lib/imageBlock'
import { useEditorStore } from '../../store'
import type { EditorBlock } from '../../types/editor'

type EditableImageProps = {
  block: EditorBlock
  slideId: string
  style: CSSProperties
}

export function EditableImage({ block, slideId, style }: EditableImageProps) {
  const updateBlock = useEditorStore((state) => state.updateBlock)
  const image = getImageBlockData(block)
  const [resolvedSrc, setResolvedSrc] = useState(
    image?.src && !isLocalImage(image.src) ? image.src : '',
  )
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!image?.src) {
      setResolvedSrc('')
      return () => {
        cancelled = true
      }
    }

    setHasError(false)
    setResolvedSrc(isLocalImage(image.src) ? '' : image.src)
    getLocalImageUrl(image.src)
      .then((url) => {
        if (!cancelled) {
          setResolvedSrc(url)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedSrc(image.src)
          setHasError(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [image?.src])

  if (!image?.src) {
    return (
      <div className="tpl-wrapper tpl-wrapper--image" style={style}>
        <div className="kn-image-frame kn-image-frame--empty">缺少图片源</div>
      </div>
    )
  }

  return (
    <div className="tpl-wrapper tpl-wrapper--image" style={style}>
      <div className={`kn-image-frame ${hasError ? 'kn-image-frame--empty' : ''}`}>
        {hasError ? (
          <div className="kn-image-frame__status">图片加载失败</div>
        ) : !resolvedSrc ? (
          <div className="kn-image-frame__status">图片加载中...</div>
        ) : (
          <img
            src={resolvedSrc}
            alt={block.name || '图片'}
            onError={() => setHasError(true)}
            onLoad={(event) => {
              const nextNaturalWidth = event.currentTarget.naturalWidth || null
              const nextNaturalHeight = event.currentTarget.naturalHeight || null

              if (
                !nextNaturalWidth
                || !nextNaturalHeight
                || (
                  image.naturalWidth === nextNaturalWidth
                  && image.naturalHeight === nextNaturalHeight
                )
              ) {
                return
              }

              updateBlock(slideId, block.id, {
                image: {
                  naturalWidth: nextNaturalWidth,
                  naturalHeight: nextNaturalHeight,
                },
              })
            }}
            style={{ objectFit: image.objectFit }}
          />
        )}
      </div>
    </div>
  )
}
