import React, { useState } from 'react';
import { Segmented, Typography } from 'antd';
import { EditOutlined, EyeOutlined, SplitCellsOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Text } = Typography;

type ViewMode = 'edit' | 'split' | 'preview';

interface MarkdownSplitEditorProps {
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  placeholder?: string;
}

const MarkdownSplitEditor: React.FC<MarkdownSplitEditorProps> = ({
  value,
  onChange,
  minRows = 20,
  placeholder = '在此编辑 Markdown 文档...',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const minHeight = minRows * 24;

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
          paddingBottom: 10,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          Markdown 编辑器
        </Text>
        <Segmented
          size="small"
          value={viewMode}
          onChange={(val) => setViewMode(val as ViewMode)}
          options={[
            { value: 'edit', label: '编辑', icon: <EditOutlined /> },
            { value: 'split', label: '分栏', icon: <SplitCellsOutlined /> },
            { value: 'preview', label: '预览', icon: <EyeOutlined /> },
          ]}
        />
      </div>

      {/* Editor area */}
      <div style={{ display: 'flex', gap: 0, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
        {/* Left: raw editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div
            style={{
              flex: 1,
              borderRight: viewMode === 'split' ? '1px solid #e5e7eb' : 'none',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {viewMode === 'split' && (
              <div
                style={{
                  padding: '4px 12px',
                  background: '#fafafa',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: 11,
                  color: '#8c8c8c',
                  fontWeight: 500,
                  letterSpacing: 0.5,
                }}
              >
                MARKDOWN 源码
              </div>
            )}
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              style={{
                flex: 1,
                width: '100%',
                minHeight,
                padding: '14px 16px',
                fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.7,
                color: '#1f2937',
                background: '#fafffe',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Right: preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
            }}
          >
            {viewMode === 'split' && (
              <div
                style={{
                  padding: '4px 12px',
                  background: '#fafafa',
                  borderBottom: '1px solid #f0f0f0',
                  fontSize: 11,
                  color: '#8c8c8c',
                  fontWeight: 500,
                  letterSpacing: 0.5,
                }}
              >
                实时预览
              </div>
            )}
            <div
              className="markdown-body"
              style={{
                flex: 1,
                padding: '14px 20px',
                minHeight,
                overflow: 'auto',
              }}
            >
              {value ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              ) : (
                <div style={{ color: '#bfbfbf', fontSize: 13, paddingTop: 4 }}>
                  预览区域（在左侧输入内容后实时显示）
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownSplitEditor;
