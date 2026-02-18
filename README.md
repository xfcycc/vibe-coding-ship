# VIBE-CODING-SHIP

AI 编码工作流管控系统 —— 通过预设模板引导、AI 交互辅助、全流程文档沉淀，帮助用户规范 AI 编码流程，生成可直接用于开发的全套设计文档。

## 功能特性

### 核心能力

- **AI 流式交互** - 浏览器直连 AI API（SSE），实时流式输出、停止/重试/追问修改、新旧内容 Diff 对比
- **双模板工作流** - AI 编码标准化流程（10 步，适配程序员）+ 零门槛 MVP 生成（6 步，适配 PM/外行）
- **智能记忆区** - 每步生成后自动累积项目记忆（关键决策、数据模型、业务规则等），后续步骤自动注入，无需重复压缩前文
- **等待区（状态 + 表结构）** - 双重提取（正则 + AI），自动从文档提取状态和核心表结构到等待区
- **工作流回溯** - 支持回溯修改已完成步骤，自动标记后续文档需要重新生成

### 文档管理

- 前置文档回看、版本记录（最近 3 次）
- Markdown 全套文档导出 / ZIP 打包下载
- AI 思考过程独立展示（支持 Doubao reasoning_content 等模型）

### 模板系统

- 步骤增删、提示词编辑（支持变量占位符）
- 回溯节点类型支持
- 模板复制 / 新建自定义模板

### 数据持久化

- IndexedDB 作为主存储（idb 库），自动从 localStorage 迁移
- localStorage 同步写入作为降级备份

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite 6 |
| UI 组件 | Ant Design 5 + @ant-design/icons |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| AI 对接 | 浏览器直连 AI API（SSE 流式输出，兼容 OpenAI / Claude / 豆包等） |
| 持久化 | IndexedDB（idb）+ localStorage 降级 |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 导出 | jszip + file-saver |
| Diff | react-diff-viewer-continued |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8

### 安装与运行

```bash
git clone <repo-url>
cd vibe-coding-ship

npm run install:all
npm run dev
```

访问 http://localhost:5173 即可使用。

### 构建部署

```bash
npm run build
npm run preview
```

构建产物位于 `client/dist/`，可直接部署到任何静态托管服务（Vercel / Netlify / Nginx 等）。

## 使用流程

1. **配置 AI API** — 进入「API 配置」页面，选择模型提供商（OpenAI / Claude / 豆包等），填入 API Key 和接口地址，点击校验连接
2. **选择模板** — 选择适合的工作流模板，输入项目名称和愿景，创建新项目
3. **执行工作流** — 按步骤引导输入补充信息，点击「开始生成」让 AI 流式生成文档
4. **记忆累积** — 每步文档生成后，系统自动总结关键信息到记忆区，后续步骤自动获取完整上下文
5. **等待区维护** — 状态和表结构自动从文档提取（规则 + AI 双重提取），也可手动编辑
6. **追问优化** — 对生成内容不满意可追问修改，系统展示新旧内容对比供选择
7. **导出文档** — 完成所有步骤后，导出全部文档为 ZIP 压缩包

## 关于 CORS

本系统从浏览器直接调用 AI API。大多数 OpenAI 兼容接口（包括第三方代理）支持浏览器 CORS 跨域访问。如遇到 CORS 错误，请使用支持浏览器访问的 API 代理地址。

## 项目结构

```
vibe-coding-ship/
├── client/                          # 纯前端 React 应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── DiffViewer/          # 新旧内容对比组件
│   │   │   ├── Layout/              # 全局布局（顶部导航 + 侧边栏）
│   │   │   └── WaitingArea/         # 等待区面板（状态管理 + 表结构管理）
│   │   ├── contexts/
│   │   │   └── ProjectContext.tsx    # 全局状态管理（useReducer）
│   │   ├── data/
│   │   │   ├── template1.ts         # AI 编码标准化流程模板（10 步）
│   │   │   ├── template2.ts         # 零门槛 MVP 生成模板（6 步）
│   │   │   └── presets.ts           # AI 模型参数预设
│   │   ├── pages/
│   │   │   ├── ApiConfig/           # AI API 配置管理
│   │   │   ├── TemplateSelect/      # 模板选择 + 项目加载
│   │   │   ├── TemplateManage/      # 模板编辑（步骤/提示词/节点类型）
│   │   │   └── Workflow/            # 核心工作流页面（AI 交互 + 文档生成）
│   │   ├── services/
│   │   │   ├── aiDirect.ts          # AI 直连服务（SSE 流式、提示词构建、记忆摘要、AI 提取）
│   │   │   ├── storage.ts           # localStorage 存储封装
│   │   │   └── idbStorage.ts        # IndexedDB 存储（idb 库）+ 迁移逻辑
│   │   ├── types/
│   │   │   └── index.ts             # 全局 TypeScript 类型定义
│   │   └── utils/
│   │       ├── docExtractor.ts      # 文档结构化提取（正则解析状态/表结构）
│   │       └── export.ts            # 文档导出（ZIP 打包）
│   ├── vite.config.ts
│   └── package.json
└── package.json                     # 根级脚本入口
```

## 架构说明

```
用户浏览器
  ├── React SPA（Vite 构建）
  │     ├── 工作流引擎：模板驱动的线性步骤流
  │     ├── AI 服务层：直连 AI API（SSE 流式）
  │     ├── 记忆系统：每步累积 → 后续步骤自动注入
  │     ├── 提取引擎：正则 + AI 双重提取状态/表结构
  │     └── 持久化层：IndexedDB 主存 + localStorage 降级
  └── AI API（OpenAI / Claude / 豆包 等）
        └── SSE 流式响应
```

## License

MIT
