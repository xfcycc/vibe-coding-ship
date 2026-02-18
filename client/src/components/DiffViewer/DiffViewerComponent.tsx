import React from 'react';
import { Button, Space, Typography, Divider } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SwapOutlined } from '@ant-design/icons';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';

const { Text } = Typography;

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  onAccept: () => void;
  onReject: () => void;
}

const DiffViewerComponent: React.FC<DiffViewerProps> = ({ oldContent, newContent, onAccept, onReject }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space>
          <SwapOutlined style={{ color: '#fa8c16' }} />
          <Text strong>内容对比</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>左侧为原内容，右侧为AI修改后内容</Text>
        </Space>
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={onAccept}
            style={{ borderRadius: 6, background: '#52c41a', borderColor: '#52c41a' }}
          >
            接受新内容
          </Button>
          <Button
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={onReject}
            style={{ borderRadius: 6 }}
          >
            保留原内容
          </Button>
        </Space>
      </div>
      <div style={{ maxHeight: 400, overflow: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <ReactDiffViewer
          oldValue={oldContent}
          newValue={newContent}
          splitView={true}
          compareMethod={DiffMethod.WORDS}
          leftTitle="原内容"
          rightTitle="修改后"
          styles={{
            contentText: { fontSize: '13px', lineHeight: '1.6' },
          }}
        />
      </div>
    </div>
  );
};

export default DiffViewerComponent;
