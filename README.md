# 岩石薄片智能分析 Agent

基于多模态大模型的矿物分类与鲕粒分割交互式分析系统。用户上传岩石薄片图片后，通过自然语言对话驱动 Agent 自主调用图像分析工具，生成结构化的专业分析报告。

---

## 目录

- [一、项目简介](#一项目简介)
- [二、技术栈](#二技术栈)
- [三、项目结构](#三项目结构)
- [四、核心架构与数据流](#四核心架构与数据流)
- [五、各模块详解](#五各模块详解)
  - [5.1 Agent 核心（src/agent/）](#51-agent-核心srcagent)
  - [5.2 知识库（src/knowledge/）](#52-知识库srcknowledge)
  - [5.3 记忆模块（src/memory/）](#53-记忆模块srcmemory)
  - [5.4 后端 API 与 Mock（src/api/ + src/mocks/）](#54-后端-api-与-mocksrcapi--srcmocks)
  - [5.5 页面（src/pages/）](#55-页面srcpages)
  - [5.6 公共组件（src/components/）](#56-公共组件srccomponents)
  - [5.7 状态管理与工具函数](#57-状态管理与工具函数)
- [六、LLM 接入方式](#六llm-接入方式)
- [七、Mock 模式说明](#七mock-模式说明)
- [八、部署方式](#八部署方式)
- [九、快速开始](#九快速开始)
- [十、答辩要点 FAQ](#十答辩要点-faq)

---

## 一、项目简介

### 1.1 背景

岩石薄片鉴定是地质学中的基础工作。传统流程需要地质人员在偏光显微镜下逐矿物观察、记录光学特征，耗时且依赖经验。本项目构建了一个**基于大语言模型的智能分析 Agent**，用户只需上传岩石薄片图片并用自然语言提问，系统即可自动完成：

1. **矿物分类**：调用深度学习分类模型，识别薄片中的矿物类型及置信度
2. **鲕粒分割**：调用分割模型，统计鲕粒数量、面积占比等参数
3. **知识检索**：从专业知识库中检索相关矿物、岩石、光学性质等知识
4. **智能报告**：综合图片视觉理解和后端结构化数据，生成 Markdown 格式的分析报告

### 1.2 核心亮点

| 亮点 | 说明 |
|------|------|
| **真正的 Agent 架构** | LLM（MiMo-v2.5）通过 Function Calling 自主决定调用哪些工具、以什么顺序调用，而非硬编码流程 |
| **三级降级策略** | Agentic 模式 → 关键词意图兜底 → 纯模板报告，确保任何环境下都能工作 |
| **纯前端部署** | 整个项目是 React SPA，可直接部署到 GitHub Pages，无需后端服务器 |
| **完整的 Mock 系统** | 内置模拟服务器，所有 API 均有 Mock 实现，无需后端即可完整演示 |
| **多模态视觉理解** | LLM 可以直接"看到"岩石薄片图片，结合视觉特征和结构化数据给出综合分析 |
| **客户端 RAG** | 基于 Fuse.js 的模糊搜索引擎，将 53 条专业知识注入 LLM 上下文 |
| **对话记忆** | 自动摘要长对话（超 20 条压缩），单图分析结果 LRU 缓存（最多 50 条） |

---

## 二、技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 前端框架 | React | 18.3 | UI 渲染 |
| 类型系统 | TypeScript | 5.6 | 全项目类型安全 |
| 构建工具 | Vite | 5.4 | 开发服务器 + 生产构建 |
| UI 组件库 | Ant Design | 6.3 | 表单、表格、布局、消息等组件 |
| 状态管理 | Zustand | 5.0 | 轻量级全局状态（认证 token） |
| 服务端状态 | TanStack React Query | 5.100 | 异步请求缓存与重试 |
| HTTP 客户端 | Axios | 1.16 | API 请求 |
| 路由 | React Router | 7.15 | 客户端路由（Hash 模式） |
| LLM 接口 | OpenAI 兼容 API | — | 流式对话 + Function Calling |
| 模糊搜索 | Fuse.js | 7.3 | 知识库全文检索 |
| Markdown | react-markdown + remark-gfm | 10.1 | 消息渲染 |
| 部署 | GitHub Pages + Actions | — | CI/CD 自动部署 |

---

## 三、项目结构

```
rock-agent/
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions 自动部署配置
├── src/
│   ├── main.tsx                # 应用入口：挂载 React、配置主题、路由
│   ├── App.tsx                 # 路由定义 + 路由守卫（登录拦截）
│   │
│   ├── agent/                  # ===== Agent 核心 =====
│   │   ├── llmClient.ts        #   LLM 客户端：SSE 流式解析、tool_calls 累积
│   │   ├── orchestrator.ts     #   编排器：Agentic Loop + 三级降级策略
│   │   ├── tools.ts            #   工具定义与执行（4 个工具）
│   │   └── intents.ts          #   关键词意图识别（降级方案使用）
│   │
│   ├── knowledge/              # ===== 知识库 =====
│   │   ├── types.ts            #   知识条目类型定义
│   │   ├── search.ts           #   Fuse.js 模糊搜索引擎
│   │   ├── index.ts            #   知识库公共 API（检索、注入 LLM 上下文）
│   │   └── data/               #   53 条专业知识（JSON 静态文件）
│   │       ├── minerals.json           #   15 种矿物光性特征
│   │       ├── rock_types.json         #   10 种岩石类型
│   │       ├── thin_section_guides.json #   5 篇薄片鉴定指南
│   │       ├── optical_properties.json  #   8 个光学概念
│   │       └── glossary.json           #   15 条专业术语
│   │
│   ├── api/                    # ===== 后端 API =====
│   │   ├── client.ts           #   Axios 实例、请求拦截器、错误解析
│   │   ├── auth.ts             #   登录、注册、获取用户信息
│   │   └── images.ts           #   图片上传、列表、分类、分割（含轮询）
│   │
│   ├── mocks/                  # ===== Mock 系统 =====
│   │   ├── data.ts             #   模拟用户、图片、分类/分割初始数据
│   │   └── server.ts           #   完整 Mock API 服务器（465 行）
│   │
│   ├── memory/                 # ===== 记忆模块 =====
│   │   ├── storage.ts          #   localStorage 安全读写封装
│   │   ├── conversationMemory.ts #   对话摘要（超 20 条自动压缩）
│   │   ├── imageMemory.ts      #   单图分析缓存（LRU 淘汰，最多 50 条）
│   │   └── index.ts            #   统一导出
│   │
│   ├── pages/                  # ===== 页面 =====
│   │   ├── LoginPage.tsx       #   登录页
│   │   ├── AgentPage.tsx       #   核心分析页（910 行，左右分栏布局）
│   │   ├── KnowledgePage.tsx   #   知识库浏览页
│   │   └── HistoryPage.tsx     #   分析历史页
│   │
│   ├── components/             # ===== 公共组件 =====
│   │   ├── MarkdownMessage.tsx  #   Markdown 渲染组件
│   │   ├── AgentToolList.tsx    #   工具调用结果列表
│   │   └── StatusTag.tsx       #   任务状态标签
│   │
│   ├── layouts/
│   │   └── AppShell.tsx        #   主布局（侧边栏 + 顶栏 + 内容区）
│   │
│   ├── store/
│   │   └── authStore.ts        #   Zustand 认证状态
│   │
│   ├── config/
│   │   └── env.ts              #   环境变量读取 + LLM 配置解析
│   │
│   ├── types/                  # ===== 类型定义 =====
│   │   ├── agent.ts            #   Agent 消息、工具调用、意图等类型
│   │   ├── api.ts              #   API 信封、分页、任务状态
│   │   ├── image.ts            #   图片、分类、分割结果类型
│   │   └── user.ts             #   用户、登录、Token 类型
│   │
│   ├── utils/                  # ===== 工具函数 =====
│   │   ├── storage.ts          #   localStorage 读写（对话、认证、LLM 配置）
│   │   ├── export.ts           #   文件导出（Markdown、JSON、图片下载）
│   │   ├── format.ts           #   格式化（日期、文件大小、百分比）
│   │   ├── assets.ts           #   资源 URL 拼接
│   │   └── promise.ts          #   sleep 工具函数
│   │
│   └── styles/
│       └── theme.css           #   全局样式（558 行，含响应式断点）
│
├── public/
│   └── vite.svg                #   网站图标
├── index.html                  #   HTML 入口
├── package.json                #   依赖与脚本
├── vite.config.ts              #   Vite 配置（base、别名）
├── tsconfig.json               #   TypeScript 配置
└── eslint.config.js            #   ESLint 配置
```

---

## 四、核心架构与数据流

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户浏览器（SPA）                          │
│                                                                 │
│  ┌──────────┐   ┌──────────────────────────────────────────┐   │
│  │ 登录页面  │   │              Agent 分析页面                │   │
│  │LoginPage │   │  ┌────────────┐  ┌───────────────────┐   │   │
│  └──────────┘   │  │ 左侧面板    │  │   右侧聊天面板     │   │   │
│                  │  │ - 图片选择  │  │ - 消息列表        │   │   │
│                  │  │ - 图片预览  │  │ - 工具调用展示     │   │   │
│                  │  │ - 结构化    │  │ - 流式文本渲染     │   │   │
│                  │  │   结果展示  │  │ - 输入框           │   │   │
│                  │  └────────────┘  └───────────────────┘   │   │
│                  └──────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Agent 编排器（orchestrator.ts）         │   │
│  │                                                         │   │
│  │  用户提问 ─→ 意图判断 ─→ Agentic Loop ─→ 生成报告       │   │
│  │                 │            │                           │   │
│  │                 │            ├─ LLM 自主决定调用工具      │   │
│  │                 │            ├─ 执行工具 → 返回结果       │   │
│  │                 │            └─ 循环直到 LLM 给出最终回答 │   │
│  │                 │                                        │   │
│  │                 └─→ 降级：关键词意图 → 硬编码工具计划     │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                    │                  │               │
│         ▼                    ▼                  ▼               │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────┐     │
│  │ LLM 客户端  │   │  工具执行器   │   │   知识库检索      │     │
│  │ llmClient  │   │   tools.ts   │   │   knowledge/     │     │
│  │            │   │              │   │                  │     │
│  │ SSE 流式   │   │ - 图片详情   │   │ Fuse.js 模糊搜索  │     │
│  │ tool_calls │   │ - 矿物分类   │   │ 53 条专业知识     │     │
│  │ 解析       │   │ - 鲕粒分割   │   │                  │     │
│  │            │   │ - 知识搜索   │   │                  │     │
│  └─────┬──────┘   └──────┬───────┘   └──────────────────┘     │
│        │                 │                                      │
└────────┼─────────────────┼──────────────────────────────────────┘
         │                 │
         ▼                 ▼
  ┌────────────┐   ┌──────────────────┐
  │ MiMo-v2.5  │   │   后端 API 服务   │
  │ LLM 服务    │   │  （FastAPI + PyTorch）│
  │            │   │                  │
  │ 流式对话    │   │ - 图片上传/管理   │
  │ 视觉理解    │   │ - 矿物分类模型   │
  │ Function   │   │ - 鲕粒分割模型   │
  │ Calling    │   │                  │
  └────────────┘   └──────────────────┘
```

### 4.2 一次完整的分析流程

以用户上传图片后提问"帮我分析这张薄片中的矿物"为例：

```
步骤 1：用户上传图片
  → AgentPage 调用 uploadImage() → 返回 imageId
  → 前端保存 imageId 到状态

步骤 2：用户发送消息
  → AgentPage 调用 streamAgentTurn({ imageId, question, history })

步骤 3：编排器判断意图
  → shouldUseImageTools() 检测到图片分析关键词 → 进入图像分析模式

步骤 4：Agentic Loop（核心）
  → 第 1 轮：发送消息 + 4 个工具定义给 LLM
    → LLM 返回 tool_calls: [get_image_detail(image_id=1)]
    → 执行工具 → 获取图片详情 → 返回结果给 LLM
  → 第 2 轮：LLM 看到图片详情后
    → LLM 返回 tool_calls: [classify_mineral(image_id=1)]
    → 执行工具 → 触发分类 → 轮询等待结果 → 返回分类结果给 LLM
  → 第 3 轮：LLM 看到分类结果后
    → LLM 不再调用工具，直接生成 Markdown 分析报告
    → 流式输出到前端

步骤 5：保存记忆
  → 将分析结果存入 imageMemory（localStorage）
  → 检查是否需要对话摘要（超过 20 条消息则自动压缩）

步骤 6：前端渲染
  → MarkdownMessage 组件渲染报告
  → AgentToolList 组件展示工具调用过程
  → 左侧面板更新分类/分割结构化结果
```

### 4.3 三级降级策略

系统设计了三级降级机制，确保在任何环境下都能正常工作：

```
                    ┌─────────────────────────┐
                    │   LLM 是否配置且可用？    │
                    └────────┬────────────────┘
                             │ 是
                             ▼
                ┌────────────────────────────┐
                │  Agentic 模式（最优）        │
                │  LLM 自主决定调用哪些工具     │
                │  通过 Function Calling 交互  │
                │  最多 5 轮推理循环            │
                └────────────┬───────────────┘
                             │ LLM 不返回 tool_calls
                             ▼
                ┌────────────────────────────┐
                │  降级模式（中等）             │
                │  关键词匹配意图              │
                │  硬编码工具计划执行           │
                │  LLM 仅做总结报告            │
                └────────────┬───────────────┘
                             │ LLM 也不可用
                             ▼
                ┌────────────────────────────┐
                │  模板模式（兜底）             │
                │  纯前端模板生成报告           │
                │  不依赖任何 LLM              │
                │  基于后端返回的结构化数据      │
                └────────────────────────────┘
```

---

## 五、各模块详解

### 5.1 Agent 核心（src/agent/）

这是整个系统最核心的部分，包含 4 个文件。

#### 5.1.1 LLM 客户端 — `llmClient.ts`

**职责**：封装与 LLM 的所有通信，支持流式和非流式两种模式。

**关键类型**：

```typescript
// OpenAI 兼容的工具调用格式
interface ChatCompletionToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// 流式返回结果：包含文本和工具调用
interface StreamResult {
  text: string;           // LLM 生成的文本
  toolCalls: ChatCompletionToolCall[];  // LLM 决定调用的工具
}

// 发给 LLM 的消息格式（支持多模态）
interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<TextContentBlock | ImageUrlContentBlock>;
  tool_call_id?: string;      // tool 角色消息需要
  tool_calls?: ChatCompletionToolCall[];  // assistant 角色携带
}
```

**核心函数**：

| 函数 | 用途 | 返回 |
|------|------|------|
| `streamChatCompletion()` | 流式请求 LLM | `StreamResult`（文本 + 工具调用） |
| `createChatCompletion()` | 非流式请求 LLM | `ChatCompletionResponse` |

**SSE 流式解析流程**：

```
SSE 数据流到达
  → 按 \n\n 分割为独立事件
  → 每个事件解析 data: 字段的 JSON
  → 提取 delta.content → 累积为文本
  → 提取 delta.tool_calls → 按 index 累积 name 和 arguments
  → 遇到 [DONE] 结束
  → 返回 { text, toolCalls }
```

**关于 tool_calls 的增量累积**：SSE 流中，一个工具调用的 `function.name` 和 `function.arguments` 会分成多个 chunk 到达。例如：

```
chunk 1: { index: 0, id: "call_abc", function: { name: "get_image_detail" } }
chunk 2: { index: 0, function: { arguments: "{\"image" } }
chunk 3: { index: 0, function: { arguments: "_id\": 1}" } }
```

解析器按 `index` 建立 Map，逐步拼接 name 和 arguments，最终得到完整的工具调用。

#### 5.1.2 工具定义与执行 — `tools.ts`

**职责**：定义 Agent 可用的工具，实现工具的实际执行逻辑。

**4 个工具**：

| 工具名 | 功能 | 参数 | 后端接口 |
|--------|------|------|----------|
| `get_image_detail` | 获取图片基本信息和已有分析结果 | `image_id` | `GET /images/{id}` |
| `classify_mineral` | 触发矿物分类（异步） | `image_id` | `POST /images/{id}/classification` + 轮询 |
| `segment_oooids` | 触发鲕粒分割（异步） | `image_id` | `POST /images/{id}/segmentation` + 轮询 |
| `search_knowledge` | 搜索岩石矿物知识库 | `query` | 纯前端 Fuse.js 搜索 |

**工具定义格式**（OpenAI Function Calling 标准）：

```typescript
{
  type: "function",
  function: {
    name: "classify_mineral",
    description: "调用矿物分类接口，返回矿物名称和置信度。",
    parameters: {
      type: "object",
      properties: {
        image_id: { type: "integer", description: "图片 ID" }
      },
      required: ["image_id"]
    }
  }
}
```

**`executeAgentTool()` 函数**：统一的工具执行入口，返回 `{ payload, trace }`：
- `payload`：工具的实际返回数据（发给 LLM 的 tool 消息内容）
- `trace`：执行追踪信息（工具名、状态、摘要、错误信息），用于前端展示

#### 5.1.3 编排器 — `orchestrator.ts`

**职责**：整个 Agent 的"大脑"，决定何时调用什么工具、如何生成最终报告。这是最复杂的文件（约 1000 行）。

**核心函数 `streamAgentTurn()`** 的完整流程：

```
streamAgentTurn({ imageId, question, history })
  │
  ├─ 1. 获取当前图片快照（如有）
  │
  ├─ 2. 判断是否需要图片工具
  │     ├─ 无图片 + 分析类问题 → 提示"请先上传图片"
  │     ├─ 无图片 + 普通问题 → streamGeneralChat()
  │     ├─ 有图片 + 非分析问题 → streamGeneralChat()（带图片上下文）
  │     └─ 有图片 + 分析问题 → 进入步骤 3
  │
  ├─ 3. Agentic Loop（主路径）
  │     ├─ 构建系统提示词（含工具说明、分析策略）
  │     ├─ 注入对话记忆摘要、图片记忆、知识库上下文
  │     ├─ 发送消息 + 4 个工具定义给 LLM
  │     ├─ 循环（最多 5 轮）：
  │     │   ├─ LLM 返回 tool_calls → 执行工具 → 结果作为 tool 消息回传
  │     │   └─ LLM 返回纯文本 → 这就是最终回答，退出循环
  │     └─ 返回回复 + 工具调用记录
  │
  ├─ 4. 降级路径（Agentic 失败时）
  │     ├─ 关键词意图识别（intents.ts）
  │     ├─ 硬编码工具计划执行
  │     └─ streamImageSummary() 生成报告
  │
  └─ 5. 后处理
        ├─ 保存图片分析记忆（imageMemory）
        └─ 检查是否需要对话摘要（超过 20 条则压缩）
```

**关键系统提示词**：

- `GENERAL_CHAT_PROMPT`：普通对话的系统提示，告诉 LLM 它是岩石薄片分析助手，可以用中文自然对话
- `SUMMARY_PROMPT`：分析报告的系统提示，要求 LLM 输出包含"任务结论"、"图片概况"、"视觉描述"、"矿物分类结果"、"鲕粒分割结果"、"综合分析与建议"六个小节的 Markdown 报告

**`streamGeneralChat()` 函数**：处理非图片分析的普通对话。会注入：
- 对话记忆摘要（如有）
- 图片历史分析记录（如有）
- 知识库检索结果（根据用户问题检索相关知识）
- 图片 URL（如有，支持多模态视觉理解）

#### 5.1.4 意图识别 — `intents.ts`

**职责**：基于关键词的简单意图分类（作为 Agentic 模式的降级方案）。

```typescript
// 三类关键词
OVERVIEW_KEYWORDS: ["分析", "总结", "整体", "综合", "这张图", "当前图片"]
CLASSIFICATION_KEYWORDS: ["矿物", "岩性", "识别", "分类", "是什么"]
SEGMENTATION_KEYWORDS: ["分割", "鲕粒", "轮廓", "数量", "颗粒", "面积"]

// 判断逻辑
if 命中概述关键词 → "overview"（调用全部工具）
if 同时命中分类和分割 → "overview"
if 仅命中分割 → "segmentation"（只调分割工具）
if 仅命中分类 → "classification"（只调分类工具）
默认 → "overview"
```

---

### 5.2 知识库（src/knowledge/）

**职责**：存储岩石矿物领域的专业知识，并提供模糊搜索能力，将检索到的知识注入 LLM 上下文（客户端 RAG）。

#### 5.2.1 数据结构

每条知识条目的格式：

```typescript
interface KnowledgeEntry {
  id: string;                    // 唯一标识，如 "mineral_quartz"
  category: KnowledgeCategory;   // 分类：mineral / rock_type / thin_section / optical_property / glossary
  title: string;                 // 中文标题，如 "石英（Quartz）"
  aliases: string[];             // 别名，如 ["Quartz", "SiO2"]
  keywords: string[];            // 搜索关键词
  content: string;               // 详细内容（Markdown 格式）
  tags: string[];                // 标签，如 ["造岩矿物", "架状硅酸盐"]
}
```

#### 5.2.2 知识内容

| 文件 | 类别 | 条目数 | 内容示例 |
|------|------|--------|----------|
| `minerals.json` | 矿物 | 15 | 石英、正长石、斜长石、黑云母、白云母、辉石、角闪石、橄榄石、方解石、白云石、磁铁矿、绿泥石、石榴石、绿帘石、蛇纹石 |
| `rock_types.json` | 岩石类型 | 10 | 花岗岩、辉长岩、玄武岩、闪长岩、砂岩、石灰岩、大理岩、片岩、片麻岩、鲕粒灰岩 |
| `thin_section_guides.json` | 薄片鉴定 | 5 | 矿物鉴定步骤、火成岩分类、沉积岩薄片、系统鉴定流程、鲕粒分析 |
| `optical_properties.json` | 光性概念 | 8 | 突起、干涉色、消光、多色性、贝克线、光性符号、双折射、双晶 |
| `glossary.json` | 术语 | 15 | 薄片、偏光显微镜、晶系、光轴、岩相学、矿物组合、火成岩/沉积岩/变质岩、颗粒计数、面积占比等 |

每条内容都包含详细的 Markdown 文本，涵盖光学特征、鉴定方法、地质意义等专业信息。

#### 5.2.3 搜索引擎

使用 **Fuse.js** 实现客户端模糊搜索，配置如下：

```typescript
{
  keys: [
    { name: "title", weight: 0.35 },     // 标题权重最高
    { name: "aliases", weight: 0.30 },    // 别名次之
    { name: "keywords", weight: 0.25 },   // 关键词
    { name: "content", weight: 0.10 },    // 正文最低
  ],
  threshold: 0.6,          // 模糊匹配阈值（0=精确，1=全匹配）
  minMatchCharLength: 2,   // 最小匹配字符数
  ignoreLocation: true,    // 忽略匹配位置（适合中文）
}
```

**为什么用 Fuse.js 而不是向量数据库？** 因为本项目部署在 GitHub Pages 上，是纯静态前端，无法运行后端服务。Fuse.js 是纯 JavaScript 库，可以在浏览器中直接运行，无需服务器。

#### 5.2.4 知识注入流程

```
用户提问 "石英的光性特征是什么"
  → retrieveKnowledgeContext("石英的光性特征", 3)
  → Fuse.js 搜索 → 返回最相关的 3 条知识
  → 格式化为 Markdown 字符串
  → 注入 LLM 的 system 消息中：
    [专业知识参考]
    以下是与用户问题相关的专业知识条目：
    ## 石英（Quartz）
    - 化学式：SiO2...
    ...
  → LLM 参考这些知识回答用户问题
```

---

### 5.3 记忆模块（src/memory/）

**职责**：管理对话历史和图片分析缓存，解决两个问题：(1) 长对话超出 LLM 上下文窗口；(2) 重复分析同一张图片。

#### 5.3.1 对话记忆 — `conversationMemory.ts`

**问题**：LLM 的上下文窗口有限，对话太长会超出限制。

**方案**：当对话超过 20 条消息时，自动调用 LLM 生成摘要，替换完整历史。

```
对话消息数 < 20 → 正常发送完整历史
对话消息数 >= 20 → 触发摘要
  → 取最近 20 条消息
  → 让 LLM 用 500 字以内总结
  → 存入 localStorage
  → 后续对话注入摘要而非完整历史
```

**存储格式**：`localStorage["rock-agent-memory-summary:{scope}"]`
- scope 可以是图片 ID（如 `"42"`）或 `"general"`（无图片时的通用对话）

#### 5.3.2 图片记忆 — `imageMemory.ts`

**问题**：用户可能反复分析同一张图片，每次都重新调用后端很浪费。

**方案**：分析完成后缓存结果到 localStorage，下次绑定同一图片时自动注入历史记录。

```typescript
interface ImageMemoryData {
  imageId: number;            // 图片 ID
  fileName: string;           // 文件名
  classification: {...};      // 分类结果
  segmentation: {...};        // 分割结果
  lastSummary: string;        // 最近一次分析摘要（前 500 字）
  timestamp: number;          // 时间戳
}
```

**LRU 淘汰**：最多保存 50 条记录，超过时删除最旧的。

**存储格式**：`localStorage["rock-agent-memory-image:{imageId}"]`

---

### 5.4 后端 API 与 Mock（src/api/ + src/mocks/）

#### 5.4.1 API 客户端 — `api/client.ts`

基于 Axios 封装，特性：
- 请求拦截器自动附加 `Authorization: Bearer <token>` 头
- 统一错误处理，支持 FastAPI 的错误格式（`detail` 字符串或验证错误数组）
- `ApiEnvelope<T>` 标准响应格式：`{ success, message, data }`

#### 5.4.2 图片 API — `api/images.ts`

| 函数 | 方法 | 端点 | 说明 |
|------|------|------|------|
| `uploadImage()` | POST | `/images/upload` | FormData 上传 |
| `listImages()` | GET | `/images` | 分页列表 |
| `getImageDetail()` | GET | `/images/{id}` | 图片详情 + 分类/分割结果 |
| `deleteImage()` | DELETE | `/images/{id}` | 删除图片 |
| `triggerClassification()` | POST | `/images/{id}/classification` | 触发分类（60s 超时） |
| `ensureClassification()` | — | — | 获取/触发 + 轮询（最多 20 次，1.5s 间隔） |
| `triggerSegmentation()` | POST | `/images/{id}/segmentation` | 触发分割（120s 超时） |
| `ensureSegmentation()` | — | — | 获取/触发 + 轮询（最多 24 次，1.5s 间隔） |

**轮询机制**：分类和分割是异步任务。`ensureClassification()` 的逻辑是：
1. 先 `getClassification()` 看是否已有结果
2. 如果没有或状态是 `pending`，调用 `triggerClassification()` 触发
3. 然后每 1.5 秒轮询一次，直到状态变为 `success` 或 `failed`（最多 20 次）

#### 5.4.3 Mock 系统 — `mocks/server.ts`

**为什么需要 Mock？** 本项目部署在 GitHub Pages 上，没有真实后端。Mock 系统让所有功能都能在纯前端环境下完整演示。

**Mock 实现**：
- 维护内存中的用户列表、图片列表、分类/分割结果
- `mockLogin()`：验证用户名密码，返回模拟 token
- `mockUploadImage()`：读取文件为 DataURL，获取图片尺寸
- `mockTriggerClassification()`：延迟 1.1 秒后返回确定性的矿物名称（基于文件名 hash）
- `mockTriggerSegmentation()`：延迟 1.4 秒后返回确定性的颗粒数和面积比，生成 SVG 可视化
- 所有 Mock 函数都有 200-450ms 的随机延迟，模拟真实网络

**Mock 演示账号**：
- `demo_user` / `demo_pass_123`（普通用户）
- `admin` / `admin123456`（管理员）

---

### 5.5 页面（src/pages/）

#### 5.5.1 登录页 — `LoginPage.tsx`

- 表单：用户名 + 密码
- Mock 模式下自动填充演示账号并显示提示
- 使用 `useMutation` 调用登录 API
- 成功后将 token 存入 Zustand store + localStorage

#### 5.5.2 Agent 分析页 — `AgentPage.tsx`（核心页面，910 行）

这是整个项目最核心的页面，采用左右分栏布局：

**左侧面板（320px）**：
- **图片上下文卡片**：
  - 图片选择下拉框（从已有图片中选择）
  - 图片上传拖拽区（支持拖拽或点击上传）
  - 图片预览（object-fit: contain）
- **结构化结果卡片**：
  - 矿物分类：预测类别 + 置信度百分比
  - 鲕粒分割：颗粒数 + 面积占比
  - 下载按钮：分割叠加图、分割掩码

**右侧面板（聊天区）**：
- **快捷提问**：5 个预设问题按钮（"帮我分析这张薄片"等）
- **消息列表**：
  - 用户消息：绿色渐变气泡
  - 助手消息：白色气泡，Markdown 渲染
  - 状态消息：虚线边框，灰色文字
  - 工具调用卡片：展示工具名、参数、结果
- **输入框**：Enter 发送，Shift+Enter 换行

**顶部工具栏**：
- LLM 配置状态标签
- 模型设置弹窗（配置 baseUrl、apiKey、model）
- 导出菜单（5 种导出格式）
- 清空对话按钮

#### 5.5.3 知识库页 — `KnowledgePage.tsx`

- 搜索框（Fuse.js 模糊搜索）
- 分类筛选标签（全部 / 矿物 / 岩石类型 / 薄片鉴定 / 光性概念 / 术语）
- 折叠列表展示知识条目（标题 + 分类标签 + 标签 + Markdown 内容）

#### 5.5.4 分析历史页 — `HistoryPage.tsx`

- 从 localStorage 读取所有图片分析记忆
- 表格展示：文件名、分类结果、分割结果、分析时间
- 可展开行显示分析摘要
- "查看"按钮跳转到 Agent 页并加载对应图片

---

### 5.6 公共组件（src/components/）

| 组件 | 功能 |
|------|------|
| `MarkdownMessage` | Markdown 渲染，支持 GFM（表格、任务列表等），链接在新标签页打开 |
| `AgentToolList` | 工具调用结果列表，展示工具名（中文）、状态标签、参数 JSON、结果摘要、错误信息 |
| `StatusTag` | 任务状态标签：pending=金色、running=蓝色动画、success=绿色、failed=红色 |

---

### 5.7 状态管理与工具函数

#### Zustand Store — `store/authStore.ts`

```typescript
// 极简的认证状态管理
const useAuthStore = create<{
  token: string | null;
  setToken: (token: string) => void;  // 存入 localStorage + 更新状态
  logout: () => void;                  // 清除 localStorage + 清空状态
}>()
```

#### 工具函数 — `utils/`

| 文件 | 函数 | 用途 |
|------|------|------|
| `storage.ts` | `loadConversation()`, `saveConversation()` | 对话持久化到 localStorage |
| `storage.ts` | `getStoredLlmConfig()`, `saveStoredLlmConfig()` | LLM 配置持久化 |
| `export.ts` | `buildConversationMarkdown()` | 导出完整对话为 Markdown |
| `export.ts` | `buildAnalysisMarkdown()` | 导出分析结果为 Markdown |
| `export.ts` | `buildSessionExportBundle()` | 导出会话包为 JSON |
| `export.ts` | `downloadRemoteFile()` | 下载远程文件（如分割叠加图） |
| `format.ts` | `formatDateTime()`, `formatPercent()` | 中文格式化 |
| `assets.ts` | `resolveAssetUrl()` | 拼接资源 URL（处理相对路径） |

---

## 六、LLM 接入方式

### 6.1 默认配置

项目内置了小米 MiMo-v2.5 的默认配置：

```typescript
// src/config/env.ts
llmBaseUrl: "https://token-plan-cn.xiaomimimo.com/v1"
llmApiKey: "sk-czq88jvsc88vy650k3xtwallazsb8dktqwe8jssmpnz99798"  // 内置 key
llmModel: "mimo-v2.5"
```

### 6.2 两种配置方式

**方式一：页面内设置**（推荐）

点击左上角「模型设置」按钮，在弹窗中填写接口地址、API Key、模型名称，保存即可。配置仅存浏览器本地（localStorage），不会提交到代码中。

**方式二：环境变量**

创建 `.env.local` 文件：

```env
VITE_LLM_BASE_URL=https://api.xiaomimimo.com/v1
VITE_LLM_API_KEY=your-api-key
VITE_LLM_MODEL=mimo-v2.5
```

### 6.3 配置优先级

```
1. localStorage 中的用户保存配置（优先）
2. 环境变量 VITE_LLM_*（其次）
3. 代码中的默认值（兜底）
```

### 6.4 OpenAI 兼容接口

LLM 客户端遵循 OpenAI Chat Completions API 标准：
- 支持流式（SSE）和非流式两种模式
- 支持 Function Calling（工具定义 + tool_calls 响应）
- 支持多模态消息（文本 + 图片 URL）
- 自动尝试多个端点路径（`/chat/completions`、`/v1/chat/completions`）

因此可以接入任何兼容 OpenAI 接口的大模型服务（如 OpenAI GPT-4、通义千问、智谱 GLM 等）。

---

## 七、Mock 模式说明

### 7.1 什么是 Mock 模式？

Mock 模式下，所有后端 API 调用都由前端内置的模拟服务器处理，无需真实后端。这是本项目的默认模式。

### 7.2 Mock 模式能做什么？

| 功能 | Mock 支持 |
|------|----------|
| 登录/注册 | 完整支持（内存用户表） |
| 图片上传 | 支持（读取为 DataURL，本地预览） |
| 图片列表 | 支持（内存列表） |
| 矿物分类 | 模拟（1.1 秒延迟，基于文件名 hash 返回确定性结果） |
| 鲕粒分割 | 模拟（1.4 秒延迟，返回 SVG 可视化） |
| LLM 对话 | **真实调用**（连接 MiMo-v2.5 服务） |
| 知识库检索 | **真实搜索**（前端 Fuse.js） |

### 7.3 切换到真实后端

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000/api
VITE_ASSET_BASE_URL=http://localhost:8000
```

---

## 八、部署方式

### 8.1 GitHub Pages 自动部署

项目配置了 GitHub Actions 自动部署（`.github/workflows/deploy.yml`）：

1. 推送代码到 `main` 分支
2. GitHub Actions 自动触发：
   - 安装 Node.js 20 + npm 依赖
   - 执行 `npm run build`（TypeScript 编译 + Vite 构建）
   - 将 `dist/` 目录部署到 GitHub Pages
3. 访问 `https://<用户名>.github.io/<仓库名>/`

### 8.2 本地构建预览

```bash
npm run build     # 构建到 dist/
npm run preview   # 本地预览构建产物
```

### 8.3 部署到其他平台

由于是纯静态 SPA，`dist/` 目录可以部署到任何静态托管服务：
- Vercel：`npx vercel --prod`
- Netlify：拖拽 `dist/` 文件夹
- Nginx：将 `dist/` 复制到 web 根目录

---

## 九、快速开始

```bash
# 1. 克隆项目
git clone <仓库地址>
cd rock-agent

# 2. 安装依赖
npm install

# 3. 启动开发服务器（默认 Mock 模式）
npm run dev

# 4. 打开浏览器访问 http://localhost:5173

# 5. 使用演示账号登录
#    用户名：demo_user
#    密码：demo_pass_123

# 6. 上传一张岩石薄片图片，开始对话分析
```

---

## 十、答辩要点 FAQ

### Q1：这个项目的 Agent 是怎么工作的？

**A**：Agent 的核心是 `orchestrator.ts` 中的 `runAgenticLoop` 函数。它的工作方式是：
1. 将用户问题和 4 个工具定义一起发给 LLM
2. LLM 自主决定是否需要调用工具（通过 Function Calling 机制）
3. 如果 LLM 返回 tool_calls，前端执行这些工具，把结果作为 tool 角色消息回传给 LLM
4. LLM 看到工具结果后，决定是继续调用工具还是给出最终回答
5. 最多循环 5 轮，确保不会无限循环

这个设计让 LLM 真正拥有决策权，而不是固定流程。

### Q2：如果 LLM 不支持 Function Calling 怎么办？

**A**：系统设计了三级降级策略：
- **第一级**：Agentic 模式（LLM 自主调用工具）
- **第二级**：降级到关键词意图匹配 + 硬编码工具计划 + LLM 总结
- **第三级**：纯前端模板生成报告（完全不需要 LLM）

这样无论 LLM 是否支持 Function Calling，系统都能正常工作。

### Q3：知识库是怎么和 LLM 结合的？

**A**：采用客户端 RAG（Retrieval-Augmented Generation）方案：
1. 用户提问时，用 Fuse.js 在 53 条专业知识中模糊搜索
2. 将最相关的 3 条知识格式化为 Markdown
3. 注入 LLM 的 system 消息中作为参考
4. LLM 参考这些知识回答问题

这样做的好处是不需要向量数据库，纯前端就能实现知识增强。

### Q4：对话记忆是怎么实现的？

**A**：两层记忆机制：
- **对话摘要**：当对话超过 20 条消息时，自动调用 LLM 生成 500 字以内的摘要，后续对话注入摘要而非完整历史
- **图片记忆**：分析结果缓存到 localStorage（最多 50 条，LRU 淘汰），下次分析同一张图片时自动注入历史记录

### Q5：为什么选择 Hash 路由？

**A**：因为部署在 GitHub Pages 上。GitHub Pages 是静态文件服务，不支持服务端路由配置。Hash 路由（`#/agent`、`#/knowledge`）确保页面刷新时不会 404。

### Q6：Mock 模式是怎么实现的？

**A**：`mocks/server.ts` 实现了一个完整的内存 API 服务器：
- 所有 API 函数在检测到 `env.useMock === true` 时，调用对应的 mock 函数
- Mock 函数维护内存中的用户列表、图片列表、分析结果
- 分类和分割有模拟延迟（1.1s / 1.4s），模拟真实异步任务
- 分类结果基于文件名 hash 生成，同一张图片总是得到相同结果

### Q7：SSE 流式传输是怎么解析的？

**A**：`llmClient.ts` 中的 `streamFromSSE` 函数：
1. 使用 `fetch()` API 获取响应流
2. 通过 `ReadableStream` reader 逐块读取
3. 按 `\n\n` 分割为独立的 SSE 事件
4. 解析每个事件的 `data:` 字段为 JSON
5. 累积 `delta.content` 为文本，累积 `delta.tool_calls` 为工具调用
6. 遇到 `[DONE]` 结束

### Q8：项目用到了哪些设计模式？

**A**：
- **策略模式**：三级降级策略（Agentic → 关键词 → 模板）
- **观察者模式**：流式回调（onChunk、onToolCalls、onEvent）
- **工厂模式**：工具执行器根据工具名分发到不同处理函数
- **代理模式**：API 层封装，Mock 和真实后端透明切换
- **单例模式**：Zustand store、Fuse.js 搜索引擎实例
