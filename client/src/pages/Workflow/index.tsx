import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Layout, Typography, Button, Space, Input, message, Empty, Steps, Tooltip,
  Card, Tag, Drawer, Tabs, Alert, Collapse,
} from 'antd';
import {
  PlayCircleOutlined, StopOutlined, ReloadOutlined, EditOutlined,
  LeftOutlined, RightOutlined, FileTextOutlined, CheckCircleOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, EyeOutlined,
  CopyOutlined, SwapOutlined, BulbOutlined, LoadingOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { streamAIDirect, streamFollowUpDirect } from '../../services/aiDirect';
import { configStorage } from '../../services/storage';
import WaitingAreaPanel from '../../components/WaitingArea/WaitingAreaPanel';
import DiffViewerComponent from '../../components/DiffViewer/DiffViewerComponent';
import { exportProjectAsZip, exportSingleDoc } from '../../utils/export';
import { extractStates, extractTables } from '../../utils/docExtractor';
import { v4 as uuidv4 } from 'uuid';

const { Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

const WorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { project, template, dispatch, getPrevDocsContent } = useProject();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState('');
  const [reasoningMap, setReasoningMap] = useState<Record<number, string>>({});
  const [followUpInput, setFollowUpInput] = useState('');
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [prevDocsDrawer, setPrevDocsDrawer] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [oldContent, setOldContent] = useState('');
  const [newContent, setNewContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const streamContentRef = useRef('');
  const streamReasoningRef = useRef('');
  const streamStepRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);

  const flushStreamContent = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }
    setStreamContent(streamContentRef.current);
    const step = streamStepRef.current;
    const reasoning = streamReasoningRef.current;
    if (reasoning) {
      setReasoningMap(prev => ({ ...prev, [step]: reasoning }));
    }
  }, []);

  const scheduleStreamUpdate = useCallback(() => {
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        setStreamContent(streamContentRef.current);
        const step = streamStepRef.current;
        const reasoning = streamReasoningRef.current;
        if (reasoning) {
          setReasoningMap(prev => ({ ...prev, [step]: reasoning }));
        }
        rafIdRef.current = 0;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  useEffect(() => {
    setStreamContent('');
    streamContentRef.current = '';
  }, [project?.currentStep]);

  if (!project || !template) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <Empty
          description={
            <Space direction="vertical" align="center">
              <Text>尚未创建项目，请先选择模板创建项目</Text>
              <Button type="primary" onClick={() => navigate('/templates')} style={{ borderRadius: 8 }}>
                选择模板
              </Button>
            </Space>
          }
        />
      </div>
    );
  }

  const currentStep = project.currentStep;
  const currentNode = template.nodes[currentStep];
  const currentDoc = project.documents[currentStep];
  const currentPrompt = template.prompts.find(p => p.promptId === currentNode?.promptId);
  const displayContent = isStreaming ? streamContent : (currentDoc?.content || '');
  const currentReasoning = isStreaming ? streamReasoningRef.current : (reasoningMap[currentStep] || '');

  const autoExtractFromDoc = useCallback((docContent: string, node: typeof currentNode) => {
    if (!node || !template || !docContent) return;

    const relatedAreas = node.relatedWaitAreas || [];
    const waitAreas = template.waitAreas || [];

    const hasStateArea = relatedAreas.some(areaId => {
      const area = waitAreas.find(w => w.waitAreaId === areaId);
      return area?.type === 'stateManagement' && area.syncRule === 'auto';
    });
    const hasTableArea = relatedAreas.some(areaId => {
      const area = waitAreas.find(w => w.waitAreaId === areaId);
      return area?.type === 'tableManagement' && area.syncRule === 'auto';
    });

    let stateCount = 0;
    let tableCount = 0;

    if (hasStateArea) {
      const extracted = extractStates(docContent);
      if (extracted.length > 0) {
        const existingNames = new Set((project?.states || []).map(s => s.stateName));
        const newStates = extracted.filter(s => !existingNames.has(s.stateName));
        for (const s of newStates) {
          dispatch({ type: 'ADD_STATE', payload: { ...s, relatedDocs: [node.nodeId] } });
        }
        stateCount = newStates.length;
      }
    }

    if (hasTableArea) {
      const extracted = extractTables(docContent);
      if (extracted.length > 0) {
        const existingNames = new Set((project?.tables || []).map(t => t.tableName));
        const newTables = extracted.filter(t => !existingNames.has(t.tableName));
        for (const t of newTables) {
          dispatch({ type: 'ADD_TABLE', payload: { ...t, relatedDocs: [node.nodeId] } });
        }
        tableCount = newTables.length;
      }
    }

    if (stateCount > 0 || tableCount > 0) {
      const parts: string[] = [];
      if (stateCount > 0) parts.push(`${stateCount} 个状态`);
      if (tableCount > 0) parts.push(`${tableCount} 个表结构`);
      message.success(`已自动提取 ${parts.join('、')} 到等待区`);
    }
  }, [template, project, dispatch]);

  const handleGenerate = useCallback(async () => {
    if (!currentPrompt || !currentNode) return;

    const apiConfig = configStorage.getDefault();
    if (!apiConfig) {
      message.error('请先在「API配置」页面配置AI模型API');
      return;
    }

    const abort = new AbortController();
    abortRef.current = abort;
    streamContentRef.current = '';
    streamReasoningRef.current = '';
    streamStepRef.current = currentStep;
    setIsStreaming(true);
    setStreamContent('');
    setReasoningMap(prev => ({ ...prev, [currentStep]: '' }));
    setShowFollowUp(false);
    setShowDiff(false);

    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: { nodeId: currentNode.nodeId, updates: { status: 'generating' } },
    });

    let fullContent = '';
    let fullReasoning = '';
    await streamAIDirect(
      {
        promptTemplate: currentPrompt.promptContent,
        projectName: project.info.projectName,
        projectVision: project.info.projectVision,
        userInput: currentDoc?.userInput || '',
        prevDocs: getPrevDocsContent(currentStep),
      },
      apiConfig,
      {
        onChunk: (chunk) => {
          fullContent += chunk;
          streamContentRef.current = fullContent;
          scheduleStreamUpdate();
        },
        onReasoningChunk: (chunk) => {
          fullReasoning += chunk;
          streamReasoningRef.current = fullReasoning;
          scheduleStreamUpdate();
        },
        onDone: () => {
          flushStreamContent();
          setIsStreaming(false);
          abortRef.current = null;
          const newVersion = { versionId: uuidv4(), content: fullContent, createdAt: new Date().toISOString() };
          const versions = [...(currentDoc?.versions || []), newVersion].slice(-3);
          dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: {
              nodeId: currentNode.nodeId,
              updates: {
                content: fullContent,
                status: 'completed',
                versions,
                currentVersionIndex: versions.length - 1,
              },
            },
          });
          autoExtractFromDoc(fullContent, currentNode);
          setShowFollowUp(true);
        },
        onError: (err) => {
          flushStreamContent();
          setIsStreaming(false);
          abortRef.current = null;
          message.error(err);
          dispatch({
            type: 'UPDATE_DOCUMENT',
            payload: { nodeId: currentNode.nodeId, updates: { status: 'pending' } },
          });
        },
      },
      abort.signal
    );
  }, [currentPrompt, currentNode, currentDoc, currentStep, project, dispatch, getPrevDocsContent, scheduleStreamUpdate, flushStreamContent, autoExtractFromDoc]);

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    flushStreamContent();
  };

  const handleFollowUp = useCallback(async () => {
    if (!followUpInput.trim() || !currentDoc?.content) return;

    const apiConfig = configStorage.getDefault();
    if (!apiConfig) {
      message.error('请先在「API配置」页面配置AI模型API');
      return;
    }

    const abort = new AbortController();
    abortRef.current = abort;
    streamContentRef.current = '';
    streamReasoningRef.current = '';
    streamStepRef.current = currentStep;
    setIsStreaming(true);
    setOldContent(currentDoc.content);
    setStreamContent('');
    setReasoningMap(prev => ({ ...prev, [currentStep]: '' }));

    let fullContent = '';
    let fullReasoning = '';
    await streamFollowUpDirect(
      {
        currentContent: currentDoc.content,
        userInstruction: followUpInput.trim(),
      },
      apiConfig,
      {
        onChunk: (chunk) => {
          fullContent += chunk;
          streamContentRef.current = fullContent;
          scheduleStreamUpdate();
        },
        onReasoningChunk: (chunk) => {
          fullReasoning += chunk;
          streamReasoningRef.current = fullReasoning;
          scheduleStreamUpdate();
        },
        onDone: () => {
          flushStreamContent();
          setIsStreaming(false);
          abortRef.current = null;
          setNewContent(fullContent);
          setShowDiff(true);
          setFollowUpInput('');
        },
        onError: (err) => {
          flushStreamContent();
          setIsStreaming(false);
          abortRef.current = null;
          message.error(err);
        },
      },
      abort.signal
    );
  }, [followUpInput, currentDoc, currentStep, scheduleStreamUpdate, flushStreamContent]);

  const handleAcceptNew = () => {
    if (!currentNode) return;
    const newVersion = { versionId: uuidv4(), content: newContent, createdAt: new Date().toISOString() };
    const versions = [...(currentDoc?.versions || []), newVersion].slice(-3);
    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: {
        nodeId: currentNode.nodeId,
        updates: { content: newContent, versions, currentVersionIndex: versions.length - 1 },
      },
    });
    setShowDiff(false);
    setNewContent('');
    setOldContent('');
    message.success('已接受新内容');
  };

  const handleKeepOld = () => {
    setShowDiff(false);
    setNewContent('');
    setOldContent('');
  };

  const handleConfirm = () => {
    if (!currentNode) return;
    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: { nodeId: currentNode.nodeId, updates: { status: 'confirmed' } },
    });
    if (currentStep < template.nodes.length - 1) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: currentStep + 1 });
    }
    message.success('文档已确认');
  };

  const handleSwitchVersion = (idx: number) => {
    if (!currentNode || !currentDoc?.versions[idx]) return;
    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: {
        nodeId: currentNode.nodeId,
        updates: { content: currentDoc.versions[idx].content, currentVersionIndex: idx },
      },
    });
  };

  // Auto-scroll content area during streaming
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamContent, isStreaming]);

  return (
    <Layout style={{ height: 'calc(100vh - 56px)', background: '#f8f9fc' }}>
      {/* Left: Step Navigation */}
      <Sider
        width={leftCollapsed ? 0 : 260}
        style={{
          background: '#fff',
          borderRight: '1px solid #e5e7eb',
          overflow: 'auto',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ padding: '16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text strong style={{ fontSize: 14 }}>工作流步骤</Text>
            <Button
              type="text"
              size="small"
              icon={<MenuFoldOutlined />}
              onClick={() => setLeftCollapsed(true)}
            />
          </div>

          <Steps
            direction="vertical"
            current={currentStep}
            size="small"
            onChange={(step) => dispatch({ type: 'SET_CURRENT_STEP', payload: step })}
            items={template.nodes.map((node, idx) => {
              const doc = project.documents[idx];
              return {
                title: (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: idx === currentStep ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {node.docName.replace('.md', '')}
                  </Text>
                ),
                status:
                  doc?.status === 'confirmed' ? 'finish' :
                  idx === currentStep ? 'process' :
                  idx < currentStep && doc?.content ? 'finish' : 'wait',
                icon: doc?.status === 'confirmed' ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : undefined,
              };
            })}
          />
        </div>
      </Sider>

      {/* Center: Main Content Area */}
      <Content style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div
          style={{
            padding: '12px 20px',
            background: '#fff',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space>
            {leftCollapsed && (
              <Button type="text" size="small" icon={<MenuUnfoldOutlined />} onClick={() => setLeftCollapsed(false)} />
            )}
            <Tag color="blue">步骤 {currentStep + 1}/{template.nodes.length}</Tag>
            <Title level={5} style={{ margin: 0 }}>{currentNode?.docName}</Title>
          </Space>
          <Space>
            {currentNode?.enableReviewPrevDocs && (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => setPrevDocsDrawer(true)}
                style={{ borderRadius: 6 }}
              >
                查看前置文档
              </Button>
            )}
            {rightCollapsed && (
              <Button type="text" size="small" icon={<MenuUnfoldOutlined />} onClick={() => setRightCollapsed(false)}>
                等待区
              </Button>
            )}
          </Space>
        </div>

        {/* Guide Text */}
        <div style={{ padding: '12px 20px', background: '#f0f5ff', borderBottom: '1px solid #d6e4ff' }}>
          <Text style={{ fontSize: 13, color: '#4C6EF5' }}>
            {currentNode?.guideText}
          </Text>
          {currentNode?.exampleText && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                {currentNode.exampleText}
              </Text>
            </div>
          )}
        </div>

        {/* User Input */}
        <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
          <Input.TextArea
            placeholder="在此输入您的补充信息和需求说明..."
            value={currentDoc?.userInput || ''}
            onChange={(e) => {
              dispatch({
                type: 'UPDATE_DOCUMENT',
                payload: { nodeId: currentNode.nodeId, updates: { userInput: e.target.value } },
              });
            }}
            rows={2}
            style={{ borderRadius: 8 }}
          />
          <Space style={{ marginTop: 8 }}>
            {!isStreaming ? (
              <>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleGenerate}
                  style={{ borderRadius: 8 }}
                >
                  {currentDoc?.content ? '重新生成' : '开始生成'}
                </Button>
                {currentDoc?.content && currentDoc.status === 'completed' && (
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleConfirm}
                    style={{ borderRadius: 8, background: '#52c41a', borderColor: '#52c41a' }}
                  >
                    确认并下一步
                  </Button>
                )}
              </>
            ) : (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={handleStop}
                style={{ borderRadius: 8 }}
              >
                停止生成
              </Button>
            )}
          </Space>
        </div>

        {/* Diff View */}
        {showDiff && (
          <div style={{ padding: '12px 20px', background: '#fff8f0', borderBottom: '1px solid #ffd591' }}>
            <DiffViewerComponent
              oldContent={oldContent}
              newContent={newContent}
              onAccept={handleAcceptNew}
              onReject={handleKeepOld}
            />
          </div>
        )}

        {/* Document Content Display */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
          }}
        >
          {/* AI Reasoning / Thinking Section */}
          {currentReasoning && (
            <Collapse
              size="small"
              style={{ marginBottom: 16, borderRadius: 10, background: '#fefcf4', border: '1px solid #faecd0' }}
              defaultActiveKey={isStreaming ? ['reasoning'] : []}
              items={[{
                key: 'reasoning',
                label: (
                  <Space>
                    {isStreaming && !streamContent ? (
                      <LoadingOutlined style={{ color: '#faad14' }} />
                    ) : (
                      <BulbOutlined style={{ color: '#faad14' }} />
                    )}
                    <Text style={{ fontSize: 13, color: '#ad6800' }}>
                      AI 思考过程{isStreaming && !streamContent ? '（思考中...）' : ''}
                    </Text>
                  </Space>
                ),
                children: (
                  <div style={{ maxHeight: 300, overflow: 'auto', fontSize: 13, color: '#8c8c8c', lineHeight: 1.8 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentReasoning}</ReactMarkdown>
                  </div>
                ),
              }]}
            />
          )}

          {displayContent ? (
            <Card
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                minHeight: 200,
              }}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <div className={`markdown-body ${isStreaming ? 'streaming-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              {isStreaming && currentReasoning ? (
                <Card style={{ borderRadius: 12, textAlign: 'center', padding: '20px 40px' }}>
                  <LoadingOutlined style={{ fontSize: 24, color: '#4C6EF5', marginBottom: 12 }} />
                  <div><Text type="secondary">AI 正在思考中，内容即将输出...</Text></div>
                </Card>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={'点击"开始生成"让AI为您生成文档'}
                />
              )}
            </div>
          )}

          {/* Follow-up Input */}
          {showFollowUp && !isStreaming && currentDoc?.content && !showDiff && (
            <Card
              size="small"
              style={{ marginTop: 16, borderRadius: 12, border: '1px solid #d9d9d9' }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="对当前文档有修改意见？输入修改指令让AI优化..."
                  value={followUpInput}
                  onChange={e => setFollowUpInput(e.target.value)}
                  onPressEnter={handleFollowUp}
                  style={{ borderRadius: '8px 0 0 8px' }}
                />
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={handleFollowUp}
                  disabled={!followUpInput.trim()}
                  style={{ borderRadius: '0 8px 8px 0' }}
                >
                  追问修改
                </Button>
              </Space.Compact>
            </Card>
          )}

          {/* Version history */}
          {currentDoc?.versions && currentDoc.versions.length > 1 && (
            <Card
              size="small"
              style={{ marginTop: 12, borderRadius: 12 }}
              bodyStyle={{ padding: '8px 16px' }}
            >
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>版本记录:</Text>
                {currentDoc.versions.map((v, idx) => (
                  <Button
                    key={v.versionId}
                    size="small"
                    type={idx === currentDoc.currentVersionIndex ? 'primary' : 'default'}
                    onClick={() => handleSwitchVersion(idx)}
                    style={{ borderRadius: 6, fontSize: 12 }}
                  >
                    V{idx + 1}
                  </Button>
                ))}
              </Space>
            </Card>
          )}
        </div>

        {/* Bottom nav */}
        <div
          style={{
            padding: '10px 20px',
            background: '#fff',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Button
            icon={<LeftOutlined />}
            disabled={currentStep === 0}
            onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: currentStep - 1 })}
            style={{ borderRadius: 8 }}
          >
            上一步
          </Button>
          <Space>
            <Text type="secondary" style={{ lineHeight: '32px', fontSize: 13 }}>
              {project.info.projectName}
            </Text>
            <Tooltip title="导出当前文档">
              <Button
                size="small"
                type="text"
                icon={<CopyOutlined />}
                disabled={!currentDoc?.content}
                onClick={() => {
                  if (currentDoc?.content) {
                    exportSingleDoc(currentDoc.docName, currentDoc.content);
                    message.success('文档已导出');
                  }
                }}
              />
            </Tooltip>
            <Tooltip title="导出全部文档(ZIP)">
              <Button
                size="small"
                type="text"
                icon={<FileTextOutlined />}
                onClick={() => {
                  exportProjectAsZip(project);
                  message.success('正在导出...');
                }}
              />
            </Tooltip>
          </Space>
          <Button
            icon={<RightOutlined />}
            disabled={currentStep >= template.nodes.length - 1}
            onClick={() => dispatch({ type: 'SET_CURRENT_STEP', payload: currentStep + 1 })}
            style={{ borderRadius: 8 }}
          >
            下一步
          </Button>
        </div>
      </Content>

      {/* Right: Waiting Area */}
      <Sider
        width={rightCollapsed ? 0 : 340}
        style={{
          background: '#fff',
          borderLeft: '1px solid #e5e7eb',
          overflow: 'auto',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 14 }}>等待区</Text>
          <Button
            type="text"
            size="small"
            icon={<MenuFoldOutlined />}
            onClick={() => setRightCollapsed(true)}
          />
        </div>
        <WaitingAreaPanel />
      </Sider>

      {/* Previous Docs Drawer */}
      <Drawer
        open={prevDocsDrawer}
        onClose={() => setPrevDocsDrawer(false)}
        title="前置文档回看"
        width={600}
        bodyStyle={{ padding: 16 }}
      >
        {project.documents
          .filter((_d, i) => i < currentStep && _d.content)
          .map((doc, i) => (
            <Card
              key={doc.nodeId}
              size="small"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#4C6EF5' }} />
                  <span>{doc.docName}</span>
                  <Tooltip title="复制内容">
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        navigator.clipboard.writeText(doc.content);
                        message.success('已复制');
                      }}
                    />
                  </Tooltip>
                </Space>
              }
              style={{ marginBottom: 12, borderRadius: 10 }}
            >
              <div className="markdown-body" style={{ maxHeight: 300, overflow: 'auto' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
              </div>
            </Card>
          ))}
        {project.documents.filter((_d, i) => i < currentStep && _d.content).length === 0 && (
          <Empty description="暂无前置文档" />
        )}
      </Drawer>
    </Layout>
  );
};

export default WorkflowPage;
