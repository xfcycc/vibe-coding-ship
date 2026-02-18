import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import { migrateFromLocalStorage } from './services/idbStorage';
import './index.css';

migrateFromLocalStorage().catch(console.warn);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#4C6EF5',
            borderRadius: 8,
            fontFamily: "'Inter', 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif",
          },
        }}
      >
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
