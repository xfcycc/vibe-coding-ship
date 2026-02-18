# VIBE-CODING-SHIP

AI编码工作流管控系统 -- 通过预设模板引导、AI交互辅助、全流程文档沉淀，帮助用户规范AI编码流程，生成可直接用于开发的全套设计文档。

## 功能特性

- **AI API 配置** - 支持 OpenAI、Claude、豆包等多种AI模型API配置，内置参数模板
- **双模板工作流** - AI编码标准化流程（10步，适配程序员）+ 零门槛MVP生成（6步，适配PM/外行）
- **AI 流式交互** - 浏览器直连AI API流式输出、停止/重试/追问修改、新旧内容对比
- **固定等待区** - 状态管理 + 核心表管理，支持双向联动
- **文档管理** - 前置文档回看、版本记录（最近3次）、Markdown导出/ZIP打包
- **模板自定义** - 步骤编辑/删除、提示词编辑、模板复制/新建
- **纯前端架构** - 无需后端服务器，所有数据存储在浏览器localStorage

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Ant Design 5 + react-markdown |
| AI对接 | 浏览器直连 AI API（SSE 流式输出） |
| 存储 | localStorage |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 8

### 安装与运行

```bash
# 克隆项目
git clone <repo-url>
cd vibe-coding-ship

# 安装依赖
npm run install:all

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173 即可使用。

### 构建

```bash
npm run build
```

## 使用说明

1. **配置AI API** - 进入「API配置」页面，选择模型提供商，填入API Key等参数，点击校验连接
2. **选择模板** - 进入「选择模板」页面，选择适合的工作流模板，创建新项目
3. **执行工作流** - 按步骤引导输入信息，点击「开始生成」让AI生成文档
4. **文档管理** - 在等待区维护状态和表结构，使用追问修改优化文档
5. **导出文档** - 完成所有步骤后，导出全部文档为ZIP压缩包

## 关于 CORS

本系统从浏览器直接调用AI API。大多数OpenAI兼容接口（包括第三方代理）支持浏览器CORS跨域访问。如果遇到CORS错误，请使用支持浏览器访问的API代理地址。

## 项目结构

```
vibe-coding-ship/
├── client/                    # 前端 React 应用
│   ├── src/
│   │   ├── components/        # 通用组件（布局、等待区、对比框）
│   │   ├── pages/             # 页面（API配置、模板选择、工作流、模板管理）
│   │   ├── contexts/          # React Context 全局状态
│   │   ├── services/          # AI直连服务、localStorage存储
│   │   ├── types/             # TypeScript类型定义
│   │   ├── data/              # 预设模板数据
│   │   └── utils/             # 工具函数（导出）
│   └── ...
└── package.json
```

## License

MIT
