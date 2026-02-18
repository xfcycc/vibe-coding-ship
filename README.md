# VIBE-CODING-SHIP

AI 编码工作流管控系统 —— 通过预设模板引导、AI 交互辅助、全流程文档沉淀，帮助用户规范 AI 编码流程，生成可直接用于开发的全套设计文档。

## 功能特性

### 核心能力

- **AI 流式交互** - 浏览器直连 AI API（SSE），实时流式输出、停止/重试/追问修改、新旧内容 Diff 对比
- **双模板工作流** - AI 编码标准化流程（10 步，适配程序员）+ 零门槛 MVP 生成（6 步，适配 PM/外行）
- **智能记忆区** - 每步生成后自动累积项目记忆（关键决策、数据模型、业务规则等），后续步骤自动注入，无需重复压缩前文
- **等待区（状态 + 表结构）** - 双重提取（正则 + AI），自动从文档提取状态和核心表结构到等待区
- **文档 ↔ 等待区双向同步** - 文档修改可同步到等待区，等待区修改可推送到文档，支持智能合并
- **手动编辑与版本管理** - 用户可直接编辑 AI 生成的文档，保存为独立版本，支持任意两版本 Diff 对比
- **DDL 导出** - 等待区表结构可导出为 PostgreSQL / MySQL / Oracle DDL
- **工作流回溯** - 支持回溯修改已完成步骤，自动标记后续文档需要重新生成

### 文档管理

- 前置文档回看、版本记录（最近 5 次，区分 AI 生成 / 手动编辑）
- 任意两版本之间 Diff 对比
- Markdown 全套文档导出 / ZIP 打包下载
- AI 思考过程独立展示（支持 Doubao reasoning_content 等模型）

### 模板系统

- 步骤增删、提示词编辑（支持变量占位符）
- 回溯节点类型支持
- 模板复制 / 新建自定义模板

### 数据持久化

- IndexedDB 作为主存储（idb 库），自动从 localStorage 迁移
- localStorage 同步写入作为降级备份

### 界面演示

![image-20260218144549459](https://pic.caiguoyu.cn/typora/202602181445565.png)

![image-20260218144512327](https://pic.caiguoyu.cn/typora/202602181445471.png)

![image-20260218144608450](https://pic.caiguoyu.cn/typora/202602181446550.png)

![image-20260218144635908](https://pic.caiguoyu.cn/typora/202602181446014.png)

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript + Vite 6 |
| UI 组件 | Ant Design 5 + @ant-design/icons |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| AI 对接 | 浏览器直连 AI API（SSE 流式），兼容 OpenAI / Claude / 豆包 / 千问 / Kimi / DeepSeek / 智谱 |
| 持久化 | IndexedDB（idb）+ localStorage 降级 |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 导出 | jszip + file-saver |
| Diff | react-diff-viewer-continued |
| ID | uuid v4 |

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

1. **配置 AI API** — 进入「API 配置」页面，选择模型提供商，填入 API Key 和接口地址，点击校验连接
2. **选择模板** — 选择适合的工作流模板，输入项目名称和愿景，创建新项目
3. **执行工作流** — 按步骤引导输入补充信息，点击「开始生成」让 AI 流式生成文档
4. **记忆累积** — 每步文档生成后，系统自动总结关键信息到记忆区，后续步骤自动获取完整上下文
5. **等待区维护** — 状态和表结构自动从文档提取（规则 + AI 双重提取），也可手动编辑
6. **手动编辑** — 对 AI 生成的文档可直接编辑修改，保存为新版本，并可选择同步到等待区
7. **双向同步** — 等待区的修改可推送回文档（Diff 预览后确认），文档修改也可同步到等待区
8. **追问优化** — 对生成内容不满意可追问修改，系统展示新旧内容对比供选择
9. **导出文档** — 完成所有步骤后，导出全部文档为 ZIP 压缩包

## 关于 CORS

本系统从浏览器直接调用 AI API。大多数 OpenAI 兼容接口（包括第三方代理）支持浏览器 CORS 跨域访问。如遇到 CORS 错误，请使用支持浏览器访问的 API 代理地址。

---

## 核心逻辑详解

### 1. 双向同步架构

文档区和等待区之间的数据同步是系统最核心的复杂逻辑。

#### 1.1 文档 → 等待区（同步提取）

触发时机：AI 文档生成完成后自动执行、用户手动保存文档后确认同步。

**两阶段提取策略（非阻塞）**：

```
Phase 1（瞬时）：正则提取 → computeMergeActions → 立即 dispatch → 用户秒看到结果
Phase 2（后台）：AI 提取 → 过滤已有项 → computeMergeActions → 自动补充
```

Phase 1 使用 `docExtractor.ts` 中的正则引擎，同步执行、毫秒级完成。Phase 2 通过 `aiDirect.ts` 调用 AI 接口做结构化提取，作为 `.then()` 异步回调运行，不阻塞用户操作。AI 只补充正则没提取到的增量数据。

**正则提取覆盖模式**（`docExtractor.ts`）：
- 状态：标题/加粗文本包含"状态"的段落、行内 `XX状态：值1、值2` 格式、Markdown 表格中的状态列
- 表结构：识别含"字段/Field"+"类型/Type"表头的 Markdown 表格，从上方最近的标题提取表名

**AI 提取**（`aiDirect.ts` → `buildAIExtractPrompt`）：构造结构化 prompt，要求 AI 返回 JSON 格式的状态和表结构，包含 `enumValues`（key/value 键值对）。

#### 1.2 等待区 → 文档（推送注入）

触发时机：用户点击「推送到文档」按钮。

**两级回退策略**：

```
尝试 1：正则定位注入（injectStatesIntoDoc + injectTablesIntoDoc）
尝试 2：AI 智能合并（buildDocMergePrompt → AI API）
```

正则注入（`docInjector.ts`）会在文档中定位对应的状态段落和表格，直接替换为等待区的最新数据。如果正则无法定位（文档结构不规范），回退到 AI 合并 — 将整篇文档 + 等待区数据作为 prompt 交给 AI，由 AI 输出合并后的完整文档。

两种方式都会先生成 Diff 预览，用户确认后才实际应用。

### 2. 智能合并算法（computeMergeActions）

核心文件：`utils/waitAreaMerge.ts`

这是文档 → 等待区同步的核心判断逻辑。解决的核心问题：**如何判断提取出的数据是"新增"还是"已有项的修改"，以及如何处理重命名**。

#### 2.1 三级匹配流程

对每个提取出的状态/表，依次尝试：

```
Pass 1：精确名称匹配
  └─ 名称完全一致 → 对比内容，有变化则 UPDATE，无变化则 SKIP

Pass 2：结构相似度匹配（Jaccard 系数 ≥ 0.3）
  └─ 名称不匹配，但结构相似 → 视为重命名，执行 UPDATE（更新名称 + 内容）

Pass 3：全新数据
  └─ 无任何匹配 → ADD
```

#### 2.2 结构相似度算法

针对表结构，通过字段名集合的 Jaccard 系数判断是否为同一张表：

```
Jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

示例：
- 等待区有表 `users`，字段 `[id, name, email, phone]`
- 文档提取出表 `user_info`，字段 `[id, name, email, avatar]`
- 交集 = `{id, name, email}` = 3，并集 = `{id, name, email, phone, avatar}` = 5
- Jaccard = 3/5 = 0.6 ≥ 0.3 → 匹配成功，视为 `users` 改名为 `user_info`

针对状态，通过状态值集合的 Jaccard 系数判断是否为同一状态。

阈值 `STRUCT_MATCH_THRESHOLD = 0.3` 经验值，平衡误匹配和漏匹配。

#### 2.3 字段变化检测（tableFieldsChanged）

逐项对比判断表是否有变化：

| 检测项 | 逻辑 |
|--------|------|
| 字段数量 | `existing.fields.length !== extracted.fields.length` |
| 新增字段 | extracted 中有、existing 中没有的字段名 |
| 删除字段 | existing 中有、extracted 中没有的字段名（双向检查） |
| 类型变更 | 归一化比较（`VARCHAR(100)` 和 `VARCHAR(255)` 视为相同，`VARCHAR` 和 `INT` 视为不同） |
| 描述变更 | 仅在提取结果有非空描述时比较 |
| 约束变更 | `isRequired` 布尔值比较 |
| 表描述 | 仅在双方都有非空描述时比较 |

类型归一化函数 `normalizeType`：移除括号、数字、空格后大写比较，避免 `VARCHAR(100)` vs `VARCHAR(255)` 等无实质变化的误报。

#### 2.4 全量替换策略（replaceTableFields）

当检测到表有变化时，字段采用**全量替换**而非增量合并：

```
文档提取的字段 = 权威版本（决定哪些字段存在）
  对于名称匹配的字段：继承已有的 id、isPrimaryKey、relatedState
  对于新字段：生成新 id
  对于文档中已删除的字段：直接丢弃
```

这确保了字段重命名（如 `id` → `id2`）不会导致等待区同时出现两个字段。

#### 2.5 状态值替换策略（replaceEnumValues）

同样采用全量替换：提取结果中的枚举值为权威列表，但对于名称匹配的枚举项，会继承已有的 value 映射（避免丢失用户手动配置的字典值）。

### 3. 智能记忆系统

核心逻辑位于 `aiDirect.ts` → `buildMemorySummaryPrompt` 和 `Workflow/index.tsx` → `doMemorySummary`。

**设计思路**：每步生成后，将该步文档中的关键信息（数据模型、业务规则、技术决策等）累积到记忆区。后续步骤只需注入记忆区内容 + 最近一步全文，而不必传入所有历史文档，显著节省 token。

**工作流程**：

```
步骤 N 生成完成
  → 取已有记忆（步骤 1 ~ N-1 累积的内容）
  → 取步骤 N 的完整文档
  → AI 总结：将新文档的关键细节追加到记忆中
  → 保存为步骤 N 的记忆快照

步骤 N+1 生成时
  → prompt 注入：记忆区内容 + 步骤 N 全文 + 当前用户输入
  → 等价于获得了全部历史上下文
```

**记忆格式要求**：按主题分类（数据模型、业务规则、技术决策等），保留具体细节（字段名、枚举值、约束条件），限制 2000 字符。

### 4. 双重提取引擎

#### 4.1 正则提取（docExtractor.ts）

**状态提取策略**：
1. 段落模式：`#{1,4} **XX状态**` 标题后的列表项
2. 行内模式：`XX状态：值1、值2、值3` 
3. 表格模式：含"状态名"列和"值/枚举"列的 Markdown 表格

**表结构提取策略**：
1. 识别含 `字段/Field/列名/Column` + `类型/Type` 表头的 Markdown 表格
2. 从表格上方最近 5 行查找标题/加粗文本作为表名
3. 字段类型通过 `normalizeFieldType` 归一化：`VARCHAR(255)` → `VARCHAR`，`INTEGER` → `INT` 等

#### 4.2 AI 提取（aiDirect.ts）

构造结构化 prompt，要求 AI 返回 JSON：

```json
{
  "states": [{
    "stateName": "订单状态",
    "stateValues": ["待支付", "已支付", "已发货"],
    "enumValues": [
      { "key": "待支付", "value": "PENDING" },
      { "key": "已支付", "value": "PAID" }
    ],
    "description": "订单的生命周期状态"
  }],
  "tables": [{
    "tableName": "orders",
    "description": "订单主表",
    "fields": [
      { "fieldName": "id", "fieldType": "BIGINT", "description": "主键", "isRequired": true }
    ]
  }]
}
```

### 5. 文档注入引擎（docInjector.ts）

等待区 → 文档方向的正则注入逻辑：

**状态注入**：
1. 行内模式：匹配 `XX状态：...`，替换冒号后的值列表
2. 段落模式：匹配包含状态名的标题 + 后续列表项，替换整个列表

**表结构注入**：
1. 遍历文档所有 Markdown 表格
2. 对每个表格，查找上方最近标题
3. 通过表名变体匹配（如 `用户表 (users)` 会同时匹配 `users`、`用户表`、`用户表表`）
4. 匹配成功后，用等待区的字段数据重新生成 Markdown 表格并替换

### 6. DDL 导出（ddlExport.ts）

支持 PostgreSQL / MySQL / Oracle 三种方言的 DDL 生成。

| 特性 | PostgreSQL | MySQL | Oracle |
|------|-----------|-------|--------|
| 类型映射 | VARCHAR → VARCHAR(255)，BOOLEAN → BOOLEAN | VARCHAR → VARCHAR(255)，BOOLEAN → TINYINT(1) | VARCHAR → VARCHAR2(255)，BOOLEAN → NUMBER(1) |
| JSON 类型 | JSONB | JSON | CLOB |
| 主键 | 行内 PRIMARY KEY | 行内 PRIMARY KEY | 行内 PRIMARY KEY |
| 字段注释 | `COMMENT ON COLUMN` | 行内 `-- 注释` | `COMMENT ON COLUMN` |
| 表注释 | `COMMENT ON TABLE` | — | `COMMENT ON TABLE` |
| 引号 | 双引号 `"name"` | 反引号 `` `name` `` | 双引号 `"name"` |

### 7. 版本管理

每个步骤的文档维护一个版本栈（最近 5 个版本）：

- AI 生成 → 自动保存版本（标记 `source: 'ai'`）
- 用户手动编辑 → 保存为新版本（标记 `source: 'manual'`）
- 等待区推送 → 用户确认 Diff 后保存为手动版本
- 支持任意两版本 Diff 对比（react-diff-viewer-continued）
- 版本切换即时生效

### 8. 枚举状态管理

状态支持 Key-Value 枚举格式：
- **Key**（显示名）：一般为中文，如"待审核"
- **Value**（字典值）：一般为数字或英文，如 `0` 或 `PENDING`

在文档中使用 `Key(Value)` 格式展示，如 `待审核(PENDING)、已通过(APPROVED)`。

---

## 项目结构

```
vibe-coding-ship/
├── client/                              # 纯前端 React 应用
│   ├── src/
│   │   ├── components/
│   │   │   ├── DiffViewer/              # 新旧内容对比组件
│   │   │   ├── Layout/                  # 全局布局（顶部导航 + 侧边栏）
│   │   │   └── WaitingArea/             # 等待区面板（状态管理 + 表结构管理 + DDL 导出）
│   │   ├── contexts/
│   │   │   └── ProjectContext.tsx        # 全局状态管理（useReducer + IndexedDB 持久化）
│   │   ├── data/
│   │   │   ├── template1.ts             # AI 编码标准化流程模板（10 步）
│   │   │   ├── template2.ts             # 零门槛 MVP 生成模板（6 步）
│   │   │   └── presets.ts               # AI 模型参数预设（OpenAI/Claude/豆包/千问/Kimi/DeepSeek/智谱）
│   │   ├── pages/
│   │   │   ├── ApiConfig/               # AI API 配置管理
│   │   │   ├── TemplateSelect/          # 模板选择 + 项目加载
│   │   │   ├── TemplateManage/          # 模板编辑（步骤/提示词/节点类型）
│   │   │   └── Workflow/                # 核心工作流页面（AI 交互 + 文档生成 + 双向同步）
│   │   ├── services/
│   │   │   ├── aiDirect.ts              # AI 直连服务（SSE 流式、提示词构建、记忆摘要、AI 提取）
│   │   │   ├── storage.ts               # localStorage 存储封装
│   │   │   └── idbStorage.ts            # IndexedDB 存储（idb 库）+ 迁移逻辑
│   │   ├── types/
│   │   │   └── index.ts                 # 全局 TypeScript 类型定义
│   │   └── utils/
│   │       ├── docExtractor.ts          # 文档结构化提取（正则解析状态/表结构）
│   │       ├── docInjector.ts           # 文档注入（等待区数据 → 文档定位替换）
│   │       ├── waitAreaMerge.ts         # 智能合并算法（三级匹配 + 全量替换 + 结构相似度）
│   │       ├── ddlExport.ts             # DDL 生成（PostgreSQL / MySQL / Oracle）
│   │       └── export.ts               # 文档导出（ZIP 打包）
│   ├── vite.config.ts
│   └── package.json
└── package.json                         # 根级脚本入口
```

## 架构说明

```
用户浏览器
  ├── React SPA（Vite 构建）
  │     ├── 工作流引擎：模板驱动的线性步骤流
  │     ├── AI 服务层：直连 AI API（SSE 流式）
  │     ├── 记忆系统：每步累积 → 后续步骤自动注入
  │     ├── 双重提取引擎：正则（瞬时）+ AI（后台异步补充）
  │     ├── 智能合并层：三级匹配（名称 → 结构相似度 → 新增）+ 全量替换
  │     ├── 双向同步层：文档 ↔ 等待区（正则注入 / AI 合并 + Diff 预览）
  │     └── 持久化层：IndexedDB 主存 + localStorage 降级
  └── AI API（OpenAI / Claude / 豆包 / 千问 / Kimi / DeepSeek / 智谱）
        └── SSE 流式响应
```

## License

MIT
