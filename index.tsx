import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App';
import { initErrorReporting } from './services/errorReporter';
import { preinstallForEdition } from './services/dictionary';

// 前端错误监控（线上版自动上报 crash/未捕获异常；开源版 no-op）
initErrorReporting();

// 线上版：空闲时静默预装英语词典（约 1.9MB，一次性）。
// 开源版 / 未配置服务器时不动，用户可在「模型设置 → 本地词典」手动下载。
preinstallForEdition();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
