import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Layout, Typography, Button, Space, Input, message, Empty, Steps, Tooltip,
  Card, Tag, Drawer, Collapse,
} from 'antd';
import {
  PlayCircleOutlined, StopOutlined, EditOutlined,
  LeftOutlined, RightOutlined, FileTextOutlined, CheckCircleOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, EyeOutlined,
  CopyOutlined, BulbOutlined, LoadingOutlined,
  ThunderboltOutlined, RobotOutlined,
  ExperimentOutlined, WarningOutlined, RollbackOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import {
  streamAIDirect, streamFollowUpDirect,
  streamMemorySummaryDirect, aiExtractFromDoc,
} from '../../services/aiDirect';
import { configStorage } from '../../services/storage';
import WaitingAreaPanel from '../../components/WaitingArea/WaitingAreaPanel';
import DiffViewerComponent from '../../components/DiffViewer/DiffViewerComponent';
import { exportProjectAsZip, exportSingleDoc } from '../../utils/export';
import { extractStates, extractTables } from '../../utils/docExtractor';
import { v4 as uuidv4 } from 'uuid';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

type WorkflowPhase = 'idle' | 'thinking' | 'generating' | 'extracting' | 'summarizing';

const PHASE_CONFIG: Record<WorkflowPhase, { className: string; icon: React.ReactNode; label: string; subtext: string }> = {
  idle: { className: '', icon: null, label: '', subtext: '' },
  thinking: {
    className: 'phase-thinking',
    icon: <BulbOutlined style={{ color: '#faad14' }} />,
    label: 'AI 正在深度思考...',
    subtext: '模型正在分析上下文并规划文档结构',
  },
  generating: {
    className: 'phase-generating',
    icon: <ThunderboltOutlined style={{ color: '#52c41a' }} />,
    label: 'AI 正在生成文档...',
    subtext: '内容实时输出中，请耐心等待',
  },
  extracting: {
    className: 'phase-extracting',
    icon: <ExperimentOutlined style={{ color: '#722ed1' }} />,
    label: '正在从文档提取状态和表结构...',
    subtext: '使用 AI 智能识别业务数据',
  },
  summarizing: {
    className: 'phase-summarizing',
    icon: <RobotOutlined style={{ color: '#13c2c2' }} />,
    label: '正在更新记忆摘要...',
    subtext: '总结当前步骤核心信息到记忆区',
  },
};

const PhaseIndicator: React.FC<{ phase: WorkflowPhase; isStreaming: boolean }> = ({ phase, isStreaming }) => {
  if (phase === 'idle') return null;
  const config = PHASE_CONFIG[phase];
  return (
    <div style={{ padding: '0 20px' }}>
      <div className={`phase-indicator ${config.className}`}>
        <div className="phase-icon">{config.icon}</div>
        <div style={{ flex: 1 }}>
          <div className="phase-text">{config.label}</div>
          <div className="phase-subtext">{config.subtext}</div>
        </div>
      </div>
      {isStreaming && (
        <div className="progress-bar-container" style={{ marginTop: 4, marginBottom: 4 }}>
          <div className="progress-bar-shimmer" />
        </div>
      )}
    </div>
  );
};

const WorkflowPage: React.FC = () => {
  const navigate = useNavigate();
  const { project, template, dispatch, getPrevDocsContent, getMemorySummary } = useProject();
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
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>('idle');
  const [memorySummaryStream, setMemorySummaryStream] = useState('');
  const [isMemoryStreaming, setIsMemoryStreaming] = useState(false);
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

  const doAIExtract = async (docContent: string, node: typeof currentNode, apiConfig: any, signal: AbortSignal) => {
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

    if (!hasStateArea && !hasTableArea) return;

    // Phase 1: Fast regex extraction
    const regexStates = hasStateArea ? extractStates(docContent) : [];
    const regexTables = hasTableArea ? extractTables(docContent) : [];

    // Phase 2: AI extraction (may fail, non-blocking)
    let aiStates: Array<{ stateName: string; stateValues: string[]; description: string }> = [];
    let aiTables: Array<{ tableName: string; description: string; fields: Array<{ fieldName: string; fieldType: string; description: string; isRequired: boolean }> }> = [];
    try {
      const aiResult = await aiExtractFromDoc(docContent, apiConfig, signal);
      aiStates = aiResult.states;
      aiTables = aiResult.tables;
    } catch {
      // AI extraction failed, fall back to regex only
    }

    // Merge results: regex first, then AI adds anything regex missed
    const existingStateNames = new Set((project?.states || []).map(s => s.stateName));
    const addedStateNames = new Set<string>();
    let stateCount = 0;
    let tableCount = 0;

    if (hasStateArea) {
      // Add regex-extracted states
      for (const s of regexStates) {
        if (!existingStateNames.has(s.stateName) && !addedStateNames.has(s.stateName)) {
          dispatch({
            type: 'ADD_STATE',
            payload: { ...s, relatedDocs: [node.nodeId] },
          });
          addedStateNames.add(s.stateName);
          stateCount++;
        }
      }
      // Add AI-extracted states (only those not already found by regex)
      for (const s of aiStates) {
        if (!existingStateNames.has(s.stateName) && !addedStateNames.has(s.stateName)) {
          dispatch({
            type: 'ADD_STATE',
            payload: {
              id: uuidv4(), stateName: s.stateName, stateValues: s.stateValues,
              description: s.description, relatedDocs: [node.nodeId], relatedTables: [],
            },
          });
          addedStateNames.add(s.stateName);
          stateCount++;
        }
      }
    }

    const existingTableNames = new Set((project?.tables || []).map(t => t.tableName));
    const addedTableNames = new Set<string>();

    if (hasTableArea) {
      // Add regex-extracted tables
      for (const t of regexTables) {
        if (!existingTableNames.has(t.tableName) && !addedTableNames.has(t.tableName)) {
          dispatch({
            type: 'ADD_TABLE',
            payload: { ...t, relatedDocs: [node.nodeId] },
          });
          addedTableNames.add(t.tableName);
          tableCount++;
        }
      }
      // Add AI-extracted tables (only those not already found by regex)
      for (const t of aiTables) {
        if (!existingTableNames.has(t.tableName) && !addedTableNames.has(t.tableName)) {
          dispatch({
            type: 'ADD_TABLE',
            payload: {
              id: uuidv4(), tableName: t.tableName, description: t.description,
              fields: t.fields.map(f => ({
                id: uuidv4(), fieldName: f.fieldName, fieldType: f.fieldType,
                description: f.description, isRequired: f.isRequired, relatedState: '',
              })),
              relatedDocs: [node.nodeId],
            },
          });
          addedTableNames.add(t.tableName);
          tableCount++;
        }
      }
    }

    if (stateCount > 0 || tableCount > 0) {
      const parts: string[] = [];
      if (stateCount > 0) parts.push(`${stateCount} 个状态`);
      if (tableCount > 0) parts.push(`${tableCount} 个表结构`);
      message.success(`已提取 ${parts.join('、')} 到等待区（AI双重提取）`);
    }
  };

  const doMemorySummary = async (stepName: string, content: string, apiConfig: any, signal: AbortSignal) => {
    const prevSummary = getMemorySummary(currentStep);
    setIsMemoryStreaming(true);
    setMemorySummaryStream('');
    let summaryText = '';

    await streamMemorySummaryDirect(stepName, content, prevSummary, apiConfig, {
      onChunk: (chunk) => {
        summaryText += chunk;
        setMemorySummaryStream(summaryText);
      },
      onDone: () => {
        dispatch({
          type: 'SET_MEMORY_SUMMARY',
          payload: { stepIndex: currentStep, content: summaryText, createdAt: new Date().toISOString() },
        });
        setIsMemoryStreaming(false);
      },
      onError: () => { setIsMemoryStreaming(false); },
    }, signal);
  };

  const handleGenerate = async () => {
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
    setCurrentPhase('thinking');

    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: { nodeId: currentNode.nodeId, updates: { status: 'generating', needsRegeneration: false } },
    });

    setCurrentPhase('thinking');
    let fullContent = '';
    let fullReasoning = '';
    let hasContent = false;

    await streamAIDirect(
      {
        promptTemplate: currentPrompt.promptContent,
        projectName: project.info.projectName,
        projectVision: project.info.projectVision,
        userInput: currentDoc?.userInput || '',
        prevDocs: getPrevDocsContent(currentStep),
        memorySummary: getMemorySummary(currentStep),
        states: project.states,
        tables: project.tables,
      },
      apiConfig,
      {
        onChunk: (chunk) => {
          if (!hasContent) {
            hasContent = true;
            setCurrentPhase('generating');
          }
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
        },
        onError: (err) => {
          flushStreamContent();
          setIsStreaming(false);
          setCurrentPhase('idle');
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

    if (abort.signal.aborted || !fullContent) {
      setIsStreaming(false);
      setCurrentPhase('idle');
      return;
    }

    // Save the document
    const newVersion = { versionId: uuidv4(), content: fullContent, createdAt: new Date().toISOString() };
    const versions = [...(currentDoc?.versions || []), newVersion].slice(-3);
    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: {
        nodeId: currentNode.nodeId,
        updates: { content: fullContent, status: 'completed', versions, currentVersionIndex: versions.length - 1 },
      },
    });

    // Phase 3: AI Extraction
    if (currentNode.relatedWaitAreas.length > 0) {
      setCurrentPhase('extracting');
      await doAIExtract(fullContent, currentNode, apiConfig, abort.signal);
    }

    // Phase 4: Memory Summary
    setCurrentPhase('summarizing');
    await doMemorySummary(currentNode.docName, fullContent, apiConfig, abort.signal);

    setIsStreaming(false);
    setCurrentPhase('idle');
    abortRef.current = null;
    setShowFollowUp(true);
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    flushStreamContent();
    setIsStreaming(false);
    setCurrentPhase('idle');
  };

  const handleFollowUp = async () => {
    if (!followUpInput.trim() || !currentDoc?.content || !currentNode) return;

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
    setCurrentPhase('thinking');

    let fullContent = '';
    let fullReasoning = '';
    let hasContent = false;

    await streamFollowUpDirect(
      { currentContent: currentDoc.content, userInstruction: followUpInput.trim() },
      apiConfig,
      {
        onChunk: (chunk) => {
          if (!hasContent) {
            hasContent = true;
            setCurrentPhase('generating');
          }
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
          setCurrentPhase('idle');
          abortRef.current = null;
          setNewContent(fullContent);
          setShowDiff(true);
          setFollowUpInput('');
        },
        onError: (err) => {
          flushStreamContent();
          setIsStreaming(false);
          setCurrentPhase('idle');
          abortRef.current = null;
          message.error(err);
        },
      },
      abort.signal
    );
  };

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
    // Mark subsequent docs as needing regeneration (P6 backtrack)
    dispatch({ type: 'MARK_NEEDS_REGENERATION', payload: { fromStep: currentStep } });
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

  const handleBacktrack = (step: number) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
    dispatch({ type: 'MARK_NEEDS_REGENERATION', payload: { fromStep: step } });
    message.info(`已回溯到步骤 ${step + 1}，后续受影响的步骤已标记为需要更新`);
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

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamContent, isStreaming]);

  const latestMemory = getMemorySummary(currentStep + 1);

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
              const needsUpdate = doc?.needsRegeneration;
              return {
                title: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: idx === currentStep ? 600 : 400,
                        cursor: 'pointer',
                        color: needsUpdate ? '#faad14' : undefined,
                      }}
                    >
                      {node.docName.replace('.md', '')}
                    </Text>
                    {needsUpdate && (
                      <Tooltip title="前置文档已修改，建议重新生成">
                        <WarningOutlined style={{ color: '#faad14', fontSize: 12 }} />
                      </Tooltip>
                    )}
                  </div>
                ),
                status:
                  needsUpdate ? 'error' as const :
                  doc?.status === 'confirmed' ? 'finish' :
                  idx === currentStep ? 'process' :
                  idx < currentStep && doc?.content ? 'finish' : 'wait',
                icon: needsUpdate ? (
                  <WarningOutlined style={{ color: '#faad14' }} />
                ) : doc?.status === 'confirmed' ? (
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
            {currentDoc?.needsRegeneration && (
              <Tag color="warning" icon={<WarningOutlined />}>需要重新生成</Tag>
            )}
          </Space>
          <Space>
            {currentStep > 0 && currentDoc?.content && (
              <Tooltip title="回溯修改：重新生成当前步骤并标记后续步骤需更新">
                <Button
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => handleBacktrack(currentStep)}
                  style={{ borderRadius: 6 }}
                >
                  回溯
                </Button>
              </Tooltip>
            )}
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

        {/* Phase Indicator - fixed below user input */}
        {currentPhase !== 'idle' && (
          <div style={{ borderBottom: '1px solid #f0f0f0' }}>
            <PhaseIndicator phase={currentPhase} isStreaming={isStreaming} />
          </div>
        )}

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
          style={{ flex: 1, overflow: 'auto', padding: '20px' }}
        >
          {/* AI Reasoning Section */}
          {currentReasoning && (
            <Collapse
              size="small"
              className={`reasoning-panel ${isStreaming && currentPhase === 'thinking' ? 'active' : ''}`}
              style={{ marginBottom: 16 }}
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
              style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', minHeight: 200 }}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <div className={`markdown-body ${isStreaming && currentPhase === 'generating' ? 'streaming-cursor' : ''}`}>
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

      {/* Right: Memory + Waiting Area */}
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

        {/* Memory Area (P4) */}
        {(latestMemory || isMemoryStreaming) && (
          <div className="memory-panel">
            <Collapse
              size="small"
              bordered={false}
              style={{ background: 'transparent' }}
              defaultActiveKey={['memory']}
              items={[{
                key: 'memory',
                label: (
                  <Space>
                    <RobotOutlined style={{ color: '#13c2c2' }} />
                    <Text style={{ fontSize: 13, color: '#006d75', fontWeight: 500 }}>
                      记忆区
                      {isMemoryStreaming && <LoadingOutlined style={{ marginLeft: 6, color: '#13c2c2' }} />}
                    </Text>
                  </Space>
                ),
                children: (
                  <div style={{ maxHeight: 400, overflow: 'auto', fontSize: 12, lineHeight: 1.8, color: '#595959' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {isMemoryStreaming ? memorySummaryStream : latestMemory}
                    </ReactMarkdown>
                  </div>
                ),
              }]}
            />
          </div>
        )}

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
          .map((doc) => {
            const summary = (project.docSummaries || []).find(s => s.nodeId === doc.nodeId);
            return (
              <Card
                key={doc.nodeId}
                size="small"
                title={
                  <Space>
                    <FileTextOutlined style={{ color: '#4C6EF5' }} />
                    <span>{doc.docName}</span>
                    {summary && <Tag color="blue" style={{ fontSize: 11 }}>已压缩</Tag>}
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
            );
          })}
        {project.documents.filter((_d, i) => i < currentStep && _d.content).length === 0 && (
          <Empty description="暂无前置文档" />
        )}
      </Drawer>
    </Layout>
  );
};

export default WorkflowPage;
