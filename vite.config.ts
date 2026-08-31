import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3011,
        host: '0.0.0.0',
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
        'process.env.QWEN_API_KEY': JSON.stringify(env.QWEN_API_KEY),
        'process.env.QWEN_BASE_URL': JSON.stringify(env.QWEN_BASE_URL),
        'process.env.QWEN_MODEL': JSON.stringify(env.QWEN_MODEL),
        'process.env.QWEN_TTS_MODEL': JSON.stringify(env.QWEN_TTS_MODEL),
        'process.env.QWEN_TTS_VOICE': JSON.stringify(env.QWEN_TTS_VOICE),
        'process.env.QWEN_STT_MODEL': JSON.stringify(env.QWEN_STT_MODEL),
        'process.env.API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
        'process.env.OPENROUTER_MODEL': JSON.stringify(env.OPENROUTER_MODEL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
