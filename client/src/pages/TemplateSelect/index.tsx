import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Button, Space, Tag, Modal, Input, Steps, Drawer,
  message, Row, Col, Tooltip, List, Popconfirm, Divider,
} from 'antd';
import {
  CodeOutlined, RocketOutlined, EyeOutlined, PlusOutlined,
  ArrowRightOutlined, FileTextOutlined, UserOutlined, TeamOutlined,
  FolderOpenOutlined, DeleteOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { TEMPLATE_CODING, TEMPLATE_MVP } from '../../data';
import { useProject } from '../../contexts/ProjectContext';
import { projectStorage } from '../../services/storage';
import type { WorkflowTemplate, ProjectData } from '../../types';

const { Title, Text, Paragraph } = Typography;

const TemplateSelectPage: React.FC = () => {
  const navigate = useNavigate();
  const { initProject, dispatch } = useProject();
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectVision, setProjectVision] = useState('');

  const templates = [
    {
      template: TEMPLATE_CODING,
      icon: <CodeOutlined style={{ fontSize: 32, color: '#4C6EF5' }} />,
      color: '#4C6EF5',
      bgGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      tags: ['程序员', '标准化', '10步流程', '全套技术文档'],
      userIcon: <CodeOutlined />,
    },
    {
      template: TEMPLATE_MVP,
      icon: <RocketOutlined style={{ fontSize: 32, color: '#f5a623' }} />,
      color: '#f5a623',
      bgGradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      tags: ['PM', '外行', '6步流程', '零门槛', '快速落地'],
      userIcon: <TeamOutlined />,
    },
  ];

  const [savedProjects, setSavedProjects] = useState<{ projectId: string; projectName: string; templateName: string; updatedAt: string }[]>([]);

  useEffect(() => {
    setSavedProjects(projectStorage.getList());
  }, []);

  const handleLoadProject = (projectId: string) => {
    const data = projectStorage.load(projectId);
    if (!data) {
      message.error('项目加载失败');
      return;
    }
    const tmpl = data.info.templateId === TEMPLATE_CODING.templateId ? TEMPLATE_CODING : TEMPLATE_MVP;
    dispatch({ type: 'SET_PROJECT', payload: { project: data, template: tmpl } });
    navigate('/workflow');
    message.success('项目已加载');
  };

  const handleDeleteProject = (projectId: string) => {
    projectStorage.delete(projectId);
    setSavedProjects(projectStorage.getList());
    message.success('项目已删除');
  };

  const handleSelect = (template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setCreateModal(true);
  };

  const handleCreate = () => {
    if (!projectName.trim()) {
      message.warning('请输入项目名称');
      return;
    }
    if (!selectedTemplate) return;

    initProject(projectName.trim(), projectVision.trim(), selectedTemplate);
    setCreateModal(false);
    setProjectName('');
    setProjectVision('');
    message.success('项目创建成功！');
    navigate('/workflow');
  };

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          选择工作流模板
        </Title>
        <Text type="secondary" style={{ fontSize: 16 }}>
          选择适合您的模板，开始AI辅助编码之旅。系统将引导您逐步生成标准化项目文档。
        </Text>
      </div>

      <Row gutter={24}>
        {templates.map(({ template, icon, color, tags, bgGradient }) => (
          <Col span={12} key={template.templateId}>
            <Card
              hoverable
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                transition: 'all 0.3s ease',
              }}
              bodyStyle={{ padding: 0 }}
            >
              {/* Header gradient */}
              <div
                style={{
                  background: bgGradient,
                  padding: '28px 24px',
                  color: '#fff',
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 12,
                    }}
                  >
                    {React.cloneElement(icon, { style: { fontSize: 28, color: '#fff' } })}
                  </div>
                  <Title level={4} style={{ color: '#fff', margin: 0 }}>
                    {template.templateName}
                  </Title>
                </div>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                  {template.description}
                </Text>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px' }}>
                <Space size={[4, 8]} wrap style={{ marginBottom: 16 }}>
                  {tags.map(tag => (
                    <Tag key={tag} style={{ borderRadius: 12, fontSize: 12 }} color={color === '#4C6EF5' ? 'blue' : 'orange'}>
                      {tag}
                    </Tag>
                  ))}
                </Space>

                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    适配用户：{template.targetUser}
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    包含步骤：{template.nodes.length} 步 / {template.nodes.length} 份文档
                  </Text>
                </div>

                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleSelect(template)}
                    style={{
                      borderRadius: 8,
                      background: color,
                      borderColor: color,
                    }}
                  >
                    使用此模板
                  </Button>
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewTemplate(template)}
                    style={{ borderRadius: 8 }}
                  >
                    预览步骤
                  </Button>
                </Space>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Saved Projects */}
      {savedProjects.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <Divider />
          <Title level={4} style={{ marginBottom: 16 }}>
            <FolderOpenOutlined style={{ marginRight: 8, color: '#4C6EF5' }} />
            已保存的项目
          </Title>
          <Row gutter={[16, 16]}>
            {savedProjects.map(p => (
              <Col span={8} key={p.projectId}>
                <Card
                  hoverable
                  size="small"
                  style={{ borderRadius: 12 }}
                  actions={[
                    <Button type="link" size="small" onClick={() => handleLoadProject(p.projectId)} key="open">
                      打开
                    </Button>,
                    <Popconfirm title="确认删除项目?" onConfirm={() => handleDeleteProject(p.projectId)} key="del">
                      <Button type="link" size="small" danger>删除</Button>
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    title={<Text strong>{p.projectName}</Text>}
                    description={
                      <Space direction="vertical" size={2}>
                        <Tag style={{ fontSize: 11 }}>{p.templateName}</Tag>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <ClockCircleOutlined style={{ marginRight: 4 }} />
                          {new Date(p.updatedAt).toLocaleString('zh-CN')}
                        </Text>
                      </Space>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        open={createModal}
        title={
          <Space>
            <PlusOutlined style={{ color: '#4C6EF5' }} />
            <span>创建新项目</span>
          </Space>
        }
        onCancel={() => setCreateModal(false)}
        onOk={handleCreate}
        okText="创建并开始"
        cancelText="取消"
        width={520}
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>模板</Text>
            <Tag color="blue" style={{ fontSize: 14, padding: '4px 12px' }}>
              {selectedTemplate?.templateName}
            </Tag>
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              项目名称 <Text type="danger">*</Text>
            </Text>
            <Input
              placeholder="请输入项目名称，如：AI写作助手"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              size="large"
              style={{ borderRadius: 8 }}
            />
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>项目愿景</Text>
            <Input.TextArea
              placeholder="简单描述您的项目愿景和目标（可选）"
              value={projectVision}
              onChange={e => setProjectVision(e.target.value)}
              rows={3}
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>
      </Modal>

      {/* Template Preview Drawer */}
      <Drawer
        open={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        title={
          <Space>
            <EyeOutlined style={{ color: '#4C6EF5' }} />
            <span>{previewTemplate?.templateName} - 步骤预览</span>
          </Space>
        }
        width={560}
      >
        {previewTemplate && (
          <Steps
            direction="vertical"
            current={-1}
            items={previewTemplate.nodes.map(node => ({
              title: (
                <Text strong style={{ fontSize: 14 }}>
                  步骤 {node.step}: {node.docName}
                </Text>
              ),
              description: (
                <div style={{ marginTop: 4 }}>
                  <Paragraph
                    type="secondary"
                    style={{ fontSize: 13, marginBottom: 8 }}
                  >
                    {node.guideText}
                  </Paragraph>
                  {node.relatedWaitAreas.length > 0 && (
                    <Space size={4}>
                      <Text type="secondary" style={{ fontSize: 12 }}>关联等待区:</Text>
                      {node.relatedWaitAreas.map(wa => (
                        <Tag key={wa} color="purple" style={{ fontSize: 11 }}>
                          {wa === 'wait-state' ? '状态管理' : '核心表管理'}
                        </Tag>
                      ))}
                    </Space>
                  )}
                </div>
              ),
              icon: <FileTextOutlined style={{ color: '#4C6EF5' }} />,
            }))}
          />
        )}
      </Drawer>
    </div>
  );
};

export default TemplateSelectPage;
