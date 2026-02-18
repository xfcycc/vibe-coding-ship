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
      promptContent: `基于用户输入的项目想法：
{userInput}

请用简单易懂的语言梳理：
1. 项目核心是做什么的
2. 能解决什么具体问题
3. 面向哪些人使用

要求：语言口语化转书面语，简洁不冗余，文档格式为Markdown。`,
    },
    {
      promptId: 'mvp-prompt-2',
      relatedNodeId: 'mvp-node-2',
      variableList: ['prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合项目想法梳理内容：
{prevDocs}

用户补充信息：{userInput}

请筛选出MVP必做的3-5个核心功能，每个功能用1句话描述（只说功能，不讲技术），同时明确哪些功能暂时不做。
文档格式为Markdown，清晰易懂。`,
    },
    {
      promptId: 'mvp-prompt-3',
      relatedNodeId: 'mvp-node-3',
      variableList: ['prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合项目想法和核心功能：
{prevDocs}

用户补充信息：{userInput}

请用通俗的语言描述：
1. 目标用户的年龄、需求、使用习惯
2. 用户使用项目的具体场景（什么时候用、怎么用）

避免专业术语，文档格式为Markdown。`,
    },
    {
      promptId: 'mvp-prompt-4',
      relatedNodeId: 'mvp-node-4',
      variableList: ['prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合核心功能：
{prevDocs}

用户补充信息：{userInput}

请梳理MVP简单落地步骤（无需技术细节），分4-5步，每一步用大白话描述，明确先后顺序，让外行也能看懂落地逻辑。
文档格式为Markdown。`,
    },
    {
      promptId: 'mvp-prompt-5',
      relatedNodeId: 'mvp-node-5',
      variableList: ['prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合核心功能：
{prevDocs}

用户补充信息：{userInput}

请梳理项目需要记录的3-5个核心数据，说明每个数据的含义（用大白话），不用涉及表结构、字段等专业内容。
文档格式为Markdown。`,
    },
    {
      promptId: 'mvp-prompt-6',
      relatedNodeId: 'mvp-node-6',
      variableList: ['prevDocs', 'userInput'],
      editTime: new Date().toISOString(),
      creator: 'system',
      promptContent: `结合前面所有步骤的内容：
{prevDocs}

用户补充信息：{userInput}

请梳理MVP交付清单，明确：
1. 交付物（核心功能、相关文档）
2. 交付标准（简单可落地）
3. 注意事项

用通俗的语言描述，方便对接开发人员。文档格式为Markdown。`,
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
