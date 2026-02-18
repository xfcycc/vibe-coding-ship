import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Input, Modal, Form, List, Tag,
  Empty, Popconfirm, message, Tooltip, Select, Alert,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined,
  SettingOutlined, FileTextOutlined,
  CodeOutlined, RocketOutlined, RollbackOutlined,
} from '@ant-design/icons';
import { TEMPLATE_CODING, TEMPLATE_MVP } from '../../data';
import { templateStorage } from '../../services/storage';
import { idbTemplateStorage } from '../../services/idbStorage';
import type { WorkflowTemplate, WorkflowNode, PromptItem } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text } = Typography;

const saveTemplate = (t: WorkflowTemplate) => {
  templateStorage.save(t);
  idbTemplateStorage.save(t).catch(() => {});
};

const deleteTemplate = (id: string) => {
  templateStorage.delete(id);
  idbTemplateStorage.delete(id).catch(() => {});
};

const TemplateManagePage: React.FC = () => {
  const [customTemplates, setCustomTemplates] = useState<WorkflowTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [newStepModalOpen, setNewStepModalOpen] = useState(false);
  const [promptForm] = Form.useForm();
  const [stepForm] = Form.useForm();
  const [templateForm] = Form.useForm();

  const loadCustomTemplates = async () => {
    try {
      const idbTemplates = await idbTemplateStorage.getAll();
      if (idbTemplates.length > 0) {
        setCustomTemplates(idbTemplates);
        return;
      }
    } catch { /* fallback to localStorage */ }
    setCustomTemplates(templateStorage.getAll());
  };

  useEffect(() => {
    loadCustomTemplates();
  }, []);

  const allTemplates = [TEMPLATE_CODING, TEMPLATE_MVP, ...customTemplates];

  const handleEditPrompt = (template: WorkflowTemplate, prompt: PromptItem) => {
    setEditingTemplate(template);
    setEditingPrompt(prompt);
    promptForm.setFieldsValue({ promptContent: prompt.promptContent });
    setPromptModalOpen(true);
  };

  const handleSavePrompt = () => {
    promptForm.validateFields().then(values => {
      if (!editingTemplate || !editingPrompt) return;

      const updatedTemplate = {
        ...editingTemplate,
        prompts: editingTemplate.prompts.map(p =>
          p.promptId === editingPrompt.promptId
            ? { ...p, promptContent: values.promptContent, editTime: new Date().toISOString() }
            : p
        ),
        updatedAt: new Date().toISOString(),
      };

      if (!updatedTemplate.isPreset) {
        saveTemplate(updatedTemplate);
        loadCustomTemplates();
      } else {
        // For preset templates, save as custom override
        localStorage.setItem(`template-override-${editingPrompt.promptId}`, values.promptContent);
      }

      message.success('提示词已更新');
      setPromptModalOpen(false);
    });
  };

  const handleCreateTemplate = () => {
    templateForm.validateFields().then(values => {
      const newTemplate: WorkflowTemplate = {
        templateId: uuidv4(),
        templateName: values.templateName,
        description: values.description || '',
        targetUser: values.targetUser || '通用',
        isPreset: false,
        isFixed: false,
        nodes: [],
        prompts: [],
        waitAreas: [
          {
            waitAreaId: 'wait-state',
            waitAreaName: '状态管理',
            description: '维护项目核心状态',
            isFixed: true,
            relatedNodeIds: [],
            syncRule: 'auto',
            twoWayBind: true,
            type: 'stateManagement',
          },
          {
            waitAreaId: 'wait-table',
            waitAreaName: '核心表管理',
            description: '维护项目核心表结构',
            isFixed: true,
            relatedNodeIds: [],
            syncRule: 'auto',
            twoWayBind: true,
            type: 'tableManagement',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      saveTemplate(newTemplate);
      setTemplateModalOpen(false);
      templateForm.resetFields();
      loadCustomTemplates();
      message.success('模板创建成功');
    });
  };

  const handleAddStep = (template: WorkflowTemplate) => {
    setEditingTemplate(template);
    stepForm.resetFields();
    setNewStepModalOpen(true);
  };

  const handleSaveStep = () => {
    stepForm.validateFields().then(values => {
      if (!editingTemplate) return;

      const isBacktrack = values.nodeType === 'backtrack';
      const newNode: WorkflowNode = {
        nodeId: uuidv4(),
        step: editingTemplate.nodes.length + 1,
        docName: values.docName,
        guideText: values.guideText || '',
        relatedWaitAreas: values.relatedWaitAreas || [],
        promptId: uuidv4(),
        isFixed: false,
        isRequired: false,
        exampleText: values.exampleText || '',
        enableReviewPrevDocs: true,
        nodeType: values.nodeType || 'normal',
        backtrackTargetNodeId: isBacktrack ? values.backtrackTargetNodeId : undefined,
      };

      const defaultPrompt = isBacktrack
        ? `# 任务\n基于用户修改要求，回溯并重新生成文档。\n\n# 前置文档\n{prevDocs}\n\n# 当前状态\n{currentStates}\n\n# 当前表结构\n{currentTables}\n\n# 用户修改要求\n{userInput}\n\n# 输出要求\n- 保持与原文档结构一致\n- 仅修改用户要求的部分\n- Markdown 格式`
        : `# 任务\n请根据前置文档和用户输入，生成「${values.docName}」文档。\n\n# 前置文档\n{prevDocs}\n\n# 当前状态\n{currentStates}\n\n# 当前表结构\n{currentTables}\n\n# 用户补充\n{userInput}\n\n# 输出要求\n- Markdown 格式\n- 内容具体可落地`;

      const newPrompt: PromptItem = {
        promptId: newNode.promptId,
        promptContent: values.promptContent || defaultPrompt,
        variableList: ['prevDocs', 'userInput', 'currentStates', 'currentTables'],
        relatedNodeId: newNode.nodeId,
        editTime: new Date().toISOString(),
        creator: 'user',
      };

      const updatedTemplate = {
        ...editingTemplate,
        nodes: [...editingTemplate.nodes, newNode],
        prompts: [...editingTemplate.prompts, newPrompt],
        updatedAt: new Date().toISOString(),
      };

      saveTemplate(updatedTemplate);
      setNewStepModalOpen(false);
      loadCustomTemplates();
      message.success('步骤已添加');
    });
  };

  const handleDeleteStep = (template: WorkflowTemplate, nodeId: string) => {
    const node = template.nodes.find(n => n.nodeId === nodeId);
    if (node?.isFixed) {
      message.warning('预设步骤不可删除');
      return;
    }

    const updatedTemplate = {
      ...template,
      nodes: template.nodes.filter(n => n.nodeId !== nodeId).map((n, i) => ({ ...n, step: i + 1 })),
      prompts: template.prompts.filter(p => p.relatedNodeId !== nodeId),
      updatedAt: new Date().toISOString(),
    };

    saveTemplate(updatedTemplate);
    loadCustomTemplates();
    message.success('步骤已删除');
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
    loadCustomTemplates();
    message.success('模板已删除');
  };

  const handleDuplicateTemplate = (template: WorkflowTemplate) => {
    const newTemplate: WorkflowTemplate = {
      ...JSON.parse(JSON.stringify(template)),
      templateId: uuidv4(),
      templateName: `${template.templateName} (副本)`,
      isPreset: false,
      isFixed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveTemplate(newTemplate);
    loadCustomTemplates();
    message.success('模板已复制');
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            <SettingOutlined style={{ marginRight: 8, color: '#4C6EF5' }} />
            模板管理
          </Title>
          <Text type="secondary">管理工作流模板，编辑提示词，新增自定义步骤与模板。</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setTemplateModalOpen(true)}
          style={{ borderRadius: 8 }}
        >
          新建自定义模板
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {allTemplates.map(template => (
          <Card
            key={template.templateId}
            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            title={
              <Space>
                {template.templateId.includes('coding') ? (
                  <CodeOutlined style={{ color: '#4C6EF5' }} />
                ) : template.templateId.includes('mvp') ? (
                  <RocketOutlined style={{ color: '#f5a623' }} />
                ) : (
                  <FileTextOutlined style={{ color: '#722ed1' }} />
                )}
                <span>{template.templateName}</span>
                {template.isPreset && <Tag color="blue">预设</Tag>}
                {!template.isPreset && <Tag color="purple">自定义</Tag>}
                <Tag>{template.nodes.length} 步骤</Tag>
              </Space>
            }
            extra={
              <Space>
                <Tooltip title="复制为新模板">
                  <Button size="small" icon={<CopyOutlined />} onClick={() => handleDuplicateTemplate(template)} style={{ borderRadius: 6 }}>
                    复制
                  </Button>
                </Tooltip>
                {!template.isPreset && (
                  <>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => handleAddStep(template)} style={{ borderRadius: 6 }}>
                      添加步骤
                    </Button>
                    <Popconfirm title="确认删除模板?" onConfirm={() => handleDeleteTemplate(template.templateId)}>
                      <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 6 }}>
                        删除
                      </Button>
                    </Popconfirm>
                  </>
                )}
              </Space>
            }
          >
            <List
              size="small"
              dataSource={template.nodes}
              renderItem={node => {
                const prompt = template.prompts.find(p => p.promptId === node.promptId);
                return (
                  <List.Item
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 4,
                      background: '#fafafa',
                    }}
                    actions={[
                      prompt && (
                        <Tooltip title="编辑提示词" key="edit-prompt">
                          <Button
                            size="small"
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => handleEditPrompt(template, prompt)}
                          >
                            编辑提示词
                          </Button>
                        </Tooltip>
                      ),
                      !node.isFixed && !template.isPreset && (
                        <Popconfirm
                          title="确认删除步骤?"
                          onConfirm={() => handleDeleteStep(template, node.nodeId)}
                          key="delete"
                        >
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      ),
                    ].filter(Boolean)}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag style={{ fontSize: 11, borderRadius: 10 }}>步骤 {node.step}</Tag>
                          <Text style={{ fontSize: 13 }}>{node.docName}</Text>
                          {node.isFixed && <Tag color="orange" style={{ fontSize: 10 }}>固定</Tag>}
                          {node.nodeType === 'backtrack' && (
                            <Tag color="warning" icon={<RollbackOutlined />} style={{ fontSize: 10 }}>回溯节点</Tag>
                          )}
                          {node.relatedWaitAreas?.length > 0 && (
                            <Tag color="blue" style={{ fontSize: 10 }}>
                              关联: {node.relatedWaitAreas.join(', ')}
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                          {node.guideText}
                        </Text>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        ))}
      </div>

      {/* Edit Prompt Modal */}
      <Modal
        open={promptModalOpen}
        title="编辑提示词"
        onCancel={() => setPromptModalOpen(false)}
        onOk={handleSavePrompt}
        okText="保存"
        width={680}
      >
        <Alert
          type="info"
          showIcon={false}
          style={{ marginBottom: 12, fontSize: 12 }}
          message={
            <div>
              <Text strong style={{ fontSize: 12 }}>可用变量：</Text>
              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[
                  { var: '{projectName}', desc: '项目名' },
                  { var: '{projectVision}', desc: '愿景' },
                  { var: '{userInput}', desc: '用户输入' },
                  { var: '{prevDocs}', desc: '前置文档' },
                  { var: '{memorySummary}', desc: '记忆摘要' },
                  { var: '{currentStates}', desc: '状态数据' },
                  { var: '{currentTables}', desc: '表结构数据' },
                ].map(v => (
                  <Tag key={v.var} color="blue" style={{ fontSize: 11, cursor: 'pointer' }}
                    onClick={() => {
                      navigator.clipboard.writeText(v.var);
                      message.success(`已复制 ${v.var}`);
                    }}
                  >
                    {v.var} ({v.desc})
                  </Tag>
                ))}
              </div>
            </div>
          }
        />
        <Form form={promptForm} layout="vertical">
          <Form.Item name="promptContent" rules={[{ required: true }]}>
            <Input.TextArea rows={12} style={{ fontFamily: 'monospace', fontSize: 13, borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Template Modal */}
      <Modal
        open={templateModalOpen}
        title="新建自定义模板"
        onCancel={() => setTemplateModalOpen(false)}
        onOk={handleCreateTemplate}
        okText="创建"
        width={480}
      >
        <Form form={templateForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="templateName" label="模板名称" rules={[{ required: true }]}>
            <Input placeholder="如: ToB后台系统模板" />
          </Form.Item>
          <Form.Item name="description" label="模板描述">
            <Input.TextArea placeholder="描述模板的适用场景" rows={2} />
          </Form.Item>
          <Form.Item name="targetUser" label="目标用户" initialValue="通用">
            <Input placeholder="如: 程序员、PM" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Step Modal */}
      <Modal
        open={newStepModalOpen}
        title="添加新步骤"
        onCancel={() => setNewStepModalOpen(false)}
        onOk={handleSaveStep}
        okText="添加"
        width={560}
      >
        <Form form={stepForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="nodeType" label="节点类型" initialValue="normal">
            <Select
              options={[
                { value: 'normal', label: '普通节点 - 正常生成文档' },
                { value: 'backtrack', label: '回溯节点 - 用于修改已有步骤' },
              ]}
            />
          </Form.Item>
          <Form.Item name="docName" label="文档名称" rules={[{ required: true }]}>
            <Input placeholder="如: 06-部署指南.md" />
          </Form.Item>
          <Form.Item name="guideText" label="引导文本">
            <Input.TextArea placeholder="引导用户输入的提示文本" rows={2} />
          </Form.Item>
          <Form.Item name="exampleText" label="示例文本">
            <Input.TextArea placeholder="给用户的输入示例" rows={2} />
          </Form.Item>
          <Form.Item name="promptContent" label="AI提示词">
            <Input.TextArea
              placeholder={`提示词模板，可用变量:\n{projectName}, {projectVision}, {userInput}, {prevDocs}\n{memorySummary}, {currentStates}, {currentTables}`}
              rows={6}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
          <Form.Item name="relatedWaitAreas" label="关联等待区">
            <Select
              mode="multiple"
              placeholder="选择关联的等待区（AI 将自动提取/注入相关数据）"
              options={[
                { value: 'wait-state', label: '状态管理 (自动提取/注入状态)' },
                { value: 'wait-table', label: '核心表管理 (自动提取/注入表结构)' },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.nodeType !== cur.nodeType}>
            {({ getFieldValue }) =>
              getFieldValue('nodeType') === 'backtrack' && editingTemplate ? (
                <Form.Item name="backtrackTargetNodeId" label="回溯目标步骤">
                  <Select
                    placeholder="选择要回溯到的步骤"
                    options={editingTemplate.nodes.map(n => ({
                      value: n.nodeId,
                      label: `步骤 ${n.step}: ${n.docName}`,
                    }))}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateManagePage;
