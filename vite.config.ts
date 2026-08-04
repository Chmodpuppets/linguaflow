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
