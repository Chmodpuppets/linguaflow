#!/usr/bin/env node
/**
 * 生成 LinguaFlow 本地词典（英文 → 中文）
 *
 * 数据源：ECDICT（https://github.com/skywind3000/ECDICT，MIT）
 *   一次性下载 ecdict.csv（约 63MB）到本地，本脚本把它压成「够用就好」的分片包：
 *   - 只收常用词（有考试标签 / 柯林斯星级 / 牛津 3000 / COCA·BNC 前 2 万）
 *   - 每条只留：音标、中文释义（最多两义）、词性、COCA 词频
 *   - 额外生成「变形 → 原形」表（abandoned → abandon），划词才有意义
 *
 * 用法：
 *   curl -L -o /tmp/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
 *   node scripts/build-dict.mjs /tmp/ecdict.csv
 *
 * 产出：public/dict/en/manifest.json + public/dict/en/part-N.json.gz
 * 前端直接 fetch('/dict/en/manifest.json') —— dev 由 vite public/ 提供，
 * 线上由 Caddy 从 /opt/linguaflow-web/dict/ 提供，不需要动后端。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SRC = process.argv[2] || '/tmp/ecdict.csv';
const RANK_CAP = Number((process.argv.find((a) => a.startsWith('--rank=')) || '').split('=')[1]) || 60_000;
const OUT_DIR = path.resolve('public/dict/en');
const MAX_ENTRIES = 160_000;
const MAX_MEANING = 120;
const PARTS = 4;

if (!fs.existsSync(SRC)) {
  console.error(`找不到 ECDICT 文件：${SRC}`);
  process.exit(1);
}

/** 流式 CSV 解析（处理引号、转义引号、字段内换行） */
async function* csvRows(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let field = '';
  let row = [];
  let inQuotes = false;
  let quotePending = false; // 上一个 chunk 以引号结尾，需要看下一个字符判断是 "" 还是结束

  for await (const chunk of stream) {
    let i = 0;
    if (quotePending) {
      quotePending = false;
      if (chunk[0] === '"') {
        field += '"';
        i = 1;
      } else {
        inQuotes = false;
      }
    }
    for (; i < chunk.length; i++) {
      const c = chunk[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 >= chunk.length) quotePending = true;
          else if (chunk[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field.replace(/\r$/, ''));
        field = '';
        yield row;
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    yield row;
  }
}

const TAG_SCORE = { zk: 1, gk: 2, cet4: 3, cet6: 4, ky: 5, toefl: 6, ielts: 7, gre: 8 };
const isSingleWord = (w) => /^[a-z][a-z'’-]{0,28}$/i.test(w) && !/[A-Z]{2,}/.test(w);

const cleanMeaning = (translation) => {
  // ECDICT 里换行是字面量 "\\n"（不是真换行），先还原再按行切
  const lines = translation
    .replace(/\\n/g, '\n')
    .split('\n')
    .map((s) => s.replace(/\[[^\]]{1,8}\]\s*/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((s) => !s.startsWith('[')); // 去掉 [网络] 之类
  const two = lines.slice(0, 2).join('；');
  return (two || lines[0] || '').slice(0, MAX_MEANING);
};

const fixPhonetic = (p) => (p || '').replace(/ә/g, 'ə').replace(/ɡ/g, 'g').replace(/^[.\s]+/, '').trim().slice(0, 60);

const posFromTranslation = (t) => {
  const m = t.match(/^([a-z]{1,5})\.\s/);
  return m ? m[1] : '';
};

const collect = async () => {
  const picked = new Map(); // word -> entry
  let total = 0;
  let header = true;

  for await (const row of csvRows(SRC)) {
    if (header) { header = false; continue; }
    if (row.length < 11) continue;
    total++;
    const [wordRaw, phonetic, , translation, pos, collins, oxford, tag, bnc, frq, exchange] = row;
    const word = (wordRaw || '').trim();
    if (!word || !isSingleWord(word)) continue;
    if (!translation || !translation.trim()) continue;

    const tags = (tag || '').trim().split(/\s+/).filter(Boolean);
    const collinsN = Number(collins) || 0;
    const oxfordN = Number(oxford) || 0;
    const bncN = Number(bnc) || 0;
    const frqN = Number(frq) || 0;
    const rank = Math.min(bncN || 1e9, frqN || 1e9);

    const useful = tags.length > 0 || collinsN > 0 || oxfordN > 0 || rank <= RANK_CAP;
    if (!useful) continue;

    const meaning = cleanMeaning(translation);
    if (!meaning) continue;

    const posTag = (pos || '').split('/')[0]?.split(':')[0] || posFromTranslation(translation);
    const entry = {
      w: word,
      p: fixPhonetic(phonetic),
      m: meaning,
      t: posTag.slice(0, 6),
      f: rank < 1e9 ? rank : 0,
      s: (tags.reduce((a, t) => a + (TAG_SCORE[t] || 0), 0) + collinsN * 2 + oxfordN * 3),
      x: exchange || '',
    };

    const prev = picked.get(word.toLowerCase());
    if (!prev || entry.s > prev.s || (entry.s === prev.s && entry.f && (!prev.f || entry.f < prev.f))) {
      picked.set(word.toLowerCase(), entry);
    }
  }

  return { total, picked };
};

const run = async () => {
  console.log(`读取 ${SRC} …`);
  const { total, picked } = await collect();
  console.log(`CSV 行数 ${total}，入选候选 ${picked.size}`);

  let entries = [...picked.values()];
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => (b.s - a.s) || ((a.f || 1e9) - (b.f || 1e9)) || a.w.localeCompare(b.w));
    entries = entries.slice(0, MAX_ENTRIES);
    console.log(`按质量分裁剪到 ${MAX_ENTRIES} 条`);
  }
  entries.sort((a, b) => a.w.localeCompare(b.w));

  // 变形 → 原形（只保留目标词也在包内的，避免查到不存在的原形）
  const headwords = new Set(entries.map((e) => e.w.toLowerCase()));
  const forms = {};
  const FORM_KEYS = { p: 1, d: 1, i: 1, '3': 1, s: 1, r: 1, t: 1 };
  for (const e of entries) {
    if (!e.x) continue;
    for (const seg of e.x.split('/')) {
      const [k, v] = seg.split(':');
      if (!k || !v || !FORM_KEYS[k]) continue;
      for (const form of v.split(',')) {
        const f = form.trim().toLowerCase();
        if (!f || f === e.w.toLowerCase() || !isSingleWord(f)) continue;
        if (!headwords.has(f)) forms[f] = e.w.toLowerCase();
      }
    }
  }

  // 分片：按词条数四等分（前端并行下载，进度可见；每片体积接近才好算进度）
  const per = Math.ceil(entries.length / PARTS);
  const buckets = [];
  for (let i = 0; i < PARTS; i++) buckets.push(entries.slice(i * per, (i + 1) * per));
  const partOf = new Map();
  buckets.forEach((rows, idx) => rows.forEach((e) => partOf.set(e.w.toLowerCase(), idx)));

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const parts = [];
  let rawBytes = 0;
  let gzBytes = 0;
  let formCount = 0;

  buckets.forEach((rows, idx) => {
    const w = {};
    for (const e of rows) {
      w[e.w] = [e.p, e.m, e.t, e.f];
    }
    // 变形表跟着它的原形走（原形在第几片，变形就进第几片）
    const f = {};
    for (const [form, lemma] of Object.entries(forms)) {
      if (partOf.get(lemma) === idx) f[form] = lemma;
    }
    formCount += Object.keys(f).length;

    const raw = JSON.stringify({ lang: 'en', v: 1, part: idx, w, f });
    const gz = zlib.gzipSync(Buffer.from(raw, 'utf8'), { level: 9 });
    const name = `part-${idx}.json.gz`;
    fs.writeFileSync(path.join(OUT_DIR, name), gz);
    rawBytes += raw.length;
    gzBytes += gz.length;
    parts.push({ file: name, words: rows.length, forms: Object.keys(f).length, bytes: gz.length });
    console.log(`  ${name}: ${rows.length} 词 / ${(gz.length / 1048576).toFixed(2)} MB`);
  });

  const manifest = {
    lang: 'en',
    name: '英汉词典（ECDICT 精简版）',
    version: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    entries: entries.length,
    forms: formCount,
    bytes: gzBytes,
    rawBytes,
    parts,
    source: 'ECDICT — https://github.com/skywind3000/ECDICT',
    license: 'MIT',
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`完成：${entries.length} 词 / ${formCount} 变形 / ${(gzBytes / 1048576).toFixed(2)} MB（gzip）`);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
