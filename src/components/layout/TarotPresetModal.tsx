import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, LayoutGrid, Layers, Box, ArrowLeft, Plus } from 'lucide-react'
import { TarotShowcase } from '../shared/TarotShowcase'

type TarotPresetModalProps = {
  open: boolean
  onClose: () => void
  onInsert: () => void
}

const CATEGORIES = [
  { id: 'presets', label: '动态组件', icon: LayoutGrid },
  { id: 'spreads', label: '牌阵模式', icon: Layers },
  { id: 'collections', label: '套牌管理', icon: Box },
]

export function TarotPresetModal({ open, onClose, onInsert }: TarotPresetModalProps) {
  const [activeCategory, setActiveCategory] = useState('presets')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  if (!open || typeof document === 'undefined') {
    return null
  }

  const renderSidebar = () => (
    <div className="flex w-[240px] shrink-0 flex-col border-r border-black/5 bg-[#fcfcfd]">
      <div className="flex items-center gap-3 px-6 py-6 font-bold text-gray-900">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white shadow-md">
          <Sparkles size={16} />
        </div>
        <span className="tracking-tight">组件探索</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-4">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id)
                setSelectedPreset(null)
              }}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-black text-white shadow-md'
                  : 'text-gray-500 hover:bg-black/5 hover:text-gray-900'
              }`}
            >
              <Icon size={18} />
              {cat.label}
            </button>
          )
        })}
      </nav>


    </div>
  )

  const renderGrid = () => (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">
          {CATEGORIES.find((c) => c.id === activeCategory)?.label}
        </h1>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 text-gray-500 transition-colors hover:bg-black/10 hover:text-black"
        >
          <X size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {activeCategory === 'presets' ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* The primary working preset */}
            <div
              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:border-gray-300 hover:shadow-xl"
              onClick={() => setSelectedPreset('core-tarot')}
            >
              <div className="aspect-video relative flex items-center justify-center bg-[#07070c] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mix-blend-overlay" />
                <div className="flex gap-4 opacity-80 transition-all duration-500 group-hover:scale-105 group-hover:opacity-100">
                  <div className="h-24 w-16 rounded-lg border border-white/20 bg-white/5 backdrop-blur-md shadow-lg" />
                  <div className="h-24 w-16 -translate-y-4 rounded-lg border border-white/30 bg-white/10 backdrop-blur-md shadow-lg" />
                  <div className="h-24 w-16 rounded-lg border border-white/20 bg-white/5 backdrop-blur-md shadow-lg" />
                </div>
              </div>
              <div className="p-5">
                <h3 className="mb-1 text-lg font-bold tracking-tight text-gray-900">动态基础卡牌</h3>
                <p className="text-sm font-medium text-gray-500">支持翻开动效与自定义属性的三张卡牌预设。</p>
              </div>
            </div>

            {/* Placeholders for future dashboard elements */}
            <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 opacity-60">
              <div className="aspect-video relative flex items-center justify-center bg-gray-200">
                <Layers className="text-gray-400" size={32} />
              </div>
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-gray-900">凯尔特十字阵</h3>
                  <span className="rounded bg-black/5 px-2 py-0.5 text-[10px] font-bold text-gray-500">规划中</span>
                </div>
                <p className="text-sm font-medium text-gray-500">经典十张牌阵的完整空间动画布局。</p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 opacity-60">
              <div className="aspect-video relative flex items-center justify-center bg-gray-200">
                <Box className="text-gray-400" size={32} />
              </div>
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight text-gray-900">3D 流体卡背</h3>
                  <span className="rounded bg-black/5 px-2 py-0.5 text-[10px] font-bold text-gray-500">规划中</span>
                </div>
                <p className="text-sm font-medium text-gray-500">基于 WebGL 渲染的可实时交互的高级背面材质。</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              {activeCategory === 'spreads' ? <Layers size={24} /> : <Box size={24} />}
            </div>
            <h3 className="text-lg font-bold text-gray-900">暂无可用资源</h3>
            <p className="text-sm text-gray-500">此分类下的组件将于后续版本通过商店提供下载。</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderPreview = () => (
    <div className="relative flex flex-1 flex-col bg-[#07070c]">
      <div className="absolute left-6 top-6 z-[100] flex items-center gap-3">
        <button
          onClick={() => setSelectedPreset(null)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <TarotShowcase mode="preview" enableKeyboard onEscape={() => setSelectedPreset(null)} showKeyboardHint />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[100] flex items-center justify-between gap-4 border-t border-white/10 bg-black/60 px-8 py-5 backdrop-blur-xl">
        <p className="text-sm font-medium text-white/60">
          插入后可在右侧继续修改卡面文案、图片、以及翻牌入场方式。
        </p>

        <button
          type="button"
          className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          onClick={onInsert}
        >
          <Plus size={18} />
          添加到页面
        </button>
      </div>
    </div>
  )

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4 xl:p-8">
      <button
        type="button"
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={onClose}
        aria-label="关闭弹窗"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[min(90vh,900px)] w-full max-w-[1240px] overflow-hidden rounded-[2rem] bg-[#f8f8fa] shadow-[0_40px_140px_rgba(0,0,0,0.4)] ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {!selectedPreset && renderSidebar()}
        {selectedPreset ? renderPreview() : renderGrid()}
      </div>
    </div>,
    document.body,
  )
}
