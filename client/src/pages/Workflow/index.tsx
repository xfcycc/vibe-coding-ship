import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Layout, Typography, Button, Space, Input, message, Empty, Steps, Tooltip,
  Card, Tag, Drawer, Collapse, Modal, Select,
} from 'antd';
import {
  PlayCircleOutlined, StopOutlined, EditOutlined,
  LeftOutlined, RightOutlined, FileTextOutlined, CheckCircleOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, EyeOutlined,
  CopyOutlined, BulbOutlined, LoadingOutlined,
  ThunderboltOutlined, RobotOutlined,
  ExperimentOutlined, WarningOutlined, RollbackOutlined,
  FormOutlined, SwapOutlined, SaveOutlined, SyncOutlined,
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
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { exportProjectAsZip, exportSingleDoc } from '../../utils/export';
import { extractStates, extractTables } from '../../utils/docExtractor';
import { injectStatesIntoDoc, injectTablesIntoDoc, buildDocMergePrompt } from '../../utils/docInjector';
import { computeMergeActions, formatMergeMessage } from '../../utils/waitAreaMerge';
import { v4 as uuidv4 } from 'uuid';
import type { AIModelConfig } from '../../types';

function buildMergeRequestParams(prompt: string, config: AIModelConfig): { url: string; headers: Record<string, string>; body: string } {
  const { provider, apiKey, baseUrl, model, temperature, maxTokens } = config;
  if (provider === 'claude') {
    return {
      url: `${baseUrl}/messages`,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, messages: [{ role: 'user', content: prompt }] }),
    };
  }
  return {
    url: `${baseUrl}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature, stream: false,
      messages: [{ role: 'system', content: '你是一位资深技术文档专家，擅长精确修改 Markdown 文档。' }, { role: 'user', content: prompt }],
    }),
  };
}

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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [versionDiffVisible, setVersionDiffVisible] = useState(false);
  const [versionDiffLeft, setVersionDiffLeft] = useState<number>(0);
  const [versionDiffRight, setVersionDiffRight] = useState<number>(0);
  const [pushDiffVisible, setPushDiffVisible] = useState(false);
  const [pushDiffContent, setPushDiffContent] = useState('');
  const [isPushing, setIsPushing] = useState(false);
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

  const doAIExtract = (docContent: string, node: typeof currentNode, apiConfig: any, signal: AbortSignal) => {
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

    // Phase 1: instant regex extraction
    const regexStates = hasStateArea ? extractStates(docContent) : [];
    const regexTables = hasTableArea ? extractTables(docContent) : [];

    const regexMerge = computeMergeActions(
      project?.states || [], project?.tables || [],
      hasStateArea ? regexStates : [], hasTableArea ? regexTables : [],
      node.nodeId,
    );

    for (const action of regexMerge.actions) {
      dispatch(action as any);
    }

    const regexMsg = formatMergeMessage(regexMerge);
    if (regexMsg) {
      message.success(`已同步到等待区：${regexMsg}`);
    }

    // Phase 2: AI supplementary extraction (background, non-blocking)
    const currentStates = [...(project?.states || []), ...regexMerge.actions.filter(a => a.type === 'ADD_STATE').map(a => a.payload as any)];
    const currentTables = [...(project?.tables || []), ...regexMerge.actions.filter(a => a.type === 'ADD_TABLE').map(a => a.payload as any)];

    aiExtractFromDoc(docContent, apiConfig, signal).then(aiResult => {
      const regexStateNames = new Set(regexStates.map(s => s.stateName));
      const regexTableNames = new Set(regexTables.map(t => t.tableName));
      const aiOnlyStates = aiResult.states.filter(s => !regexStateNames.has(s.stateName));
      const aiOnlyTables = aiResult.tables.filter(t => !regexTableNames.has(t.tableName));

      if (aiOnlyStates.length === 0 && aiOnlyTables.length === 0) return;

      const aiMerge = computeMergeActions(
        currentStates, currentTables,
        hasStateArea ? aiOnlyStates : [], hasTableArea ? aiOnlyTables : [],
        node.nodeId,
      );

      for (const action of aiMerge.actions) {
        dispatch(action as any);
      }

      const aiMsg = formatMergeMessage(aiMerge);
      if (aiMsg) {
        message.success(`AI 补充提取：${aiMsg}`);
      }
    }).catch(() => {});
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
    const newVersion = { versionId: uuidv4(), content: fullContent, createdAt: new Date().toISOString(), source: 'ai' as const };
    const versions = [...(currentDoc?.versions || []), newVersion].slice(-5);
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
    const newVersion = { versionId: uuidv4(), content: newContent, createdAt: new Date().toISOString(), source: 'ai' as const };
    const versions = [...(currentDoc?.versions || []), newVersion].slice(-5);
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
    if (isEditMode) {
      setEditContent(currentDoc.versions[idx].content);
    }
  };

  const handleEnterEditMode = () => {
    setEditContent(displayContent);
    setIsEditMode(true);
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setEditContent('');
  };

  const handleSaveAsVersion = () => {
    if (!currentNode) return;
    const contentToSave = isEditMode ? editContent : displayContent;
    const newVersion = { versionId: uuidv4(), content: contentToSave, createdAt: new Date().toISOString(), source: 'manual' as const };
    const versions = [...(currentDoc?.versions || []), newVersion].slice(-5);
    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: {
        nodeId: currentNode.nodeId,
        updates: { content: contentToSave, versions, currentVersionIndex: versions.length - 1 },
      },
    });
    setIsEditMode(false);
    setEditContent('');
    message.success('已保存为新版本');

    if (currentNode.relatedWaitAreas.length > 0) {
      Modal.confirm({
        title: '同步到等待区',
        content: '文档已修改，是否同步状态和表结构到等待区？',
        okText: '同步',
        cancelText: '跳过',
        onOk: () => syncDocToWaitArea(contentToSave),
      });
    }
  };

  const syncDocToWaitArea = (content: string) => {
    // Phase 1: instant regex extraction
    const regexStates = extractStates(content);
    const regexTables = extractTables(content);

    const regexMerge = computeMergeActions(
      project?.states || [], project?.tables || [],
      regexStates, regexTables, currentNode!.nodeId,
    );

    for (const action of regexMerge.actions) {
      dispatch(action as any);
    }

    const regexMsg = formatMergeMessage(regexMerge);
    if (regexMsg) {
      message.success(`已同步到等待区：${regexMsg}`);
    } else {
      message.info('文档内容与等待区一致，无需更新');
    }

    // Phase 2: AI补充提取（后台异步，不阻塞用户）
    const apiConfig = configStorage.getDefault();
    if (apiConfig) {
      const nodeId = currentNode!.nodeId;
      const currentStates = [...(project?.states || []), ...regexMerge.actions.filter(a => a.type === 'ADD_STATE').map(a => a.payload as any)];
      const currentTables = [...(project?.tables || []), ...regexMerge.actions.filter(a => a.type === 'ADD_TABLE').map(a => a.payload as any)];

      aiExtractFromDoc(content, apiConfig).then(aiResult => {
        const regexStateNames = new Set(regexStates.map(s => s.stateName));
        const regexTableNames = new Set(regexTables.map(t => t.tableName));
        const aiOnlyStates = aiResult.states.filter(s => !regexStateNames.has(s.stateName));
        const aiOnlyTables = aiResult.tables.filter(t => !regexTableNames.has(t.tableName));

        if (aiOnlyStates.length === 0 && aiOnlyTables.length === 0) return;

        const aiMerge = computeMergeActions(
          currentStates, currentTables,
          aiOnlyStates, aiOnlyTables, nodeId,
        );

        for (const action of aiMerge.actions) {
          dispatch(action as any);
        }

        const aiMsg = formatMergeMessage(aiMerge);
        if (aiMsg) {
          message.success(`AI 补充提取：${aiMsg}`);
        }
      }).catch(() => {});
    }
  };

  const handlePushToDoc = async () => {
    if (!currentNode || !currentDoc?.content) return;
    setIsPushing(true);

    const stateResult = injectStatesIntoDoc(currentDoc.content, project.states);
    const tableResult = injectTablesIntoDoc(stateResult.newContent, project.tables);

    const allModified = [...stateResult.modifiedSections, ...tableResult.modifiedSections];

    if (allModified.length > 0) {
      setPushDiffContent(tableResult.newContent);
      setPushDiffVisible(true);
      setIsPushing(false);
    } else {
      const apiConfig = configStorage.getDefault();
      if (apiConfig) {
        try {
          message.loading({ content: 'AI 正在合并等待区数据到文档...', key: 'push', duration: 0 });
          const prompt = buildDocMergePrompt(currentDoc.content, project.states, project.tables);
          const { url, headers, body } = buildMergeRequestParams(prompt, apiConfig);
          const resp = await fetch(url, { method: 'POST', headers, body });
          if (!resp.ok) throw new Error(`${resp.status}`);
          const data = await resp.json();
          let text = '';
          if (apiConfig.provider === 'claude') {
            text = data.content?.[0]?.text || '';
          } else {
            text = data.choices?.[0]?.message?.content || '';
          }
          if (text) {
            setPushDiffContent(text);
            setPushDiffVisible(true);
          } else {
            message.warning('AI 未返回有效内容');
          }
          message.destroy('push');
        } catch (err: any) {
          message.destroy('push');
          message.error(`AI 合并失败: ${err.message}`);
        }
      } else {
        message.info('无法自动定位文档中的状态/表段落，请配置 AI API 以启用智能合并');
      }
      setIsPushing(false);
    }
  };

  const handleAcceptPush = () => {
    if (!currentNode || !pushDiffContent) return;
    const newVersion = { versionId: uuidv4(), content: pushDiffContent, createdAt: new Date().toISOString(), source: 'manual' as const };
    const versions = [...(currentDoc?.versions || []), newVersion].slice(-5);
    dispatch({
      type: 'UPDATE_DOCUMENT',
      payload: { nodeId: currentNode.nodeId, updates: { content: pushDiffContent, versions, currentVersionIndex: versions.length - 1 } },
    });
    setPushDiffVisible(false);
    setPushDiffContent('');
    message.success('等待区数据已同步到文档');
  };

  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamContent, isStreaming]);

  useEffect(() => {
    setIsEditMode(false);
    setEditContent('');
  }, [currentStep]);

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

          {displayContent || isEditMode ? (
            <Card
              style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', minHeight: 200 }}
              bodyStyle={{ padding: '20px 24px' }}
              extra={
                !isStreaming && (displayContent || isEditMode) && (
                  <Space>
                    {isEditMode ? (
                      <>
                        <Button size="small" icon={<EyeOutlined />} onClick={handleExitEditMode} style={{ borderRadius: 6 }}>
                          取消
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          icon={<SaveOutlined />}
                          onClick={handleSaveAsVersion}
                          style={{ borderRadius: 6 }}
                        >
                          保存为新版本
                        </Button>
                      </>
                    ) : (
                      <Button size="small" icon={<FormOutlined />} onClick={handleEnterEditMode} style={{ borderRadius: 6 }}>
                        编辑
                      </Button>
                    )}
                  </Space>
                )
              }
            >
              {isEditMode ? (
                <Input.TextArea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder="在此编辑 Markdown 文档..."
                  autoSize={{ minRows: 20, maxRows: 60 }}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}
                />
              ) : (
                <div className={`markdown-body ${isStreaming && currentPhase === 'generating' ? 'streaming-cursor' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
                </div>
              )}
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
          {currentDoc?.versions && currentDoc.versions.length > 0 && (
            <Card
              size="small"
              style={{ marginTop: 12, borderRadius: 12 }}
              bodyStyle={{ padding: '8px 16px' }}
            >
              <Space wrap>
                <Text type="secondary" style={{ fontSize: 12 }}>版本记录:</Text>
                {currentDoc.versions.map((v, idx) => (
                  <Space key={v.versionId} size={4}>
                    <Button
                      size="small"
                      type={idx === currentDoc.currentVersionIndex ? 'primary' : 'default'}
                      onClick={() => handleSwitchVersion(idx)}
                      style={{ borderRadius: 6, fontSize: 12 }}
                    >
                      V{idx + 1}
                    </Button>
                    {v.source && (
                      <Tag color={v.source === 'ai' ? 'blue' : 'green'} style={{ margin: 0, fontSize: 10 }}>
                        {v.source === 'ai' ? 'AI' : '手动'}
                      </Tag>
                    )}
                  </Space>
                ))}
                {currentDoc.versions.length >= 2 && (
                  <Button
                    size="small"
                    icon={<SwapOutlined />}
                    onClick={() => {
                      setVersionDiffLeft(0);
                      setVersionDiffRight(currentDoc.versions.length - 1);
                      setVersionDiffVisible(true);
                    }}
                    style={{ borderRadius: 6, fontSize: 12 }}
                  >
                    对比版本
                  </Button>
                )}
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

        {/* Push to doc button */}
        {currentDoc?.content && (project.states.length > 0 || project.tables.length > 0) && (
          <div style={{ padding: '0 12px 8px' }}>
            <Button
              size="small"
              icon={<SyncOutlined spin={isPushing} />}
              onClick={handlePushToDoc}
              loading={isPushing}
              style={{ width: '100%', borderRadius: 6 }}
              type="dashed"
            >
              推送到文档
            </Button>
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

      {/* Version Diff Modal */}
      <Modal
        title="对比版本差异"
        open={versionDiffVisible}
        onCancel={() => setVersionDiffVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {currentDoc?.versions && currentDoc.versions.length >= 2 && (
          <div>
            <Space style={{ marginBottom: 12 }}>
              <span>左侧版本:</span>
              <Select
                value={versionDiffLeft}
                onChange={setVersionDiffLeft}
                style={{ width: 120 }}
                options={currentDoc.versions.map((v, idx) => ({
                  value: idx,
                  label: `V${idx + 1}${v.source ? ` (${v.source === 'ai' ? 'AI' : '手动'})` : ''}`,
                }))}
              />
              <span>右侧版本:</span>
              <Select
                value={versionDiffRight}
                onChange={setVersionDiffRight}
                style={{ width: 120 }}
                options={currentDoc.versions.map((v, idx) => ({
                  value: idx,
                  label: `V${idx + 1}${v.source ? ` (${v.source === 'ai' ? 'AI' : '手动'})` : ''}`,
                }))}
              />
            </Space>
            <div style={{ maxHeight: 500, overflow: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <ReactDiffViewer
                oldValue={currentDoc.versions[versionDiffLeft]?.content || ''}
                newValue={currentDoc.versions[versionDiffRight]?.content || ''}
                splitView={true}
                compareMethod={DiffMethod.WORDS}
                leftTitle={`V${versionDiffLeft + 1}`}
                rightTitle={`V${versionDiffRight + 1}`}
                styles={{ contentText: { fontSize: '13px', lineHeight: '1.6' } }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Push to Doc Diff Modal */}
      <Modal
        title="等待区数据 → 文档同步预览"
        open={pushDiffVisible}
        onCancel={() => { setPushDiffVisible(false); setPushDiffContent(''); }}
        width={900}
        destroyOnClose
        footer={
          <Space>
            <Button onClick={() => { setPushDiffVisible(false); setPushDiffContent(''); }}>取消</Button>
            <Button type="primary" onClick={handleAcceptPush} style={{ background: '#52c41a', borderColor: '#52c41a' }}>
              接受修改
            </Button>
          </Space>
        }
      >
        {currentDoc && pushDiffContent && (
          <div style={{ maxHeight: 500, overflow: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <ReactDiffViewer
              oldValue={currentDoc.content}
              newValue={pushDiffContent}
              splitView={true}
              compareMethod={DiffMethod.WORDS}
              leftTitle="当前文档"
              rightTitle="同步后文档"
              styles={{ contentText: { fontSize: '13px', lineHeight: '1.6' } }}
            />
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default WorkflowPage;
