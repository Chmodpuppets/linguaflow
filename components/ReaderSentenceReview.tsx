import { useEffect, useId, useState } from 'react';

type Assessment = 'can_rewrite' | 'needs_review';
type ReviewResult = { taskId: string; answer: string; assessment: Assessment; submittedAt: string };

export default function ReaderSentenceReview({ account, id, taskId, sentence, previousAnswer, title }: {
  account: number;
  id: string;
  taskId: string;
  sentence: string;
  previousAnswer: string | null;
  title: string;
}) {
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [answer, setAnswer] = useState('');
  const [assessment, setAssessment] = useState<Assessment>('needs_review');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'connect' | 'missing' | 'read-error' | 'save-error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const inputId = useId();
  const endpoint = 'https://pathmora.cn/api/product-account/sentence-practices/' + encodeURIComponent(id) + '/review-result';
  const back = 'https://pathmora.cn/?' + new URLSearchParams({ reader_practice: id });
  const connect = 'https://pathmora.cn/?' + new URLSearchParams({ product_return: location.href });

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    fetch(endpoint + '?' + new URLSearchParams({ taskId }), {
      credentials: 'include', headers: { 'X-Pathmora-User': String(account) }, signal: controller.signal,
    }).then(async response => {
      if (controller.signal.aborted) return;
      if ([401, 403, 409].includes(response.status)) { setStatus('connect'); return; }
      if (response.status === 404) { setStatus('missing'); return; }
      if (!response.ok) throw Error('Could not load review result');
      const data = await response.json();
      if (!controller.signal.aborted) { setResult(data.result); setStatus('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setStatus('read-error'); });
    return () => controller.abort();
  }, [account, endpoint, taskId, attempt]);

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!answer.trim() || (status !== 'ready' && status !== 'save-error')) return;
    setStatus('saving');
    try {
      const response = await fetch(endpoint, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Pathmora-User': String(account) },
        body: JSON.stringify({ taskId, answer: answer.trim(), assessment }),
        signal: AbortSignal.timeout(12000),
      });
      if ([401, 403].includes(response.status)) { setStatus('connect'); return; }
      if (response.status === 404) { setStatus('missing'); return; }
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        if (body?.code === 'REVIEW_ALREADY_SUBMITTED') setAttempt(value => value + 1);
        else setStatus('connect');
        return;
      }
      if (!response.ok) throw Error('Could not save review');
      setResult((await response.json()).result);
      setStatus('ready');
    } catch {
      setStatus('save-error');
    }
  }

  return <main className="reader-sentence-page">
    <section className="reader-sentence-card" aria-labelledby="reader-review-title">
      <h1 id="reader-review-title">再改写一次</h1>
      <p className="reader-sentence-source">{title}</p>
      <blockquote lang="en">{sentence}</blockquote>
      {status === 'loading' && <p role="status">正在读取复习任务…</p>}
      {status === 'connect' && <p role="alert">账号会话已变化。 <a href={connect}>重新连接 Pathmora</a></p>}
      {status === 'missing' && <p role="alert">这项复习任务不可用，请从 Pathmora 今日计划重新打开。</p>}
      {status === 'read-error' && <p role="alert">暂时无法读取任务。 <button type="button" onClick={() => setAttempt(value => value + 1)}>重试</button></p>}
      {status === 'save-error' && <p role="alert">复习结果未确认，输入已保留，请重试。</p>}
      {result ? <>
        <p role="status">复习结果已保存，Pathmora 任务已完成。</p>
        <p>本次改写</p>
        <p lang="en" className="reader-sentence-result">{result.answer}</p>
        {previousAnswer && <><p>首次改写</p><p lang="en" className="reader-sentence-result">{previousAnswer}</p></>}
      </> : ['ready', 'saving', 'save-error'].includes(status) && <form onSubmit={submit}>
        <label htmlFor={inputId}>用一句英文重新表达原意。</label>
        <textarea id={inputId} rows={4} maxLength={1000} value={answer} disabled={status === 'saving'} lang="en"
          onChange={event => setAnswer(event.target.value)} />
        <fieldset className="reader-sentence-assessment" disabled={status === 'saving'}>
          <legend>下次还需要练这句吗？</legend>
          <label><input type="radio" checked={assessment === 'needs_review'} onChange={() => setAssessment('needs_review')} /> 还需要练</label>
          <label><input type="radio" checked={assessment === 'can_rewrite'} onChange={() => setAssessment('can_rewrite')} /> 能独立改写</label>
        </fieldset>
        <button type="submit" disabled={!answer.trim() || status === 'saving'}>{status === 'saving' ? '正在保存…' : '保存复习结果'}</button>
      </form>}
      <a href={back}>返回 Pathmora 查看练习</a>
    </section>
  </main>;
}
