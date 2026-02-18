import React, { useState } from 'react';
import {
  Collapse, Table, Button, Space, Input, Select, Tag, Modal, Form,
  Typography, Empty, Popconfirm, Switch, Tooltip, InputNumber, message,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined,
  PartitionOutlined, SaveOutlined, SyncOutlined,
} from '@ant-design/icons';
import { useProject } from '../../contexts/ProjectContext';
import type { StateItem, TableItem, TableField } from '../../types';
import { extractStates, extractTables } from '../../utils/docExtractor';
import { v4 as uuidv4 } from 'uuid';

const { Text } = Typography;
const { Panel } = Collapse;

const WaitingAreaPanel: React.FC = () => {
  const { project, dispatch } = useProject();
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingState, setEditingState] = useState<StateItem | null>(null);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [stateForm] = Form.useForm();
  const [tableForm] = Form.useForm();
  const [editingFields, setEditingFields] = useState<TableField[]>([]);

  if (!project) return null;

  // State Management
  const handleSaveState = () => {
    stateForm.validateFields().then(values => {
      const stateItem: StateItem = {
        id: editingState?.id || uuidv4(),
        stateName: values.stateName,
        stateValues: values.stateValues?.split(',').map((v: string) => v.trim()).filter(Boolean) || [],
        description: values.description || '',
        relatedDocs: [],
        relatedTables: [],
      };

      if (editingState) {
        dispatch({ type: 'UPDATE_STATE', payload: stateItem });
      } else {
        dispatch({ type: 'ADD_STATE', payload: stateItem });
      }
      setStateModalOpen(false);
      setEditingState(null);
      stateForm.resetFields();
    });
  };

  const openEditState = (state: StateItem) => {
    setEditingState(state);
    stateForm.setFieldsValue({
      stateName: state.stateName,
      stateValues: state.stateValues.join(', '),
      description: state.description,
    });
    setStateModalOpen(true);
  };

  // Table Management
  const handleSaveTable = () => {
    tableForm.validateFields().then(values => {
      const tableItem: TableItem = {
        id: editingTable?.id || uuidv4(),
        tableName: values.tableName,
        description: values.description || '',
        fields: editingFields,
        relatedDocs: [],
      };

      if (editingTable) {
        dispatch({ type: 'UPDATE_TABLE', payload: tableItem });
      } else {
        dispatch({ type: 'ADD_TABLE', payload: tableItem });
      }
      setTableModalOpen(false);
      setEditingTable(null);
      tableForm.resetFields();
      setEditingFields([]);
    });
  };

  const openEditTable = (table: TableItem) => {
    setEditingTable(table);
    tableForm.setFieldsValue({
      tableName: table.tableName,
      description: table.description,
    });
    setEditingFields([...table.fields]);
    setTableModalOpen(true);
  };

  const addField = () => {
    setEditingFields([
      ...editingFields,
      {
        id: uuidv4(),
        fieldName: '',
        fieldType: 'VARCHAR',
        description: '',
        isRequired: false,
        relatedState: '',
      },
    ]);
  };

  const updateField = (id: string, updates: Partial<TableField>) => {
    setEditingFields(fields =>
      fields.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeField = (id: string) => {
    setEditingFields(fields => fields.filter(f => f.id !== id));
  };

  const handleExtractFromDocs = () => {
    if (!project) return;

    const allContent = project.documents
      .filter(d => d.content)
      .map(d => d.content)
      .join('\n\n---\n\n');

    if (!allContent) {
      message.info('暂无已生成的文档内容可供提取');
      return;
    }

    const existingStateNames = new Set(project.states.map(s => s.stateName));
    const existingTableNames = new Set(project.tables.map(t => t.tableName));

    const newStates = extractStates(allContent).filter(s => !existingStateNames.has(s.stateName));
    const newTables = extractTables(allContent).filter(t => !existingTableNames.has(t.tableName));

    for (const s of newStates) {
      dispatch({ type: 'ADD_STATE', payload: s });
    }
    for (const t of newTables) {
      dispatch({ type: 'ADD_TABLE', payload: t });
    }

    if (newStates.length > 0 || newTables.length > 0) {
      const parts: string[] = [];
      if (newStates.length > 0) parts.push(`${newStates.length} 个状态`);
      if (newTables.length > 0) parts.push(`${newTables.length} 个表结构`);
      message.success(`已提取 ${parts.join('、')}`);
    } else {
      message.info('未发现新的状态或表结构');
    }
  };

  return (
    <div style={{ padding: '0 12px 12px' }}>
      {/* Extract from docs button */}
      <div style={{ marginBottom: 8 }}>
        <Button
          size="small"
          icon={<SyncOutlined />}
          onClick={handleExtractFromDocs}
          style={{ width: '100%', borderRadius: 6 }}
        >
          从文档自动提取
        </Button>
      </div>

      <Collapse
        defaultActiveKey={['states', 'tables']}
        ghost
        style={{ background: 'transparent' }}
      >
        {/* State Management */}
        <Panel
          key="states"
          header={
            <Space>
              <PartitionOutlined style={{ color: '#4C6EF5' }} />
              <Text strong style={{ fontSize: 13 }}>状态管理</Text>
              <Tag color="blue" style={{ fontSize: 11 }}>{project.states.length}</Tag>
            </Space>
          }
        >
          {project.states.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无状态" style={{ margin: '8px 0' }} />
          ) : (
            <div style={{ maxHeight: 260, overflow: 'auto' }}>
              {project.states.map(state => (
                <div
                  key={state.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#f8f9fc',
                    marginBottom: 6,
                    border: '1px solid #f0f0f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13 }}>{state.stateName}</Text>
                    <Space size={2}>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditState(state)} />
                      <Popconfirm title="确认删除?" onConfirm={() => dispatch({ type: 'DELETE_STATE', payload: state.id })}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                  {state.description && (
                    <Text type="secondary" style={{ fontSize: 12 }}>{state.description}</Text>
                  )}
                  <div style={{ marginTop: 4 }}>
                    {state.stateValues.map(v => (
                      <Tag key={v} style={{ fontSize: 11, marginBottom: 2 }}>{v}</Tag>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => { setEditingState(null); stateForm.resetFields(); setStateModalOpen(true); }}
            style={{ width: '100%', borderRadius: 6, marginTop: 6 }}
          >
            添加状态
          </Button>
        </Panel>

        {/* Table Management */}
        <Panel
          key="tables"
          header={
            <Space>
              <DatabaseOutlined style={{ color: '#52c41a' }} />
              <Text strong style={{ fontSize: 13 }}>核心表管理</Text>
              <Tag color="green" style={{ fontSize: 11 }}>{project.tables.length}</Tag>
            </Space>
          }
        >
          {project.tables.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无表结构" style={{ margin: '8px 0' }} />
          ) : (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {project.tables.map(table => (
                <div
                  key={table.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: '#f6ffed',
                    marginBottom: 6,
                    border: '1px solid #d9f7be',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13 }}>{table.tableName}</Text>
                    <Space size={2}>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditTable(table)} />
                      <Popconfirm title="确认删除?" onConfirm={() => dispatch({ type: 'DELETE_TABLE', payload: table.id })}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                  {table.description && (
                    <Text type="secondary" style={{ fontSize: 12 }}>{table.description}</Text>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      字段: {table.fields.map(f => f.fieldName).join(', ') || '无'}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => { setEditingTable(null); tableForm.resetFields(); setEditingFields([]); setTableModalOpen(true); }}
            style={{ width: '100%', borderRadius: 6, marginTop: 6 }}
          >
            添加表
          </Button>
        </Panel>
      </Collapse>

      {/* State Modal */}
      <Modal
        open={stateModalOpen}
        title={editingState ? '编辑状态' : '添加状态'}
        onCancel={() => { setStateModalOpen(false); setEditingState(null); }}
        onOk={handleSaveState}
        okText="保存"
        width={440}
      >
        <Form form={stateForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="stateName" label="状态名称" rules={[{ required: true, message: '请输入状态名称' }]}>
            <Input placeholder="如: 用户状态、订单状态" />
          </Form.Item>
          <Form.Item name="stateValues" label="状态值（逗号分隔）">
            <Input placeholder="如: 待审核, 已激活, 已禁用" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="状态说明" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Table Modal */}
      <Modal
        open={tableModalOpen}
        title={editingTable ? '编辑表结构' : '添加表'}
        onCancel={() => { setTableModalOpen(false); setEditingTable(null); }}
        onOk={handleSaveTable}
        okText="保存"
        width={640}
      >
        <Form form={tableForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="tableName" label="表名" rules={[{ required: true, message: '请输入表名' }]}>
            <Input placeholder="如: users, orders" />
          </Form.Item>
          <Form.Item name="description" label="表描述">
            <Input placeholder="表的用途说明" />
          </Form.Item>
        </Form>

        <div style={{ marginBottom: 8 }}>
          <Text strong>字段列表</Text>
          <Button size="small" type="link" icon={<PlusOutlined />} onClick={addField}>
            添加字段
          </Button>
        </div>

        {editingFields.map((field, idx) => (
          <div
            key={field.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 1fr 40px 30px',
              gap: 6,
              marginBottom: 6,
              alignItems: 'center',
            }}
          >
            <Input
              size="small"
              placeholder="字段名"
              value={field.fieldName}
              onChange={e => updateField(field.id, { fieldName: e.target.value })}
            />
            <Select
              size="small"
              value={field.fieldType}
              onChange={v => updateField(field.id, { fieldType: v })}
              options={[
                { value: 'VARCHAR', label: 'VARCHAR' },
                { value: 'INT', label: 'INT' },
                { value: 'BIGINT', label: 'BIGINT' },
                { value: 'TEXT', label: 'TEXT' },
                { value: 'BOOLEAN', label: 'BOOLEAN' },
                { value: 'DATETIME', label: 'DATETIME' },
                { value: 'JSON', label: 'JSON' },
                { value: 'DECIMAL', label: 'DECIMAL' },
              ]}
            />
            <Input
              size="small"
              placeholder="描述"
              value={field.description}
              onChange={e => updateField(field.id, { description: e.target.value })}
            />
            <Tooltip title="必填">
              <Switch
                size="small"
                checked={field.isRequired}
                onChange={v => updateField(field.id, { isRequired: v })}
              />
            </Tooltip>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeField(field.id)} />
          </div>
        ))}
      </Modal>
    </div>
  );
};

export default WaitingAreaPanel;
