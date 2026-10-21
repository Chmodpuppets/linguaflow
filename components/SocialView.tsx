
import React, { useState, useEffect } from 'react';
import { UserProfile, ActivityLog } from '../types';
import { getLogs } from '../services/storageService';
import { copyToClipboard } from '../utils/clipboard';
import QRCode from 'qrcode';
import QrScannerModal from './QrScannerModal';
import {
  getServerUrl,
  setServerUrl as setSyncServerUrl,
  isCloudSyncEnabled,
  isRegistered,
  getLastSyncAt,
  register,
  login,
  resetCloudIdentity,
  pushMyStatus,
  listFriends,
  addFriend,
  removeFriend,
  nudgeFriend,
  listNudges,
  clearNudges,
  computeCommonStreak,
  syncToCloud,
  syncFromCloud,
  syncOnLogin,
  todayString,
  listLeaderboard,
  getAppEdition,
  type FriendProfile,
  type MyProfile,
  type Nudge,
  type LeaderboardEntry,
} from '../services/communityService';
import {
  Users, Share2, Server, Trophy, Flame, CheckCircle2,
  Cloud, CloudUpload, CloudDownload, Settings2, LogOut, Loader2,
  UserPlus, Bell, Zap, X, QrCode, ScanLine,
} from 'lucide-react';

interface SocialViewProps {
  user: UserProfile;
  onUpdateUser: (u: UserProfile) => void;
}

const fmtTime = (ms: number | null): string => {
  if (!ms) return '尚未同步';
  return new Date(ms).toLocaleString();
};

const SocialView: React.FC<SocialViewProps> = ({ user }) => {
  const [weeklyOutput, setWeeklyOutput] = useState(0);
  const [totalOutput, setTotalOutput] = useState(0);
  const [activeDays, setActiveDays] = useState(0);
  const [copied, setCopied] = useState(false);

  // 云同步 / 社交状态
  const [configured, setConfigured] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [serverInput, setServerInput] = useState('');
  const [registered, setRegistered] = useState(false);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const progress = user.progress[user.learningLanguage];
  const today = todayString();

  useEffect(() => {
    const logs: ActivityLog[] = getLogs();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    setWeeklyOutput(logs.filter((l) => l.timestamp >= weekAgo).reduce((a, l) => a + (l.details.wordCount || 0), 0));
    setTotalOutput(logs.reduce((a, l) => a + (l.details.wordCount || 0), 0));
    setActiveDays(new Set(logs.map((l) => l.date)).size);

    setConfigured(isCloudSyncEnabled());
    setServerUrl(getServerUrl());
    setServerInput(getServerUrl());
    setRegistered(isRegistered());
    setNickname(user.username || '');
    setLastSyncAt(getLastSyncAt());
  }, [user]);

  // 打开页面即同步我的 streak 并拉取好友 / 提醒（非实时，就这一次拉取）
  useEffect(() => {
    if (configured && registered) refreshSocial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, registered]);

  // 生成好友二维码
  useEffect(() => {
    if (myProfile?.friendCode) {
      QRCode.toDataURL(`LF:${myProfile.friendCode}`, { margin: 1, width: 240 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [myProfile?.friendCode]);

  const refreshSocial = async () => {
    try {
      const [me, fr, nd, lb] = await Promise.all([
        pushMyStatus(user.currentStreak, user.learningLanguage),
        listFriends(),
        listNudges(),
        listLeaderboard(),
      ]);
      setMyProfile(me);
      setFriends(fr);
      setNudges(nd);
      setLeaderboard(lb);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '加载失败' });
    }
  };

  const shareText = `我在用 LinguaFlow 学 ${user.learningLanguage} 🌍\n等级 Lv.${progress?.level} · 连击 ${user.currentStreak} 天 · 本周输出 ${weeklyOutput} 字\n输出驱动，真正把语言学出来。一起来当学习搭子？`;

  const copy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setCopied(false);
    }
  };

  const saveServer = () => {
    setSyncServerUrl(serverInput);
    setConfigured(isCloudSyncEnabled());
    setServerUrl(getServerUrl());
    setMsg(null);
  };

  const changeServer = () => {
    setSyncServerUrl('');
    resetCloudIdentity();
    setConfigured(false);
    setRegistered(false);
    setServerUrl('');
    setServerInput('');
    setMyProfile(null);
    setFriends([]);
    setNudges([]);
    setLastSyncAt(null);
    setMsg(null);
  };

  const doRegister = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const me = await register(nickname.trim(), password, user.learningLanguage);
      setRegistered(true);
      setMyProfile(me);
      const pulled = await syncOnLogin();
      if (pulled) {
        setMsg({ kind: 'ok', text: '已恢复云端数据，即将刷新…' });
        setTimeout(() => window.location.reload(), 900);
      } else {
        await refreshSocial();
        setMsg({ kind: 'ok', text: '注册成功，本地数据已同步到云端' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '注册失败' });
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const me = await login(nickname.trim(), password);
      setRegistered(true);
      setMyProfile(me);
      const pulled = await syncOnLogin();
      if (pulled) {
        setMsg({ kind: 'ok', text: '已恢复云端数据，即将刷新…' });
        setTimeout(() => window.location.reload(), 900);
      } else {
        await refreshSocial();
        setMsg({ kind: 'ok', text: '登录成功，数据已同步到云端' });
      }
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '登录失败' });
    } finally {
      setBusy(false);
    }
  };

  const doAddFriend = async (code?: string) => {
    const target = (code ?? friendCodeInput).trim();
    if (!target) return;
    setBusy(true);
    setMsg(null);
    try {
      await addFriend(target);
      setFriendCodeInput('');
      setMsg({ kind: 'ok', text: '已添加好友 ✓' });
      await refreshSocial();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '添加失败' });
    } finally {
      setBusy(false);
    }
  };

  const handleScan = (code: string) => {
    setShowScanner(false);
    doAddFriend(code);
  };

  const doRemoveFriend = async (id: number) => {
    if (!window.confirm('移除该好友？')) return;
    try {
      await removeFriend(id);
      await refreshSocial();
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '移除失败' });
    }
  };

  const doNudge = async (id: number) => {
    try {
      await nudgeFriend(id);
      setMsg({ kind: 'ok', text: '已提醒 TA 保持连胜 💪' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '提醒失败' });
    }
  };

  const doDismissNudges = async () => {
    setNudges([]);
    try {
      await clearNudges();
    } catch {
      /* ignore */
    }
  };

  const doSyncUp = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const at = await syncToCloud();
      setLastSyncAt(at);
      setMsg({ kind: 'ok', text: '已备份到云端 ✓' });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '备份失败' });
    } finally {
      setBusy(false);
    }
  };

  const doSyncDown = async () => {
    if (!window.confirm('从云端恢复将【覆盖】本地当前全部学习数据，确定继续？')) return;
    setBusy(true);
    setMsg(null);
    try {
      await syncFromCloud();
      setMsg({ kind: 'ok', text: '已恢复云端数据，即将刷新…' });
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '恢复失败' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users size={22} className="text-neon" /> 学习搭子
          <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-white/10 text-muted">
            {getAppEdition() === 'online' ? '线上版' : '开源版'}
          </span>
        </h1>
        <p className="text-muted text-sm mt-1">
          找个搭子一起坚持。数据<b>非实时</b>——每次打开本页时刷新，好友断签点「提醒」，TA 下次打开会看到。
        </p>
      </div>

      {!configured ? (
        <div className="rounded-2xl border border-white/10 glass-panel p-5">
          <div className="flex items-center gap-2 mb-2">
            <Cloud size={18} className="text-neon-2" />
            <span className="text-sm font-bold text-white">开启学习搭子</span>
          </div>
          <p className="text-xs text-muted mb-3">
            填一个同步服务器地址（自建或社区托管），即可加好友、一起连胜。留空 = 纯本地，数据不出设备。
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="https://sync.example.com"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-neon/50"
            />
            <button
              onClick={saveServer}
              disabled={!serverInput.trim()}
              className="px-4 py-2 rounded-lg bg-neon text-white text-xs font-bold disabled:opacity-40 shadow-glow-sm"
            >
              保存并开启
            </button>
          </div>
        </div>
      ) : !registered ? (
        <div className="rounded-2xl border border-white/10 glass-panel p-5">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus size={18} className="text-neon-2" />
            <span className="text-sm font-bold text-white">{authMode === 'register' ? '注册账号' : '登录'}</span>
          </div>
          <p className="text-xs text-muted mb-3">
            用户名 + 密码（无需邮箱）。注册后你的学习数据存到云端，换设备登录即可取回。
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="用户名"
              maxLength={24}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-neon/50"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={authMode === 'register' ? '密码（至少 6 位）' : '密码'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (authMode === 'register') doRegister();
                  else doLogin();
                }
              }}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted/50 focus:outline-none focus:border-neon/50"
            />
          </div>
          <button
            onClick={authMode === 'register' ? doRegister : doLogin}
            disabled={busy || !nickname.trim() || password.length < 6}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neon text-white text-xs font-bold disabled:opacity-40 shadow-glow-sm"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : authMode === 'register' ? '注册' : '登录'}
          </button>
          <div className="flex items-center justify-between mt-3 text-[11px]">
            <button
              onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setMsg(null); }}
              className="text-neon hover:underline"
            >
              {authMode === 'register' ? '已有账号？登录' : '没有账号？注册'}
            </button>
            <span className="text-muted">
              服务器：<code className="bg-white/5 rounded px-1">{serverUrl}</code>
              <button onClick={changeServer} className="ml-1 hover:text-white"><Settings2 size={12} /> 更换</button>
            </span>
          </div>
          {msg && (
            <p className={`text-xs mt-2 ${msg.kind === 'ok' ? 'text-green-300' : 'text-red-300'}`}>{msg.text}</p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* 收到提醒 */}
          {nudges.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-neon/40 bg-neon/10 text-white text-xs">
              <Bell size={16} className="text-neon shrink-0" />
              <span className="flex-1">
                {nudges[0].fromUsername}{nudges.length > 1 ? ` 等 ${nudges.length} 人` : ''} 提醒你保持连胜 🔥
              </span>
              <button onClick={doDismissNudges} className="text-muted hover:text-white"><X size={14} /></button>
            </div>
          )}

          {/* 学习卡片 */}
          <div className="rounded-2xl border border-neon/30 bg-gradient-to-br from-neon/20 to-neon-2/10 p-6 shadow-glow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold text-white">{myProfile?.username || user.username}</div>
                <div className="text-xs text-muted">LinguaFlow · {user.learningLanguage}</div>
              </div>
              <div className="flex items-center gap-1 text-orange-400">
                <Flame size={18} /> <span className="text-lg font-bold">{user.currentStreak}</span>
                <span className="text-xs text-muted">天连击</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5 text-center">
              <div className="bg-white/5 rounded-xl py-3">
                <div className="text-2xl font-bold text-white">Lv.{progress?.level}</div>
                <div className="text-[10px] text-muted uppercase">等级</div>
              </div>
              <div className="bg-white/5 rounded-xl py-3">
                <div className="text-2xl font-bold text-white">{weeklyOutput}</div>
                <div className="text-[10px] text-muted uppercase">本周输出</div>
              </div>
              <div className="bg-white/5 rounded-xl py-3">
                <div className="text-2xl font-bold text-white">{user.maxStreak}</div>
                <div className="text-[10px] text-muted uppercase">最长连击</div>
              </div>
            </div>
            <button
              onClick={() => copy(shareText)}
              className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-neon/20 hover:bg-neon/30 text-white text-sm font-bold shadow-glow-neon"
            >
              <Share2 size={16} /> {copied ? '已复制分享文案' : '复制分享文案'}
            </button>
          </div>

          {/* 我的好友码 */}
          <div className="p-4 rounded-xl border border-white/10 glass-panel">
            <div className="flex items-center gap-2 mb-2">
              <QrCode size={16} className="text-neon-2" />
              <span className="text-sm font-bold text-white">我的好友码</span>
            </div>
            <p className="text-xs text-muted mb-3">扫码即加搭子。把二维码发给朋友，或扫对方的码。</p>
            <div className="flex gap-4 items-center">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="好友二维码"
                  className="w-28 h-28 rounded-lg bg-white p-1.5 shrink-0"
                />
              )}
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex gap-2">
                  <code className="flex-1 text-lg tracking-widest font-bold text-white bg-white/5 rounded px-2 py-1.5 text-center">
                    {myProfile?.friendCode || '…'}
                  </code>
                  <button
                    onClick={() => myProfile && copy(myProfile.friendCode)}
                    className="px-3 rounded-lg bg-neon text-white text-xs font-bold shadow-glow-sm"
                  >
                    复制
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowScanner(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-neon/20 hover:bg-neon/30 text-white text-xs font-bold"
                  >
                    <ScanLine size={14} /> 扫一扫加好友
                  </button>
                  {qrDataUrl && (
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = qrDataUrl;
                        a.download = `linguaflow-friend-${myProfile?.friendCode}.png`;
                        a.click();
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted text-xs"
                    >
                      下载二维码
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 一起连胜 */}
          <div className="rounded-2xl border border-white/10 glass-panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-sm font-bold text-white">一起连胜</span>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={friendCodeInput}
                onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                placeholder="输入好友码"
                maxLength={6}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white uppercase tracking-widest placeholder:text-muted/50 placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-neon/50"
              />
              <button
                onClick={() => doAddFriend()}
                disabled={busy || friendCodeInput.trim().length < 6}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-neon text-white text-xs font-bold disabled:opacity-40 shadow-glow-sm"
              >
                <UserPlus size={14} /> 加好友
              </button>
            </div>

            {friends.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">还没有搭子。把你的好友码发给朋友，或输入 TA 的码。</p>
            ) : (
              <div className="space-y-2">
                {friends.map((f) => {
                  const common = computeCommonStreak(
                    myProfile?.streak ?? user.currentStreak,
                    myProfile?.lastActiveDay ?? null,
                    f.streak,
                    f.lastActiveDay,
                    today
                  );
                  return (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate">{f.username}</div>
                        <div className="text-[10px] text-muted">{f.language || '—'}</div>
                      </div>
                      <div className="text-center shrink-0">
                        <div className="text-lg font-bold text-orange-400">{f.streak}</div>
                        <div className="text-[10px] text-muted">连胜</div>
                      </div>
                      <div className="text-center shrink-0">
                        <div className={`text-lg font-bold ${common > 0 ? 'text-neon' : 'text-muted'}`}>{common}</div>
                        <div className="text-[10px] text-muted">共同连胜</div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => doNudge(f.id)}
                          className="px-2.5 py-1 rounded bg-neon/20 hover:bg-neon/30 text-neon text-[11px] font-bold"
                        >
                          提醒
                        </button>
                        <button
                          onClick={() => doRemoveFriend(f.id)}
                          className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-muted text-[11px]"
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 连胜排行榜 */}
          <div className="rounded-2xl border border-white/10 glass-panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={16} className="text-yellow-400" />
              <span className="text-sm font-bold text-white">连胜排行榜</span>
              <span className="text-[11px] text-muted ml-auto">Top {leaderboard.length}</span>
            </div>
            {leaderboard.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">暂无数据</p>
            ) : (
              <div className="space-y-1">
                {leaderboard.map((e) => {
                  const isMe = myProfile?.username === e.username;
                  return (
                    <div
                      key={e.rank}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isMe ? 'bg-neon/15 ring-1 ring-neon/30' : 'bg-white/5'}`}
                    >
                      <div className={`w-6 text-center text-sm font-bold ${e.rank <= 3 ? 'text-yellow-400' : 'text-muted'}`}>
                        {e.rank}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className={`text-sm font-bold truncate ${isMe ? 'text-neon' : 'text-white'}`}>{e.username}</span>
                        {isMe && <span className="text-[10px] text-muted shrink-0">（我）</span>}
                      </div>
                      <div className="text-xs text-muted shrink-0">{e.language || '—'}</div>
                      <div className="flex items-center gap-1 shrink-0 w-14 justify-end">
                        <Flame size={13} className="text-orange-400" />
                        <span className="text-sm font-bold text-orange-400">{e.streak}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 云备份（可选，次要） */}
          <details className="rounded-xl border border-white/10 glass-panel p-4">
            <summary className="flex items-center gap-2 cursor-pointer text-sm font-bold text-white">
              <Cloud size={16} className="text-neon-2" /> 云备份（跨设备恢复学习数据）
              <span className="text-[11px] text-muted font-normal ml-1">上次：{fmtTime(lastSyncAt)}</span>
            </summary>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={doSyncUp}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neon text-white text-xs font-bold disabled:opacity-50 shadow-glow-sm"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />} 备份到云端
              </button>
              <button
                onClick={doSyncDown}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold disabled:opacity-50"
              >
                <CloudDownload size={14} /> 从云端恢复
              </button>
              <button
                onClick={() => { resetCloudIdentity(); setRegistered(false); setMyProfile(null); setFriends([]); setNudges([]); setMsg({ kind: 'ok', text: '已退出登录（学习数据未动）' }); }}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-muted text-xs disabled:opacity-50"
              >
                <LogOut size={14} /> 退出登录
              </button>
            </div>
          </details>

          {msg && (
            <p className={`text-xs ${msg.kind === 'ok' ? 'text-green-300' : 'text-red-300'}`}>{msg.text}</p>
          )}
        </div>
      )}

      {/* 个人最佳 */}
      <div className="p-4 rounded-xl border border-white/10 glass-panel">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-yellow-400" />
          <span className="text-sm font-bold text-white">个人最佳（本地）</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-bold text-white">{totalOutput}</div>
            <div className="text-[10px] text-muted">累计输出字数</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{activeDays}</div>
            <div className="text-[10px] text-muted">活跃天数</div>
          </div>
          <div>
            <div className="text-lg font-bold text-white">{user.joinedDate ? Math.max(1, Math.floor((Date.now() - user.joinedDate) / 86400000)) : 1}</div>
            <div className="text-[10px] text-muted">加入天数</div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs border-t border-line pt-3">
        <span className="flex items-center gap-2 text-green-400/80">
          <CheckCircle2 size={14} />
          {registered
            ? '已登录，学习数据自动同步到云端（关闭页面时也会保存）'
            : '数据只在你打开本页或手动备份时同步。'}
        </span>
        {registered && (
          <button
            onClick={() => {
              if (window.confirm('退出登录？本地数据保留，云端数据不受影响。')) {
                resetCloudIdentity();
                window.location.reload();
              }
            }}
            className="text-muted hover:text-white shrink-0"
          >
            退出登录
          </button>
        )}
      </div>

      {showScanner && <QrScannerModal onClose={() => setShowScanner(false)} onScan={handleScan} />}
    </div>
  );
};

export default SocialView;
