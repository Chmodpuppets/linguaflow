
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import brandLogo from '../assets/brand/linguaflow-logo.png';
import { login, register, syncOnLogin } from '../services/communityService';

interface AuthGateProps {
  defaultUsername?: string;
  learningLanguage?: string;
}

// 线上版应用级登录门：未登录先见此页，登录/注册后才进 app。
// 开源版不渲染此组件（社区在「学习搭子」页内可选加入）。
const AuthGate: React.FC<AuthGateProps> = ({ defaultUsername = '', learningLanguage = 'en' }) => {
  const [mode, setMode] = useState<'register' | 'login'>(defaultUsername ? 'login' : 'register');
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (mode === 'register') await register(username.trim(), password, learningLanguage);
      else await login(username.trim(), password);
      const pulled = await syncOnLogin();
      if (pulled) setMsg({ kind: 'ok', text: '已恢复云端数据，正在进入…' });
      setTimeout(() => window.location.reload(), pulled ? 800 : 0);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : mode === 'register' ? '注册失败' : '登录失败' });
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070e] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={brandLogo} alt="LinguaFlow" className="h-12 mb-3" />
          <p className="text-xs text-muted">登录后学习数据存云端，换设备随时取回</p>
        </div>
        <div className="rounded-2xl border border-white/10 glass-panel p-6 space-y-3">
          <div className="flex rounded-lg bg-white/5 p-1 text-xs font-bold">
            <button
              onClick={() => { setMode('register'); setMsg(null); }}
              className={`flex-1 py-1.5 rounded-md ${mode === 'register' ? 'bg-neon text-white' : 'text-muted hover:text-white'}`}
            >
              注册
            </button>
            <button
              onClick={() => { setMode('login'); setMsg(null); }}
              className={`flex-1 py-1.5 rounded-md ${mode === 'login' ? 'bg-neon text-white' : 'text-muted hover:text-white'}`}
            >
              登录
            </button>
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            maxLength={24}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-neon/50"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? '密码（至少 6 位）' : '密码'}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-neon/50"
          />
          <button
            onClick={() => void submit()}
            disabled={busy || !username.trim() || password.length < 6}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-neon text-white text-sm font-bold disabled:opacity-40 shadow-glow-sm"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : mode === 'register' ? '注册并进入' : '登录'}
          </button>
          {msg && (
            <p className={`text-xs ${msg.kind === 'ok' ? 'text-green-300' : 'text-red-300'}`}>{msg.text}</p>
          )}
        </div>
        <p className="text-[11px] text-muted text-center mt-4">无需邮箱 · 数据可随时导出到本地</p>
      </div>
    </div>
  );
};

export default AuthGate;
