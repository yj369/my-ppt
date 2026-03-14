import type { ChangeEvent } from 'react'
import { useRef } from 'react'
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
} from 'lucide-react'
import { exportPresentationSnapshot, useEditorStore } from '../../store'
import type { PresentationSnapshot } from '../../types/editor'

export function Toolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
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
        <button className="toolbar-pill" onClick={() => insertBlock('shape-rect')}>
          <Shapes size={16} />
          <span>形状</span>
        </button>
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
