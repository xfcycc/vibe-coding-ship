import type { WorkflowTemplate } from '../types';

/** 模板2：零门槛MVP生成模板（6步，适配PM/外行） */
export const TEMPLATE_MVP: WorkflowTemplate = {
  templateId: 'preset-mvp-zero',
  templateName: '零门槛MVP生成模板',
  description: '适配PM、纯外行，侧重无专业门槛、快速落地，步骤简化、引导通俗，无需技术/产品知识，仅需输入项目想法，即可生成可落地的MVP核心文档。',
  targetUser: 'PM / 外行',
  isPreset: true,
  isFixed: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      nodeId: 'mvp-node-1',
      step: 1,
      docName: '00-项目想法梳理.md',
      guideText: '用大白话描述一下你的项目想法：这个项目是做什么的？能解决什么问题？面向哪些人？',
      relatedWaitAreas: [],
      promptId: 'mvp-prompt-1',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：我想做一个帮小商家管理会员的工具，让他们不用花钱买系统也能记录会员信息和消费记录...',
      enableReviewPrevDocs: false,
    },
    {
      nodeId: 'mvp-node-2',
      step: 2,
      docName: '01-MVP核心功能.md',
      guideText: '从你的项目想法中，挑出最重要的3-5个功能，只说"能做什么"就好，不用讲技术。',
      relatedWaitAreas: ['wait-state'],
      promptId: 'mvp-prompt-2',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：1. 能添加和查看会员信息；2. 能记录每次消费；3. 能看到消费统计...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'mvp-node-3',
      step: 3,
      docName: '02-目标用户与场景.md',
      guideText: '描述一下你的目标用户是什么样的人？他们在什么时候、什么场景下会用你的产品？',
      relatedWaitAreas: ['wait-state'],
      promptId: 'mvp-prompt-3',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：目标用户是小区周边的餐饮店老板，30-50岁，不太懂技术，在顾客消费时使用...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'mvp-node-4',
      step: 4,
      docName: '03-简单落地步骤.md',
      guideText: '我们帮你梳理MVP落地的简单步骤，不涉及技术细节，只告诉你"先做什么、再做什么"。',
      relatedWaitAreas: ['wait-state'],
      promptId: 'mvp-prompt-4',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：你可以补充一下预期上线时间、预算范围等信息...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'mvp-node-5',
      step: 5,
      docName: '04-核心数据说明.md',
      guideText: '你的项目需要记录哪些核心数据？比如用户数、订单量等，不用懂专业术语，用大白话说就行。',
      relatedWaitAreas: ['wait-table'],
      promptId: 'mvp-prompt-5',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：需要记录会员姓名、电话、消费金额、消费时间...',
      enableReviewPrevDocs: true,
    },
    {
      nodeId: 'mvp-node-6',
      step: 6,
      docName: '05-MVP交付清单.md',
      guideText: '最后一步！我们帮你整理一份MVP交付清单，对接开发时无需额外沟通。',
      relatedWaitAreas: ['wait-state', 'wait-table'],
      promptId: 'mvp-prompt-6',
      isFixed: true,
      isRequired: true,
      exampleText: '例如：你可以补充对交付时间、交付方式的要求...',
      enableReviewPrevDocs: true,
    },
  ],
  prompts: [
    {
      promptId: 'mvp-prompt-1',
      relatedNodeId: 'mvp-node-1',
      variableList: ['userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 任务
用户用大白话描述了一个项目想法，请帮他整理成结构清晰的项目想法文档。

# 用户的项目想法
{userInput}

# 文档要求（用简单易懂的语言）

## 1. 项目是什么
- 用一两句话说清楚这个项目做什么

## 2. 解决什么问题
- 用户目前遇到什么困难
- 这个项目怎么帮他们解决

## 3. 给谁用
- 目标用户是什么样的人
- 他们的基本特征（年龄、职业、习惯）

## 4. 项目亮点
- 这个项目最吸引人的 2-3 个点

# 输出要求
- 语言通俗易懂，不使用专业术语
- 如果用户描述模糊，帮他补充合理的细节
- Markdown 格式，结构清晰`,
    },
    {
      promptId: 'mvp-prompt-2',
      relatedNodeId: 'mvp-node-2',
      variableList: ['prevDocs', 'userInput', 'currentStates'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 已有状态数据
{currentStates}

# 任务
从项目想法中筛选出 MVP 阶段最核心的功能，帮用户理清"先做什么"。

# 用户补充信息
{userInput}

# 文档要求

## 1. MVP 必做功能（3-5 个）
- 每个功能用一句大白话描述"能做什么"
- 标注重要程度（最重要 / 重要 / 需要）

## 2. 暂时不做的功能
- 列出暂不实现的功能
- 用一句话说明为什么先不做

## 3. 功能使用流程
- 用简单的步骤描述：用户打开 → 做什么 → 看到什么

# 输出要求
- 不要使用技术术语
- 功能描述要具体，不要抽象
- Markdown 格式`,
    },
    {
      promptId: 'mvp-prompt-3',
      relatedNodeId: 'mvp-node-3',
      variableList: ['prevDocs', 'userInput', 'currentStates'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 已有状态数据
{currentStates}

# 任务
帮用户详细描绘目标用户画像和使用场景。

# 用户补充信息
{userInput}

# 文档要求

## 1. 目标用户画像
- 用户年龄、职业、收入水平
- 用户的痛点和需求
- 用户的技术熟悉程度

## 2. 使用场景
- 描述 2-3 个典型场景："什么时候、在哪里、怎么用"
- 每个场景讲一个小故事

## 3. 用户期望
- 用户希望这个产品帮他达成什么效果
- 用户最在意的体验是什么

# 输出要求
- 语言口语化，像在给朋友讲故事
- 场景描述要有画面感
- Markdown 格式`,
    },
    {
      promptId: 'mvp-prompt-4',
      relatedNodeId: 'mvp-node-4',
      variableList: ['prevDocs', 'userInput', 'currentStates'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 已有状态数据
{currentStates}

# 任务
帮用户梳理 MVP 产品从想法到落地的简单步骤，不涉及任何技术细节。

# 用户补充信息
{userInput}

# 文档要求

## 落地步骤（4-6 步）
每步包含：
- **第 N 步：做什么**（一句话标题）
- **具体说明**：这一步要做的事情（大白话）
- **产出物**：这一步完成后能得到什么
- **注意事项**：这一步容易踩的坑

## 时间预估
- 每步大致需要多长时间
- 总共需要多长时间

# 输出要求
- 步骤清晰，外行一看就懂
- 避免任何技术词汇
- Markdown 格式`,
    },
    {
      promptId: 'mvp-prompt-5',
      relatedNodeId: 'mvp-node-5',
      variableList: ['prevDocs', 'userInput', 'currentTables'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 已有表结构
{currentTables}

# 任务
帮用户梳理项目需要记录的核心数据，用大白话解释每类数据的作用。

# 用户补充信息
{userInput}

# 文档要求

## 1. 核心数据清单（3-8 类）
每类数据包含：
- **数据名称**：如"会员信息"
- **包含哪些内容**：如姓名、电话、注册时间
- **为什么要记录**：一句话说明作用
- **大概有多少**：预估数据量级

## 2. 数据之间的关系
- 用简单的话描述数据之间怎么关联
- 比如"一个会员可以有多条消费记录"

## 3. 数据管理需求
- 哪些数据需要经常查看
- 哪些数据需要统计分析

# 输出要求
- 不要出现"字段""类型""主键"等技术术语
- 用生活化的语言解释
- Markdown 格式`,
    },
    {
      promptId: 'mvp-prompt-6',
      relatedNodeId: 'mvp-node-6',
      variableList: ['prevDocs', 'userInput', 'currentStates', 'currentTables'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `# 前置文档
{prevDocs}

# 已有状态数据
{currentStates}

# 已有表结构
{currentTables}

# 任务
汇总所有前面步骤的成果，生成一份完整的 MVP 交付清单，方便用户直接拿给开发团队。

# 用户补充信息
{userInput}

# 文档要求

## 1. 项目概要
- 一段话总结项目是什么、给谁用、核心功能

## 2. 功能交付清单
使用表格：
| 功能名称 | 简要描述 | 优先级 | 备注 |

## 3. 数据需求清单
- 列出需要存储的核心数据

## 4. 交付标准
- 功能完成的判断标准
- 基本的质量要求

## 5. 注意事项
- 开发时需要注意的关键点
- 用户特别在意的体验要求

## 6. 后续规划
- MVP 上线后的改进方向

# 输出要求
- 这份文档是给开发团队看的"需求说明书"
- 要求完整、无歧义
- 语言保持简洁专业
- Markdown 格式`,
    },
  ],
  waitAreas: [
    {
      waitAreaId: 'wait-state',
      waitAreaName: '状态管理',
      description: '维护项目中所有核心状态',
      isFixed: true,
      relatedNodeIds: ['mvp-node-2', 'mvp-node-3', 'mvp-node-4', 'mvp-node-6'],
      syncRule: 'auto',
      twoWayBind: true,
      type: 'stateManagement',
    },
    {
      waitAreaId: 'wait-table',
      waitAreaName: '核心表管理',
      description: '维护项目核心数据（简化版）',
      isFixed: true,
      relatedNodeIds: ['mvp-node-5', 'mvp-node-6'],
      syncRule: 'auto',
      twoWayBind: true,
      type: 'tableManagement',
    },
  ],
};
