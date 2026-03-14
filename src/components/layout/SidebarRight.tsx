import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Italic,
  Lock,
  LockOpen,
  Pause,
  Play,
  Trash2,
  Underline,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { previewBlockPhase, restoreBlockAfterPreview } from '../../lib/animation-runtime'
import {
  ANIMATION_PHASE_OPTIONS,
  getBlockAnimations,
  getEffectLabel,
  getEffectOptions,
  getPhaseLabel,
  getSlideBuildOrder,
  getTriggerLabel,
} from '../../lib/animations'
import {
  BACKGROUND_OPTIONS,
  LAYOUT_OPTIONS,
  TRANSITION_OPTIONS,
} from '../../lib/presentation'
import { useEditorStore } from '../../store'
import type { AnimationPhase, TriggerType } from '../../types/editor'

function isEditableTarget() {
  const target = document.activeElement as HTMLElement | null
  return Boolean(target?.isContentEditable)
}

function runRichTextCommand(command: string) {
  if (isEditableTarget()) {
    document.execCommand(command, false)
  }
}

export function SidebarRight() {
  const {
    slides,
    currentSlideId,
    activeBlockId,
    activeInspector,
    setActiveInspector,
    applySlideLayout,
    updateSlide,
    updateBlock,
    updateBlockAnimation,
    moveBlockAnimation,
    deleteBlock,
    setActiveBlock,
  } = useEditorStore()

  const currentSlide = slides.find((slide) => slide.id === currentSlideId)
  const activeBlock = currentSlide?.blocks.find((block) => block.id === activeBlockId)
  const buildOrder = currentSlide ? getSlideBuildOrder(currentSlide) : []

  const [formatTab, setFormatTab] = useState<'style' | 'text' | 'arrange'>('text')
  const [animationTab, setAnimationTab] = useState<AnimationPhase>('buildIn')
  const [isBuildOrderModalOpen, setBuildOrderModalOpen] = useState(false)
  const [previewLoopKey, setPreviewLoopKey] = useState<string | null>(null)
  const activeAnimations = activeBlock ? getBlockAnimations(activeBlock) : null
  const activeAnimation = activeAnimations?.[animationTab] ?? null
  const activeActionAnimation = animationTab === 'action' ? activeAnimations?.action ?? null : null
  const previewRef = useRef<{
    key: string
    element: HTMLElement
    block: typeof activeBlock
  } | null>(null)
  const currentPreviewKey = activeBlock ? `${activeBlock.id}:${animationTab}` : null
  const isCurrentLoopPreviewing = currentPreviewKey !== null && previewLoopKey === currentPreviewKey

  useEffect(() => {
    if (!isBuildOrderModalOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        setBuildOrderModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isBuildOrderModalOpen])

  const stopActivePreview = () => {
    if (!previewRef.current?.block) {
      previewRef.current = null
      setPreviewLoopKey(null)
      return
    }

    restoreBlockAfterPreview(previewRef.current.element, previewRef.current.block)
    previewRef.current = null
    setPreviewLoopKey(null)
  }

  useEffect(() => {
    return () => {
      stopActivePreview()
    }
  }, [activeBlockId, animationTab, currentSlideId])

  const handleInspectorChange = (tab: 'format' | 'animate' | 'document') => {
    if (tab !== 'animate') {
      stopActivePreview()
      setBuildOrderModalOpen(false)
    }

    setActiveInspector(tab)
  }

  const handlePreviewCurrentAnimation = () => {
    if (!activeBlock) {
      return
    }

    const slideContent = document.getElementById('slideContent')
    const element = Array.from(slideContent?.querySelectorAll<HTMLElement>('.editor-block') ?? []).find(
      (candidate) => candidate.dataset.blockId === activeBlock.id,
    )
    if (!element) {
      return
    }

    if (isCurrentLoopPreviewing) {
      stopActivePreview()
      return
    }

    stopActivePreview()
    const didStartPreview = previewBlockPhase(element, activeBlock, animationTab)
    if (!didStartPreview) {
      return
    }

    if (animationTab === 'action' && activeActionAnimation?.loop && currentPreviewKey) {
      previewRef.current = {
        key: currentPreviewKey,
        element,
        block: activeBlock,
      }
      setPreviewLoopKey(currentPreviewKey)
    }
  }

  const updateCurrentAnimation = (
    updates: Partial<{
      effect: string
      trigger: TriggerType
      duration: number
      delay: number
      order: number
      loop: boolean
    }>,
  ) => {
    if (!currentSlide || !activeBlock) {
      return
    }

    stopActivePreview()
    updateBlockAnimation(currentSlide.id, activeBlock.id, animationTab, updates)
  }

  return (
    <>
      <aside className="sidebar sidebar-right sidebar-right--inspector">
        <div className="sidebar-tabs sidebar-tabs--inspector">
          <button
            className={activeInspector === 'format' ? 'is-active' : ''}
            onClick={() => handleInspectorChange('format')}
          >
            格式
          </button>
          <button
            className={activeInspector === 'animate' ? 'is-active' : ''}
            onClick={() => handleInspectorChange('animate')}
          >
            动画
          </button>
          <button
            className={activeInspector === 'document' ? 'is-active' : ''}
            onClick={() => handleInspectorChange('document')}
          >
            文稿
          </button>
        </div>

        <div className="sidebar-scroll">
        {activeInspector === 'document' && currentSlide && (
          <>
            <section className="inspector-card">
              <h3>布局</h3>
              <label className="field">
                <span>幻灯片布局</span>
                <select
                  value={currentSlide.layout}
                  onChange={(event) =>
                    applySlideLayout(currentSlide.id, event.target.value as typeof currentSlide.layout)
                  }
                >
                  {LAYOUT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="empty-copy">切换布局会重新应用该页的占位与默认内容。</p>
            </section>

            <section className="inspector-card">
              <h3>背景</h3>
              <label className="field">
                <span>页面背景</span>
                <select
                  value={currentSlide.bg}
                  onChange={(event) =>
                    updateSlide(currentSlide.id, {
                      bg: event.target.value as typeof currentSlide.bg,
                    })
                  }
                >
                  {BACKGROUND_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="inspector-card">
              <h3>转场</h3>
              <label className="field">
                <span>效果</span>
                <select
                  value={currentSlide.transition}
                  onChange={(event) =>
                    updateSlide(currentSlide.id, {
                      transition: event.target.value as typeof currentSlide.transition,
                    })
                  }
                >
                  {TRANSITION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>时长</span>
                <div className="range-with-value">
                  <input
                    type="range"
                    min="0.3"
                    max="1.8"
                    step="0.1"
                    value={currentSlide.transitionDuration}
                    onChange={(event) =>
                      updateSlide(currentSlide.id, {
                        transitionDuration: Number(event.target.value),
                      })
                    }
                  />
	                  <span className="range-value">{formatDuration(currentSlide.transitionDuration)}</span>
                </div>
              </label>
            </section>
          </>
        )}

        {activeInspector === 'format' && (
          <>
            {!activeBlock || !currentSlide ? (
              <section className="inspector-card">
                <h3>格式</h3>
                <p className="empty-copy">
                  先在画布中选中一个对象。文本可双击进入编辑，拖动对象可移动位置。
                </p>
              </section>
            ) : (
              <>
                <div className="sidebar-tabs sidebar-tabs--sub">
                  <button
                    className={formatTab === 'style' ? 'is-active' : ''}
                    onClick={() => setFormatTab('style')}
                  >
                    样式
                  </button>
                  <button
                    className={formatTab === 'text' ? 'is-active' : ''}
                    onClick={() => setFormatTab('text')}
                  >
                    文本
                  </button>
                  <button
                    className={formatTab === 'arrange' ? 'is-active' : ''}
                    onClick={() => setFormatTab('arrange')}
                  >
                    排列
                  </button>
                </div>

                {formatTab === 'text' && (
                  <section className="inspector-card inspector-card--kn">
                  <h3>字体</h3>
                  <div className="kn-font-family">
                    <select
                      value={activeBlock.appearance.fontFamily || 'Helvetica Neue'}
                      onChange={(event) => updateBlock(currentSlide.id, activeBlock.id, { appearance: { fontFamily: event.target.value }})}
                    >
                      <option value="Helvetica Neue">Helvetica Neue</option>
                      <option value="PingFang SC">PingFang SC</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                    </select>
                  </div>
                  
                  <div className="kn-font-style-row">
                    <select
                      value={activeBlock.appearance.fontWeight || 'normal'}
                      onChange={(event) => updateBlock(currentSlide.id, activeBlock.id, { appearance: { fontWeight: event.target.value }})}
                    >
                      <option value="normal">常规</option>
                      <option value="bold">粗体</option>
                    </select>
                    <div className="kn-number-input">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={activeBlock.appearance.fontSize}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            appearance: { fontSize: Number(event.target.value) },
                          })
                        }
                      />
                      <span>pt</span>
                      <div className="kn-stepper">
                        <button onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { fontSize: activeBlock.appearance.fontSize + 1 }})}>▴</button>
                        <button onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { fontSize: Math.max(1, activeBlock.appearance.fontSize - 1) }})}>▾</button>
                      </div>
                    </div>
                  </div>

                  <div className="kn-style-tools">
                    <button className="kn-style-btn"><div className="kn-dot"></div></button>
                    <button
                      className={`kn-style-btn ${activeBlock.appearance.fontWeight === 'bold' ? 'is-active' : ''}`}
                      onMouseDown={() => runRichTextCommand('bold')}
                      onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { fontWeight: activeBlock.appearance.fontWeight === 'bold' ? 'normal' : 'bold' }})}
                    >
                      <Bold size={14} />
                    </button>
                    <button
                      className={`kn-style-btn ${activeBlock.appearance.fontStyle === 'italic' ? 'is-active' : ''}`}
                      onMouseDown={() => runRichTextCommand('italic')}
                      onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { fontStyle: activeBlock.appearance.fontStyle === 'italic' ? 'normal' : 'italic' }})}
                    >
                      <Italic size={14} />
                    </button>
                    <button
                      className={`kn-style-btn ${activeBlock.appearance.textDecoration === 'underline' ? 'is-active' : ''}`}
                      onMouseDown={() => runRichTextCommand('underline')}
                      onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { textDecoration: activeBlock.appearance.textDecoration === 'underline' ? 'none' : 'underline' }})}
                    >
                      <Underline size={14} />
                    </button>
                    <button className="kn-style-btn kn-style-btn--settings">⚙</button>
                  </div>
                  
                  <div className="kn-property-row mt-4">
                    <span className="kn-label">文本颜色</span>
                    <div className="kn-color-picker-wrap">
                      <input
                        type="color"
                        className="kn-color-input"
                        value={normalizeColor(activeBlock.appearance.textColor)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            appearance: { textColor: event.target.value },
                          })
                        }
                      />
                      <div className="kn-color-wheel-icon"></div>
                    </div>
                  </div>

                  <div className="kn-align-grid mt-4">
                    <div className="kn-align-row">
                      <button
                        className={`kn-align-btn ${activeBlock.appearance.textAlign === 'left' ? 'is-active' : ''}`}
                        onMouseDown={() => runRichTextCommand('justifyLeft')}
                        onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { textAlign: 'left' } })}
                      >
                        <AlignLeft size={16} />
                      </button>
                      <button
                        className={`kn-align-btn ${activeBlock.appearance.textAlign === 'center' ? 'is-active' : ''}`}
                        onMouseDown={() => runRichTextCommand('justifyCenter')}
                        onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { textAlign: 'center' } })}
                      >
                        <AlignCenter size={16} />
                      </button>
                      <button
                        className={`kn-align-btn ${activeBlock.appearance.textAlign === 'right' ? 'is-active' : ''}`}
                        onMouseDown={() => runRichTextCommand('justifyRight')}
                        onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { textAlign: 'right' } })}
                      >
                        <AlignRight size={16} />
                      </button>
                      <button
                        className={`kn-align-btn ${activeBlock.appearance.textAlign === 'justify' ? 'is-active' : ''}`}
                        onMouseDown={() => runRichTextCommand('justifyFull')}
                        onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { textAlign: 'justify' } })}
                      >
                        ≡
                      </button>
                    </div>
                    <div className="kn-align-row">
                      <button
                        className={`kn-align-btn ${activeBlock.appearance.verticalAlign === 'top' ? 'is-active' : ''}`}
                        onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { verticalAlign: 'top' }})}
                      >
                        ↑
                      </button>
                      <button
                        className={`kn-align-btn ${activeBlock.appearance.verticalAlign === 'middle' ? 'is-active' : ''}`}
                        onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { verticalAlign: 'middle' }})}
                      >
                        ↕
                      </button>
                      <button
                        className={`kn-align-btn ${activeBlock.appearance.verticalAlign === 'bottom' ? 'is-active' : ''}`}
                        onClick={() => updateBlock(currentSlide.id, activeBlock.id, { appearance: { verticalAlign: 'bottom' }})}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                </section>
                )}

                {formatTab === 'style' && (
                  <section className="inspector-card">
                  <h3>样式</h3>
                  <div className="field-grid">
                    <label className="field">
                      <span>填充</span>
                      <input
                        type="color"
                        value={normalizeColor(activeBlock.appearance.fill)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            appearance: { fill: event.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>描边</span>
                      <input
                        type="color"
                        value={normalizeColor(activeBlock.appearance.stroke)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            appearance: { stroke: event.target.value },
                          })
                        }
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>透明度</span>
                    <div className="range-with-value">
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={activeBlock.opacity}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            opacity: Number(event.target.value),
                          })
                        }
                      />
                      <span className="range-value">{Math.round(activeBlock.opacity * 100)}%</span>
                    </div>
                  </label>

                  <label className="field">
                    <span>圆角</span>
                    <div className="range-with-value">
                      <input
                        type="range"
                        min="0"
                        max="60"
                        step="1"
                        value={activeBlock.appearance.radius}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            appearance: { radius: Number(event.target.value) },
                          })
                        }
                      />
                      <span className="range-value">{activeBlock.appearance.radius}</span>
                    </div>
                  </label>
                </section>
                )}

                {formatTab === 'arrange' && (
                  <section className="inspector-card">
                  <h3>排列</h3>
                  <div className="field-grid">
                    <label className="field">
                      <span>X</span>
                      <input
                        type="number"
                        value={Math.round(activeBlock.x)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            x: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Y</span>
                      <input
                        type="number"
                        value={Math.round(activeBlock.y)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            y: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>宽</span>
                      <input
                        type="number"
                        value={Math.round(activeBlock.width)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            width: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>高</span>
                      <input
                        type="number"
                        value={Math.round(activeBlock.height)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            height: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>旋转</span>
                    <div className="range-with-value">
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="1"
                        value={activeBlock.rotation}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            rotation: Number(event.target.value),
                          })
                        }
                      />
                      <span className="range-value">{activeBlock.rotation}°</span>
                    </div>
                  </label>

                  <div className="toggle-list">
                    <button
                      className={`toggle-chip ${activeBlock.appearance.shadow ? 'is-on' : ''}`}
                      onClick={() =>
                        updateBlock(currentSlide.id, activeBlock.id, {
                          appearance: { shadow: !activeBlock.appearance.shadow },
                        })
                      }
                    >
                      阴影
                    </button>
                    <button
                      className={`toggle-chip ${activeBlock.locked ? 'is-on' : ''}`}
                      onClick={() =>
                        updateBlock(currentSlide.id, activeBlock.id, {
                          locked: !activeBlock.locked,
                        })
                      }
                    >
                      {activeBlock.locked ? <Lock size={14} /> : <LockOpen size={14} />}
                      <span>锁定</span>
                    </button>
                    <button
                      className={`toggle-chip ${activeBlock.hidden ? 'is-on' : ''}`}
                      onClick={() =>
                        updateBlock(currentSlide.id, activeBlock.id, {
                          hidden: !activeBlock.hidden,
                        })
                      }
                    >
                      {activeBlock.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>隐藏</span>
                    </button>
                    <button
                      className="toggle-chip toggle-chip--danger"
                      onClick={() => deleteBlock(currentSlide.id, activeBlock.id)}
                    >
                      <Trash2 size={14} />
                      <span>删除</span>
                    </button>
                  </div>
                </section>
                )}
              </>
            )}
          </>
        )}

        {activeInspector === 'animate' && currentSlide && (
          <>
            <section className="inspector-card">
              <h3>页面转场</h3>
              <label className="field">
                <span>效果</span>
                <select
                  value={currentSlide.transition}
                  onChange={(event) =>
                    updateSlide(currentSlide.id, {
                      transition: event.target.value as typeof currentSlide.transition,
                    })
                  }
                >
                  {TRANSITION_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>时长</span>
                <div className="range-with-value">
                  <input
                    type="range"
                    min="0.3"
                    max="1.8"
                    step="0.1"
                    value={currentSlide.transitionDuration}
                    onChange={(event) =>
                      updateSlide(currentSlide.id, {
                        transitionDuration: Number(event.target.value),
                      })
                    }
                  />
	                  <span className="range-value">{formatDuration(currentSlide.transitionDuration)}</span>
                </div>
              </label>
            </section>

            <section className="inspector-card inspector-card--animation">
              <h3>对象动画</h3>

              {!activeBlock || !activeAnimation ? (
                <p className="empty-copy">先选中一个对象，再为它设置入场、动作或退场动画。</p>
              ) : (
                <>
                  <div className="animation-target-card">
                    <span className="animation-target-card__label">当前对象</span>
                    <strong>{activeBlock.name}</strong>
                    <p>
                      {getPhaseLabel(animationTab)}
                      {activeAnimation.effect === 'none'
                        ? ' · 尚未设置效果'
                        : ` · ${getEffectLabel(animationTab, activeAnimation.effect)}`}
                    </p>
                  </div>

                  <div className="animation-phase-tabs">
                    {ANIMATION_PHASE_OPTIONS.map((phase) => (
                      <button
                        key={phase.id}
                        className={animationTab === phase.id ? 'is-active' : ''}
                        onClick={() => setAnimationTab(phase.id)}
                      >
                        {phase.label}
                      </button>
                    ))}
                  </div>

                  {activeAnimation.effect === 'none' ? (
                    <div className="animation-empty-state">
                      <strong>
                        {ANIMATION_PHASE_OPTIONS.find((phase) => phase.id === animationTab)?.emptyLabel}
                      </strong>
                      <button
                        className="animation-add-btn"
                        onClick={() =>
                          updateCurrentAnimation({
                            effect: getDefaultEffectForPhase(animationTab),
                          })
                        }
                      >
                        添加效果
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="animation-summary-row">
                        <span className="animation-summary-chip">{getPhaseLabel(animationTab)}</span>
                        <span className="animation-summary-chip">
                          {getEffectLabel(animationTab, activeAnimation.effect)}
                        </span>
                        <span className="animation-summary-chip">
                          {getTriggerLabel(activeAnimation.trigger)}
                        </span>
                        {activeActionAnimation?.loop && (
                          <span className="animation-summary-chip">循环播放</span>
                        )}
                      </div>

                      <label className="field animation-field">
                        <span>效果类型</span>
                        <select
                          value={activeAnimation.effect}
                          onChange={(event) =>
                            updateCurrentAnimation({
                              effect: event.target.value,
                            })
                          }
                        >
                          {getEffectOptions(animationTab).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field animation-field">
                        <span>触发方式</span>
                        <select
                          value={activeAnimation.trigger}
                          onChange={(event) =>
                            updateCurrentAnimation({
                              trigger: event.target.value as TriggerType,
                            })
                          }
                        >
                          <option value="onClick">单击时</option>
                          <option value="withPrev">与上一项同时</option>
                          <option value="afterPrev">在上一项之后</option>
                        </select>
                      </label>

                      {activeActionAnimation && (
                        <div className="animation-toggle-row">
                          <div className="animation-toggle-copy">
                            <strong>循环播放</strong>
                            <p>持续重复，直到下一次动画、切页或退出播放。</p>
                          </div>
                          <button
                            className={`animation-switch ${activeActionAnimation.loop ? 'is-on' : ''}`}
                            aria-pressed={activeActionAnimation.loop}
                            onClick={() =>
                              updateCurrentAnimation({
                                loop: !activeActionAnimation.loop,
                              })
                            }
                          >
                            <span className="animation-switch__track" aria-hidden="true">
                              <span className="animation-switch__thumb" />
                            </span>
                            <span className="animation-switch__text">
                              {activeActionAnimation.loop ? '开启' : '关闭'}
                            </span>
                          </button>
                        </div>
                      )}

                      <div className="animation-slider-group">
                        <label className="animation-slider-card">
                          <div className="animation-slider-card__top">
                            <span>持续时间</span>
                            <strong>{formatDuration(activeAnimation.duration)}</strong>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="2"
                            step="0.1"
                            value={activeAnimation.duration}
                            onChange={(event) =>
                              updateCurrentAnimation({
                                duration: Number(event.target.value),
                              })
                            }
                          />
                        </label>

                        <label className="animation-slider-card">
                          <div className="animation-slider-card__top">
                            <span>延迟</span>
                            <strong>{formatDuration(activeAnimation.delay)}</strong>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1.5"
                            step="0.1"
                            value={activeAnimation.delay}
                            onChange={(event) =>
                              updateCurrentAnimation({
                                delay: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="animation-card-footer">
                        <span className="build-order-hint">
                          {activeAnimation.order ? `当前位于第 ${activeAnimation.order} 步` : '当前还未加入构建顺序'}
                        </span>
                        <div className="animation-card-actions">
                          <button
                            className={`animation-preview-btn ${isCurrentLoopPreviewing ? 'is-active' : ''}`}
                            onClick={handlePreviewCurrentAnimation}
                          >
                            {isCurrentLoopPreviewing ? <Pause size={14} /> : <Play size={14} />}
                            <span>{isCurrentLoopPreviewing ? '停止预览' : '预览效果'}</span>
                          </button>
                          <button
                            className="toggle-chip toggle-chip--danger"
                            onClick={() =>
                              updateCurrentAnimation({
                                effect: 'none',
                              })
                            }
                          >
                            移除效果
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </section>

            <section className="inspector-card inspector-card--animation-footer">
              <div className="animation-footer-copy">
                <h3>构建顺序</h3>
                <p>在独立面板中查看整页动画流程，并调整每一步的先后关系。</p>
              </div>
              <button
                className="build-order-launch"
                onClick={() => setBuildOrderModalOpen(true)}
              >
                打开构建顺序
              </button>
            </section>
          </>
        )}
        </div>
      </aside>

      {isBuildOrderModalOpen && currentSlide && (
        <BuildOrderModal
          activeBlockId={activeBlockId}
          animationTab={animationTab}
          buildOrder={buildOrder}
          onClose={() => setBuildOrderModalOpen(false)}
          onMove={(blockId, phase, direction) =>
            moveBlockAnimation(currentSlide.id, blockId, phase, direction)
          }
          onSelect={(blockId, phase) => {
            setActiveBlock(blockId)
            setActiveInspector('animate')
            setAnimationTab(phase)
          }}
          slideName={currentSlide.name}
        />
      )}
    </>
  )
}

function normalizeColor(value: string) {
  if (value.startsWith('#')) {
    return value
  }

  return '#ffffff'
}

function getDefaultEffectForPhase(phase: AnimationPhase) {
  return getEffectOptions(phase).find((option) => option.id !== 'none')?.id ?? 'none'
}

function formatDuration(value: number) {
  return `${value.toFixed(1)} 秒`
}

type BuildOrderModalProps = {
  activeBlockId: string | null
  animationTab: AnimationPhase
  buildOrder: ReturnType<typeof getSlideBuildOrder>
  onClose: () => void
  onMove: (blockId: string, phase: AnimationPhase, direction: -1 | 1) => void
  onSelect: (blockId: string, phase: AnimationPhase) => void
  slideName: string
}

function BuildOrderModal({
  activeBlockId,
  animationTab,
  buildOrder,
  onClose,
  onMove,
  onSelect,
  slideName,
}: BuildOrderModalProps) {
  return (
    <div className="build-order-modal-backdrop" onClick={onClose}>
      <div
        className="build-order-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="buildOrderModalTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="build-order-modal__header">
          <div className="build-order-modal__title-wrap">
            <span className="build-order-modal__eyebrow">动画编排</span>
            <h2 id="buildOrderModalTitle">构建顺序</h2>
            <p>{slideName}</p>
          </div>
          <button
            className="build-order-modal__close"
            onClick={onClose}
            aria-label="关闭构建顺序"
          >
            <X size={18} />
          </button>
        </div>

        {buildOrder.length === 0 ? (
          <div className="build-order-modal__empty">
            <strong>当前页面还没有任何对象动画</strong>
            <p>先为对象添加入场、动作或退场效果，再回来调整顺序。</p>
          </div>
        ) : (
          <div className="build-order-modal__list">
            {buildOrder.map((item, index) => (
              <div
                key={`${item.blockId}-${item.phase}`}
                className={`build-order-modal__item ${
                  item.blockId === activeBlockId && item.phase === animationTab ? 'is-active' : ''
                }`}
                onClick={() => onSelect(item.blockId, item.phase)}
              >
                <div className="build-order-modal__index">{index + 1}</div>
                <div className="build-order-modal__copy">
                  <div className="build-order-modal__topline">
                    <strong>{item.blockName}</strong>
                    <span className={`build-order-phase build-order-phase--${item.phase}`}>
                      {getPhaseLabel(item.phase)}
                    </span>
                  </div>
                  <div className="build-order-modal__meta">
                    <span>{getEffectLabel(item.phase, item.animation.effect)}</span>
                    <span>{getTriggerLabel(item.animation.trigger)}</span>
                    {'loop' in item.animation && item.animation.loop && <span>循环播放</span>}
                    <span>{formatDuration(item.animation.duration)}</span>
                  </div>
                </div>
                <div className="build-order-controls" onClick={(event) => event.stopPropagation()}>
                  <button
                    onClick={() => onMove(item.blockId, item.phase, -1)}
                    disabled={index === 0}
                    aria-label="上移"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => onMove(item.blockId, item.phase, 1)}
                    disabled={index === buildOrder.length - 1}
                    aria-label="下移"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
