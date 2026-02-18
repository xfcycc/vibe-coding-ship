import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/config', icon: <ApiOutlined />, label: 'API配置' },
    { key: '/templates', icon: <AppstoreOutlined />, label: '选择模板' },
    { key: '/workflow', icon: <ThunderboltOutlined />, label: '工作流' },
    { key: '/template-manage', icon: <SettingOutlined />, label: '模板管理' },
  ];

  return (
    <Layout style={{ height: '100vh', background: '#f8f9fc' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          zIndex: 100,
          height: 56,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 40 }}>
          <ThunderboltOutlined style={{ fontSize: 22, color: '#4C6EF5' }} />
          <Typography.Title
            level={4}
            style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a2e', letterSpacing: -0.3 }}
          >
            VIBE-CODING-SHIP
          </Typography.Title>
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            flex: 1,
            border: 'none',
            background: 'transparent',
            fontSize: 14,
          }}
        />
      </Header>
      <Content style={{ overflow: 'auto', padding: 0 }}>
        <Outlet />
      </Content>
    </Layout>
  );
};

export default AppLayout;
