import React, { useEffect, useState } from 'react';

import { ArrowRight } from 'lucide-react';
import './PathmoraAccountGate.css';
import flowLogo from '../assets/brand/linguaflow-icon.png';

type AccountStatus = 'loading' | 'allowed' | 'login' | 'unavailable';

export default function PathmoraAccountGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://pathmora.cn/api/product-account/me', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    }).then(response => {
      if (response.ok) setStatus('allowed');
      else if (response.status === 401 || response.status === 403) setStatus('login');
      else setStatus('unavailable');
    }).catch(() => {
      if (!controller.signal.aborted) setStatus('unavailable');
    });
    return () => controller.abort();
  }, [attempt]);

  if (status === 'allowed') return <>{children}</>;
  const login = new URL('https://pathmora.cn/');
  login.searchParams.set('product_return', location.href);

  return (
    <main className="product-account" aria-labelledby="product-account-title">
      <div className="product-account__layout">
        <header className="product-account__brand">
          <img className="product-account__logo" src={flowLogo} width="76" height="76" alt="" />
          <h1 id="product-account-title">LinguaFlow</h1>
          <p>语言练习 · 词汇积累</p>
        </header>
        <section className="product-account__access" aria-labelledby="product-account-access">
          <h2 id="product-account-access">登录或注册</h2>
          <p>使用 Pathmora 账号继续。新用户凭邀请码注册。</p>
          <div className="product-account__action">
            {status === 'loading' && <span className="product-account__status" role="status">正在检查登录状态…</span>}
            {status === 'login' && (
              <a className="product-account__button" href={login.href}>
                使用 Pathmora 账号继续 <ArrowRight size={19} aria-hidden="true" />
              </a>
            )}
            {status === 'unavailable' && (
              <>
                <p className="product-account__error" role="alert">暂时无法验证账号，请重试。</p>
                <button className="product-account__button" type="button" onClick={() => {
                  setStatus('loading');
                  setAttempt(value => value + 1);
                }}>重新验证 <ArrowRight size={19} aria-hidden="true" /></button>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
