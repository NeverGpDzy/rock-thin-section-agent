# 岩石薄片智能分析 Agent

基于多模态大模型的矿物分类与鲕粒分割交互式分析系统。

## 功能特性

- **智能对话**：接入小米 MiMo-v2.5 多模态大模型，支持流式对话和图片理解
- **矿物分类**：调用后端分类接口，识别岩石薄片中的矿物类型及置信度
- **鲕粒分割**：调用后端分割接口，统计鲕粒数量与面积占比
- **意图识别**：自动判断用户问题意图，规划工具调用顺序
- **记忆模块**：对话摘要（超 20 条自动压缩）+ 单图分析缓存（LRU 淘汰，最多 50 条）
- **模板兜底**：未配置大模型时，基于后端结构化数据生成前端模板报告
- **Mock 模式**：无需后端服务即可完整演示全部功能
- **导出功能**：支持导出聊天记录、分析结果、会话包（Markdown / JSON）

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 5 |
| UI | Ant Design 6 |
| 状态 | Zustand + TanStack React Query |
| 路由 | React Router 7 (Hash) |
| LLM | 小米 MiMo-v2.5（OpenAI 兼容接口） |
| 部署 | GitHub Pages + GitHub Actions |

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发（默认 Mock 模式，无需后端）
npm run dev

# 构建
npm run build

# 预览构建产物
npm run preview
```

## 模型配置

默认已内置 MiMo-v2.5 配置。如需修改，有两种方式：

**方式一：页面内设置**

点击左上角「模型设置」按钮，在弹窗中填写接口地址、API Key、模型名称，保存即可（仅存浏览器本地）。

**方式二：环境变量**

创建 `.env.local` 文件：

```env
VITE_LLM_BASE_URL=https://api.xiaomimimo.com/v1
VITE_LLM_API_KEY=your-api-key
VITE_LLM_MODEL=mimo-v2.5
```

## 关于后端

本项目的矿物分类和鲕粒分割功能依赖后端服务（FastAPI + 深度学习模型），后端**暂未开源**。

- **在线演示**：默认以 Mock 模式运行，LLM 对话、多模态图片理解等功能可直接体验，分类和分割结果为模拟数据。
- **真实分析**：如需连接真实后端进行矿物分类与鲕粒分割，请联系作者获取后端部署方式。

> 后端基于 PyTorch + SAM / 自训练分类器，支持图片上传、自动分类、鲕粒分割与结果持久化。如需后端，请通过 [GitHub Issues](https://github.com/NeverGpDzy/rock-thin-section-agent/issues) 联系我。

## Mock 模式

默认开启（`VITE_USE_MOCK=true`），所有后端接口返回模拟数据，图片上传支持本地预览。

如需连接真实后端：

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000/api
VITE_ASSET_BASE_URL=http://localhost:8000
```

## 项目结构

```
src/
├── agent/              # Agent 核心
│   ├── llmClient.ts    # LLM 客户端（流式 + 非流式）
│   ├── orchestrator.ts # 编排器（意图→工具→总结）
│   ├── tools.ts        # 工具执行
│   └── intents.ts      # 意图识别
├── api/                # 后端 API 封装
├── components/         # 复用组件
├── config/             # 环境配置
├── layouts/            # 布局组件
├── memory/             # 记忆模块
├── mocks/              # Mock 数据与服务
├── pages/              # 页面
├── store/              # 全局状态
├── styles/             # 样式
├── types/              # 类型定义
└── utils/              # 工具函数
```

## 在线访问

部署到 GitHub Pages 后可通过以下地址访问：

```
https://<用户名>.github.io/rock-thin-section-agent/
```
