import { v4 as uuidv4 } from 'uuid'
import heroImage from '../assets/hero.png'
import {
  BUILD_IN_OPTIONS,
  createDefaultBlockAnimations,
  normalizeBlockAnimations,
  normalizeSlideAnimations,
} from './animations'
import type {
  BlockAppearance,
  EditorBlock,
  ElementType,
  PresentationSnapshot,
  PresentationTheme,
  Slide,
  SlideBg,
  SlideLayout,
} from '../types/editor'

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

export const THEME_OPTIONS: Array<{
  id: PresentationTheme
  label: string
  description: string
  defaultBg: Exclude<SlideBg, 'theme'>
}> = [
  { id: 'classic', label: '经典商务', description: '清晰的排版与强层级感，适合正式汇报。', defaultBg: 'paper' },
  { id: 'studio', label: '暗场发布', description: '深色背景与高对比度，适合大场面发布。', defaultBg: 'midnight' },
  { id: 'sunset', label: '日落余晖', description: '温暖的渐变色调，适合品牌故事。', defaultBg: 'sunset' },
  { id: 'paper', label: '简约白板', description: '中性浅灰色系，适合内容密集的展示。', defaultBg: 'paper' },
]

export const LAYOUT_OPTIONS: Array<{ id: SlideLayout; label: string; description: string }> = [
  { id: 'title', label: '标题页', description: '包含主标题、副标题及视觉重心。' },
  { id: 'section', label: '章节过渡', description: '用于划分演示文稿的不同段落。' },
  { id: 'two-column', label: '双栏内容', description: '左右对照，适合展示对比信息。' },
  { id: 'metrics', label: '数据指标', description: '突出数字卡片与核心图表。' },
  { id: 'media-left', label: '左图右文', description: '多媒体素材与文字说明并排展示。' },
  { id: 'blank', label: '空白页面', description: '自由画布，支持完全自定义布局。' },
]

export const BACKGROUND_OPTIONS: Array<{ id: SlideBg; label: string }> = [
  { id: 'theme', label: '跟随主题' },
  { id: 'aurora', label: '极光渐变' },
  { id: 'midnight', label: '深邃午夜' },
  { id: 'paper', label: '质感纸张' },
  { id: 'sunset', label: '暖色日落' },
  { id: 'spotlight', label: '聚光灯' },
]

export const TRANSITION_OPTIONS = [
  { id: 'magic', label: '神奇移动' },
  { id: 'fade', label: '淡入淡出' },
  { id: 'move-left', label: '向左平移' },
  { id: 'move-up', label: '向上推进' },
  { id: 'zoom', label: '缩放进入' },
  { id: 'dissolve', label: '溶解转场' },
] as const

export const ANIMATION_OPTIONS = BUILD_IN_OPTIONS

export const INSERT_OPTIONS: Array<{ id: ElementType; label: string; category: string }> = [
  { id: 'heading', label: '大标题', category: '文字' },
  { id: 'body', label: '正文', category: '文字' },
  { id: 'bullet', label: '项目列表', category: '文字' },
  { id: 'quote', label: '引用文字', category: '文字' },
  { id: 'shape-rect', label: '矩形', category: '图形' },
  { id: 'shape-rounded', label: '圆角矩形', category: '图形' },
  { id: 'shape-circle', label: '圆形', category: '图形' },
  { id: 'shape-triangle', label: '三角形', category: '图形' },
  { id: 'shape-diamond', label: '菱形', category: '图形' },
  { id: 'divider', label: '分割线', category: '图形' },
  { id: 'image', label: '图片', category: '媒体' },
  { id: 'video', label: '视频', category: '媒体' },
  { id: 'table', label: '数据表', category: '工具' },
  { id: 'chart', label: '统计图', category: '工具' },
  { id: 'stat', label: '数字卡片', category: '工具' },
  { id: 'timeline', label: '时间轴', category: '布局' },
  { id: '3d', label: '3D组件', category: '媒体' },
]

const baseAppearance = (textColor = '#f7f7fb'): BlockAppearance => ({
  fillType: 'color',
  fill: 'rgba(255, 255, 255, 0.08)',
  stroke: 'rgba(255, 255, 255, 0.14)',
  strokeWidth: 1,
  strokeStyle: 'solid',
  radius: 24,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  shadow: true,
  textColor,
  textStrokeColor: 'transparent',
  textStrokeWidth: 0,
  fontSize: 28,
  textAlign: 'left',
  fontFamily: 'Helvetica Neue',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  verticalAlign: 'top',
})

const baseTextAppearance = (textColor = '#f8fafc'): BlockAppearance => ({
  fillType: 'none',
  fill: 'transparent',
  stroke: 'transparent',
  strokeWidth: 0,
  strokeStyle: 'none',
  radius: 0,
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  shadow: false,
  textColor,
  textStrokeColor: 'transparent',
  textStrokeWidth: 0,
  fontSize: 28,
  textAlign: 'left',
  fontFamily: 'Helvetica Neue',
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  verticalAlign: 'top',
})

type BlockOverrides = Partial<Omit<EditorBlock, 'appearance'>> & {
  appearance?: Partial<BlockAppearance>
  src?: string
}

export function getThemeLabel(theme: PresentationTheme) {
  return THEME_OPTIONS.find((item) => item.id === theme)?.label ?? '主题'
}

export function getThemeDefaultBackground(theme: PresentationTheme): Exclude<SlideBg, 'theme'> {
  return THEME_OPTIONS.find((item) => item.id === theme)?.defaultBg ?? 'midnight'
}

export function resolveSlideBackground(theme: PresentationTheme, bg: SlideBg): Exclude<SlideBg, 'theme'> {
  if (bg !== 'theme') {
    return bg
  }

  return getThemeDefaultBackground(theme)
}

export function getLayoutLabel(layout: SlideLayout) {
  return LAYOUT_OPTIONS.find((item) => item.id === layout)?.label ?? '布局'
}

export function getBlockLabel(type: ElementType) {
  return INSERT_OPTIONS.find((item) => item.id === type)?.label ?? '构件'
}

export function getNextZIndex(blocks: EditorBlock[]) {
  return blocks.reduce((max, block) => Math.max(max, block.zIndex), 0) + 1
}

export function cloneBlock(block: EditorBlock, offset = 28): EditorBlock {
  return normalizeBlockAnimations({
    ...block,
    id: uuidv4(),
    groupId: null,
    name: `${block.name} 副本`,
    x: block.x + offset,
    y: block.y + offset,
    zIndex: block.zIndex + 1,
  })
}

export function cloneSlide(slide: Slide): Slide {
  return normalizeSlideAnimations({
    ...slide,
    id: uuidv4(),
    name: `${slide.name} 副本`,
    blocks: slide.blocks.map((block, index) => ({
      ...cloneBlock(block, 12 + index * 2),
      zIndex: block.zIndex,
    })),
  })
}

export function createInsertedBlock(
  type: ElementType,
  blocks: EditorBlock[],
  overrides?: BlockOverrides,
) {
  const block = createBlockPreset(type, overrides)

  return {
    ...block,
    x: overrides?.x ?? Math.round(SLIDE_WIDTH / 2 - block.width / 2 + blocks.length * 8),
    y: overrides?.y ?? Math.round(SLIDE_HEIGHT / 2 - block.height / 2 + blocks.length * 8),
    zIndex: getNextZIndex(blocks),
  }
}

export function createBlockPreset(type: ElementType, overrides: BlockOverrides = {}): EditorBlock {
  const preset = getPresetByType(type, overrides)
  const appearance = {
    ...preset.appearance,
    ...overrides.appearance,
  }

  return normalizeBlockAnimations(normalizeBlockAppearance({
    ...preset,
    ...overrides,
    appearance,
    id: overrides.id ?? uuidv4(),
    name: overrides.name ?? preset.name,
    animations: overrides.animations ?? preset.animations ?? createDefaultBlockAnimations({
      effect: overrides.anim ?? preset.anim,
      trigger: overrides.trigger ?? preset.trigger,
      duration: overrides.duration ?? preset.duration,
      delay: overrides.delay ?? preset.delay,
    }),
  }))
}

function getPresetByType(type: ElementType, overrides?: BlockOverrides): EditorBlock {
  switch (type) {
    case 'eyebrow':
      return {
        id: uuidv4(),
        name: '眉题',
        type,
        x: 96,
        y: 92,
        width: 300,
        height: 52,
        zIndex: 1,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-eyebrow" contenteditable="true">产品设计系统</div>',
        appearance: baseAppearance('#ffffff'),
        anim: 'fade-up',
        trigger: 'withPrev',
        duration: 0.7,
        delay: 0,
      }
    case 'heading':
      return {
        id: uuidv4(),
        name: '标题',
        type,
        x: 96,
        y: 150,
        width: 760,
        height: 170,
        zIndex: 2,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content:
          '<h1 class="kn-heading" contenteditable="true">把当前原型升级为更像 Keynote 的演示编辑器</h1>',
        appearance: {
          ...baseTextAppearance('#ffffff'),
          fontSize: 54,
          fontWeight: '700',
          lineHeight: 1.08,
          letterSpacing: -2,
        },
        anim: 'fade-up',
        trigger: 'onClick',
        duration: 0.8,
        delay: 0,
      }
    case 'subheading':
      return {
        id: uuidv4(),
        name: '副标题',
        type,
        x: 96,
        y: 318,
        width: 640,
        height: 82,
        zIndex: 3,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content:
          '<h2 class="kn-subheading" contenteditable="true">支持主题、页面布局、转场和构件动画</h2>',
        appearance: {
          ...baseTextAppearance('rgba(248, 250, 252, 0.72)'),
          fontSize: 24,
          fontWeight: '500',
          lineHeight: 1.28,
        },
        anim: 'fade-left',
        trigger: 'afterPrev',
        duration: 0.7,
        delay: 0,
      }
    case 'body':
      return {
        id: uuidv4(),
        name: '正文',
        type,
        x: 96,
        y: 420,
        width: 560,
        height: 140,
        zIndex: 4,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content:
          '<p class="kn-body" contenteditable="true">你可以双击任意文本直接编辑，使用右侧检视器修改颜色、阴影、圆角、层级与动画节奏。</p>',
        appearance: {
          ...baseTextAppearance('rgba(248, 250, 252, 0.72)'),
          fontSize: 18,
          lineHeight: 1.45,
        },
        anim: 'fade-up',
        trigger: 'withPrev',
        duration: 0.7,
        delay: 0.1,
      }
    case 'bullet':
      return {
        id: uuidv4(),
        name: '项目符号',
        type,
        x: 720,
        y: 180,
        width: 420,
        height: 240,
        zIndex: 5,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <div class="kn-bullet-card kn-surface">
            <div class="kn-card-label" contenteditable="true">关键能力</div>
            <ul class="kn-bullets-list">
              <li contenteditable="true">多页缩略图导航与布局模板</li>
              <li contenteditable="true">转场、构件动画与播放控制</li>
              <li contenteditable="true">导入导出与基础编辑流程</li>
            </ul>
          </div>
        `,
        appearance: {
          ...baseAppearance('#ffffff'),
          fontSize: 18,
        },
        anim: 'blur-in',
        trigger: 'onClick',
        duration: 0.8,
        delay: 0,
      }
    case 'quote':
      return {
        id: uuidv4(),
        name: '引用',
        type,
        x: 720,
        y: 430,
        width: 400,
        height: 180,
        zIndex: 6,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <blockquote class="kn-quote kn-surface">
            <p contenteditable="true">“一页一重点，把注意力交给叙事节奏。”</p>
            <footer contenteditable="true">你的演示原则</footer>
          </blockquote>
        `,
        appearance: baseAppearance('#ffffff'),
        anim: 'scale-in',
        trigger: 'afterPrev',
        duration: 0.8,
        delay: 0,
      }
    case 'stat':
      return {
        id: uuidv4(),
        name: '数字卡片',
        type,
        x: 96,
        y: 180,
        width: 300,
        height: 180,
        zIndex: 7,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <div class="kn-stat kn-surface">
            <div class="kn-stat-value" contenteditable="true">96%</div>
            <div class="kn-stat-label" contenteditable="true">转场与动画控制已补齐</div>
            <div class="kn-stat-foot" contenteditable="true">用于强调单一指标或里程碑</div>
          </div>
        `,
        appearance: baseAppearance('#ffffff'),
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'image':
      return {
        id: uuidv4(),
        name: '图片',
        type,
        x: overrides?.x ?? 820,
        y: overrides?.y ?? 110,
        width: overrides?.width ?? 400,
        height: overrides?.height ?? 300,
        zIndex: 8,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <img src="${overrides?.src || heroImage}" alt="图片" style="width: 100%; height: 100%; object-fit: fill; pointer-events: none; display: block;" />
        `,
        appearance: baseAppearance('transparent'),
        anim: 'scale-in',
        trigger: 'withPrev',
        duration: 0.8,
        delay: 0.1,
      }
    case 'video':
      return {
        id: uuidv4(),
        name: '视频占位',
        type,
        x: 200,
        y: 220,
        width: 520,
        height: 300,
        zIndex: 9,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <div class="kn-video kn-surface">
            <div class="kn-video-play"></div>
            <div class="kn-video-title" contenteditable="true">产品演示视频</div>
            <div class="kn-video-subtitle" contenteditable="true">用于模拟 Keynote 中的媒体占位与封面卡片</div>
          </div>
        `,
        appearance: baseAppearance('#ffffff'),
        anim: 'scale-in',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'table':
      return {
        id: uuidv4(),
        name: '表格',
        type,
        x: 700,
        y: 190,
        width: 460,
        height: 260,
        zIndex: 10,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <div class="kn-table-wrap kn-surface">
            <table class="kn-table">
              <thead>
                <tr>
                  <th contenteditable="true">模块</th>
                  <th contenteditable="true">状态</th>
                  <th contenteditable="true">说明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td contenteditable="true">导航</td>
                  <td contenteditable="true">已完成</td>
                  <td contenteditable="true">缩略图、复制、移动、跳过</td>
                </tr>
                <tr>
                  <td contenteditable="true">动画</td>
                  <td contenteditable="true">已完成</td>
                  <td contenteditable="true">构件动画与页面转场</td>
                </tr>
                <tr>
                  <td contenteditable="true">播放</td>
                  <td contenteditable="true">已完成</td>
                  <td contenteditable="true">全屏播放与翻页控制</td>
                </tr>
              </tbody>
            </table>
          </div>
        `,
        appearance: baseAppearance('#ffffff'),
        anim: 'blur-in',
        trigger: 'onClick',
        duration: 0.8,
        delay: 0,
      }
    case 'chart':
      return {
        id: uuidv4(),
        name: '图表',
        type,
        x: 760,
        y: 170,
        width: 380,
        height: 250,
        zIndex: 11,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <div class="kn-chart kn-surface">
            <div class="kn-card-label" contenteditable="true">功能完成度</div>
            <div class="kn-chart-row">
              <span contenteditable="true">编辑器</span>
              <strong style="width: 92%"></strong>
            </div>
            <div class="kn-chart-row">
              <span contenteditable="true">动画</span>
              <strong style="width: 88%"></strong>
            </div>
            <div class="kn-chart-row">
              <span contenteditable="true">播放模式</span>
              <strong style="width: 84%"></strong>
            </div>
          </div>
        `,
        appearance: baseAppearance('#ffffff'),
        anim: 'fade-left',
        trigger: 'afterPrev',
        duration: 0.7,
        delay: 0,
      }
    case 'timeline':
      return {
        id: uuidv4(),
        name: '时间线',
        type,
        x: 110,
        y: 480,
        width: 1030,
        height: 130,
        zIndex: 12,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <div class="kn-timeline kn-surface">
            <div class="kn-timeline-item">
              <span class="dot"></span>
              <strong contenteditable="true">梳理功能面</strong>
              <small contenteditable="true">界面、转场、导入导出</small>
            </div>
            <div class="kn-timeline-item">
              <span class="dot"></span>
              <strong contenteditable="true">重写状态层</strong>
              <small contenteditable="true">主题、布局、播放、排序</small>
            </div>
            <div class="kn-timeline-item">
              <span class="dot"></span>
              <strong contenteditable="true">补齐体验</strong>
              <small contenteditable="true">快捷键、缩放、缩略图与预览</small>
            </div>
          </div>
        `,
        appearance: baseAppearance('#ffffff'),
        anim: 'fade-up',
        trigger: 'afterPrev',
        duration: 0.8,
        delay: 0,
      }
    case 'shape-rect':
      return {
        id: uuidv4(),
        name: '矩形',
        type,
        x: 240,
        y: 220,
        width: 260,
        height: 140,
        zIndex: 13,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-box" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(129, 140, 248, 0.45), rgba(45, 212, 191, 0.32))',
          radius: 28,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'scale-in',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-rounded':
      return {
        id: uuidv4(),
        name: '圆角矩形',
        type,
        x: 250,
        y: 230,
        width: 240,
        height: 140,
        zIndex: 13,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-box kn-shape-rounded" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(59, 130, 246, 0.55), rgba(147, 51, 234, 0.45))',
          radius: 32,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'scale-in',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-circle':
      return {
        id: uuidv4(),
        name: '圆形',
        type,
        x: 260,
        y: 200,
        width: 180,
        height: 180,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-circle" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(244, 114, 182, 0.55), rgba(251, 191, 36, 0.36))',
          radius: 999,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-triangle':
      return {
        id: uuidv4(),
        name: '三角形',
        type,
        x: 280,
        y: 220,
        width: 160,
        height: 160,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-triangle" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(239, 68, 68, 0.65), rgba(249, 115, 22, 0.55))',
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-diamond':
      return {
        id: uuidv4(),
        name: '菱形',
        type,
        x: 280,
        y: 220,
        width: 160,
        height: 160,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-diamond" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(16, 185, 129, 0.55), rgba(20, 184, 166, 0.45))',
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-pentagon':
      return {
        id: uuidv4(),
        name: '五边形',
        type,
        x: 280,
        y: 220,
        width: 160,
        height: 155,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-pentagon" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(99, 102, 241, 0.65), rgba(168, 85, 247, 0.55))',
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-star':
      return {
        id: uuidv4(),
        name: '五角星',
        type,
        x: 280,
        y: 200,
        width: 160,
        height: 160,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-star" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(251, 191, 36, 0.8), rgba(245, 158, 11, 0.65))',
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-arrow-right':
      return {
        id: uuidv4(),
        name: '右箭头',
        type,
        x: 250,
        y: 230,
        width: 200,
        height: 120,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-arrow-right" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(59, 130, 246, 0.65), rgba(99, 102, 241, 0.55))',
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-arrow-double':
      return {
        id: uuidv4(),
        name: '双向箭头',
        type,
        x: 230,
        y: 240,
        width: 240,
        height: 120,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-arrow-double" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(34, 197, 94, 0.65), rgba(20, 184, 166, 0.55))',
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-callout-oval':
      return {
        id: uuidv4(),
        name: '椭圆气泡',
        type,
        x: 240,
        y: 200,
        width: 220,
        height: 180,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-callout-oval" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.12))',
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'shape-callout-rect':
      return {
        id: uuidv4(),
        name: '矩形气泡',
        type,
        x: 240,
        y: 200,
        width: 200,
        height: 160,
        zIndex: 14,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-shape-callout-rect" contenteditable="true"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.1))',
          radius: 12,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
    case 'divider':
      return {
        id: uuidv4(),
        name: '分隔线',
        type,
        x: 120,
        y: 350,
        width: 760,
        height: 24,
        zIndex: 15,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: '<div class="kn-divider"></div>',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'transparent',
          stroke: 'transparent',
          shadow: false,
          radius: 999,
        },
        anim: 'fade-left',
        trigger: 'withPrev',
        duration: 0.6,
        delay: 0,
      }
    case '3d':
      return {
        id: uuidv4(),
        name: '3D 组件',
        type,
        x: 740,
        y: 120,
        width: 420,
        height: 420,
        zIndex: 16,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: `
          <div class="kn-3d">
            <div class="kn-3d-ring ring-a"></div>
            <div class="kn-3d-ring ring-b"></div>
            <article class="kn-3d-card main-card">
              <span contenteditable="true">核心构件</span>
              <strong contenteditable="true">Keynote 式浮层</strong>
            </article>
            <article class="kn-3d-card side-card left-card">
              <span contenteditable="true">图层 A</span>
            </article>
            <article class="kn-3d-card side-card right-card">
              <span contenteditable="true">图层 B</span>
            </article>
          </div>
        `,
        appearance: baseAppearance('#ffffff'),
        anim: 'rotate-in',
        trigger: 'afterPrev',
        duration: 0.9,
        delay: 0,
      }
    case 'icon':
      return {
        id: uuidv4(),
        name: '图标',
        type,
        x: 280,
        y: 200,
        width: 160,
        height: 160,
        zIndex: 15,
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        content: overrides?.content ?? 'Star',
        appearance: {
          ...baseAppearance('#ffffff'),
          fill: 'transparent',
          stroke: 'transparent',
          shadow: false,
          radius: 0,
          textAlign: 'center',
          verticalAlign: 'middle',
        },
        anim: 'pop',
        trigger: 'onClick',
        duration: 0.7,
        delay: 0,
      }
  }
}

export function createSlideFromLayout(layout: SlideLayout, index: number, theme: PresentationTheme): Slide {
  const baseSlide: Slide = {
    id: uuidv4(),
    name: `${getLayoutLabel(layout)} ${index}`,
    layout,
    transition: layout === 'section' ? 'move-left' : layout === 'metrics' ? 'zoom' : 'magic',
    transitionDuration: 0.8,
    bg: layout === 'blank' ? 'theme' : layout === 'section' ? 'spotlight' : 'theme',
    notes: '',
    skipped: false,
    blocks: [],
  }

  if (layout === 'blank') {
    return baseSlide
  }

  if (layout === 'title') {
    return {
      ...baseSlide,
      notes: '',
      blocks: [
        createBlockPreset('eyebrow', { x: 470, y: 150, width: 340, appearance: { textAlign: 'center' }, content: '<div class="kn-eyebrow is-centered" contenteditable="true">产品发布演示</div>' }),
        createBlockPreset('heading', {
          x: 220,
          y: 235,
          width: 840,
          height: 130,
          appearance: { textAlign: 'center' },
          content:
            '<h1 class="kn-heading is-centered" contenteditable="true">Mac 版 Keynote 风格的演示编辑体验</h1>',
        }),
        createBlockPreset('subheading', {
          x: 280,
          y: 390,
          width: 720,
          height: 90,
          appearance: { textAlign: 'center' },
          content:
            '<h2 class="kn-subheading is-centered" contenteditable="true">聚焦编辑器结构、布局应用、动画、转场与基础操作流</h2>',
        }),
      ],
    }
  }

  if (layout === 'section') {
    return {
      ...baseSlide,
      bg: resolveSlideBackground(theme, 'spotlight'),
      notes: '',
      blocks: [
        createBlockPreset('eyebrow', {
          x: 470,
          y: 160,
          width: 340,
          appearance: { textAlign: 'center' },
          content: '<div class="kn-eyebrow is-centered" contenteditable="true">章节切页</div>',
        }),
        createBlockPreset('heading', {
          x: 250,
          y: 260,
          width: 780,
          height: 140,
          appearance: { textAlign: 'center' },
          content:
            '<h1 class="kn-heading is-centered" contenteditable="true">从原型走向完整演示文稿编辑器</h1>',
        }),
        createBlockPreset('subheading', {
          x: 320,
          y: 430,
          width: 640,
          height: 80,
          appearance: { textAlign: 'center' },
          content:
            '<h2 class="kn-subheading is-centered" contenteditable="true">布局、检视器、动画与播放全部纳入</h2>',
        }),
      ],
    }
  }

  if (layout === 'two-column') {
    return {
      ...baseSlide,
      notes: '',
      blocks: [
        createBlockPreset('heading', {
          x: 110,
          y: 82,
          width: 860,
          height: 110,
          content: '<h1 class="kn-heading" contenteditable="true">多栏内容页与数据页</h1>',
        }),
        createBlockPreset('body', {
          x: 110,
          y: 230,
          width: 420,
          height: 170,
          content:
            '<p class="kn-body" contenteditable="true">左侧适合放叙述、推导、清单或引用；右侧适合放表格、图片、图表与补充说明。</p>',
        }),
        createBlockPreset('bullet', { x: 110, y: 440, width: 420, height: 160 }),
        createBlockPreset('table', { x: 650, y: 220, width: 500, height: 250 }),
        createBlockPreset('quote', { x: 700, y: 500, width: 400, height: 100 }),
      ],
    }
  }

  if (layout === 'metrics') {
    return {
      ...baseSlide,
      bg: 'aurora',
      notes: '',
      blocks: [
        createBlockPreset('heading', {
          x: 110,
          y: 78,
          width: 760,
          height: 110,
          content: '<h1 class="kn-heading" contenteditable="true">指标总览与阶段结果</h1>',
        }),
        createBlockPreset('stat', { x: 110, y: 220 }),
        createBlockPreset('stat', {
          x: 430,
          y: 220,
          content: `
            <div class="kn-stat kn-surface">
              <div class="kn-stat-value" contenteditable="true">14</div>
              <div class="kn-stat-label" contenteditable="true">可插入构件类型</div>
              <div class="kn-stat-foot" contenteditable="true">文本、媒体、数据与装饰类型齐全</div>
            </div>
          `,
        }),
        createBlockPreset('stat', {
          x: 750,
          y: 220,
          content: `
            <div class="kn-stat kn-surface">
              <div class="kn-stat-value" contenteditable="true">6</div>
              <div class="kn-stat-label" contenteditable="true">页面转场</div>
              <div class="kn-stat-foot" contenteditable="true">覆盖常见演示节奏与发布会风格</div>
            </div>
          `,
        }),
        createBlockPreset('timeline', { x: 110, y: 470, width: 640, height: 120 }),
        createBlockPreset('chart', { x: 820, y: 470, width: 300, height: 150 }),
      ],
    }
  }

  return {
    ...baseSlide,
    notes: '',
    blocks: [
      createBlockPreset('image', { x: 110, y: 150, width: 460, height: 360, rotation: 0 }),
      createBlockPreset('heading', {
        x: 650,
        y: 160,
        width: 420,
        height: 110,
        content: '<h1 class="kn-heading" contenteditable="true">媒体页与版面配合</h1>',
      }),
      createBlockPreset('body', {
        x: 650,
        y: 300,
        width: 380,
        height: 120,
        content:
          '<p class="kn-body" contenteditable="true">这一类页面适合图像、产品截图、界面演示或视觉案例说明。</p>',
      }),
      createBlockPreset('bullet', { x: 650, y: 450, width: 380, height: 150 }),
    ],
  }
}

export function createDemoPresentation(): PresentationSnapshot {
  const theme: PresentationTheme = 'studio'
  const slides = [
    createSlideFromLayout('title', 1, theme),
    createSlideFromLayout('section', 2, theme),
    createSlideFromLayout('two-column', 3, theme),
    createSlideFromLayout('metrics', 4, theme),
    createSlideFromLayout('media-left', 5, theme),
  ]

  return {
    presentationName: '未命名 1',
    theme,
    slides: slides.map((slide) => normalizeSlideAnimations(slide)),
    currentSlideId: slides[0]?.id ?? null,
    showGrid: false,
    showGuides: false,
  }
}

function normalizeBlockAppearance(block: EditorBlock): EditorBlock {
  const boxModel = {
    marginTop: block.appearance.marginTop ?? 0,
    marginRight: block.appearance.marginRight ?? 0,
    marginBottom: block.appearance.marginBottom ?? 0,
    marginLeft: block.appearance.marginLeft ?? 0,
    paddingTop: block.appearance.paddingTop ?? 0,
    paddingRight: block.appearance.paddingRight ?? 0,
    paddingBottom: block.appearance.paddingBottom ?? 0,
    paddingLeft: block.appearance.paddingLeft ?? 0,
  }

  if (!['heading', 'subheading', 'body'].includes(block.type)) {
    return {
      ...block,
      appearance: {
        ...block.appearance,
        ...boxModel,
        fillType: block.appearance.fillType ?? (block.appearance.fill.startsWith('linear-gradient') ? 'gradient' : 'color'),
        strokeStyle: block.appearance.strokeStyle ?? (block.appearance.strokeWidth > 0 ? 'solid' : 'none'),
        textStrokeColor: block.appearance.textStrokeColor ?? 'transparent',
        textStrokeWidth: block.appearance.textStrokeWidth ?? 0,
      },
    }
  }

  const appearance = { ...block.appearance }
  const isLegacyTextBlock = appearance.fillType === undefined
  const normalized: BlockAppearance = {
    ...appearance,
    ...boxModel,
    fillType: isLegacyTextBlock ? 'none' : appearance.fillType ?? 'none',
    fill: isLegacyTextBlock ? 'transparent' : appearance.fill,
    strokeStyle: isLegacyTextBlock ? 'none' : appearance.strokeStyle ?? 'none',
    stroke: isLegacyTextBlock ? 'transparent' : appearance.stroke,
    strokeWidth: isLegacyTextBlock ? 0 : appearance.strokeWidth,
    radius: isLegacyTextBlock ? 0 : appearance.radius,
    shadow: isLegacyTextBlock ? false : appearance.shadow,
    textStrokeColor: appearance.textStrokeColor ?? 'transparent',
    textStrokeWidth: appearance.textStrokeWidth ?? 0,
  }

  if (block.type === 'heading') {
    if (appearance.fontSize === 28) normalized.fontSize = 54
    if (appearance.fontWeight === 'normal') normalized.fontWeight = '700'
    if (appearance.lineHeight == null) normalized.lineHeight = 1.08
    if (appearance.letterSpacing == null) normalized.letterSpacing = -2
  }

  if (block.type === 'subheading') {
    if (appearance.fontSize === 30) normalized.fontSize = 24
    if (appearance.fontWeight === 'normal') normalized.fontWeight = '500'
    if (appearance.lineHeight == null) normalized.lineHeight = 1.28
    if (appearance.textColor === 'rgba(255,255,255,0.92)') {
      normalized.textColor = 'rgba(248, 250, 252, 0.72)'
    }
  }

  if (block.type === 'body') {
    if (appearance.fontSize === 20) normalized.fontSize = 18
    if (appearance.lineHeight == null) normalized.lineHeight = 1.45
    if (appearance.textColor === 'rgba(247,247,251,0.82)') {
      normalized.textColor = 'rgba(248, 250, 252, 0.72)'
    }
  }

  return {
    ...block,
    appearance: normalized,
  }
}

export function normalizePresentationSnapshot(snapshot: PresentationSnapshot): PresentationSnapshot {
  const slides = snapshot.slides.map((slide) => normalizeSlideAnimations({
    ...slide,
    blocks: slide.blocks.map((block) => normalizeBlockAppearance(block)),
  }))

  // Ensure currentSlideId is always valid — fall back to first slide if stale or null.
  const currentSlideId = slides.some((s) => s.id === snapshot.currentSlideId)
    ? snapshot.currentSlideId
    : (slides[0]?.id ?? null)

  return {
    ...snapshot,
    slides,
    currentSlideId,
  }
}
