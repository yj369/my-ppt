import type { ChangeEvent } from 'react'
import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileImage,
  Play,
  Presentation,
  Sparkles,
  Shapes,
  Table2,
  Type,
  Circle,
  Triangle,
  Link as LinkIcon,
  Image as ImageIcon,
  Smile,
  Home,
} from 'lucide-react'
import { useEditorStore } from '../../store'
import { saveLocalImage, getImageDimensions, calculateFitDimensions } from '../../lib/imageStorage'
import { IconPicker } from './IconPicker'
import { TarotPresetModal } from './TarotPresetModal'

export function Toolbar() {
  const navigate = useNavigate()
  const imageUploadRef = useRef<HTMLInputElement>(null)
  
  const [isShapeMenuOpen, setShapeMenuOpen] = useState(false)
  const shapeMenuRef = useRef<HTMLDivElement>(null)

  const [isImageMenuOpen, setImageMenuOpen] = useState(false)
  const imageMenuRef = useRef<HTMLDivElement>(null)
  const [imageTab, setImageTab] = useState<'local' | 'online'>('local')
  const [imageUrl, setImageUrl] = useState('')

  const [isIconMenuOpen, setIconMenuOpen] = useState(false)
  const iconMenuRef = useRef<HTMLDivElement>(null)
  const [isTarotModalOpen, setTarotModalOpen] = useState(false)

  const {
    name,
    slides,
    insertBlock,
    togglePlayMode,
    updatePresentation,
    addToast,
  } = useEditorStore()

  // 增加本地名称状态以优化更名体验
  const [localName, setLocalName] = useState(name)

  // 当外部 name 变化时（如导入或撤销），同步本地状态
  useEffect(() => {
    setLocalName(name)
  }, [name])

  const handleNameSave = () => {
    const trimmedName = localName.trim()
    if (trimmedName && trimmedName !== name) {
      updatePresentation({ name: trimmedName })
      addToast('演示文稿名称已更新', 'success', 2000)
    } else {
      setLocalName(name) // 恢复原名
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      setLocalName(name)
      setTimeout(() => (e.target as HTMLInputElement).blur(), 0)
    }
  }

  useEffect(() => {

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (isShapeMenuOpen && shapeMenuRef.current && !shapeMenuRef.current.contains(target)) {
        setShapeMenuOpen(false)
      }
      if (isImageMenuOpen && imageMenuRef.current && !imageMenuRef.current.contains(target)) {
        setImageMenuOpen(false)
      }
      if (isIconMenuOpen && iconMenuRef.current && !iconMenuRef.current.contains(target)) {
        setIconMenuOpen(false)
      }
    }

    if (isShapeMenuOpen || isImageMenuOpen || isIconMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isShapeMenuOpen, isImageMenuOpen, isIconMenuOpen])

  const insertShapePreset = (type: any) => {
    insertBlock(type)
    setShapeMenuOpen(false)
  }

  const handleInsertTarotShowcase = () => {
    insertBlock('tarot')
    setTarotModalOpen(false)
  }

  const handleInsertImageUrl = () => {
    if (!imageUrl.trim()) return
    const url = imageUrl
    setImageUrl('')
    setImageMenuOpen(false)

    getImageDimensions(url)
      .then(({ width, height }) => {
        const fit = calculateFitDimensions(width, height)
        insertBlock('image', {
          src: url,
          width: fit.width,
          height: fit.height,
          naturalWidth: width,
          naturalHeight: height,
        })
      })
      .catch(() => {
        insertBlock('image', { src: url })
      })
  }

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const uri = await saveLocalImage(file)
      const objectUrl = URL.createObjectURL(file)
      
      getImageDimensions(objectUrl)
        .then(({ width, height }) => {
          const fit = calculateFitDimensions(width, height)
          insertBlock('image', {
            src: uri,
            width: fit.width,
            height: fit.height,
            naturalWidth: width,
            naturalHeight: height,
          })
          URL.revokeObjectURL(objectUrl)
        })
        .catch(() => {
          insertBlock('image', { src: uri })
          URL.revokeObjectURL(objectUrl)
        })
        
      setImageMenuOpen(false)
    } catch (e) {
      console.error("Local image upload failed:", e)
      window.alert("图片上传失败")
    } finally {
      if (imageUploadRef.current) {
        imageUploadRef.current.value = ''
      }
    }
  }

  return (
    <header className="app-toolbar">
      <div className="toolbar-section" style={{ paddingLeft: '8px' }}>
        <button 
          className="toolbar-btn toolbar-btn--compact" 
          onClick={() => navigate('/')}
          title="Back to Dashboard"
        >
          <Home size={18} />
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-document">
        <div className="toolbar-document__icon">
          <Presentation size={16} />
        </div>
        <div className="brand-copy">
          <input
            type="text"
            className="toolbar-document-name-input"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={handleNameKeyDown}
            placeholder="未命名演示文稿"
            spellCheck={false}
          />
          <span>{slides.length} 页</span>
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section toolbar-section--insert">
        <button className="toolbar-pill" onClick={() => insertBlock('heading')}>
          <Type size={16} />
          <span>文本</span>
        </button>

        <button
          className={`toolbar-pill ${isTarotModalOpen ? 'toolbar-pill--active' : ''}`}
          onClick={() => {
            setShapeMenuOpen(false)
            setImageMenuOpen(false)
            setIconMenuOpen(false)
            setTarotModalOpen(true)
          }}
        >
          <Sparkles size={16} />
          <span>塔罗牌</span>
        </button>

        <div style={{ position: 'relative' }} ref={shapeMenuRef}>
          <button
            className={`toolbar-pill ${isShapeMenuOpen ? 'toolbar-pill--active' : ''}`}
            onClick={() => {
              setShapeMenuOpen(!isShapeMenuOpen)
              if (!isShapeMenuOpen) { setImageMenuOpen(false); setIconMenuOpen(false) }
            }}
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
                <button type="button" onClick={() => insertShapePreset('shape-pentagon')} title="五边形">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="12,2 22,9 18,22 6,22 2,9" />
                  </svg>
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-star')} title="五角星">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
                  </svg>
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-arrow-right')} title="右箭头">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="0,8 15,8 15,2 24,12 15,22 15,16 0,16" />
                  </svg>
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-arrow-double')} title="双向箭头">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="0,12 6,2 6,8 18,8 18,2 24,12 18,22 18,16 6,16 6,22" />
                  </svg>
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-callout-oval')} title="圆角对话气泡">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="12" cy="10" rx="10" ry="8" />
                    <path d="M7 17l-3 4 1-5" />
                  </svg>
                </button>
                <button type="button" onClick={() => insertShapePreset('shape-callout-rect')} title="矩形对话气泡">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="4" width="16" height="16" rx="3" />
                    <path d="M6 10l-4 2 4 2" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div style={{ position: 'relative' }} ref={imageMenuRef}>
          <button 
            className={`toolbar-pill ${isImageMenuOpen ? 'toolbar-pill--active' : ''}`} 
            onClick={() => {
              setImageMenuOpen(!isImageMenuOpen)
              if (!isImageMenuOpen) { setShapeMenuOpen(false); setIconMenuOpen(false) }
            }}
          >
            <FileImage size={16} />
            <span>图片</span>
          </button>
          
          {isImageMenuOpen && (
            <div className="toolbar-shape-popover" style={{ width: '280px', display: 'flex', flexDirection: 'column' }}>
              {/* Tabs Section */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(15, 23, 42, 0.08)' }}>
                <button 
                  style={{ 
                    flex: 1, 
                    padding: '12px 0', 
                    fontSize: '12px', 
                    fontWeight: 600,
                    color: imageTab === 'local' ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: imageTab === 'local' ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setImageTab('local')}
                >
                  本地文件
                </button>
                <button 
                  style={{ 
                    flex: 1, 
                    padding: '12px 0', 
                    fontSize: '12px', 
                    fontWeight: 600,
                    color: imageTab === 'online' ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: imageTab === 'online' ? '2px solid var(--accent)' : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => setImageTab('online')}
                >
                  在线链接
                </button>
              </div>

              {/* Content Panel */}
              <div style={{ padding: '20px' }}>
                {imageTab === 'local' && (
                  <div 
                    style={{ 
                      border: '1px dashed rgba(15, 23, 42, 0.16)', 
                      borderRadius: '12px', 
                      height: '140px',
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '12px',
                      background: 'rgba(248, 250, 252, 0.6)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => imageUploadRef.current?.click()}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(10, 132, 255, 0.04)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(10, 132, 255, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(248, 250, 252, 0.6)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(15, 23, 42, 0.16)';
                    }}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                      <ImageIcon size={20} color="var(--accent)" />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>选择本地图片</p>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>支持拖拽或点击</p>
                    </div>
                    <input
                      ref={imageUploadRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleImageUpload}
                    />
                  </div>
                )}

                {imageTab === 'online' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                      <LinkIcon size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                      <input 
                        type="text" 
                        placeholder="https://..." 
                        style={{ 
                          width: '100%',
                          paddingLeft: '32px', 
                          paddingRight: '12px',
                          height: '36px', 
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          background: 'var(--surface-sunken)',
                          color: 'var(--text-primary)',
                          fontSize: '13px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleInsertImageUrl()
                        }}
                      />
                    </div>
                    <button 
                      className="toolbar-btn toolbar-btn--accent" 
                      style={{ width: '100%', justifyContent: 'center', height: '36px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                      onClick={handleInsertImageUrl}
                      disabled={!imageUrl.trim()}
                    >
                      插入图片
                    </button>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '12px', background: 'rgba(15, 23, 42, 0.03)', borderRadius: '8px' }}>
                      <ImageIcon size={14} color="var(--text-muted)" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        链接的图片不会被保存到您的本地浏览器缓存中。请确保链接长期有效。
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Icon Picker Menu */}
        <div style={{ position: 'relative' }} ref={iconMenuRef}>
          <button
            className={`toolbar-pill ${isIconMenuOpen ? 'toolbar-pill--active' : ''}`}
            onClick={() => {
              setIconMenuOpen(!isIconMenuOpen)
              if (!isIconMenuOpen) { setShapeMenuOpen(false); setImageMenuOpen(false) }
            }}
          >
            <Smile size={16} />
            <span>图标</span>
          </button>

          {isIconMenuOpen && (
            <div className="toolbar-shape-popover" style={{ padding: 0, overflow: 'hidden' }}>
              <IconPicker
                onSelect={(iconName) => {
                  insertBlock('icon', { content: iconName })
                  setIconMenuOpen(false)
                }}
              />
            </div>
          )}
        </div>

        <button className="toolbar-pill" onClick={() => insertBlock('table')}>
          <Table2 size={16} />
          <span>表格</span>
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-section toolbar-section--end">
        <button
          className="toolbar-btn toolbar-btn--compact toolbar-btn--play"
          onClick={() => togglePlayMode(true)}
        >
          <Play size={16} />
          <span>播放</span>
        </button>
      </div>

      <TarotPresetModal
        open={isTarotModalOpen}
        onClose={() => setTarotModalOpen(false)}
        onInsert={handleInsertTarotShowcase}
      />
    </header>
  )
}
