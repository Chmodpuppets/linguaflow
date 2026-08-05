
import React, { useState } from 'react';
import { Language, CEFRLevel, UserProfile, MentorPersona } from '../types';
import { registerUser, saveUser } from '../services/storageService';
import { SUPPORTED_LANGUAGES, MENTOR_PERSONAS, TOPIC_PACKAGES } from '../constants';
import { ArrowRight, Globe, Sparkles } from 'lucide-react';

interface LoginViewProps {
  onLogin: (user: UserProfile) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [nativeLang, setNativeLang] = useState<Language>(Language.English);
  const [learningLang, setLearningLang] = useState<Language>(Language.Japanese);
  const [level, setLevel] = useState<CEFRLevel>(CEFRLevel.A1);
  const [mentor, setMentor] = useState<MentorPersona>('encourager');
  const [topics, setTopics] = useState<string[]>([]);

  const toggleTopic = (id: string) => {
    setTopics((prev) => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleRegister = () => {
    if (!username.trim()) return;
    const user = registerUser(username, nativeLang, learningLang, level);
    user.mentorPersona = mentor;
    user.preferredTopics = topics;
    user.aiMemory.interests = topics;
    saveUser(user);
    onLogin(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark text-white p-4">
      <div className="w-full max-w-3xl glass-panel rounded-3xl p-8 md:p-10 shadow-glow-neon relative overflow-y-auto max-h-[92vh]">
        {/* Background blobs */}
        <div className="absolute top-6 right-6 w-32 h-32 bg-neon/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-6 left-6 w-32 h-32 bg-neon-2/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-neon to-neon-2 rounded-2xl mx-auto flex items-center justify-center text-3xl font-bold shadow-glow-neon logo-glow mb-4">
              L
            </div>
            <h1 className="text-2xl font-bold">欢迎使用 LinguaFlow</h1>
            <p className="text-muted mt-2">你的流利之路从这里开始。</p>
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div>
                <label className="block text-sm font-medium text-body mb-2">我们该怎么称呼你？</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="输入你的昵称"
                  className="w-full bg-dark border border-line-strong rounded-xl px-4 py-3 text-body placeholder:text-muted focus:ring-2 focus:ring-neon outline-none transition-all"
                  autoFocus
                />
              </div>
              <div>
                 <label className="block text-sm font-medium text-body mb-2">母语</label>
                 <select
                    value={nativeLang}
                    onChange={(e) => setNativeLang(e.target.value as Language)}
                    className="w-full bg-dark border border-line-strong rounded-xl px-4 py-3 text-body outline-none"
                 >
                    {SUPPORTED_LANGUAGES.map(l => (
                        <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                    ))}
                 </select>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!username.trim()}
                className="w-full py-3 bg-gradient-to-r from-neon to-neon-2 text-white font-bold rounded-xl shadow-glow-neon hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                下一步 <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
               <div>
                 <label className="block text-sm font-medium text-body mb-2">想学的语言</label>
                 <select
                    value={learningLang}
                    onChange={(e) => setLearningLang(e.target.value as Language)}
                    className="w-full bg-dark border border-line-strong rounded-xl px-4 py-3 text-body outline-none"
                 >
                    {SUPPORTED_LANGUAGES.map(l => (
                        <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                    ))}
                 </select>
              </div>
              <div>
                 <label className="block text-sm font-medium text-body mb-2">当前水平（估算）</label>
                 <div className="grid grid-cols-3 gap-2">
                    {Object.values(CEFRLevel).map(l => (
                        <button
                            key={l}
                            onClick={() => setLevel(l)}
                            className={`py-2 rounded-lg border text-sm font-semibold transition-all ${level === l ? 'bg-neon border-neon text-white shadow-glow-sm' : 'bg-dark border-line-strong text-muted hover:border-line-strong'}`}
                        >
                            {l}
                        </button>
                    ))}
                 </div>
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 bg-gradient-to-r from-neon to-neon-2 text-white font-bold rounded-xl shadow-glow-neon hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                下一步 <ArrowRight size={18} />
              </button>
              <button onClick={() => setStep(1)} className="w-full text-center text-sm text-muted hover:text-gray-300">
                返回
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div>
                <label className="block text-sm font-medium text-body mb-2">选择你的 AI 导师风格</label>
                <div className="grid grid-cols-2 gap-2">
                  {MENTOR_PERSONAS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMentor(m.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${mentor === m.id ? 'bg-neon/20 border-neon' : 'bg-dark border-line-strong hover:border-line-strong'}`}
                    >
                      <div className="text-lg font-bold text-white flex items-center gap-1">{m.emoji} {m.label}</div>
                      <div className="text-[11px] text-muted mt-1 leading-snug">{m.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-body mb-2">你对什么感兴趣？（可多选，用来定制练习内容）</label>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_PACKAGES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => toggleTopic(t.id)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${topics.includes(t.id) ? 'bg-neon-2/20 border-neon-2 text-neon-2' : 'bg-dark border-line-strong text-muted hover:border-line-strong'}`}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleRegister}
                className="w-full py-3 bg-gradient-to-r from-neon to-neon-2 text-white font-bold rounded-xl shadow-glow-neon hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                开始学习 <Sparkles size={18} />
              </button>
              <button onClick={() => setStep(2)} className="w-full text-center text-sm text-muted hover:text-gray-300">
                返回
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
