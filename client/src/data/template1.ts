import type { WorkflowTemplate } from '../types';

/** 模板1：AI编码标准化流程模板（10步，适配程序员） */
export const TEMPLATE_CODING: WorkflowTemplate = {
  templateId: 'preset-coding-standard',
  templateName: 'AI编码标准化流程模板',
  description: '适配程序员，侧重AI编码流程规范、技术文档标准化，步骤贴合技术开发逻辑，输出可直接用于编码的全套技术文档。',
  targetUser: '程序员',
  isPreset: true,
  isFixed: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      nodeId: 'coding-node-1',
      step: 1,
      docName: '00-商业模式与交付.md',
      guideText: '请描述您的项目商业模式（ToB/ToC/其他）、核心盈利方式、交付物清单、交付标准和验收条件。',
      relatedWaitAreas: [],
      promptId: 'coding-prompt-1',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：本项目为ToC模式的AI写作助手，通过订阅制盈利，核心交付物包括Web端应用、API文档、部署脚本...',
      enableReviewPrevDocs: false,
    },
    {
      nodeId: 'coding-node-2',
      step: 2,
      docName: '01-产品全景与愿景.md',
      guideText: '请补充项目愿景细节、核心价值主张、目标用户画像、产品核心功能概览、差异化优势。',
      relatedWaitAreas: [],
      promptId: 'coding-prompt-2',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：愿景是让每个开发者都能高效使用AI编码，核心用户为中高级程序员...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-3',
      step: 3,
      docName: '02-核心技术与专利.md',
      guideText: '请明确项目核心技术亮点、初步技术栈选型、技术难点、潜在专利点。',
      relatedWaitAreas: [],
      promptId: 'coding-prompt-3',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：核心技术亮点包括AI流式交互、轻量部署架构，技术栈初步选型React+Node.js...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-4',
      step: 4,
      docName: '03-用户与角色体系.md',
      guideText: '请明确用户类型、角色划分、各角色权限、角色关联关系。',
      relatedWaitAreas: ['wait-state'],
      promptId: 'coding-prompt-4',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：用户类型分为普通用户、管理员，普通用户可创建项目、生成文档...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-5',
      step: 5,
      docName: '04-多端产品文档.md',
      guideText: '请选择项目涉及的终端（如Web管理端、Web用户端、小程序端），系统将按终端生成对应产品文档。',
      relatedWaitAreas: ['wait-state'],
      promptId: 'coding-prompt-5',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：项目涉及Web管理端（面向管理员）和Web用户端（面向普通用户）...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-6',
      step: 6,
      docName: '05-数据模型与工作流.md',
      guideText: '请明确核心数据模型、初步表结构、数据流转逻辑、核心业务工作流。',
      relatedWaitAreas: ['wait-state', 'wait-table'],
      promptId: 'coding-prompt-6',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：核心数据模型包括用户模型、项目模型、文档模型，数据流转为用户创建项目→选择模板→生成文档...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-7',
      step: 7,
      docName: '06-AI能力与算法层.md',
      guideText: '请明确项目所用AI能力、算法选型、AI交互逻辑、AI输出规范。',
      relatedWaitAreas: ['wait-state'],
      promptId: 'coding-prompt-7',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：AI能力包括文档生成、需求校验，交互逻辑为用户输入→提示词拼接→调用AI→流式返回...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-8',
      step: 8,
      docName: '07-MVP范围与迭代路线.md',
      guideText: '请明确MVP核心功能范围（必做/不做）、上线时间预估、迭代优先级、后续迭代计划。',
      relatedWaitAreas: ['wait-state'],
      promptId: 'coding-prompt-8',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：MVP必做功能包括API配置、工作流模板、AI流式生成，不做功能包括多人协作、权限管理...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-9',
      step: 9,
      docName: '08-技术选型与实现说明.md',
      guideText: '请明确前端、后端、数据库、AI模型、部署环境等核心技术栈及选型理由。',
      relatedWaitAreas: ['wait-table', 'wait-state'],
      promptId: 'coding-prompt-9',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：前端React+TS（类型安全），后端Express+TS（轻量快速），数据库SQLite（零部署）...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'coding-node-10',
      step: 10,
      docName: '09-技术架构与实现方案.md',
      guideText: '请明确整体技术架构（分层）、各层职责、核心接口设计、部署方案、运行说明。',
      relatedWaitAreas: ['wait-table', 'wait-state'],
      promptId: 'coding-prompt-10',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：架构分为前端层→接口层→服务层→数据层→AI交互层，部署使用Vercel...',
      enableReviewPrevDocs: true,
    },
  ],
  prompts: [
    {
      promptId: 'coding-prompt-1',
      relatedNodeId: 'coding-node-1',
      variableList: ['projectName', 'projectVision', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 项目背景
- 项目名称：{projectName}
- 项目愿景：{projectVision}

# 任务
请生成一份完整的「商业模式与交付」文档，作为项目立项的第一份核心文档。

# 文档要求
请依次详细阐述以下内容：

## 1. 商业模式
- 明确 ToB / ToC / 平台模式 / 其他
- 目标市场和竞争格局简述

## 2. 核心盈利模式
- 具体盈利方式（订阅、按次付费、增值服务、广告等）
- 若暂无盈利计划请注明

## 3. 交付物清单
- 逐项列出 MVP 阶段的所有交付物（代码仓库、文档、部署包、API 等）
- 每项注明交付形式和验收标准

## 4. 交付标准与验收条件
- 功能验收标准
- 性能验收标准
- 文档完整性要求

# 用户补充信息
{userInput}

# 输出要求
- Markdown 格式，使用清晰的标题层级
- 内容务必具体可落地，避免空泛表述
- 可直接作为项目立项文档使用`,
    },
    {
      promptId: 'coding-prompt-2',
      relatedNodeId: 'coding-node-2',
      variableList: ['projectName', 'projectVision', 'prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 项目背景
- 项目名称：{projectName}
- 项目愿景：{projectVision}

# 前置文档
{prevDocs}

# 任务
基于商业模式文档，生成「产品全景与愿景」文档，全面描绘产品的整体图景。

# 文档要求

## 1. 愿景详述
- 要解决的核心痛点（具体场景化描述）
- 最终达成的目标和理想状态

## 2. 核心价值主张
- 产品独特价值（一句话概括）
- 与现有方案的差异点

## 3. 目标用户画像
- 主要用户类型及特征（年龄、职业、技术水平）
- 典型使用场景

## 4. 核心功能全景
- 全局功能清单（不拆分多端）
- 功能优先级标注（P0/P1/P2）

## 5. 差异化竞争优势
- 至少 3 个明确的差异化亮点

# 用户补充信息
{userInput}

# 输出要求
- Markdown 格式，逻辑连贯
- 用户画像要精准具体，可直接指导后续设计`,
    },
    {
      promptId: 'coding-prompt-3',
      relatedNodeId: 'coding-node-3',
      variableList: ['projectName', 'prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 项目背景
- 项目名称：{projectName}

# 前置文档
{prevDocs}

# 任务
基于产品全景，梳理项目的核心技术方向和技术亮点。

# 文档要求

## 1. 核心技术亮点
- 列出 3-5 个技术亮点（如 AI 流式交互、实时协作、轻量化部署等）
- 每个亮点说明技术价值和业务价值

## 2. 初步技术栈方向
- 前端框架方向
- 后端框架方向
- 数据存储方向
- AI 模型对接方向
- （本步只做方向性选择，后续步骤细化版本号）

## 3. 核心技术难点分析
- 列出 Top 3-5 技术难点
- 每个难点说明挑战所在和初步解决思路

## 4. 潜在专利/创新点
- 有则列出，无则写"暂无明确专利点"

# 用户补充信息
{userInput}

# 输出要求
- Markdown 格式，聚焦技术层面
- 技术选型理由要充分，避免"因为流行所以用"`,
    },
    {
      promptId: 'coding-prompt-4',
      relatedNodeId: 'coding-node-4',
      variableList: ['prevDocs', 'userInput', 'currentStates'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 当前已有状态数据
{currentStates}

# 任务
基于产品全景和目标用户画像，详细设计用户与角色权限体系。

# 文档要求

## 1. 用户类型定义
- 枚举所有用户类型（普通用户、管理员、运营等）
- 每种类型的定位和特征

## 2. 角色划分
- 每个角色名称、描述、对应的用户类型

## 3. 权限矩阵
- 使用表格形式：角色 × 功能模块 × 权限（查看/编辑/删除/管理）
- 权限粒度要细化到操作级别

## 4. 角色关联关系
- 角色间的层级或协作关系

## 5. 用户相关状态定义（枚举格式）
请明确列出所有用户相关的状态枚举，使用 Key(Value) 格式：
- **用户状态**: 待审核(0)、已激活(1)、已禁用(2)、已注销(3)
- **认证状态**: 未认证(UNVERIFIED)、认证中(VERIFYING)、已认证(VERIFIED)
（Key 为中文显示名，Value 为字典值/代码中使用的数字或英文常量，根据实际业务补充）

# 用户补充信息
{userInput}

# 输出要求
- Markdown 格式，权限描述精确到操作级
- 所有状态/枚举必须同时给出中文显示名（Key）和字典值（Value），格式：中文名(字典值)
- 权限矩阵使用 Markdown 表格`,
    },
    {
      promptId: 'coding-prompt-5',
      relatedNodeId: 'coding-node-5',
      variableList: ['prevDocs', 'userInput', 'currentStates'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 当前已有状态数据
{currentStates}

# 任务
基于用户角色体系，按终端维度生成多端产品文档。

# 用户选择的终端类型
{userInput}

# 文档要求（每个终端独立章节）

## 每个终端需包含：

### 终端定位
- 服务于哪个角色
- 核心使用场景

### 核心功能模块
- 模块名称 + 包含的功能点
- 每个功能点标注优先级（P0/P1/P2）

### 页面流程
- 核心页面列表
- 关键页面跳转逻辑（用文字流程描述）

### 交互规范
- 关键交互说明（表单提交、列表操作、状态切换等）
- 异常状态处理

# 输出要求
- Markdown 格式，每个终端用一级标题区分
- 功能描述精确到开发可直接实现的程度
- 如果用户未指定终端类型，请根据角色体系自动推断合理的终端划分`,
    },
    {
      promptId: 'coding-prompt-6',
      relatedNodeId: 'coding-node-6',
      variableList: ['prevDocs', 'userInput', 'currentStates', 'currentTables'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 当前已有状态数据
{currentStates}

# 当前已有表结构
{currentTables}

# 任务
基于多端产品文档和角色权限，设计完整的数据模型和核心业务工作流。

# 文档要求

## 1. 核心数据模型概览
- 列出所有核心实体及其关系（如用户、项目、订单等）

## 2. 数据库表结构设计
对每个核心表，使用以下 Markdown 表格格式：

### 表名（表说明）
| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | BIGINT | 必填,主键 | 自增主键 |
| ... | ... | ... | ... |

**要求：**
- 类型使用标准数据库类型（VARCHAR, INT, BIGINT, TEXT, BOOLEAN, DATETIME, JSON, DECIMAL）
- 约束标注：必填/可选、主键、外键、唯一等
- 每个表至少包含 id, created_at, updated_at 字段

## 3. 数据流转逻辑
- 使用步骤化描述（如 "用户注册 → 写入 users 表 → 状态设为'待审核' → 发送验证邮件"）

## 4. 核心业务工作流
- 描述 3-5 个核心业务流程
- 每个流程标注涉及的数据表和状态变更

## 5. 状态/枚举汇总
将文档中涉及的所有业务状态汇总列出，使用 Key(Value) 格式：
- **XXX状态**: 待处理(0)、处理中(1)、已完成(2)
（Key 为中文显示名，Value 为字典值/数字或英文常量）

# 用户补充信息
{userInput}

# 输出要求
- 所有表结构必须使用 Markdown 表格，包含字段名、类型、必填、描述
- 所有状态/枚举必须同时给出 Key（中文）和 Value（字典值），格式：中文名(字典值)
- 表设计要考虑扩展性，每个表至少包含 id、created_at、updated_at`,
    },
    {
      promptId: 'coding-prompt-7',
      relatedNodeId: 'coding-node-7',
      variableList: ['prevDocs', 'userInput', 'currentStates'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 当前已有状态数据
{currentStates}

# 任务
基于技术方向和数据模型，设计 AI 能力层的完整方案。

# 文档要求

## 1. AI 能力清单
- 列出项目所有 AI 能力（文档生成、代码生成、智能推荐、需求校验等）
- 每个能力标注使用场景和优先级

## 2. AI 模型选型
- 推荐的 AI 模型和提供商
- 选型理由（成本、效果、延迟、API 兼容性等）
- 若无自研算法，注明"依赖第三方大模型 API"

## 3. AI 交互设计
- 完整的交互流程：用户输入 → 提示词构建 → API 调用 → 流式返回 → 后处理
- 上下文管理策略
- 错误处理和降级方案

## 4. AI 输出规范
- 文档类输出的格式规范
- 代码类输出的风格规范
- 数据类输出的结构规范

## 5. 提示词工程方案
- 提示词模板的管理策略
- 变量注入机制
- 提示词版本管理

# 用户补充信息
{userInput}

# 输出要求
- Markdown 格式，技术方案要可落地
- AI 交互流程要细化到可编码实现`,
    },
    {
      promptId: 'coding-prompt-8',
      relatedNodeId: 'coding-node-8',
      variableList: ['prevDocs', 'userInput', 'currentStates'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 当前已有状态数据
{currentStates}

# 任务
基于全部产品和技术文档，制定 MVP 范围和迭代路线。

# 文档要求

## 1. MVP 必做功能清单
- 使用表格：功能名称 | 所属模块 | 优先级 | 预估工作量
- 只列入满足核心用户核心场景的最小功能集

## 2. MVP 不做功能清单
- 明确排除的功能及排除理由

## 3. MVP 上线时间预估
- 基于功能量和团队规模的合理估算
- 关键里程碑节点

## 4. 迭代优先级
- P0: MVP 核心（必须首批完成）
- P1: 体验优化（第二轮迭代）
- P2: 附加功能（第三轮及以后）

## 5. 迭代路线图
- V1.0: MVP 核心功能（描述 + 时间）
- V1.1: 体验优化（描述 + 时间）
- V2.0: 重大功能升级（描述 + 时间）

# 用户补充信息
{userInput}

# 输出要求
- Markdown 格式，功能粒度到可分配开发任务的程度
- 时间预估要合理，避免过于乐观`,
    },
    {
      promptId: 'coding-prompt-9',
      relatedNodeId: 'coding-node-9',
      variableList: ['prevDocs', 'userInput', 'currentStates', 'currentTables'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 当前已有状态数据
{currentStates}

# 当前已有表结构
{currentTables}

# 任务
基于 AI 能力方案和 MVP 范围，确定完整的技术选型并说明实现方案。

# 文档要求

## 1. 前端技术栈
- 框架 + 版本号（如 React 18.3 + TypeScript 5.x）
- UI 组件库 + 版本号
- 状态管理方案
- 路由方案
- 构建工具

## 2. 后端技术栈
- 框架 + 版本号
- API 风格（RESTful / GraphQL）
- 认证方案

## 3. 数据库选型
- 数据库类型和版本
- 选型理由（与数据模型步骤的表结构对齐）
- ORM / 数据访问层

## 4. AI 模型对接
- 具体 API 提供商和模型版本
- SDK 或 HTTP 直接调用
- 流式响应处理方案

## 5. 部署方案
- 开发环境 / 测试环境 / 生产环境
- CI/CD 方案
- 域名和 HTTPS

## 6. 技术难点与解决方案
- 列出 Top 5 技术挑战及具体解决思路

# 用户补充信息
{userInput}

# 输出要求
- 每个技术选型必须注明版本号
- 选型理由要充分，不能只说"流行"
- 方案要可直接用于项目初始化`,
    },
    {
      promptId: 'coding-prompt-10',
      relatedNodeId: 'coding-node-10',
      variableList: ['prevDocs', 'userInput', 'currentStates', 'currentTables'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 当前已有状态数据
{currentStates}

# 当前已有表结构
{currentTables}

# 任务
基于技术选型，输出完整的技术架构设计和实现方案，作为开发的最终技术蓝图。

# 文档要求

## 1. 整体架构设计
- 分层架构图描述（前端层 → API 接口层 → 业务服务层 → 数据访问层 → AI 交互层）
- 各层职责和依赖关系

## 2. 目录结构设计
- 前端项目目录结构（到二级目录）
- 后端项目目录结构（到二级目录）

## 3. 核心 API 接口设计
使用表格格式：
| 接口路径 | 方法 | 说明 | 请求参数 | 返回数据 |
列出所有 MVP 核心接口

## 4. 数据库实施方案
- 完整的建表 SQL（PostgreSQL 语法），与等待区表结构严格一致
- 枚举/状态字段需标注对应的字典值，格式：字段名 COMMENT '状态名: Key1(Value1), Key2(Value2)'
- 索引策略

## 5. 部署实施方案
- 详细的部署步骤（step by step）
- 环境变量配置清单
- 常见问题排查

## 6. 本地开发运行说明
- 环境要求
- 安装步骤
- 启动命令
- 访问地址

# 用户补充信息
{userInput}

# 输出要求
- 这是整个工作流的最终文档，必须完整闭环
- API 设计与前面的功能模块一一对应
- 部署步骤要一步步可操作
- 表结构必须与数据模型步骤保持一致`,
    },
  ],
  waitAreas: [
    {
      waitAreaId: 'wait-state',
      waitAreaName: '状态管理',
      description: '维护项目中所有核心状态，确保全流程状态统一',
      isFixed: true,
      relatedNodeIds: ['coding-node-4', 'coding-node-5', 'coding-node-6', 'coding-node-7', 'coding-node-8', 'coding-node-9', 'coding-node-10'],
      syncRule: 'auto',
      twoWayBind: true,
      type: 'stateManagement',
    },
    {
      waitAreaId: 'wait-table',
      waitAreaName: '核心表管理',
      description: '维护项目中所有核心数据库表结构，确保表结构统一',
      isFixed: true,
      relatedNodeIds: ['coding-node-6', 'coding-node-9', 'coding-node-10'],
      syncRule: 'auto',
      twoWayBind: true,
      type: 'tableManagement',
    },
  ],
};
