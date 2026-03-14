import { Plus } from 'lucide-react'
import { useEditorStore } from '../../store'
import { SlideFrame } from '../canvas/SlideFrame'

export function SidebarLeft() {
  const { slides, currentSlideId, addSlide, switchSlide } = useEditorStore()
  const currentIndex = slides.findIndex((slide) => slide.id === currentSlideId)

  return (
    <aside className="sidebar sidebar-left sidebar-left--slides">
      <div className="slides-pane__header">
        <span className="slides-pane__title">幻灯片</span>
        <button
          className="slides-pane__add"
          onClick={() => addSlide('blank')}
          title="新建幻灯片"
          type="button"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="slides-pane__list">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            className={`slides-pane__item ${slide.id === currentSlideId ? 'is-active' : ''}`}
            type="button"
            aria-label={`切换到第 ${index + 1} 页`}
            onClick={() =>
              switchSlide(
                slide.id,
                index === currentIndex ? 0 : index > currentIndex ? 1 : -1,
              )
            }
          >
            <span className="slides-pane__number">{index + 1}</span>
            <div className="slides-pane__thumb">
              <div className="thumbnail-shell">
                <SlideFrame slideId={slide.id} interactive={false} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}
