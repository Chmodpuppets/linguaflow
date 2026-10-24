import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // 生产构建（build / build:online）**绝不内置真实 API Key** —— dist 里的 JS 可被任何人扒出。
    // 仅 dev 读取 .env 方便本地调试；线上版/开源版都必须由用户在「模型设置」里自填 Key。
    const isProdBuild = mode === 'production' || mode === 'online';
    const qwenKey = isProdBuild ? '' : env.QWEN_API_KEY;
    const openrouterKey = isProdBuild ? '' : env.OPENROUTER_API_KEY;
    const glmKey = isProdBuild ? '' : (env.GLM_API_KEY || env.VITE_GLM_API_KEY);
    return {
      server: {
        port: 3011,
        // 双栈绑定：'0.0.0.0' 只监听 IPv4，而 macOS 把 localhost 优先解析成 ::1，
        // 导致浏览器打开 http://localhost:3011/ 连不上（必须手打 127.0.0.1）。
        // '::' 让 Node 同时接受 IPv6 与 IPv4-mapped 连接，localhost / 127.0.0.1 / LAN IP 都好使。
        host: '::',
      },
      plugins: [react()],
      // 生产构建 vendor 拆分：react / 图标库单独成 chunk，利于浏览器长期缓存与并行加载。
      // pdfjs-dist / jszip 已是动态 import，Vite 会自动为其生成独立 chunk，无需手动指定。
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              react: ['react', 'react-dom', 'react-dom/client'],
              icons: ['lucide-react'],
            },
          },
        },
      },
      define: {
        'process.env.QWEN_API_KEY': JSON.stringify(qwenKey),
        'process.env.QWEN_BASE_URL': JSON.stringify(env.QWEN_BASE_URL),
        'process.env.QWEN_MODEL': JSON.stringify(env.QWEN_MODEL),
        'process.env.QWEN_TTS_MODEL': JSON.stringify(env.QWEN_TTS_MODEL),
        'process.env.QWEN_TTS_VOICE': JSON.stringify(env.QWEN_TTS_VOICE),
        'process.env.QWEN_STT_MODEL': JSON.stringify(env.QWEN_STT_MODEL),
        'process.env.API_KEY': JSON.stringify(openrouterKey),
        'process.env.GLM_API_KEY': JSON.stringify(glmKey),
        'process.env.OPENROUTER_MODEL': JSON.stringify(env.OPENROUTER_MODEL),
        // 内容安全：拦截词表/审核接口由部署方配置；密钥同 API Key 一样不在生产构建内置
        'process.env.MODERATION_BLOCKLIST': JSON.stringify(env.MODERATION_BLOCKLIST || ''),
        'process.env.MODERATION_URL': JSON.stringify(env.MODERATION_URL || ''),
        'process.env.MODERATION_KEY': JSON.stringify(isProdBuild ? '' : env.MODERATION_KEY || ''),
        // 双发行版：`npm run build` = 开源版（无社区地址）；`npm run build:online` 读 .env.online 内置地址
        'process.env.COMMUNITY_URL': JSON.stringify(env.COMMUNITY_URL || ''),
        'process.env.APP_EDITION': JSON.stringify(env.COMMUNITY_URL ? 'online' : 'oss')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
