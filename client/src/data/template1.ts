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
      variableList: ['projectName', 'projectVision'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `基于项目名称【{projectName}】和愿景【{projectVision}】，结合AI编码落地需求，请生成一份完整的"商业模式与交付"文档，包含以下内容：
1. 项目的商业模式（ToB/ToC/其他）
2. 核心盈利点（若有）
3. 交付物清单（需贴合MVP开发，明确文档、代码、部署包等）
4. 交付标准及验收条件

{userInput}

要求：语言简洁、可落地，避免空泛，文档格式为Markdown，分章节清晰。`,
    },
    {
      promptId: 'coding-prompt-2',
      relatedNodeId: 'coding-node-2',
      variableList: ['projectName', 'projectVision', 'prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合项目名称【{projectName}】、愿景【{projectVision}】及上一步商业模式文档内容：
{prevDocs}

请详细阐述产品全景：
1. 愿景细节（要解决的核心痛点、最终达成的目标）
2. 核心价值（区别于其他产品的优势）
3. 目标用户画像（精准描述，贴合实际使用场景）
4. 整体核心功能（不拆分多端，仅讲全局功能）
5. 差异化优势

{userInput}

文档格式为Markdown，逻辑连贯，贴合AI编码落地需求。`,
    },
    {
      promptId: 'coding-prompt-3',
      relatedNodeId: 'coding-node-3',
      variableList: ['projectName', 'prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `基于项目全景与愿景内容：
{prevDocs}

请梳理项目核心技术相关内容：
1. 核心技术亮点（如AI交互、轻量部署、高并发处理等，贴合AI编码场景）
2. 初步核心技术栈（前端、后端、数据库、AI模型等，可模糊描述，后续步骤细化）
3. 核心技术难点（如上下文关联、状态统一、多端适配等）
4. 潜在专利点（若无可写"无"）

{userInput}

文档格式为Markdown，聚焦技术落地，避免冗余。`,
    },
    {
      promptId: 'coding-prompt-4',
      relatedNodeId: 'coding-node-4',
      variableList: ['prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合前置文档内容中的目标用户画像：
{prevDocs}

请详细梳理用户与角色体系：
1. 用户类型（如普通用户、管理员、运营人员等）
2. 角色划分（对应用户类型，明确每个角色的定位）
3. 各角色核心权限（细化到操作层面）
4. 角色关联关系

{userInput}

文档格式为Markdown，权限描述清晰，为后续多端产品文档、权限设计奠定基础。请同时输出需要维护的用户相关状态信息。`,
    },
    {
      promptId: 'coding-prompt-5',
      relatedNodeId: 'coding-node-5',
      variableList: ['prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `基于用户与角色体系文档：
{prevDocs}

用户选择的终端类型为：{userInput}

请按每个终端生成独立产品文档：
1. 终端定位（服务于哪个角色、核心用途）
2. 核心功能模块（拆分具体功能点，贴合角色权限）
3. 页面流程（核心页面的跳转逻辑）
4. 基础交互规范（按钮位置、提示逻辑）

文档格式为Markdown，每个终端单独成章节，功能描述贴合开发需求。`,
    },
    {
      promptId: 'coding-prompt-6',
      relatedNodeId: 'coding-node-6',
      variableList: ['prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合多端产品文档：
{prevDocs}

请梳理核心数据相关内容：
1. 核心数据模型（如用户模型、订单模型，对应各端功能）
2. 初步核心表结构（表名、核心字段、字段类型、备注）
3. 数据流转逻辑（如"用户注册→数据存入用户表→更新用户状态"）
4. 核心业务工作流（用流程描述核心业务逻辑）

{userInput}

文档格式为Markdown，表结构清晰，数据流转贴合业务。请明确列出所有核心表及字段详情，以及所有需要维护的业务状态。`,
    },
    {
      promptId: 'coding-prompt-7',
      relatedNodeId: 'coding-node-7',
      variableList: ['prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `基于核心技术与数据模型文档：
{prevDocs}

请梳理AI相关内容：
1. 项目所用AI能力（如文档生成、代码生成、需求校验等）
2. AI算法选型（若有，如分类算法、生成算法，无可写"无，依赖第三方AI模型"）
3. AI交互逻辑（如"用户输入→系统生成提示词→调用AI→返回结果→用户修改"）
4. AI输出规范（如文档格式、代码风格、命名规范）

{userInput}

文档格式为Markdown，聚焦AI与业务的结合。`,
    },
    {
      promptId: 'coding-prompt-8',
      relatedNodeId: 'coding-node-8',
      variableList: ['prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `基于多端产品文档与核心业务工作流：
{prevDocs}

请明确MVP范围与迭代路线：
1. MVP核心功能范围（必做功能列表，贴合落地，不贪多）
2. MVP不做的功能（明确排除项，避免冗余）
3. MVP上线时间预估（合理预估）
4. 迭代优先级（核心功能→优化功能→附加功能）
5. 后续迭代计划（2-3轮迭代的核心目标）

{userInput}

文档格式为Markdown，逻辑清晰，可落地。`,
    },
    {
      promptId: 'coding-prompt-9',
      relatedNodeId: 'coding-node-9',
      variableList: ['prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `基于核心技术、AI能力与MVP范围文档：
{prevDocs}

请明确完整技术选型与实现说明：
1. 前端技术栈（框架、UI库、版本号）
2. 后端技术栈（框架、版本号）
3. 数据库选型（说明选型理由）
4. AI模型选型（说明适配理由）
5. 部署环境（说明部署方案）
6. 各技术实现难点及初步解决方案

{userInput}

文档格式为Markdown，技术选型贴合TS快速开发，理由充分，可直接用于编码。`,
    },
    {
      promptId: 'coding-prompt-10',
      relatedNodeId: 'coding-node-10',
      variableList: ['prevDocs'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `基于技术选型文档：
{prevDocs}

请详细阐述技术架构与实现方案：
1. 整体技术架构（前端层→接口层→服务层→数据层→AI交互层）
2. 各层核心职责（明确每层的功能、依赖关系）
3. 核心接口设计（接口地址、请求方式、参数、返回值）
4. 部署方案（详细步骤，简单易懂）
5. 运行说明（本地运行、线上运行的步骤，排查常见问题）

{userInput}

文档格式为Markdown，架构清晰，部署/运行步骤可直接操作，完成MVP落地闭环。`,
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
