import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Input, Modal, Form, List, Tag,
  Empty, Popconfirm, message, Tabs, Tooltip, Divider, Select,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined,
  SettingOutlined, DragOutlined, FileTextOutlined, SaveOutlined,
  CodeOutlined, RocketOutlined,
} from '@ant-design/icons';
import { TEMPLATE_CODING, TEMPLATE_MVP } from '../../data';
import { templateStorage } from '../../services/storage';
import type { WorkflowTemplate, WorkflowNode, PromptItem } from '../../types';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text, Paragraph } = Typography;

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

  const loadCustomTemplates = () => {
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
        templateStorage.save(updatedTemplate);
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

      templateStorage.save(newTemplate);
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
      };

      const newPrompt: PromptItem = {
        promptId: newNode.promptId,
        promptContent: values.promptContent || '请根据前置文档内容和用户输入，生成{docName}文档。\n\n{userInput}\n\n{prevDocs}',
        variableList: ['prevDocs', 'userInput'],
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

      templateStorage.save(updatedTemplate);
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

    templateStorage.save(updatedTemplate);
    loadCustomTemplates();
    message.success('步骤已删除');
  };

  const handleDeleteTemplate = (id: string) => {
    templateStorage.delete(id);
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
    templateStorage.save(newTemplate);
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
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            可用变量: {'{projectName}'}, {'{projectVision}'}, {'{userInput}'}, {'{prevDocs}'}
          </Text>
        </div>
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
              placeholder="提示词模板，可用变量: {projectName}, {projectVision}, {userInput}, {prevDocs}"
              rows={4}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
          <Form.Item name="relatedWaitAreas" label="关联等待区">
            <Select
              mode="multiple"
              placeholder="选择关联的等待区"
              options={[
                { value: 'wait-state', label: '状态管理' },
                { value: 'wait-table', label: '核心表管理' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TemplateManagePage;
