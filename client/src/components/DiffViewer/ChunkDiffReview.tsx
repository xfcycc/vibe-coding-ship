import React, { useMemo, useState } from 'react';
import { Button, Space, Typography, Tag, Tooltip, Progress } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SwapOutlined,
  HourglassOutlined,
} from '@ant-design/icons';
import { diffLines, type Change } from 'diff';

const { Text } = Typography;

const CONTEXT_LINES = 3;

// ---- Types ----

type HunkStatus = 'pending' | 'accepted' | 'rejected';

interface DiffHunk {
  id: string;
  /** Index range in the diff changes array this hunk covers */
  changeRange: [number, number];
  contextBefore: string[];
  removedLines: string[];
  addedLines: string[];
  contextAfter: string[];
  status: HunkStatus;
}

interface ChunkDiffReviewProps {
  oldContent: string;
  newContent: string;
  onFinish: (result: string) => void;
  onCancel: () => void;
}

// ---- Hunk computation ----

function buildHunks(changes: Change[]): DiffHunk[] {
  // Collect all lines with their type
  type LineInfo = { text: string; type: 'unchanged' | 'removed' | 'added'; changeIdx: number };
  const lines: LineInfo[] = [];

  changes.forEach((change, idx) => {
    const parts = change.value.split('\n');
    // diffLines includes trailing newline in value; drop the last empty string
    const trimmed = parts[parts.length - 1] === '' ? parts.slice(0, -1) : parts;
    if (change.added) {
      trimmed.forEach(t => lines.push({ text: t, type: 'added', changeIdx: idx }));
    } else if (change.removed) {
      trimmed.forEach(t => lines.push({ text: t, type: 'removed', changeIdx: idx }));
    } else {
      trimmed.forEach(t => lines.push({ text: t, type: 'unchanged', changeIdx: idx }));
    }
  });

  // Find groups of consecutive non-unchanged lines
  const hunks: DiffHunk[] = [];
  let i = 0;
  let hunkCounter = 0;

  while (i < lines.length) {
    if (lines[i].type === 'unchanged') {
      i++;
      continue;
    }

    // Found a change block – expand to include all consecutive removed/added
    const blockStart = i;
    while (i < lines.length && lines[i].type !== 'unchanged') {
      i++;
    }
    const blockEnd = i; // exclusive

    // Gather context before
    const ctxBeforeStart = Math.max(0, blockStart - CONTEXT_LINES);
    const contextBefore = lines.slice(ctxBeforeStart, blockStart).map(l => l.text);

    // Gather context after
    const ctxAfterEnd = Math.min(lines.length, blockEnd + CONTEXT_LINES);
    const contextAfter = lines.slice(blockEnd, ctxAfterEnd).map(l => l.text);

    const block = lines.slice(blockStart, blockEnd);
    const removedLines = block.filter(l => l.type === 'removed').map(l => l.text);
    const addedLines = block.filter(l => l.type === 'added').map(l => l.text);

    const changeIdxMin = Math.min(...block.map(l => l.changeIdx));
    const changeIdxMax = Math.max(...block.map(l => l.changeIdx));

    hunks.push({
      id: `hunk-${hunkCounter++}`,
      changeRange: [changeIdxMin, changeIdxMax],
      contextBefore,
      removedLines,
      addedLines,
      contextAfter,
      status: 'pending',
    });
  }

  return hunks;
}

// Build the final content from hunk decisions
function buildResult(oldContent: string, newContent: string, hunks: DiffHunk[]): string {
  const changes = diffLines(oldContent, newContent);

  // Map changeIdx → hunk
  const hunkByChangeIdx = new Map<number, DiffHunk>();
  const hunkSeenIdx = new Set<string>();
  for (const hunk of hunks) {
    for (let ci = hunk.changeRange[0]; ci <= hunk.changeRange[1]; ci++) {
      hunkByChangeIdx.set(ci, hunk);
    }
  }

  const resultParts: string[] = [];

  changes.forEach((change, idx) => {
    const hunk = hunkByChangeIdx.get(idx);

    if (!change.added && !change.removed) {
      // Unchanged – always keep
      resultParts.push(change.value);
      return;
    }

    if (!hunk) {
      // Should not happen; keep original behavior
      if (!change.added) resultParts.push(change.value);
      return;
    }

    // Only process each hunk once (the hunk spans multiple change indices)
    if (hunkSeenIdx.has(hunk.id)) return;
    hunkSeenIdx.add(hunk.id);

    const accepted = hunk.status === 'accepted';

    // Collect all change entries for this hunk in order
    const hunkChanges = changes.slice(hunk.changeRange[0], hunk.changeRange[1] + 1);
    if (accepted) {
      // Apply new content: keep added, skip removed
      hunkChanges.forEach(c => {
        if (!c.removed) resultParts.push(c.value);
      });
    } else {
      // Reject / pending: keep original (removed lines), skip added
      hunkChanges.forEach(c => {
        if (!c.added) resultParts.push(c.value);
      });
    }
  });

  return resultParts.join('');
}

// ---- Sub-components ----

const LINE_STYLES = {
  context: {
    background: 'transparent',
    color: '#6b7280',
    paddingLeft: 12,
  },
  removed: {
    background: '#fff5f5',
    color: '#c0392b',
    textDecoration: 'line-through' as const,
    paddingLeft: 12,
  },
  added: {
    background: '#f0fff4',
    color: '#16a34a',
    paddingLeft: 12,
  },
  prefix: {
    display: 'inline-block',
    width: 16,
    color: 'inherit',
    userSelect: 'none' as const,
    fontWeight: 700,
  },
};

const CodeLine: React.FC<{ text: string; type: 'context' | 'removed' | 'added' }> = ({ text, type }) => (
  <div
    style={{
      fontFamily: 'ui-monospace, "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: '22px',
      padding: '1px 8px 1px 0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      ...LINE_STYLES[type],
    }}
  >
    <span style={LINE_STYLES.prefix}>
      {type === 'removed' ? '−' : type === 'added' ? '+' : ' '}
    </span>
    {text || ' '}
  </div>
);

const StatusBadge: React.FC<{ status: HunkStatus }> = ({ status }) => {
  if (status === 'accepted') return <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>已接受</Tag>;
  if (status === 'rejected') return <Tag color="default" icon={<CloseCircleOutlined />} style={{ margin: 0 }}>已拒绝</Tag>;
  return <Tag color="warning" icon={<HourglassOutlined />} style={{ margin: 0 }}>待审阅</Tag>;
};

// ---- Main component ----

const ChunkDiffReview: React.FC<ChunkDiffReviewProps> = ({ oldContent, newContent, onFinish, onCancel }) => {
  const changes = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);
  const initialHunks = useMemo(() => buildHunks(changes), [changes]);

  const [hunks, setHunks] = useState<DiffHunk[]>(initialHunks);

  const totalHunks = hunks.length;
  const decidedCount = hunks.filter(h => h.status !== 'pending').length;
  const acceptedCount = hunks.filter(h => h.status === 'accepted').length;

  const updateHunk = (id: string, status: HunkStatus) => {
    setHunks(prev => prev.map(h => h.id === id ? { ...h, status } : h));
  };

  const acceptAll = () => setHunks(prev => prev.map(h => ({ ...h, status: 'accepted' })));
  const rejectAll = () => setHunks(prev => prev.map(h => ({ ...h, status: 'rejected' })));

  const handleFinish = () => {
    const result = buildResult(oldContent, newContent, hunks);
    onFinish(result);
  };

  if (totalHunks === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c' }}>
        <Text type="secondary">内容没有变化</Text>
        <div style={{ marginTop: 12 }}>
          <Button size="small" onClick={onCancel}>关闭</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: '10px 14px',
          background: '#f8f9fc',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
        }}
      >
        <Space align="center">
          <SwapOutlined style={{ color: '#fa8c16' }} />
          <Text strong style={{ fontSize: 14 }}>逐块对比审阅</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {decidedCount} / {totalHunks} 已处理
          </Text>
          <Progress
            percent={Math.round((decidedCount / totalHunks) * 100)}
            showInfo={false}
            size="small"
            style={{ width: 80, margin: 0 }}
            strokeColor="#4C6EF5"
          />
        </Space>
        <Space>
          <Button size="small" onClick={acceptAll} icon={<CheckOutlined />} style={{ color: '#16a34a', borderColor: '#16a34a' }}>
            全部接受
          </Button>
          <Button size="small" onClick={rejectAll} icon={<CloseOutlined />}>
            全部拒绝
          </Button>
          <Button size="small" onClick={onCancel}>
            取消
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={handleFinish}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            完成审阅
          </Button>
        </Space>
      </div>

      {/* Hunk list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480, overflow: 'auto' }}>
        {hunks.map((hunk, index) => (
          <div
            key={hunk.id}
            style={{
              border: `1px solid ${hunk.status === 'accepted' ? '#b7eb8f' : hunk.status === 'rejected' ? '#d9d9d9' : '#ffd591'}`,
              borderRadius: 8,
              overflow: 'hidden',
              opacity: hunk.status === 'rejected' ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            {/* Hunk header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 12px',
                background: hunk.status === 'accepted'
                  ? '#f6ffed'
                  : hunk.status === 'rejected'
                    ? '#fafafa'
                    : '#fffbe6',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <Space size={6}>
                <Text style={{ fontSize: 12, color: '#8c8c8c' }}>
                  变更 {index + 1}/{totalHunks}
                </Text>
                <Text style={{ fontSize: 12, color: '#c0392b' }}>
                  -{hunk.removedLines.length}
                </Text>
                <Text style={{ fontSize: 12, color: '#16a34a' }}>
                  +{hunk.addedLines.length}
                </Text>
              </Space>
              <Space size={6}>
                <StatusBadge status={hunk.status} />
                {hunk.status !== 'accepted' && (
                  <Tooltip title="接受此变更">
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => updateHunk(hunk.id, 'accepted')}
                      style={{ background: '#52c41a', borderColor: '#52c41a', fontSize: 12, padding: '0 8px', height: 24 }}
                    >
                      接受
                    </Button>
                  </Tooltip>
                )}
                {hunk.status !== 'rejected' && (
                  <Tooltip title="拒绝此变更，保留原内容">
                    <Button
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => updateHunk(hunk.id, 'rejected')}
                      style={{ fontSize: 12, padding: '0 8px', height: 24 }}
                    >
                      拒绝
                    </Button>
                  </Tooltip>
                )}
                {hunk.status !== 'pending' && (
                  <Tooltip title="撤销决策，重新选择">
                    <Button
                      size="small"
                      type="text"
                      onClick={() => updateHunk(hunk.id, 'pending')}
                      style={{ fontSize: 11, color: '#8c8c8c', padding: '0 4px', height: 24 }}
                    >
                      撤销
                    </Button>
                  </Tooltip>
                )}
              </Space>
            </div>

            {/* Code block */}
            <div style={{ background: '#fff', padding: '4px 0' }}>
              {/* Context before */}
              {hunk.contextBefore.map((line, i) => (
                <CodeLine key={`cb-${i}`} text={line} type="context" />
              ))}

              {/* Removed lines */}
              {hunk.status !== 'accepted' && hunk.removedLines.map((line, i) => (
                <CodeLine key={`rm-${i}`} text={line} type="removed" />
              ))}

              {/* Added lines */}
              {hunk.status !== 'rejected' && hunk.addedLines.map((line, i) => (
                <CodeLine key={`ad-${i}`} text={line} type="added" />
              ))}

              {/* Context after */}
              {hunk.contextAfter.map((line, i) => (
                <CodeLine key={`ca-${i}`} text={line} type="context" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom summary */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          已接受 {acceptedCount} 处变更，
          已拒绝 {decidedCount - acceptedCount} 处，
          待处理 {totalHunks - decidedCount} 处
        </Text>
        <Button
          type="primary"
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={handleFinish}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          完成审阅
        </Button>
      </div>
    </div>
  );
};

export default ChunkDiffReview;
