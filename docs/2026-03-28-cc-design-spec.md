# cc-design 设计规格文档

> AI 生成网站前的风格预览与选择系统

## 1. 问题与愿景

### 1.1 问题

使用 AI 创建网站时，用户无法预知生成效果。AI 直接生成完整代码，如果风格不满意只能推倒重来，浪费时间和 token。

### 1.2 愿景

cc-design 重新定义 AI 生成网站的交互流程：在 AI 真正开始生成代码之前，先提供多种 UI 风格的可视化预览供用户选择。用户"看到"并"选择"后，AI 才按照选定的风格生成代码。

### 1.3 核心价值

- **可预见性** — 用户在投入代码生成成本前就能看到效果
- **选择权** — 用户主导风格决策，而非 AI 单方面决定
- **效率** — 避免"生成→不满意→重来"的循环浪费

## 2. 产品形态

cc-design 是一个 **Claude Code / Cursor 插件包**，由两个组件构成：

| 组件 | 职责 | 技术 |
|------|------|------|
| **SKILL.md** | 流程编排 — 定义何时介入、引导 AI 生成风格预览、协调 MCP 交互 | Markdown 技能文件 |
| **MCP Server** | 预览服务 — 托管风格预览页面、收集用户选择、返回结果给 AI | Node.js + TypeScript |

## 3. 整体架构

```
用户："帮我做一个美食博客网站"
            │
            ▼
    ┌───────────────┐
    │   SKILL.md    │  ← 拦截请求，识别"需要创建 Web 应用"
    │  (流程编排)    │
    └───────┬───────┘
            │ 引导 AI 执行以下步骤：
            ▼
  ┌─────────────────────────┐
  │ Step 1: 理解需求          │  AI 分析应用类型、目标用户、功能模块
  │ Step 2: 生成风格变体       │  AI 生成 3-4 种完整 HTML/CSS 预览
  │ Step 3: 调用 MCP 工具     │  将预览 HTML 发送给 MCP Server
  └─────────┬───────────────┘
            │
            ▼
    ┌───────────────────┐
    │   MCP Server      │
    │  (Node.js/TS)     │
    │                   │
    │  ┌─────────────┐  │
    │  │ HTTP Server  │──┼──→ 浏览器：风格预览画廊页
    │  └─────────────┘  │         │
    │  ┌─────────────┐  │         │ 用户点击选择/请求更多
    │  │ MCP Tools   │  │         │
    │  │             │◄─┼─────────┘
    │  └─────────────┘  │
    └───────┬───────────┘
            │ 返回用户选择
            ▼
  ┌─────────────────────────┐
  │ Step 4: 确认选择          │  AI 收到选择结果
  │ Step 5: 持久化设计系统     │  保存到 .cc-design/design-system.json
  │ Step 6: 生成应用代码      │  AI 按照选中风格生成完整项目代码
  └─────────────────────────┘
```

### 3.1 设计原则

- **AI 全权负责创意** — AI 生成完整 HTML/CSS 预览，不受模板限制，充分发挥创造力
- **MCP Server 只负责展示和收集** — 接收 AI 生成的 HTML，包装成可交互画廊页，收集用户选择
- **支持循环** — 用户不满意可以要求再生成，历史风格保留，新风格追加

## 4. MCP Server 设计

### 4.1 MCP 工具定义

#### 工具 1：`create_style_preview`

AI 调用此工具将生成的风格预览提交给 Server。

```typescript
// 输入
{
  session_id?: string,         // 复用已有会话（追加模式），首次可不传
  app_description: string,     // 用户的应用描述
  round: number,               // 第几轮生成，从 1 开始
  round_label?: string,        // 本轮标签，如 "基于「Glassmorphism」"
  styles: [
    {
      id: string,              // 风格 ID，如 "style-1"
      name: string,            // 风格名称，如 "Warm Organic · 温暖有机"
      description: string,     // 一句话描述
      preview_html: string,    // 完整 HTML/CSS 预览代码
      design_system: {
        colors: {
          primary: string,
          secondary: string,
          accent: string,
          background: string,
          text: string
        },
        typography: {
          heading_font: string,
          body_font: string,
          google_fonts_url: string
        },
        border_radius: string,
        shadow_style: string,
        layout_pattern: string,
        effects: string,
        anti_patterns: string[]
      }
    }
    // ... 3-4 个风格
  ]
}

// 输出
{
  session_id: string,          // 会话 ID（首次生成时返回）
  preview_url: string,         // 预览页面 URL，如 "http://localhost:52680"
  total_styles: number         // 当前画廊中的风格总数（含历史轮次）
}
```

#### 工具 2：`get_user_selection`

AI 调用此工具获取用户的选择结果。

```typescript
// 输入
{
  session_id: string
}

// 输出（三种可能）
// 1. 用户已选择
{
  status: "selected",
  selected_style: {
    id: string,
    name: string,
    design_system: { ... }     // 完整风格定义，AI 直接用于代码生成
  }
}

// 2. 用户请求再生成
{
  status: "regenerate",
  base_style?: string,         // 用户从风格家族列表中选的，如 "Glassmorphism"
  feedback?: string,           // 用户的文字反馈，如 "想要更暖的"
  keep_previous: true
}

// 3. 用户尚未操作
{
  status: "pending"
}
```

#### 工具 3：`stop_preview`

选择完成后关闭预览服务器。

```typescript
// 输入
{ session_id: string }
// 输出
{ status: "stopped" }
```

### 4.2 HTTP Server 内部架构

```
MCP Server (Node.js)
├── MCP 层：处理 AI 的工具调用
│   ├── create_style_preview  → 接收 HTML，写入预览文件，启动/更新画廊
│   ├── get_user_selection    → 读取用户选择事件
│   └── stop_preview          → 关闭 HTTP 服务器，清理资源
│
├── HTTP 层：服务预览页面
│   ├── GET /                 → 返回风格展示画廊页
│   ├── GET /preview/:id      → 返回单个风格的全屏预览（iframe src）
│   ├── POST /api/select      → 接收用户选择
│   └── POST /api/regenerate  → 接收"再生成"请求（含风格家族+反馈）
│
├── 数据层：
│   └── sessions/{session_id}/
│       ├── meta.json         → 会话元数据（app_description, rounds）
│       ├── styles.json       → 所有风格定义（含历史轮次）
│       ├── round-1/
│       │   ├── style-1.html  → 各风格预览 HTML
│       │   ├── style-2.html
│       │   └── ...
│       ├── round-2/
│       │   └── ...
│       └── events.json       → 用户交互事件
│
└── 静态资源：
    ├── gallery.html          → 画廊页模板
    ├── gallery.css           → 画廊页样式
    ├── gallery.js            → 交互逻辑（选择、全屏预览、再生成弹窗）
    └── style-families.json   → 内置风格家族列表（67 种，供再生成弹窗展示）
```

### 4.3 预览页面设计

#### 画廊页布局

```
┌──────────────────────────────────────────────────────┐
│ 顶部栏                                                │
│  cc-design  │  为 {应用名} 选择 UI 风格   [都不喜欢，再来一批] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  选择你喜欢的风格                                       │
│  AI 根据「{应用名}」的特性生成了 N 种不同风格方案           │
│                                                      │
│  ── 第 2 轮 · 基于「Glassmorphism」 ──（最新在上）       │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │  [iframe 预览]   │  │  [iframe 预览]   │           │
│  │  风格名 + 描述   │  │  风格名 + 描述   │           │
│  │  标签  配色色点   │  │  标签  配色色点   │           │
│  └─────────────────┘  └─────────────────┘           │
│                                                      │
│  ── 第 1 轮 ──                                       │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │  ...             │  │  ...             │           │
│  └─────────────────┘  └─────────────────┘           │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │  ...             │  │  ...             │           │
│  └─────────────────┘  └─────────────────┘           │
│                                                      │
├──────────────────────────────────────────────────────┤
│ 底部栏 (选中后滑出)                                     │
│  ✓ 已选择 {风格名}              [确认选择，开始生成代码]    │
└──────────────────────────────────────────────────────┘
```

#### 交互行为

| 交互 | 行为 |
|------|------|
| **点击卡片** | 选中该风格，卡片边框高亮 + 勾选标记，底部确认栏滑出 |
| **全屏预览** | hover 卡片时出现按钮，点击在全屏 overlay 中展示完整页面 |
| **确认选择** | POST `/api/select`，MCP Server 记录结果，AI 通过 `get_user_selection` 获取 |
| **都不喜欢** | 打开风格引导弹窗（见下方） |
| **配色色点** | 每个卡片显示 4 个核心色点，快速感知配色方案 |

#### "再来一批"风格引导弹窗

```
┌─────────────────────────────────────────────────────┐
│  想要什么方向的风格？                                  │
│  选择一个风格家族，AI 会基于它生成新的变体               │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 热门风格                                     │    │
│  │  ○ Glassmorphism 玻璃拟态                    │    │
│  │  ○ Neumorphism 新拟态                        │    │
│  │  ○ Brutalism 粗野主义                         │    │
│  │  ○ Bento Grid 便当盒网格                      │    │
│  │  ○ Minimalism 极简主义                        │    │
│  │  ○ Dark Immersive 暗黑沉浸                    │    │
│  │  ○ Organic 有机自然                           │    │
│  │  ○ Retro-Futurism 复古未来                    │    │
│  │  ▸ 查看全部 67 种风格...                       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  或者用文字描述你想要的方向：                           │
│  ┌─────────────────────────────────────────────┐    │
│  │ 想要更日式的、侘寂风格的...                     │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  两种方式可以同时使用                                  │
│              [取消]    [生成新风格]                    │
└─────────────────────────────────────────────────────┘
```

- 风格家族列表来自 `style-families.json`（内置 67 种风格分类）
- 可以只选风格、只写文字、或两者结合
- POST `/api/regenerate` 将 `{ base_style, feedback }` 发送给 Server
- AI 通过 `get_user_selection` 获取 `{ status: "regenerate", base_style, feedback }`

#### 关键技术决策

1. **iframe 隔离** — 每个风格预览在 `<iframe srcdoc="...">` 中渲染，互不干扰
2. **累积式画廊** — 新一轮风格追加到画廊顶部，旧风格保留在下方，用户可跨轮次选择
3. **轮次标签** — 每轮标记序号和生成依据（如"基于 Glassmorphism"）
4. **深色画廊主题** — 画廊页本身使用深色主题，避免干扰预览内容的色彩判断

## 5. SKILL.md 设计

### 5.1 触发条件

```
激活场景：
- 用户请求创建网站、Web 应用、Landing Page、Dashboard 等前端项目
- 关键词匹配："做一个"、"创建"、"Build"、"Create"、"Make" + Web/网站/应用/页面

不激活场景：
- 修改现有项目的局部功能（"加个按钮"、"改个颜色"）
- 纯后端/API 开发
- 用户明确跳过风格选择（"不需要选风格"、"直接生成"）
```

### 5.2 完整流程

```
Step 1: 需求分析
│   从用户描述中提取：
│   - app_type: 应用类型（博客、电商、SaaS、Dashboard...）
│   - target_audience: 目标用户
│   - features: 功能模块列表
│   - preference: 用户提到的风格偏好（如果有）
│
▼
Step 2: 生成风格变体
│   基于需求分析 + 行业推理规则 + 风格知识库
│   生成 3-4 种差异化风格，每种包含 preview_html + design_system
│
▼
Step 3: 调用 MCP 工具展示
│   调用 create_style_preview，告知用户打开预览 URL
│
▼
Step 4: 获取选择结果        ◄─── 循环点
│   调用 get_user_selection
│   ├── "selected"     → Step 5
│   ├── "regenerate"   → Step 2（带 base_style + feedback）
│   └── "pending"      → 等待后重试
│
▼
Step 5: 持久化设计系统
│   保存 .cc-design/design-system.json
│
▼
Step 6: 生成应用代码
│   按照 design_system 规范生成完整项目
│   最后对照 Pre-delivery Checklist 检查质量
│
▼
Step 7: 关闭预览
    调用 stop_preview
```

### 5.3 风格生成指令（Step 2 的提示词核心）

```markdown
## 风格生成规则

### 输入
- app_type: {从 Step 1 提取}
- target_audience: {从 Step 1 提取}
- features: {从 Step 1 提取}
- preference: {用户偏好，可选}
- base_style: {再生成时用户选的风格家族，可选}
- feedback: {再生成时用户的文字反馈，可选}

### 生成要求

1. **数量与差异化**
   - 生成 3-4 种风格
   - 每种必须来自不同的风格家族（除非 base_style 指定了特定家族）
   - 差异体现在：配色、字体、布局、视觉效果、整体氛围

2. **预览 HTML 质量**
   - 页面内容基于用户的实际应用（美食博客→博客内容，电商→商品列表）
   - 使用真实的中文/英文内容，不用 Lorem ipsum
   - 至少包含：导航栏、Hero 区域、主要内容区
   - HTML 和 CSS 内联在同一文件中
   - 通过 Google Fonts CDN 加载字体
   - 页面宽度适配 iframe 展示（min-width: 800px）

3. **design_system JSON**
   - 每种风格同时输出结构化设计定义（见 §4.1 schema）
   - 用户选择后直接作为代码生成规范

4. **行业适配**
   - 参考风格知识库中的行业推理规则
   - 优先推荐适合该行业的风格家族
   - 遵循 anti_patterns 限制

5. **再生成模式**
   - 如果有 base_style：所有新风格基于该风格家族的变体
   - 变体间仍需有差异（配色冷暖、明暗、布局疏密等维度）
   - 如果有 feedback：将反馈融入所有新风格
```

### 5.4 内嵌风格知识库

SKILL 中直接内嵌核心风格知识，AI 不需要调用外部脚本。

#### 风格家族速查表

| 风格 | 视觉关键词 | 适合行业 | 避免用于 |
|------|-----------|---------|---------|
| Minimalism 极简主义 | 留白、无衬线、单色、几何 | 工具、SaaS、文档 | 儿童、娱乐 |
| Glassmorphism 玻璃拟态 | 毛玻璃、半透明、模糊背景 | SaaS、金融仪表盘 | 老年用户 |
| Neumorphism 新拟态 | 柔和凸起、内阴影、同色系 | 健康、冥想、个人应用 | 数据密集型 |
| Brutalism 粗野主义 | 粗边框、大色块、反常规排版 | 作品集、创意机构 | 银行、医疗 |
| Bento Grid 便当盒 | 不等分网格、模块化卡片 | 仪表盘、产品页、个人主页 | 长文章阅读 |
| Editorial 杂志编辑 | 分栏、衬线标题、强版式 | 新闻、博客、杂志 | 工具类应用 |
| Dark Immersive 暗黑沉浸 | 深色、渐变强调、发光效果 | 游戏、音乐、创意内容 | 健康、儿童 |
| Organic 有机自然 | 暖色、圆润形状、自然纹理 | 美食、健康、生活方式 | 科技、金融 |
| Retro-Futurism 复古未来 | 霓虹、CRT 效果、赛博 | 游戏、娱乐、音乐 | 企业、政府 |
| Flat Design 扁平化 | 无阴影、纯色、简洁 | Web 应用、移动应用、MVP | 奢侈品 |
| Aurora UI 极光 | 渐变网格、柔和发光 | SaaS、创意机构 | 严肃商务 |
| Claymorphism 黏土态 | 3D 凸起、柔和阴影、圆润 | 教育、儿童应用 | 金融、法律 |
| Y2K Aesthetic 千禧风 | 亮色、星星、塑料质感 | 时尚、Gen Z 品牌 | 企业、B2B |
| Cyberpunk 赛博朋克 | 霓虹、深色、故障效果 | 游戏、加密、科技 | 健康、教育 |
| Swiss Modernism 瑞士现代 | 网格系统、Helvetica、秩序 | 企业、建筑、编辑 | 娱乐、儿童 |

#### 行业推理规则

| 行业 | 推荐风格 (优先级) | 配色倾向 | 字体倾向 | 绝对避免 |
|------|-----------------|---------|---------|---------|
| 美食/餐饮 | Organic > Editorial > Minimal | 暖色 (棕、橙、奶油) | 衬线标题 + 无衬线正文 | 暗黑模式、霓虹色 |
| SaaS/工具 | Minimal > Glass > Bento | 蓝色系/中性灰 | 无衬线 (Inter, Geist) | 花哨动画、过多装饰 |
| 电商 | Minimal > Bento > Flat | 高对比 CTA (橙、红) | 无衬线、清晰易读 | 低对比文字、复杂导航 |
| 金融/保险 | Minimal > Glass > Swiss | 蓝色、绿色 | 无衬线、专业 | 紫粉渐变、花哨动效 |
| 创意/设计 | Brutalism > Dark > Editorial | 大胆、不拘一格 | 混搭、展示型字体 | 保守模板感 |
| 健康/医疗 | Minimal > Organic > Flat | 蓝、绿、白 | 清晰无衬线 | 暗黑模式、粗野主义 |
| 教育 | Flat > Clay > Bento | 明亮、友好 | 圆润无衬线 | 复杂布局、小字体 |
| 游戏/娱乐 | Dark > Cyberpunk > Retro | 霓虹、高饱和 | 展示型、像素 | 企业感、保守 |
| 个人博客 | Editorial > Minimal > Organic | 依内容类型而定 | 衬线或混搭 | 过度商业化 |
| 企业官网 | Swiss > Minimal > Glass | 品牌色 + 中性 | 专业无衬线 | 花哨、非主流 |

## 6. 持久化设计系统

### 6.1 文件结构

用户选定风格后，保存到项目中：

```
项目根目录/
└── .cc-design/
    └── design-system.json
```

### 6.2 文件格式

```json
{
  "version": "1.0",
  "project": "美食博客",
  "selected_style": "Warm Organic · 温暖有机",
  "selected_at": "2026-03-28T15:30:00Z",
  "design_system": {
    "colors": {
      "primary": "#C67C4E",
      "secondary": "#8B6914",
      "accent": "#E8956A",
      "background": "#FFF8F0",
      "text": "#3D2B1F"
    },
    "typography": {
      "heading_font": "Playfair Display",
      "body_font": "Inter",
      "google_fonts_url": "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap"
    },
    "border_radius": "16px",
    "shadow_style": "0 2px 12px rgba(139,69,19,0.08)",
    "layout_pattern": "Hero + Card Grid",
    "effects": "Soft shadows, warm hover transitions (200ms ease)",
    "anti_patterns": [
      "Avoid neon/harsh colors",
      "Avoid dark mode for food content",
      "No emoji as icons"
    ]
  },
  "pre_delivery_checklist": [
    "No emojis as icons (use SVG: Heroicons/Lucide)",
    "cursor-pointer on all clickable elements",
    "Hover states with smooth transitions (150-300ms)",
    "Text contrast >= 4.5:1",
    "Focus states visible for keyboard nav",
    "Responsive: 375px, 768px, 1024px, 1440px"
  ]
}
```

### 6.3 用途

- **当前会话** — AI 生成代码时严格参照 design_system
- **后续会话** — AI 修改/新增页面时读取 design_system 保持风格一致
- **用户可编辑** — 用户可以手动微调 JSON 中的值（如换个主色）

## 7. 项目结构

```
cc-design/
├── package.json                  # 项目配置
├── tsconfig.json
├── README.md
│
├── src/
│   ├── server/                   # MCP Server
│   │   ├── index.ts              # 入口，MCP Server 启动
│   │   ├── tools/                # MCP 工具实现
│   │   │   ├── create-preview.ts # create_style_preview 工具
│   │   │   ├── get-selection.ts  # get_user_selection 工具
│   │   │   └── stop-preview.ts   # stop_preview 工具
│   │   ├── http/                 # HTTP 服务器
│   │   │   ├── server.ts         # Express/Koa HTTP 服务器
│   │   │   └── routes.ts         # API 路由（/api/select, /api/regenerate）
│   │   └── session/              # 会话管理
│   │       └── manager.ts        # 会话创建、数据读写、清理
│   │
│   └── client/                   # 预览页面前端
│       ├── gallery.html          # 画廊页模板
│       ├── gallery.css           # 画廊页样式（深色主题）
│       ├── gallery.js            # 交互逻辑
│       └── style-families.json   # 内置 67 种风格家族列表
│
├── skill/                        # SKILL 定义
│   └── SKILL.md                  # 完整的技能提示词
│
└── docs/
    └── 2026-03-28-cc-design-spec.md  # 本文档
```

## 8. 借鉴 ui-ux-pro-max-skill

cc-design 从 [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) 借鉴了以下要素，并在其基础上解决了"不可预览"和"用户无选择权"的核心缺失：

| 借鉴要素 | 在 cc-design 中的应用 |
|---------|---------------------|
| **行业推理规则** (161 条) | 浓缩为风格知识库，内嵌 SKILL 提示词，引导 AI 生成行业适配的风格 |
| **风格分类体系** (67 种) | 作为风格家族列表，用于"再生成"时的风格引导选择器 |
| **Anti-patterns 反模式** | 1) 风格生成时避免行业禁忌 2) 代码生成后 Pre-delivery Checklist |
| **Design System Schema** | 每种风格的 design_system JSON，选中后直接作为代码生成规范 |
| **持久化设计系统** | `.cc-design/design-system.json`，保证后续会话风格一致 |

### cc-design vs ui-ux-pro-max 的差异

| 维度 | ui-ux-pro-max | cc-design |
|------|--------------|-----------|
| 输出形式 | 文本推荐（ASCII/Markdown，给 AI 看） | 可视化预览页面（给人看） |
| 选择方式 | AI 自动选最佳匹配 | 用户在预览中主动选择 |
| 预览内容 | 无预览 | 基于用户具体应用的定制预览 |
| 风格来源 | CSV 数据库 + Python 搜索引擎 | AI 实时生成（SKILL 知识库引导） |
| 交互流程 | 线性（生成→输出） | 循环（生成→预览→选择/再生成） |

## 9. 未来扩展方向

以下功能不在当前版本范围内，但值得后续考虑：

- **组件级预览** — 选完整体风格后，进一步预览和选择具体组件（表单、卡片、导航）的设计变体
- **风格微调面板** — 选定风格后，用户可以在预览页面上直接微调配色、字体、圆角等参数
- **风格收藏** — 用户可以收藏喜欢的风格组合，跨项目复用
- **社区风格库** — 用户可以分享自己的风格定义，形成社区驱动的风格市场
