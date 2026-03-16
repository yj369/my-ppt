import type { ChangeEvent } from 'react'
import { useRef, useState, useEffect } from 'react'
import {
  Download,
  FileImage,
  Play,
  Plus,
  Presentation,
  Shapes,
  Table2,
  Type,
  Upload,
  Circle,
  Triangle,
} from 'lucide-react'
import { exportPresentationSnapshot, useEditorStore } from '../../store'
import type { PresentationSnapshot } from '../../types/editor'

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isShapeMenuOpen, setShapeMenuOpen] = useState(false)
  const shapeMenuRef = useRef<HTMLDivElement>(null)
  const {
    presentationName,
    slides,
    addSlide,
    insertBlock,
    togglePlayMode,
  } = useEditorStore()

  const handleExport = () => {
    const snapshot = exportPresentationSnapshot()
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${snapshot.presentationName || 'presentation'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as PresentationSnapshot
      if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
        throw new Error('无效文件')
      }

      useEditorStore.getState().importPresentation(parsed)
    } catch {
      window.alert('导入失败：请选择由当前编辑器导出的 JSON 文件。')
    } finally {
      event.target.value = ''
    }
  }

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(e.target as Node)) {
        setShapeMenuOpen(false)
      }
    }
    if (isShapeMenuOpen) {
      document.addEventListener('click', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [isShapeMenuOpen])

  const insertShapePreset = (type: any) => {
    insertBlock(type)
    setShapeMenuOpen(false)
  }

  return (
    <header className="app-toolbar">
      <div className="toolbar-document">
        <div className="toolbar-document__icon">
          <Presentation size={16} />
        </div>
        <div className="brand-copy">
          <strong>{presentationName}</strong>
          <span>{slides.length} 页</span>
        </div>
      </div>

      <div className="toolbar-section">
        <button className="toolbar-btn toolbar-btn--compact" onClick={() => addSlide('blank')}>
          <Plus size={16} />
          <span>新建幻灯片</span>
        </button>
        <button
          className="toolbar-btn toolbar-btn--accent toolbar-btn--compact"
          onClick={() => togglePlayMode(true)}
        >
          <Play size={16} />
          <span>播放</span>
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section toolbar-section--insert">
        <button className="toolbar-pill" onClick={() => insertBlock('heading')}>
          <Type size={16} />
          <span>文本</span>
        </button>
        <div style={{ position: 'relative' }} ref={shapeMenuRef}>
          <button
            className={`toolbar-pill ${isShapeMenuOpen ? 'toolbar-pill--active' : ''}`}
            onClick={() => setShapeMenuOpen(!isShapeMenuOpen)}
          >
            <Shapes size={16} />
            <span>形状</span>
          </button>
          
          {isShapeMenuOpen && (
            <div className="toolbar-shape-popover">
              <div className="toolbar-shape-popover-grid">
                <button type="button" onClick={() => insertShapePreset('shape-rect')} title="正方形">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" />
                  </svg>
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-rounded')} title="圆角矩形">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <rect width="24" height="24" rx="6" />
                  </svg>
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-circle')} title="圆形">
                  <Circle size={24} fill="currentColor" strokeWidth={0} />
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-triangle')} title="三角形">
                  <Triangle size={24} fill="currentColor" strokeWidth={0} />
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-diamond')} title="菱形">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L22 12L12 22L2 12L12 2Z" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
        <button className="toolbar-pill" onClick={() => insertBlock('image')}>
          <FileImage size={16} />
          <span>图片</span>
        </button>
        <button className="toolbar-pill" onClick={() => insertBlock('table')}>
          <Table2 size={16} />
          <span>表格</span>
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-section toolbar-section--end">
        <button className="toolbar-btn toolbar-btn--compact" onClick={handleExport}>
          <Download size={16} />
          <span>导出</span>
        </button>
        <button
          className="toolbar-btn toolbar-btn--compact"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} />
          <span>导入</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={handleImport}
        />
      </div>
    </header>
  )
}
