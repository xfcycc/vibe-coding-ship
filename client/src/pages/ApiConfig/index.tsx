import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, Button, Space, Typography, Tag, Popconfirm,
  message, Switch, InputNumber, List, Divider, Spin, Empty, Tooltip,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined,
  ApiOutlined, ThunderboltOutlined, SaveOutlined,
} from '@ant-design/icons';
import { AI_MODEL_PRESETS } from '../../data';
import { configStorage } from '../../services/storage';
import { idbConfigStorage } from '../../services/idbStorage';
import { testConnectionDirect } from '../../services/aiDirect';
import type { AIModelConfig, AIModelPreset } from '../../types';

const { Title, Text } = Typography;

const ApiConfigPage: React.FC = () => {
  const [configs, setConfigs] = useState<AIModelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AIModelConfig | null>(null);
  const [testing, setTesting] = useState(false);
  const [form] = Form.useForm();

  const loadConfigs = () => {
    setLoading(true);
    setConfigs(configStorage.getAll());
    setLoading(false);
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handlePresetSelect = (provider: AIModelPreset['provider']) => {
    const preset = AI_MODEL_PRESETS.find(p => p.provider === provider);
    if (preset) {
      form.setFieldsValue({
        provider: preset.provider,
        name: preset.label,
        baseUrl: preset.baseUrl,
        model: preset.models[0] || '',
        temperature: preset.defaultTemperature,
        maxTokens: preset.defaultMaxTokens,
      });
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const config: Partial<AIModelConfig> = {
        ...values,
        id: editing?.id,
        stream: true,
        isDefault: values.isDefault ?? false,
      };
      const saved = configStorage.save(config);
      idbConfigStorage.save(saved).catch(() => {});
      message.success(editing ? '配置已更新' : '配置已保存');
      setEditing(null);
      form.resetFields();
      loadConfigs();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('保存失败: ' + err.message);
    }
  };

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      const result = await testConnectionDirect(values as AIModelConfig);
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(result.message);
      }
    } catch (err: any) {
      if (err.errorFields) return;
      message.error('校验失败: ' + err.message);
    }
    setTesting(false);
  };

  const handleEdit = (config: AIModelConfig) => {
    setEditing(config);
    form.setFieldsValue(config);
  };

  const handleDelete = (id: string) => {
    configStorage.delete(id);
    idbConfigStorage.delete(id).catch(() => {});
    message.success('已删除');
    loadConfigs();
  };

  const handleSetDefault = (config: AIModelConfig) => {
    const saved = configStorage.save({ ...config, isDefault: true });
    idbConfigStorage.save(saved).catch(() => {});
    message.success(`已将 ${config.name} 设为默认`);
    loadConfigs();
  };

  const selectedProvider = Form.useWatch('provider', form);
  const providerModels = AI_MODEL_PRESETS.find(p => p.provider === selectedProvider)?.models || [];

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        <ApiOutlined style={{ marginRight: 8, color: '#4C6EF5' }} />
        AI API 配置
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        配置您的AI模型API，系统将通过该API实现文档的流式生成。支持OpenAI、Claude、豆包等主流模型。
      </Text>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Config Form */}
        <Card
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#4C6EF5' }} />
              <span>{editing ? '编辑配置' : '新增配置'}</span>
            </Space>
          }
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <Form form={form} layout="vertical" requiredMark="optional">
            {/* Preset buttons */}
            <Form.Item label="快速选择模型">
              <Space wrap>
                {AI_MODEL_PRESETS.map(p => (
                  <Button
                    key={p.provider}
                    size="small"
                    onClick={() => handlePresetSelect(p.provider)}
                    style={{ borderRadius: 6 }}
                  >
                    {p.label}
                  </Button>
                ))}
              </Space>
            </Form.Item>

            <Form.Item name="name" label="配置名称" rules={[{ required: true, message: '请输入配置名称' }]}>
              <Input placeholder='如 "我的GPT-4o"' />
            </Form.Item>

            <Form.Item name="provider" label="模型提供商" rules={[{ required: true }]}>
              <Select placeholder="选择提供商">
                {AI_MODEL_PRESETS.map(p => (
                  <Select.Option key={p.provider} value={p.provider}>
                    {p.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="baseUrl" label="API Base URL" rules={[{ required: true, message: '请输入API地址' }]}>
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>

            <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入API Key' }]}>
              <Input.Password placeholder="sk-..." />
            </Form.Item>

            <Form.Item name="model" label="模型" rules={[{ required: true, message: '请选择或输入模型' }]}>
              {providerModels.length > 0 ? (
                <Select placeholder="选择模型" showSearch allowClear>
                  {providerModels.map(m => (
                    <Select.Option key={m} value={m}>{m}</Select.Option>
                  ))}
                </Select>
              ) : (
                <Input placeholder="输入模型名称" />
              )}
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="temperature" label="温度值" initialValue={0.7}>
                <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="maxTokens" label="最大Tokens" initialValue={4096}>
                <InputNumber min={100} max={128000} step={100} style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <Form.Item name="isDefault" label="设为默认" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>

            <Space>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} style={{ borderRadius: 6 }}>
                {editing ? '更新配置' : '保存配置'}
              </Button>
              <Button icon={<CheckCircleOutlined />} onClick={handleTest} loading={testing} style={{ borderRadius: 6 }}>
                校验连接
              </Button>
              {editing && (
                <Button onClick={() => { setEditing(null); form.resetFields(); }} style={{ borderRadius: 6 }}>
                  取消
                </Button>
              )}
            </Space>
          </Form>
        </Card>

        {/* Config List */}
        <Card
          title={
            <Space>
              <ApiOutlined style={{ color: '#4C6EF5' }} />
              <span>已保存的配置</span>
              <Tag color="blue">{configs.length}</Tag>
            </Space>
          }
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : configs.length === 0 ? (
            <Empty description="暂无配置，请先新增一个AI API配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <List
              dataSource={configs}
              renderItem={config => (
                <List.Item
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    marginBottom: 8,
                    background: config.isDefault ? '#f0f5ff' : '#fafafa',
                    border: config.isDefault ? '1px solid #adc6ff' : '1px solid #f0f0f0',
                  }}
                  actions={[
                    <Tooltip title="编辑" key="edit">
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(config)} />
                    </Tooltip>,
                    !config.isDefault && (
                      <Tooltip title="设为默认" key="default">
                        <Button size="small" type="text" icon={<CheckCircleOutlined />} onClick={() => handleSetDefault(config)} />
                      </Tooltip>
                    ),
                    <Popconfirm title="确认删除？" onConfirm={() => handleDelete(config.id)} key="delete">
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <span style={{ fontWeight: 600 }}>{config.name}</span>
                        {config.isDefault && <Tag color="blue">默认</Tag>}
                        <Tag>{config.provider}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
                        <Text type="secondary">模型: {config.model}</Text>
                        <Text type="secondary">温度: {config.temperature} | MaxTokens: {config.maxTokens}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    </div>
  );
};

export default ApiConfigPage;
