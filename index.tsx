import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import App from './App';
import { initErrorReporting } from './services/errorReporter';

// 前端错误监控（线上版自动上报 crash/未捕获异常；开源版 no-op）
initErrorReporting();

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
