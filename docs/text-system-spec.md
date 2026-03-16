# Text System Rewrite Spec

## Goal

把当前编辑器里的文字系统重做成接近 Keynote 的行为。重点不是“把某个按钮修好”，而是把以下链路做成一套稳定系统：

1. 对象选中
2. 双击进入文字编辑
3. 选中文字
4. 右侧 Inspector 修改文字属性
5. 画布实时预览
6. 选区保持可继续编辑
7. 退出编辑后数据稳定保存

当前实现最大的问题不是单点 bug，而是：

1. 文字编辑态由局部组件和 DOM 焦点临时推断，状态不稳定。
2. 选区信息在点击 sidebar / color panel / stepper 后容易丢失。
3. 选中文字的操作和整块文字对象的操作没有清晰分层。
4. 渲染层把 block 级文字样式和选区内局部样式混在一起，导致局部样式经常被覆盖。
5. 使用 `document.execCommand` 做核心编辑链路，导致行为不可控。

这个文档的目标，是给出一套完整替代方案。

## Non-Goals

这次重做不要求：

1. 先支持协同编辑
2. 先支持撤销栈重写
3. 先支持 markdown / ProseMirror / Slate 级别的复杂 schema

但要保证当前产品里所有已有文字相关功能都能落到新系统上。

## Required User Experience

### 1. 对象态 vs 文字编辑态

必须把一个文字块分成两种清晰状态：

1. `object-selected`
2. `text-editing`

规则：

1. 单击文字块：选中对象，不进入文字编辑。
2. 双击文字块：进入文字编辑态。
3. 文字编辑态下：
   - 光标是 `text`
   - 不显示普通 transform handles
   - 不显示删除 chip
   - 点文字内部不会重新触发对象选择逻辑
4. 退出文字编辑态：
   - 点击空白画布
   - 选择别的对象
   - 进入多选
   - 切换幻灯片
   - 播放模式
   - `Esc`

### 2. 选中文字后的 Inspector 行为

当用户在文字编辑态下选中了局部文字：

1. 右侧 Inspector 显示当前选区的真实属性
2. 修改 Inspector 只作用于当前选区
3. 修改完成后，选区仍然可继续操作
4. 不允许“改一次后选区丢失”
5. 不允许“第一次改成功，第二次变成整块”

### 3. 插入点行为

当用户没有选中范围，只有插入点时：

1. Inspector 显示插入点所在位置的实际文字属性
2. 修改 Inspector 后，不应该回头改整段历史文字
3. 这些属性应该变成“接下来输入文字的 typing style”

也就是说：

1. 有 range selection：改选区
2. 只有 caret：改 typing style
3. 非文字编辑态：改整个 block 默认文字样式

## Functional Scope

### A. Block-Level Text Properties

这些是整个文字对象的默认样式：

1. `fontFamily`
2. `fontSize`
3. `fontWeight`
4. `fontStyle`
5. `textDecoration`
6. `textAlign`
7. `lineHeight`
8. `letterSpacing`
9. `textFill`
10. `textStrokeColor`
11. `textStrokeWidth`

适用时机：

1. 用户选中整个文字块，但没进入文字编辑
2. 用户进入文字编辑，但没有选区也没有 typing style 时，作为默认样式基线

### B. Selection-Level Text Properties

这些必须支持对选中文字单独修改：

1. 字体
2. 字号
3. 字重
4. 斜体
5. 下划线
6. 删除线
7. 填充
   - 纯色
   - 渐变
8. 描边
   - 开关
   - 颜色
   - 粗细
9. 行内对齐
   - 这里不是逐字对齐，而是所处段落的对齐

### C. Mixed State Display

如果选区里样式不统一：

1. 字体显示“混合”
2. 字号显示“混合”
3. 填充显示“混合”
4. 描边颜色或粗细不一致时显示“混合”
5. B / I / U / S 如果选区里有的开有的关，也要支持 mixed UI

Inspector 绝对不能在 mixed 情况下假装给出一个假的单值。

## State Model

必须引入一个明确的全局文字编辑会话状态，不允许只靠局部组件 state + DOM 焦点猜测。

建议结构：

```ts
type TextEditingSession = {
  blockId: string | null
  isEditing: boolean
  selection: {
    start: number
    end: number
    direction?: 'forward' | 'backward'
  } | null
  typingStyle: Partial<InlineTextStyle> | null
  lastKnownStyles: SelectedTextStyles | null
}
```

说明：

1. `blockId`
   当前正在编辑的文字块
2. `selection`
   不是直接存 DOM Range，而是存文本偏移
3. `typingStyle`
   caret 状态下，接下来输入文字应继承的样式
4. `lastKnownStyles`
   给 inspector 用的快照，避免 sidebar 点击后完全丢上下文

## DOM Model

### 1. Editable Root

每个文字块必须只有一个主要的 editable root。

例如：

```html
<h1 class="kn-heading" contenteditable="true">...</h1>
```

不要把多个互相独立的 contenteditable 拼在一个普通标题块里，除非它本身是 bullet / table 这类复杂组件。

### 2. Inline Markup Whitelist

允许在 editable 内生成的行内节点只应包括：

1. `span`
2. `strong`
3. `em`
4. `u`
5. `s`
6. `br`

推荐最终统一成 `span + style/data-*`，避免混用太多标签。

### 3. Normalization Rules

每次文字样式操作后都必须做 normalize：

1. 合并相邻且样式完全相同的 span
2. 删除空 span
3. 删除无样式 span
4. 禁止重复嵌套等价 span
5. 允许把 `strong/em/u/s` 归一成 style span

如果不做这一步，系统迟早会再次变回：

1. 操作一次还能用
2. 操作两三次 DOM 爆炸
3. 选区恢复开始失真
4. 文本布局开始裁切或错乱

## Mutation Rules

### 1. 对选区应用样式

不要再把核心链路建立在 `execCommand` 上。

正确做法：

1. 从保存的 offset selection 恢复出 Range
2. 将 Range 切分到合适边界
3. 对选区范围包裹或重写 inline span
4. normalize
5. 重新计算新的 selection offsets
6. 保存 HTML
7. 同步 inspector

### 2. 对 caret 应用样式

有 caret、没有 range 时：

1. 不要直接改整块 block
2. 不要依赖 `execCommand('foreColor')`、`fontName`、`fontSize`
3. 应该更新 `typingStyle`
4. 用户下一次输入文字时，把 typingStyle 应用到新插入文本

实现建议：

1. 在 `beforeinput` / `input` 阶段拦截插入
2. 把新输入文本包进带样式的 span
3. 再 normalize

### 3. Sidebar Interaction Rules

点击右侧 sidebar 时：

1. 不能清空文字编辑会话
2. 不能丢掉逻辑选区
3. 可以失去浏览器原生 focus
4. 但必须保留可恢复 selection offsets

不要做的事：

1. 每次 sidebar 操作后都强制 focus 回 contenteditable
2. 每次点按钮都把 active selection 改成 block selection
3. 因为 focus 不在 editable，就误判“现在不是文字编辑态”

### 4. Realtime Preview

所有这些操作都必须实时体现在画布上：

1. 字号
2. 字体
3. 字重
4. 填充
5. 描边颜色
6. 描边粗细
7. 行高
8. 字距

不能等：

1. blur
2. Enter
3. 第二次点击
4. 退出编辑

## Rendering Rules

### 1. Block Default Style vs Inline Override

block 默认文字样式和选区内局部样式必须分层：

1. block appearance 是默认值
2. inline span 是 override
3. inline 必须优先于 block default

### 2. Do Not Use Root-Level Hard Override

禁止在文字根节点上写这种破坏性规则：

1. `color: transparent !important`
2. 对整个 `[contenteditable]` 强制 `background-clip:text`
3. 对整个 `[contenteditable]` 强制 `-webkit-text-fill-color: transparent`

因为这会直接把局部纯色 / 局部描边 / 局部渐变全部盖掉。

更安全的做法是：

1. block 默认文字填充用普通继承色
2. 如果 block 默认就是渐变，给 root text container 一个默认渐变样式
3. 但 inline span 必须能覆盖这个默认样式
4. 不要用 `!important`

### 3. Text Fill and Stroke Model

建议统一成：

```ts
type InlineTextStyle = {
  color?: string
  textFill?: string
  textStrokeColor?: string
  textStrokeWidth?: number
  fontFamily?: string
  fontSize?: number
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
}
```

说明：

1. 纯色填充：`color`
2. 渐变填充：`textFill = linear-gradient(...)` + span 自己做 clip/text-fill
3. 描边：只作用于 span 本身，不走整个 block 根节点的强覆盖

## Auto Height Rules

文字块高度必须跟真实内容联动。

规则：

1. 局部文字变大时，block 自动增高
2. 局部文字变小时，允许收缩
3. 测量依据是真实渲染高度，不是旧 block height
4. 更新高度时不能要求 content HTML 一定变化

也就是说：

1. `height` 变化本身就应触发保存
2. 不能只在 `content !== oldContent` 时才更新 block

## Cursor and Visual Behavior

### 1. Cursor

1. 对象态：`move`
2. 文字编辑态的文字区：`text`
3. 文字编辑态的 block 外缘：可保留对象选框，但不要抢文字内部交互

### 2. Selection Highlight

需要两层概念：

1. 逻辑选区
2. 浏览器当前高亮

当 sidebar 拿走 focus 时：

1. 浏览器默认高亮可能变弱或消失
2. 但逻辑选区必须还在
3. inspector 继续对这段逻辑选区生效

如果要做得更像原生软件，可以后续补一层“自绘选区高亮”，但不是首要条件。

## Inspector Rules

### 1. Priority

Inspector 取值优先级：

1. 当前 range selection 的真实样式
2. 当前 caret 的 typing style / caret context style
3. 当前 block 的默认 appearance

### 2. Control Behavior

#### Font family / size / weight

1. 在 range selection 下修改选区
2. 在 caret 下修改 typing style
3. 在 object-selected 下修改 block 默认样式

#### Fill

1. 文本填充是字形本身，不是 block 背景
2. 支持纯色和渐变
3. 颜色系统必须支持 RGBA

#### Stroke

1. 文本描边是字形描边，不是 block border
2. 支持开关
3. 支持颜色
4. 支持粗细

#### Alignment

1. 文字编辑态下是段落对齐
2. 对象态下是整个文字块的默认对齐

## Keyboard Rules

至少应支持：

1. `Cmd/Ctrl+B`
2. `Cmd/Ctrl+I`
3. `Cmd/Ctrl+U`
4. `Esc` 退出编辑态
5. `Backspace/Delete` 在非编辑态删除对象
6. 文字编辑态下 Delete 不应该误删整个 block

## Data Persistence

保存时要持久化：

1. 规范化后的 HTML content
2. block 默认 appearance
3. 不要保存临时 DOM 结构垃圾

不要保存：

1. 临时 selection DOM
2. 脏的空 span
3. 重复 data-inline wrapper

## Recommended Implementation Plan

### Phase 1: Session Rewrite

先重做：

1. 全局 `TextEditingSession`
2. `EditorBlock` 进入/退出编辑态
3. selection offset 保存 / 恢复
4. Inspector 只认 session，不猜 DOM focus

### Phase 2: Inline Style Engine

再做：

1. range wrap/split/merge
2. normalize
3. selection-level fill / stroke / font operations

### Phase 3: Caret Typing Style

再做：

1. caret style state
2. 新输入文字继承 inspector 设置

### Phase 4: Rendering Cleanup

最后做：

1. 清掉 root-level text gradient / stroke 强覆盖
2. 保证 inline override 必胜
3. 修正 auto-height

## Acceptance Tests

以下用例全部必须通过：

### Test 1: 连续改选区颜色

1. 双击标题进入编辑
2. 选中 3 个字
3. 改成红色
4. 不重新选择，再改成渐变
5. 再改成纯白

预期：

1. 每次都只作用于这 3 个字
2. 选区始终还能继续操作
3. 不会第二次开始改整块

### Test 2: 连续手输字号

1. 双击进入编辑
2. 选中一句中的几个字
3. 在 sidebar 字号框输入 `36`
4. 再输入 `44`

预期：

1. 每次输入都实时预览
2. 输入框不会因为恢复焦点被打断
3. 选区仍然有效

### Test 3: 文本描边

1. 选中局部文字
2. 开启描边
3. 改描边色
4. 改描边粗细

预期：

1. 只影响局部文字
2. 不会把整个 block border 改掉
3. 不会影响未选中的字

### Test 4: caret style

1. 双击进入编辑
2. 只放一个插入点，不选区
3. 在 inspector 改成紫色 + 48pt
4. 输入新文字

预期：

1. 新输入文字是紫色 48pt
2. 旧文字不被回改

### Test 5: sidebar 交互不中断

1. 选中一段文字
2. 点击颜色弹层
3. 拖透明度
4. 切换渐变 tab
5. 改角度
6. 再切回字号输入框

预期：

1. 逻辑选区一直存在
2. 每一步都继续作用于同一选区
3. 不会突然掉回 block 级操作

### Test 6: auto height

1. 选中局部文字
2. 把字号改大到会换行

预期：

1. block 高度自动增长
2. 文字不会被裁切

## Hard Constraints

下面这些是明确不要再做的：

1. 不要继续把核心链路建立在 `execCommand` 上
2. 不要继续让 sidebar 通过“当前 focus 在不在 contenteditable”猜文字编辑态
3. 不要每次操作后都强行 focus 回 editable
4. 不要在 root `[contenteditable]` 上用 `!important` 强压颜色或渐变
5. 不要继续允许重复嵌套 span 无限制累积

## Suggested Files to Rewrite

优先重写或重构这些文件：

1. `src/components/editor/EditorBlock.tsx`
2. `src/components/editor/BlockRenderer.tsx`
3. `src/components/layout/SidebarRight.tsx`
4. `src/lib/rich-text.ts`
5. `src/store/index.ts`

## Final Standard

最终标准不是“按钮点击后偶尔能生效”，而是：

1. 用户在文字编辑态中，连续使用 inspector 改字体、字号、颜色、渐变、描边，整个过程不掉选区
2. Inspector 永远显示当前真实选区样式
3. 局部文字样式和 block 默认样式之间层级清晰
4. DOM 会被持续归一化，不会越改越脏
5. 体验接近 Keynote，而不是网页上的临时 contenteditable demo
