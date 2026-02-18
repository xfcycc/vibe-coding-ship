import React, { useState } from 'react';
import {
  Collapse, Button, Space, Input, Select, Tag, Modal, Form, Table,
  Typography, Empty, Popconfirm, Switch, Tooltip, message, Spin, Dropdown,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, DatabaseOutlined,
  PartitionOutlined, SyncOutlined, RobotOutlined, FileTextOutlined,
  DownloadOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import { useProject } from '../../contexts/ProjectContext';
import type { StateItem, StateEnumValue, TableItem, TableField } from '../../types';
import { aiExtractFromDoc } from '../../services/aiDirect';
import { extractStates, extractTables } from '../../utils/docExtractor';
import { computeMergeActions, formatMergeMessage } from '../../utils/waitAreaMerge';
import { configStorage } from '../../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { generateDDL } from '../../utils/ddlExport';

const { Text } = Typography;
const { Panel } = Collapse;

const WaitingAreaPanel: React.FC = () => {
  const { project, template, dispatch } = useProject();
  const [stateModalOpen, setStateModalOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [editingState, setEditingState] = useState<StateItem | null>(null);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [stateForm] = Form.useForm();
  const [tableForm] = Form.useForm();
  const [editingFields, setEditingFields] = useState<TableField[]>([]);
  const [editingEnumValues, setEditingEnumValues] = useState<StateEnumValue[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  if (!project) return null;

  const handleSaveState = () => {
    stateForm.validateFields().then(values => {
      const cleanedEnums = editingEnumValues.filter(e => e.key.trim());
      const stateItem: StateItem = {
        id: editingState?.id || uuidv4(),
        stateName: values.stateName,
        stateValues: cleanedEnums.map(e => e.key),
        enumValues: cleanedEnums,
        description: values.description || '',
        relatedDocs: editingState?.relatedDocs || [],
        relatedTables: editingState?.relatedTables || [],
      };

      if (editingState) {
        dispatch({ type: 'UPDATE_STATE', payload: stateItem });
      } else {
        dispatch({ type: 'ADD_STATE', payload: stateItem });
      }
      setStateModalOpen(false);
      setEditingState(null);
      stateForm.resetFields();
      setEditingEnumValues([]);
    });
  };

  const openEditState = (state: StateItem) => {
    setEditingState(state);
    stateForm.setFieldsValue({
      stateName: state.stateName,
      description: state.description,
    });
    setEditingEnumValues(
      state.enumValues?.length
        ? [...state.enumValues]
        : state.stateValues.map(v => ({ key: v, value: '' }))
    );
    setStateModalOpen(true);
  };

  const handleSaveTable = () => {
    tableForm.validateFields().then(values => {
      const tableItem: TableItem = {
        id: editingTable?.id || uuidv4(),
        tableName: values.tableName,
        description: values.description || '',
        fields: editingFields,
        relatedDocs: editingTable?.relatedDocs || [],
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
    tableForm.setFieldsValue({ tableName: table.tableName, description: table.description });
    setEditingFields([...table.fields]);
    setTableModalOpen(true);
  };

  const addField = () => {
    setEditingFields([
      ...editingFields,
      { id: uuidv4(), fieldName: '', fieldType: 'VARCHAR', description: '', isRequired: false, relatedState: '' },
    ]);
  };

  const updateField = (id: string, updates: Partial<TableField>) => {
    setEditingFields(fields => fields.map(f => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    setEditingFields(fields => fields.filter(f => f.id !== id));
  };

  const handleExportDDL = (table: TableItem, dialect: 'postgresql' | 'mysql' | 'oracle') => {
    const ddl = generateDDL(table, dialect);
    navigator.clipboard.writeText(ddl);
    message.success(`${dialect.toUpperCase()} DDL 已复制到剪贴板`);
  };

  const handleExportAllDDL = (dialect: 'postgresql' | 'mysql' | 'oracle') => {
    const allDDL = project.tables.map(t => generateDDL(t, dialect)).join('\n\n');
    const blob = new Blob([allDDL], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tables_${dialect}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`已导出全部 ${dialect.toUpperCase()} DDL`);
  };

  const handleExtractFromDocs = async () => {
    if (!project) return;
    const allContent = project.documents
      .filter(d => d.content)
      .map(d => `## ${d.docName}\n\n${d.content}`)
      .join('\n\n---\n\n');
    if (!allContent) { message.info('暂无已生成的文档内容可供提取'); return; }

    setIsExtracting(true);

    const regexStates = extractStates(allContent);
    const regexTables = extractTables(allContent);

    let allStates = [...regexStates];
    let allTables = [...regexTables];

    const apiConfig = configStorage.getDefault();
    if (apiConfig) {
      try {
        const aiResult = await aiExtractFromDoc(allContent, apiConfig);
        const regexStateNames = new Set(regexStates.map(s => s.stateName));
        const regexTableNames = new Set(regexTables.map(t => t.tableName));
        for (const s of aiResult.states) {
          if (!regexStateNames.has(s.stateName)) {
            allStates.push({ ...s, id: uuidv4(), relatedDocs: [], relatedTables: [], enumValues: s.stateValues.map(v => ({ key: v, value: '' })) } as any);
          }
        }
        for (const t of aiResult.tables) {
          if (!regexTableNames.has(t.tableName)) {
            allTables.push({ ...t, id: uuidv4(), relatedDocs: [], fields: t.fields.map(f => ({ ...f, id: uuidv4(), relatedState: '' })) } as any);
          }
        }
      } catch { /* regex results already applied */ }
    }

    const mergeResult = computeMergeActions(project.states, project.tables, allStates, allTables);

    for (const action of mergeResult.actions) {
      dispatch(action as any);
    }

    setIsExtracting(false);
    const msg = formatMergeMessage(mergeResult);
    if (msg) {
      message.success(`${msg}（规则+AI双重提取）`);
    } else {
      message.info('文档内容与等待区一致，无需更新');
    }
  };

  const ddlMenuItems = (table: TableItem): MenuProps['items'] => [
    { key: 'pg', label: 'PostgreSQL', onClick: () => handleExportDDL(table, 'postgresql') },
    { key: 'mysql', label: 'MySQL', onClick: () => handleExportDDL(table, 'mysql') },
    { key: 'oracle', label: 'Oracle', onClick: () => handleExportDDL(table, 'oracle') },
  ];

  const allDDLMenuItems: MenuProps['items'] = [
    { key: 'pg', label: 'PostgreSQL', onClick: () => handleExportAllDDL('postgresql') },
    { key: 'mysql', label: 'MySQL', onClick: () => handleExportAllDDL('mysql') },
    { key: 'oracle', label: 'Oracle', onClick: () => handleExportAllDDL('oracle') },
  ];

  const fieldColumns = [
    { title: '字段名', dataIndex: 'fieldName', key: 'fieldName', width: 110, ellipsis: true,
      render: (v: string, r: TableField) => (
        <Text style={{ fontSize: 12, fontWeight: r.isPrimaryKey ? 600 : 400 }}>
          {r.isPrimaryKey ? '🔑 ' : ''}{v}
        </Text>
      ),
    },
    { title: '类型', dataIndex: 'fieldType', key: 'fieldType', width: 80,
      render: (v: string) => <Tag style={{ fontSize: 10, margin: 0 }}>{v}</Tag>,
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true,
      render: (v: string) => <Text type="secondary" style={{ fontSize: 11 }}>{v || '-'}</Text>,
    },
  ];

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <div style={{ marginBottom: 8 }}>
        <Button
          size="small"
          icon={isExtracting ? <SyncOutlined spin /> : <RobotOutlined />}
          onClick={handleExtractFromDocs}
          loading={isExtracting}
          style={{ width: '100%', borderRadius: 6 }}
          type="dashed"
        >
          {isExtracting ? 'AI 正在提取...' : 'AI 智能提取'}
        </Button>
      </div>

      <Collapse defaultActiveKey={['states', 'tables']} ghost style={{ background: 'transparent' }}>
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
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {project.states.map(state => {
                const enums = state.enumValues?.length ? state.enumValues : state.stateValues.map(v => ({ key: v, value: '' }));
                return (
                  <div
                    key={state.id}
                    style={{ padding: '8px 10px', borderRadius: 8, background: '#f8f9fc', marginBottom: 6, border: '1px solid #f0f0f0' }}
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
                    {state.description && <Text type="secondary" style={{ fontSize: 12 }}>{state.description}</Text>}
                    <div style={{ marginTop: 4 }}>
                      {enums.map((e, i) => (
                        <Tag key={i} style={{ fontSize: 11, marginBottom: 2 }}>
                          {e.key}{e.value ? <span style={{ color: '#8c8c8c', marginLeft: 3 }}>= {e.value}</span> : null}
                        </Tag>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Button
            type="dashed" size="small" icon={<PlusOutlined />}
            onClick={() => { setEditingState(null); stateForm.resetFields(); setEditingEnumValues([{ key: '', value: '' }]); setStateModalOpen(true); }}
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
              {project.tables.length > 0 && (
                <Dropdown menu={{ items: allDDLMenuItems }} trigger={['click']}>
                  <Button size="small" type="text" icon={<DownloadOutlined />} style={{ fontSize: 11 }}>
                    导出全部DDL
                  </Button>
                </Dropdown>
              )}
            </Space>
          }
        >
          {project.tables.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无表结构" style={{ margin: '8px 0' }} />
          ) : (
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {project.tables.map(table => (
                <div
                  key={table.id}
                  style={{ padding: '8px 10px', borderRadius: 8, background: '#f6ffed', marginBottom: 8, border: '1px solid #d9f7be' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Space size={4}>
                      <DatabaseOutlined style={{ color: '#52c41a', fontSize: 12 }} />
                      <Text strong style={{ fontSize: 13 }}>{table.tableName}</Text>
                      <Tag style={{ fontSize: 10, margin: 0 }}>{table.fields.length} 字段</Tag>
                    </Space>
                    <Space size={2}>
                      <Dropdown menu={{ items: ddlMenuItems(table) }} trigger={['click']}>
                        <Button size="small" type="text" icon={<DownloadOutlined />} />
                      </Dropdown>
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditTable(table)} />
                      <Popconfirm title="确认删除?" onConfirm={() => dispatch({ type: 'DELETE_TABLE', payload: table.id })}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                  {table.description && (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{table.description}</Text>
                  )}
                  {table.fields.length > 0 ? (
                    <Table
                      dataSource={table.fields}
                      columns={fieldColumns}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      style={{ fontSize: 11 }}
                      scroll={table.fields.length > 8 ? { y: 200 } : undefined}
                    />
                  ) : (
                    <Text type="secondary" style={{ fontSize: 11 }}>暂无字段定义</Text>
                  )}
                </div>
              ))}
            </div>
          )}
          <Button
            type="dashed" size="small" icon={<PlusOutlined />}
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
        onCancel={() => { setStateModalOpen(false); setEditingState(null); setEditingEnumValues([]); }}
        onOk={handleSaveState}
        okText="保存"
        width={520}
      >
        <Form form={stateForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="stateName" label="状态名称" rules={[{ required: true, message: '请输入状态名称' }]}>
            <Input placeholder="如: 用户状态、订单状态" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="状态说明" rows={2} />
          </Form.Item>
        </Form>
        <div style={{ marginBottom: 8 }}>
          <Text strong>枚举值（Key = 显示名/中文，Value = 字典值/英文或数字）</Text>
          <Button size="small" type="link" icon={<PlusOutlined />} onClick={() => setEditingEnumValues([...editingEnumValues, { key: '', value: '' }])}>
            添加
          </Button>
        </div>
        {editingEnumValues.map((ev, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 30px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <Input
              size="small" placeholder="Key（如: 待审核）" value={ev.key}
              onChange={e => {
                const next = [...editingEnumValues];
                next[idx] = { ...next[idx], key: e.target.value };
                setEditingEnumValues(next);
              }}
            />
            <Input
              size="small" placeholder="Value（如: 0 或 PENDING）" value={ev.value}
              onChange={e => {
                const next = [...editingEnumValues];
                next[idx] = { ...next[idx], value: e.target.value };
                setEditingEnumValues(next);
              }}
            />
            <Button
              size="small" type="text" danger icon={<MinusCircleOutlined />}
              onClick={() => setEditingEnumValues(editingEnumValues.filter((_, i) => i !== idx))}
            />
          </div>
        ))}
      </Modal>

      {/* Table Modal */}
      <Modal
        open={tableModalOpen}
        title={editingTable ? '编辑表结构' : '添加表'}
        onCancel={() => { setTableModalOpen(false); setEditingTable(null); }}
        onOk={handleSaveTable}
        okText="保存"
        width={700}
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
          <Button size="small" type="link" icon={<PlusOutlined />} onClick={addField}>添加字段</Button>
        </div>

        {editingFields.map((field) => (
          <div
            key={field.id}
            style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr 40px 40px 30px', gap: 6, marginBottom: 6, alignItems: 'center' }}
          >
            <Input size="small" placeholder="字段名" value={field.fieldName} onChange={e => updateField(field.id, { fieldName: e.target.value })} />
            <Select
              size="small" value={field.fieldType} onChange={v => updateField(field.id, { fieldType: v })}
              options={[
                { value: 'VARCHAR', label: 'VARCHAR' }, { value: 'INT', label: 'INT' },
                { value: 'BIGINT', label: 'BIGINT' }, { value: 'TEXT', label: 'TEXT' },
                { value: 'BOOLEAN', label: 'BOOLEAN' }, { value: 'DATETIME', label: 'DATETIME' },
                { value: 'JSON', label: 'JSON' }, { value: 'DECIMAL', label: 'DECIMAL' },
              ]}
            />
            <Input size="small" placeholder="描述" value={field.description} onChange={e => updateField(field.id, { description: e.target.value })} />
            <Tooltip title="必填">
              <Switch size="small" checked={field.isRequired} onChange={v => updateField(field.id, { isRequired: v })} />
            </Tooltip>
            <Tooltip title="主键">
              <Switch size="small" checked={!!field.isPrimaryKey} onChange={v => updateField(field.id, { isPrimaryKey: v })} />
            </Tooltip>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeField(field.id)} />
          </div>
        ))}
      </Modal>
    </div>
  );
};

export default WaitingAreaPanel;
