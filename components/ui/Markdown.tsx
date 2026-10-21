import React, { useMemo } from 'react';

/**
 * 轻量 Markdown 渲染器（零新增依赖）
 *
 * 支持：标题、段落（保留软换行）、有序/无序列表（含缩进嵌套）、任务清单、
 *      引用、分隔线、围栏代码块、行内代码、粗体/斜体/删除线、链接、表格。
 *
 * 设计约束：
 *  - 不使用 dangerouslySetInnerHTML，全部构建 React 节点 → 无 XSS 风险；
 *  - 链接仅放行 http/https/mailto，其余降级为纯文本；
 *  - 面向流式输出容错：未闭合的 ``` 代码块、半截的 ** 强调，都按已到达的文本降级渲染。
 *  - 实现 GFM 反斜杠转义：\_ \* \` \[ 等还原为字面字符。
 *    AI 生成填空位时常输出 \_\_\_\_\_，不还原就会显示成一串反斜杠。
 */

/* ---------------- 行内解析 ---------------- */

// 用工厂生成正则：renderInline 会递归（粗体里再解析行内码），
// 共用同一个带 g 的全局正则会被递归重置 lastIndex，导致外层匹配中断。
const inlineRe = () =>
  /`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|\*([^*\n]+)\*|_([^_\n]+)_|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

const isWordChar = (ch?: string) => !!ch && /[0-9A-Za-z_]/.test(ch);

const safeHref = (url: string): string | null => {
  const u = url.trim();
  return /^(https?:|mailto:)/i.test(u) ? u : null;
};

const INLINE_CODE_CLS =
  'rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.85em] text-violet-200';

/* ---------- 反斜杠转义（GFM） ----------
 * 1) 先把 `\_` `\*` `\[` 等转义序列掩码成私有区占位符，使其不参与后续正则匹配
 *    （否则 `\_\_` 会被斜体正则误配成「斜体」）；
 * 2) 输出纯文本时再把占位符还原成字面字符。
 * 占位符用私有区码位，正常文本不会出现，天然不会误伤。 */

const ESC_RE = /\\([!-\/:-@\[-`{-~])/g;
const PH_OPEN = '\uE000';
const PH_CLOSE = '\uE001';
const PLACEHOLDER_RE = /\uE000(\d+)\uE001/g;

/**
 * AI 生成填空位时经常输出多重转义的下划线（\_\_\_ / \\\\\\_ 等），
 * 按 GFM 严格解析会残留一堆反斜杠，对学习场景毫无意义。
 * 这里在掩码之前先归一化：整串「反斜杠 + 下划线」→ 纯下划线。
 * 仅在成组出现（>=2 个下划线）时归一化，避免误伤 \n、\* 之类单字符转义。
 */
const normalizeBlanks = (s: string): string =>
  s.replace(/(?:\\+_){2,}/g, (m) => '_'.repeat((m.match(/_/g) || []).length));

const maskEscapes = (s: string) => {
  const store: string[] = [];
  const masked = normalizeBlanks(s).replace(ESC_RE, (_, ch: string) => {
    store.push(ch);
    return PH_OPEN + (store.length - 1) + PH_CLOSE;
  });
  return { src: masked, store };
};

const unmask = (s: string, store: string[]): string =>
  s.replace(PLACEHOLDER_RE, (_, i: string) => store[Number(i)] ?? '');

const renderInline = (
  text: string,
  keyBase: string,
  escaped?: { store: string[]; src: string }
): React.ReactNode[] => {
  // 递归调用传进来的文本已是掩码态，直接复用同一份 store / src
  const { src, store } = escaped ?? maskEscapes(text ?? '');
  if (!src) return [];
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  const INLINE_RE = inlineRe();

  while ((m = INLINE_RE.exec(src))) {
    const start = m.index;
    // 单词内部的 _ 视为普通字符（snake_case / 变量名不算斜体）
    if (m[6] !== undefined && (isWordChar(src[start - 1]) || isWordChar(src[start + m[0].length]))) {
      continue;
    }
    if (start > last) nodes.push(unmask(src.slice(last, start), store));
    const key = `${keyBase}-${idx++}`;
    // 递归时传已掩码的子串，并透传同一份 store，保证占位符能还原
    const inner = (raw: string | undefined) => ({ store, src: raw ?? '' });

    if (m[1] !== undefined) {
      nodes.push(
        <code key={key} className={INLINE_CODE_CLS}>
          {unmask(m[1], store)}
        </code>
      );
    } else if (m[2] !== undefined || m[3] !== undefined) {
      nodes.push(
        <strong key={key} className="font-bold text-white">
          {renderInline('', key, inner(m[2] ?? m[3] ?? ''))}
        </strong>
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <del key={key} className="text-faint line-through">
          {renderInline('', key, inner(m[4]))}
        </del>
      );
    } else if (m[5] !== undefined || m[6] !== undefined) {
      nodes.push(
        <em key={key} className="italic text-violet-100/90">
          {renderInline('', key, inner(m[5] ?? m[6] ?? ''))}
        </em>
      );
    } else if (m[7] !== undefined && m[8] !== undefined) {
      const href = safeHref(m[8]);
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-300 underline underline-offset-2 hover:text-white"
          >
            {renderInline('', key, inner(m[7]))}
          </a>
        ) : (
          <span key={key}>{renderInline('', key, inner(m[7]))}</span>
        )
      );
    }
    last = start + m[0].length;
  }
  if (last < src.length) nodes.push(unmask(src.slice(last), store));
  return nodes;
};

/* ---------------- 块级解析 ---------------- */

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const UL_RE = /^(\s*)([-*+])\s+(.*)$/;
const OL_RE = /^(\s*)(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const FENCE_RE = /^\s*(```+|~~~+)\s*([\w+#-]*)\s*$/;
const TABLE_SEP_RE = /^\s*\|?[\s]*:?-{1,}:?[\s]*(?:\|[\s]*:?-{1,}:?[\s]*)*\|?\s*$/;
const TASK_RE = /^\[([ xX])\]\s+/;

type ListItem = { indent: number; ordered: boolean; text: string };

type ListNode = { text: string; ordered: boolean; children: ListNode[] };

const splitTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

const buildListTree = (raw: ListItem[]): ListNode[] => {
  const root: ListNode[] = [];
  const stack: { indent: number; node: ListNode }[] = [];

  for (const it of raw) {
    const node: ListNode = { text: it.text, ordered: it.ordered, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= it.indent) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else root.push(node);
    stack.push({ indent: it.indent, node });
  }
  return root;
};

/** 按 ordered 标记把同级节点切成连续分组（支持 ul / ol 混排） */
const groupByOrdered = (nodes: ListNode[]): ListNode[][] =>
  nodes.reduce<ListNode[][]>((groups, node) => {
    const tail = groups[groups.length - 1];
    if (tail && tail[0].ordered === node.ordered) tail.push(node);
    else groups.push([node]);
    return groups;
  }, []);

const renderListRun = (nodes: ListNode[], keyBase: string): React.ReactNode => {
  const ordered = nodes[0]?.ordered;
  const Tag = ordered ? 'ol' : 'ul';

  return (
    <Tag
      className={`my-1.5 space-y-1 pl-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-faint`}
    >
      {nodes.map((node, i) => {
        const task = TASK_RE.exec(node.text);
        const text = task ? node.text.slice(task[0].length) : node.text;
        return (
          <li key={`${keyBase}-${i}`} className="leading-relaxed">
            {task ? (
              <span className="inline-flex items-start gap-1.5 align-top">
                <span
                  className={`mt-[3px] inline-block h-3 w-3 shrink-0 rounded border ${
                    task[1] === ' ' ? 'border-white/25' : 'border-neon/60 bg-neon/25'
                  }`}
                />
                <span>{renderInline(text, `${keyBase}-${i}-t`)}</span>
              </span>
            ) : (
              renderInline(text, `${keyBase}-${i}-t`)
            )}
            {groupByOrdered(node.children).map((group, gi) => (
              <div key={`${keyBase}-${i}-${gi}`} className="mt-1">
                {renderListRun(group, `${keyBase}-${i}-${gi}`)}
              </div>
            ))}
          </li>
        );
      })}
    </Tag>
  );
};

const HEADING_CLS = [
  'text-[15px] font-bold text-white',
  'text-sm font-bold text-white',
  'text-sm font-semibold text-violet-200',
  'text-sm font-semibold text-violet-200/90',
  'text-sm font-semibold text-muted',
  'text-sm font-semibold text-muted',
];

const renderTable = (
  head: string[],
  align: ('left' | 'center' | 'right')[],
  rows: string[][],
  keyBase: string
) => (
  <div key={keyBase} className="my-2 overflow-x-auto">
    <table className="w-full border-collapse text-[12px]">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th
              key={i}
              style={{ textAlign: align[i] ?? 'left' }}
              className="border-b border-white/12 px-2 py-1.5 font-semibold text-white"
            >
              {renderInline(h, `${keyBase}-h${i}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {head.map((_, ci) => (
              <td
                key={ci}
                style={{ textAlign: align[ci] ?? 'left' }}
                className="border-b border-white/[0.06] px-2 py-1.5 align-top"
              >
                {renderInline(row[ci] ?? '', `${keyBase}-r${ri}c${ci}`)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const parseBlocks = (src: string): React.ReactNode[] => {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: React.ReactNode[] = [];
  let i = 0;
  let seq = 0;
  const nextKey = () => `md-${seq++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // 围栏代码块（流式未闭合时消费到结尾）
    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1][0];
      const closeRe = new RegExp(`^\\s*${marker === '`' ? '`' : '~'}{3,}\\s*$`);
      const body: string[] = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // 跳过收尾围栏
      out.push(
        <pre
          key={nextKey()}
          className="my-2 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/30 p-3"
        >
          {fence[2] && (
            <div className="mb-1.5 text-[10px] uppercase tracking-wider text-faint">{fence[2]}</div>
          )}
          <code className="font-mono text-[12px] leading-relaxed text-cyan-100/90">
            {body.join('\n')}
          </code>
        </pre>
      );
      continue;
    }

    if (HR_RE.test(line)) {
      out.push(<hr key={nextKey()} className="my-3 border-white/[0.08]" />);
      i++;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const Tag = (['h3', 'h4', 'h5', 'h6'] as const)[Math.min(level, 4) - 1];
      out.push(
        <Tag key={nextKey()} className={`mt-3 mb-1 first:mt-0 ${HEADING_CLS[level - 1]}`}>
          {renderInline(heading[2], nextKey())}
        </Tag>
      );
      i++;
      continue;
    }

    // 表格：当前行含 | 且下一行是分隔行
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && TABLE_SEP_RE.test(lines[i + 1])) {
      const head = splitTableRow(line);
      const align = splitTableRow(lines[i + 1]).map((c) =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left'
      );
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      out.push(renderTable(head, align as ('left' | 'center' | 'right')[], rows, nextKey()));
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length) {
        const q = lines[i].match(QUOTE_RE);
        if (!q) break;
        buf.push(q[1]);
        i++;
      }
      out.push(
        <blockquote
          key={nextKey()}
          className="my-2 border-l-2 border-neon/40 pl-3 text-muted"
        >
          {renderInline(buf.join('\n'), nextKey())}
        </blockquote>
      );
      continue;
    }

    if (UL_RE.test(line) || OL_RE.test(line)) {
      const raw: ListItem[] = [];
      while (i < lines.length) {
        const ul = lines[i].match(UL_RE);
        const ol = lines[i].match(OL_RE);
        if (ul) {
          raw.push({ indent: ul[1].replace(/\t/g, '  ').length, ordered: false, text: ul[3] });
          i++;
          continue;
        }
        if (ol) {
          raw.push({ indent: ol[1].length, ordered: true, text: ol[3] });
          i++;
          continue;
        }
        // 列表项的续行（缩进但无标记）并入上一项
        if (
          raw.length &&
          lines[i].trim() &&
          /^\s{2,}/.test(lines[i]) &&
          !HEADING_RE.test(lines[i]) &&
          !HR_RE.test(lines[i]) &&
          !FENCE_RE.test(lines[i])
        ) {
          raw[raw.length - 1].text += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        break;
      }
      groupByOrdered(buildListTree(raw)).forEach((group, gi) =>
        out.push(<span key={nextKey()} className="block">{renderListRun(group, `md-l${gi}`)}</span>)
      );
      continue;
    }

    // 段落：连续非空、非块起始的行
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING_RE.test(lines[i]) &&
      !HR_RE.test(lines[i]) &&
      !FENCE_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    out.push(
      <p key={nextKey()} className="my-1.5 first:mt-0 last:mb-0">
        {para.flatMap((l, li) =>
          li === para.length - 1
            ? renderInline(l, `${nextKey()}-l${li}`)
            : [...renderInline(l, `${nextKey()}-l${li}`), <br key={`${nextKey()}-br${li}`} />]
        )}
      </p>
    );
  }

  return out;
};

/* ---------------- 对外组件 ---------------- */

export const Markdown: React.FC<{ children?: string; className?: string }> = ({
  children = '',
  className = '',
}) => {
  const nodes = useMemo(() => parseBlocks(children), [children]);
  return <div className={className}>{nodes}</div>;
};

export default Markdown;
