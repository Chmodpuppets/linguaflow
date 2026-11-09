#!/usr/bin/env node
/**
 * 生成「服务器词典」SQLite 库（完整版，含生僻词）
 *
 * 数据源同 build-dict.mjs：ECDICT（MIT）。区别：
 *   - build-dict.mjs  → public/dict/en/*.json.gz（精简 5.4 万词，用户可下载到浏览器离线用）
 *   - 本脚本         → server/data/dict/en.db（ECDICT 全部单词 ~37 万条，服务器在线查词用）
 *
 * 用法（本机没有 better-sqlite3 的原生绑定也能跑，走系统 sqlite3 CLI）：
 *   node scripts/build-dict-db.mjs /tmp/ecdict.csv /tmp/en.db
 *
 * 部署：gzip 后传到服务器 /opt/linguaflow-server/data/dict/en.db，重启 linguaflow-sync。
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const SRC = process.argv[2] || '/tmp/ecdict.csv';
const OUT = process.argv[3] || '/tmp/en.db';
const SQL = `${OUT}.sql`;
const MAX_MEANING = 160;

if (!fs.existsSync(SRC)) {
  console.error(`找不到 ECDICT 文件：${SRC}`);
  process.exit(1);
}

/** 流式 CSV 解析（与 build-dict.mjs 同一套规则） */
async function* csvRows(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let field = '';
  let row = [];
  let inQuotes = false;
  let quotePending = false;
  for await (const chunk of stream) {
    let i = 0;
    if (quotePending) {
      quotePending = false;
      if (chunk[0] === '"') { field += '"'; i = 1; } else { inQuotes = false; }
    }
    for (; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 >= chunk.length) quotePending = true;
          else if (chunk[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field.replace(/\r$/, '')); field = ''; yield row; row = []; }
      else field += c;
    }
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); yield row; }
}

const q = (s) => `'${String(s || '').replace(/'/g, "''")}'`;
const isSingleWord = (w) => /^[a-z][a-z'’-]{0,28}$/i.test(w) && !/[A-Z]{2,}/.test(w);
const cleanMeaning = (translation) => {
  const lines = translation
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((s) => s.replace(/\[[^\]]{1,8}\]\s*/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith('['));
  return (lines.slice(0, 3).join('；') || '').slice(0, MAX_MEANING);
};
const FORM_KEYS = new Set(['p', 'd', 'i', '3', 's', 'r', 't']);
const posFromTranslation = (t) => {
  const m = (t || '').match(/^([a-z]{1,5})\.\s/);
  return m ? m[1] : '';
};

const run = async () => {
  const out = fs.createWriteStream(SQL, { encoding: 'utf8' });
  const write = (s) => new Promise((res) => (out.write(s) ? res() : out.once('drain', res)));

  await write(`PRAGMA journal_mode=OFF;
PRAGMA synchronous=OFF;
PRAGMA temp_store=MEMORY;
DROP TABLE IF EXISTS words;
DROP TABLE IF EXISTS forms;
CREATE TABLE words (word TEXT PRIMARY KEY, ph TEXT, mean TEXT, pos TEXT, frq INTEGER) WITHOUT ROWID;
CREATE TABLE forms (form TEXT PRIMARY KEY, lemma TEXT) WITHOUT ROWID;
BEGIN;
`);

  let header = true;
  let words = 0;
  let forms = 0;
  let buf = [];
  let formBuf = [];

  const flush = async () => {
    if (buf.length) {
      await write(`INSERT OR REPLACE INTO words (word,ph,mean,pos,frq) VALUES ${buf.join(',')};\n`);
      buf = [];
    }
    if (formBuf.length) {
      await write(`INSERT OR IGNORE INTO forms (form,lemma) VALUES ${formBuf.join(',')};\n`);
      formBuf = [];
    }
  };

  for await (const row of csvRows(SRC)) {
    if (header) { header = false; continue; }
    if (row.length < 11) continue;
    const [wordRaw, phonetic, , translation, pos, , , , bnc, frq, exchange] = row;
    const word = (wordRaw || '').trim();
    if (!word || !isSingleWord(word) || !translation || !translation.trim()) continue;

    const meaning = cleanMeaning(translation);
    if (!meaning) continue;
    const low = word.toLowerCase();
    const rank = Number(frq) || Number(bnc) || 0;
    const posTag = (pos || '').split('/')[0]?.split(':')[0] || posFromTranslation(translation);

    buf.push(`(${q(low)},${q((phonetic || '').replace(/ә/g, 'ə').replace(/^[.\s]+/, '').trim().slice(0, 60))},${q(meaning)},${q(posTag.slice(0, 6))},${rank})`);
    words++;

    if (exchange) {
      for (const seg of exchange.split('/')) {
        const [k, v] = seg.split(':');
        if (!FORM_KEYS.has(k) || !v) continue;
        for (const form of v.split(',')) {
          const f = form.trim().toLowerCase();
          if (!f || f === low || !isSingleWord(f)) continue;
          formBuf.push(`(${q(f)},${q(low)})`);
          forms++;
        }
      }
    }

    if (buf.length >= 400) await flush();
  }
  await flush();
  await write('COMMIT;\n');
  await new Promise((res) => out.end(res));

  console.log(`SQL 生成完毕：${words} 词 / ${forms} 变形 → ${SQL}`);
  fs.rmSync(OUT, { force: true });
  execFileSync('/usr/bin/sqlite3', [OUT], { input: fs.readFileSync(SQL), stdio: ['pipe', 'inherit', 'inherit'] });
  const size = fs.statSync(OUT).size;
  console.log(`SQLite 建库完成：${OUT} → ${(size / 1048576).toFixed(1)} MB`);
  fs.rmSync(SQL, { force: true });
};

run().catch((e) => { console.error(e); process.exit(1); });
