import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eye,
  EyeOff,
  Italic,
  Lock,
  LockOpen,
  Trash2,
  Underline,
} from 'lucide-react'
import {
  ANIMATION_OPTIONS,
  BACKGROUND_OPTIONS,
  LAYOUT_OPTIONS,
  TRANSITION_OPTIONS,
} from '../../lib/presentation'
import { useEditorStore } from '../../store'
import type { AnimationType, TriggerType } from '../../types/editor'

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
    deleteBlock,
  } = useEditorStore()

  const currentSlide = slides.find((slide) => slide.id === currentSlideId)
  const activeBlock = currentSlide?.blocks.find((block) => block.id === activeBlockId)

  return (
    <aside className="sidebar sidebar-right sidebar-right--inspector">
      <div className="sidebar-tabs sidebar-tabs--inspector">
        <button
          className={activeInspector === 'document' ? 'is-active' : ''}
          onClick={() => setActiveInspector('document')}
        >
          幻灯片
        </button>
        <button
          className={activeInspector === 'format' ? 'is-active' : ''}
          onClick={() => setActiveInspector('format')}
        >
          格式
        </button>
        <button
          className={activeInspector === 'animate' ? 'is-active' : ''}
          onClick={() => setActiveInspector('animate')}
        >
          动画
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
                <section className="inspector-card">
                  <h3>文本</h3>
                  <div className="command-row">
                    <button className="command-btn" onMouseDown={() => runRichTextCommand('bold')}>
                      <Bold size={14} />
                    </button>
                    <button className="command-btn" onMouseDown={() => runRichTextCommand('italic')}>
                      <Italic size={14} />
                    </button>
                    <button
                      className="command-btn"
                      onMouseDown={() => runRichTextCommand('underline')}
                    >
                      <Underline size={14} />
                    </button>
                    <button
                      className="command-btn"
                      onMouseDown={() => runRichTextCommand('justifyLeft')}
                      onClick={() =>
                        updateBlock(currentSlide.id, activeBlock.id, {
                          appearance: { textAlign: 'left' },
                        })
                      }
                    >
                      <AlignLeft size={14} />
                    </button>
                    <button
                      className="command-btn"
                      onMouseDown={() => runRichTextCommand('justifyCenter')}
                      onClick={() =>
                        updateBlock(currentSlide.id, activeBlock.id, {
                          appearance: { textAlign: 'center' },
                        })
                      }
                    >
                      <AlignCenter size={14} />
                    </button>
                    <button
                      className="command-btn"
                      onMouseDown={() => runRichTextCommand('justifyRight')}
                      onClick={() =>
                        updateBlock(currentSlide.id, activeBlock.id, {
                          appearance: { textAlign: 'right' },
                        })
                      }
                    >
                      <AlignRight size={14} />
                    </button>
                  </div>

                  <div className="field-grid">
                    <label className="field">
                      <span>字体颜色</span>
                      <input
                        type="color"
                        value={normalizeColor(activeBlock.appearance.textColor)}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            appearance: { textColor: event.target.value },
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>字号</span>
                      <input
                        type="number"
                        value={activeBlock.appearance.fontSize}
                        onChange={(event) =>
                          updateBlock(currentSlide.id, activeBlock.id, {
                            appearance: { fontSize: Number(event.target.value) },
                          })
                        }
                      />
                    </label>
                  </div>
                </section>

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
                  </label>

                  <label className="field">
                    <span>圆角</span>
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
                  </label>
                </section>

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
              </label>
            </section>

            {activeBlock && (
              <section className="inspector-card">
                <h3>对象动画</h3>
                <label className="field">
                  <span>效果</span>
                  <select
                    value={activeBlock.anim}
                    onChange={(event) =>
                      updateBlock(currentSlide.id, activeBlock.id, {
                        anim: event.target.value as AnimationType,
                      })
                    }
                  >
                    {ANIMATION_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>触发</span>
                  <select
                    value={activeBlock.trigger}
                    onChange={(event) =>
                      updateBlock(currentSlide.id, activeBlock.id, {
                        trigger: event.target.value as TriggerType,
                      })
                    }
                  >
                    <option value="onClick">单击时</option>
                    <option value="withPrev">与上一项同时</option>
                    <option value="afterPrev">在上一项之后</option>
                  </select>
                </label>
                <label className="field">
                  <span>持续时间</span>
                  <input
                    type="range"
                    min="0.2"
                    max="2"
                    step="0.1"
                    value={activeBlock.duration}
                    onChange={(event) =>
                      updateBlock(currentSlide.id, activeBlock.id, {
                        duration: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

function normalizeColor(value: string) {
  if (value.startsWith('#')) {
    return value
  }

  return '#ffffff'
}
