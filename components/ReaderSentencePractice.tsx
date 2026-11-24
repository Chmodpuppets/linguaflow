import ReaderSentenceReview from './ReaderSentenceReview';
import { useEffect, useId, useState } from 'react';
import './ReaderSentencePractice.css';

type Assessment = 'can_rewrite' | 'needs_review';
type Practice = { selfAssessment?: Assessment | null; id: string; resourceTitle: string; sentence: string; answer: string | null; submittedAt: string | null };

export default function ReaderSentencePractice({ id, account }: { id: string; account: number }) {
  const [practice, setPractice] = useState<Practice | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const answerId = useId();
  const endpoint = 'https://pathmora.cn/api/product-account/sentence-practices/' + encodeURIComponent(id);
  const back = 'https://pathmora.cn/?' + new URLSearchParams({ reader_practice: id });
  const connect = 'https://pathmora.cn/?' + new URLSearchParams({ product_return: location.href });

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch(endpoint, { credentials: 'include', headers: { 'X-Pathmora-User': String(account) }, signal: controller.signal }).then(async response => {
      if (controller.signal.aborted) return;
      if (response.status === 404) { setError('missing'); return; }
      if ([401, 403, 409].includes(response.status)) { setError('connect'); return; }
      if (!response.ok) throw Error('Load failed');
      const loaded = await response.json();
      if (!controller.signal.aborted) setPractice(loaded);
    }).catch(() => {
      if (!controller.signal.aborted) setError('read');
    });
    return () => controller.abort();
  }, [account, endpoint, refresh]);

  async function submit(event: { preventDefault(): void }) {
    event.preventDefault();
    if (busy || !answer.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Pathmora-User': String(account) },
        body: JSON.stringify({ answer: answer.trim() }),
        signal: AbortSignal.timeout(12000),
      });
      if ([401, 403].includes(response.status)) { setError('connect'); return; }
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        if (body?.code === 'PRACTICE_ALREADY_SUBMITTED') {
          setRefresh(value => value + 1);
          return;
        }
        setError('connect');
        return;
      }
      if (response.status === 404) { setPractice(null); setError('missing'); return; }
      if (!response.ok) throw Error('Save failed');
      setPractice(await response.json());
    } catch {
      setError('save');
    } finally {
      setBusy(false);
    }
  }

  async function assess(assessment: Assessment) {
    if (!practice?.submittedAt || assessmentBusy || error === 'connect') return;
    setAssessmentBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint + '/self-assessment', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Pathmora-User': String(account) },
        body: JSON.stringify({ assessment, previous: practice.selfAssessment ?? null }),
        signal: AbortSignal.timeout(12000),
      });
      if ([401, 403].includes(response.status)) { setError('connect'); return; }
      if (response.status === 409) {
        const body = await response.json().catch(() => null);
        if (body?.code === 'PRACTICE_NOT_SUBMITTED' || body?.code === 'ASSESSMENT_CHANGED') setRefresh(value => value + 1);
        else setError('connect');
        return;
      }
      if (response.status === 404) { setPractice(null); setError('missing'); return; }
      if (!response.ok) throw Error('Assessment failed');
      setPractice(await response.json());
    } catch {
      setError('assessment');
    } finally {
      setAssessmentBusy(false);
    }
  }

  const reviewTask = new URLSearchParams(location.search).get('review_task') || '';
  if (practice?.submittedAt && reviewTask.startsWith('reader-review-' + id + '-')) {
    return <ReaderSentenceReview account={account} id={id} taskId={reviewTask}
      sentence={practice.sentence} previousAnswer={practice.answer} title={practice.resourceTitle} />;
  }

  return <main className="reader-sentence-page">
    <section className="reader-sentence-card" aria-labelledby="reader-sentence-title">
      <a href="/">LinguaFlow</a>
      <h1 id="reader-sentence-title">用自己的话改写</h1>
      {!practice && !error && <p role="status">正在加载原句…</p>}
      {practice && <>
        <p className="reader-sentence-source">{practice.resourceTitle}</p>
        <blockquote lang="en">{practice.sentence}</blockquote>
        {practice.submittedAt
          ? <>
            <p role="status">已提交到 Pathmora</p>
            {practice.selfAssessment === 'needs_review' && !showPrevious
              ? <>
                <p>先用一句英文复述原意，再检查上次的写法。</p>
                <button type="button" onClick={() => setShowPrevious(true)}>查看上次改写</button>
              </>
              : <p lang="en" className="reader-sentence-result">{practice.answer}</p>}
            <fieldset className="reader-sentence-assessment" disabled={assessmentBusy || error === 'connect'}>
              <legend>这句话下次需要复习吗？</legend>
              <button type="button" aria-pressed={practice.selfAssessment === 'can_rewrite'}
                onClick={() => void assess('can_rewrite')}>我能独立改写</button>
              <button type="button" aria-pressed={practice.selfAssessment === 'needs_review'}
                onClick={() => void assess('needs_review')}>我还需要练</button>
            </fieldset>
            {practice.selfAssessment && <p role="status">
              {practice.selfAssessment === 'needs_review' ? '已标记复习，下次生成这本书的计划时会优先安排。' : '已更新自评，后续计划会继续阅读。'}
            </p>}
          </>
          : <form onSubmit={submit}>
              <label htmlFor={answerId}>用一句英文保留原意，至少换一种说法。</label>
              <textarea id={answerId} lang="en" maxLength={1000} rows={4} value={answer} disabled={busy}
                onChange={event => setAnswer(event.target.value)} />
              <button type="submit" disabled={busy || !answer.trim() || error === 'connect'}>
                {busy ? '正在提交…' : '提交到 Pathmora'}
              </button>
            </form>}
      </>}
      {error === 'missing' && <p role="alert">当前账号找不到这项练习。请从 Pathmora 重新打开。</p>}
      {error === 'read' && <p role="alert">暂时无法加载。 <button type="button" onClick={() => setRefresh(value => value + 1)}>重试</button></p>}
      {error === 'connect' && <p role="alert">账号会话已变化。 <a href={connect}>重新连接 Pathmora</a></p>}
      {error === 'assessment' && <p role="alert">自评未确认，请再点一次重试。</p>}
      {error === 'save' && <p role="alert">提交未确认，输入已保留，请重试。</p>}
      <a href={back}>返回 Pathmora 查看练习</a>
    </section>
  </main>;
}
