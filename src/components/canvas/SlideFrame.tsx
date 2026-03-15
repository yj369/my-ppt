import type { SelectionRect } from '../../lib/selection'
import { resolveSlideBackground } from '../../lib/presentation'
import { useEditorStore } from '../../store'
import { EditorBlock } from '../editor/EditorBlock'
import { SlideBackground } from './SlideBackground'

type SlideFrameProps = {
  slideId: string | null
  interactive: boolean
  marqueeRect?: SelectionRect | null
}

export function SlideFrame({ slideId, interactive, marqueeRect = null }: SlideFrameProps) {
  const { slides, theme, showGuides, isPlayMode } = useEditorStore()
  const slide = slides.find((item) => item.id === slideId) ?? null
  const background = resolveSlideBackground(theme, slide?.bg ?? 'theme')

  return (
    <div
      id={interactive ? 'slideFrame' : undefined}
      className={`slide-frame ${interactive ? 'is-interactive' : 'is-thumbnail'}`}
      data-bg={background}
      data-theme={theme}
    >
      <SlideBackground theme={theme} bg={background} />

      {interactive && showGuides && !isPlayMode && (
        <div className="slide-guides" aria-hidden="true">
          <span className="guide guide--vertical" />
          <span className="guide guide--horizontal" />
          <span className="safe-area" />
        </div>
      )}

      <div
        id={interactive ? 'slideContent' : undefined}
        className="slide-content"
        key={interactive ? `${isPlayMode ? 'play' : 'edit'}-${slideId ?? 'none'}` : `thumb-${slideId ?? 'none'}`}
      >
        {slide?.blocks.map((block) => (
          <EditorBlock
            key={block.id}
            block={block}
            slideId={slide.id}
            interactive={interactive}
          />
        ))}

        {interactive && marqueeRect && (
          <div
            className="selection-marquee"
            style={{
              left: `${marqueeRect.x}px`,
              top: `${marqueeRect.y}px`,
              width: `${marqueeRect.width}px`,
              height: `${marqueeRect.height}px`,
            }}
          />
        )}
      </div>

      {interactive && (
        <div className="transition-layer" id="transitionLayer">
          <div className="transition-orb" />
        </div>
      )}
    </div>
  )
}
