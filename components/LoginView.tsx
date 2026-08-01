
import React, { useState } from 'react';
import { Language, CEFRLevel, UserProfile } from '../types';
import { registerUser } from '../services/storageService';
import { SUPPORTED_LANGUAGES } from '../constants';
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

  const handleRegister = () => {
    if (!username.trim()) return;
    const user = registerUser(username, nativeLang, learningLang, level);
    onLogin(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark text-white p-4">
      <div className="max-w-md w-full bg-card border border-gray-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl mx-auto flex items-center justify-center text-3xl font-bold shadow-lg mb-4">
              L
            </div>
            <h1 className="text-2xl font-bold">Welcome to LinguaFlow</h1>
            <p className="text-gray-400 mt-2">Your journey to fluency starts here.</p>
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">What should we call you?</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your nickname"
                  className="w-full bg-dark border border-gray-600 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none transition-all"
                  autoFocus
                />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-400 mb-2">Native Language</label>
                 <select
                    value={nativeLang}
                    onChange={(e) => setNativeLang(e.target.value as Language)}
                    className="w-full bg-dark border border-gray-600 rounded-xl px-4 py-3 outline-none"
                 >
                    {SUPPORTED_LANGUAGES.map(l => (
                        <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                    ))}
                 </select>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!username.trim()}
                className="w-full py-3 bg-white text-dark font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                Next <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
               <div>
                 <label className="block text-sm font-medium text-gray-400 mb-2">Target Language</label>
                 <select
                    value={learningLang}
                    onChange={(e) => setLearningLang(e.target.value as Language)}
                    className="w-full bg-dark border border-gray-600 rounded-xl px-4 py-3 outline-none"
                 >
                    {SUPPORTED_LANGUAGES.map(l => (
                        <option key={l.id} value={l.id}>{l.flag} {l.label}</option>
                    ))}
                 </select>
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-400 mb-2">Current Level (Estimate)</label>
                 <div className="grid grid-cols-3 gap-2">
                    {Object.values(CEFRLevel).map(l => (
                        <button
                            key={l}
                            onClick={() => setLevel(l)}
                            className={`py-2 rounded-lg border text-sm font-semibold transition-all ${level === l ? 'bg-primary border-primary text-white' : 'bg-dark border-gray-600 text-gray-400 hover:border-gray-400'}`}
                        >
                            {l}
                        </button>
                    ))}
                 </div>
              </div>
              <button
                onClick={handleRegister}
                className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white font-bold rounded-xl shadow-lg shadow-purple-900/30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                Start Learning <Sparkles size={18} />
              </button>
              <button onClick={() => setStep(1)} className="w-full text-center text-sm text-gray-500 hover:text-gray-300">
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
