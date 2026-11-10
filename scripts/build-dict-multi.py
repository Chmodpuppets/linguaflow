#!/usr/bin/env python3
"""
多语种词典生成器（ja / ko / es）——浏览器离线包 + 服务端 SQLite 同源产出。

英语仍由 scripts/build-dict.mjs + build-dict-db.mjs 生成，本脚本不动英语。

用法：
  1) 把外部数据源放到 --src 目录（见 docs/dictionary.md 的下载清单）：
       jamdict_cn/jamdict_cn_deduplicated.db   JMdict 中文释义（19 万词条）
       ko/vol-0*.json                          延世韩国语 1-6 册词表
       wikdict-es-zh.sqlite3 / wikdict-ja-zh.sqlite3   WikDict 双语词库
       TSCharacters.txt                        OpenCC 繁→简单字表
       可选：es-zh_wiki.txt / ko-zh_wiki.txt   Wikipedia 专名（只进服务端库）
  2) python3 scripts/build-dict-multi.py --src /tmp/lf-dict-src --out public/dict --dbout /tmp/lf-dict-out

产物：
  public/dict/<lang>/manifest.json + part-*.json.gz   （浏览器离线包，会进仓库）
  /tmp/lf-dict-out/<lang>.db                          （服务端库，需 scp 到服务器 data/dict/）

只用 Python 标准库；源数据体积大但只在构建时读一次，产出是精简后的小包。
"""
import argparse
import gzip
import json
import os
import re
import sqlite3
import sys
from collections import defaultdict

VERSION = '2026-11-10'
PART_WORDS = 14000
MAX_MEANING = 160

SOURCES = {
    'ja': {'name': '日语 → 中文', 'source': 'JMdict / jamdict-cn', 'license': 'CC BY-SA 4.0'},
    'ko': {'name': '韩语 → 中文', 'source': 'Open Yonsei Korean Vocabulary', 'license': 'CC BY-SA 3.0'},
    'es': {'name': '西班牙语 → 中文', 'source': 'WikDict / DBnary', 'license': 'CC BY-SA'},
}

# ------------------------------------------------------------------ 清洗工具

POS_TAG_MAP = [
    # 顺序要紧：'adjectival nouns' 里含 'noun'，放后面会被误判成名词
    ('adjectival nouns', '形动'), ('auxiliary verb', '助动'),
    ('noun', '名'), ('verb', '动'),
    ('adjective', '形'), ('adverb', '副'), ('interjection', '感'),
    ('pronoun', '代'), ('conjunction', '接'), ('particle', '助'),
    ('auxiliary', '助动'), ('counter', '量'), ('prefix', '接头'),
    ('suffix', '接尾'), ('numeral', '数'), ('expression', '惯'),
]


def short_pos(tag: str) -> str:
    t = (tag or '').lower()
    for key, label in POS_TAG_MAP:
        if key in t:
            return label
    return ''


def clean_gloss(text: str) -> str:
    s = (text or '').replace('\\n', ' ').replace('\n', ' ').strip()
    s = re.sub(r'\[[^\]]{1,10}\]', '', s)       # [网络] 之类的标签
    s = re.sub(r'（[^）]{12,}）', '', s)         # 百科式括注（学名、来源…）对划词没用
    s = re.sub(r'\s+', ' ', s).strip(' ；;，,。.')
    # jamdict-cn 的 LLM 译文里会自曝误译，这类别展示给用户
    if '误译' in s or '应为其他词' in s:
        return ''
    return s


def load_ts_map(path: str) -> dict:
    """OpenCC TSCharacters.txt：繁体单字 → 简体单字。只在构建期用一次。"""
    m = {}
    if not os.path.exists(path):
        print(f'  ! 缺少繁简表 {path}，WikDict 的繁体释义将原样保留', file=sys.stderr)
        return m
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line or line.startswith('#'):
                continue
            parts = line.split('\t')
            if len(parts) < 2:
                continue
            key = parts[0].strip()
            val = parts[1].split(' ')[0].strip()
            if len(key) == 1 and val:
                m[key] = val[0]
    return m


def to_simplified(text: str, ts: dict) -> str:
    return ''.join(ts.get(ch, ch) for ch in text)


# ------------------------------------------------------------------ 各语言数据源

def words_rows_common(words: dict, forms: dict) -> None:
    """原地去掉空释义、过长词头；把词形表指向真实存在的词条。"""
    for k in list(words):
        row = words[k]
        if not row[1] or len(k) > 40:
            del words[k]
    for f, lemma in list(forms.items()):
        if lemma not in words or f == lemma:
            del forms[f]


def build_ja(src: str, ts: dict):
    db = os.path.join(src, 'jamdict_cn', 'jamdict_cn_deduplicated.db')
    if not os.path.exists(db):
        raise SystemExit(f'缺少日语源库：{db}')
    con = sqlite3.connect(db)
    con.execute('PRAGMA cache_size = -200000')

    # 一次把三张表读进内存：191k 词条 / 229k 假名 / 366k 中文释义，约 200MB
    kana = defaultdict(list)
    for seq, text in con.execute('SELECT idseq, text FROM Kana ORDER BY ID'):
        kana[seq].append(text)
    kanji = defaultdict(list)
    for seq, text in con.execute('SELECT idseq, text FROM Kanji ORDER BY ID'):
        kanji[seq].append(text)

    gloss = defaultdict(list)
    for sid, lang, text in con.execute("SELECT sid, lang, text FROM SenseGloss WHERE lang='chn'"):
        gloss[sid].append(text)
    senses = defaultdict(list)
    for sid, seq in con.execute('SELECT ID, idseq FROM Sense'):
        senses[seq].append(sid)
    poss = {}
    for sid, text in con.execute('SELECT sid, text FROM pos'):
        poss.setdefault(sid, text)

    # 常用词标记（news1/ichi1/spec1/…）：离线包只收高频，服务端收全量。
    # 注意 KJP.kid / KNP.kid 外键指向 Kanji.ID / Kana.ID，不是 idseq，必须 join 一次。
    pri = "('news1','ichi1','spec1','spec2','gai1')"
    common = set()
    for (seq,) in con.execute(
        f'SELECT DISTINCT k.idseq FROM Kanji k JOIN KJP p ON p.kid = k.ID WHERE p.text IN {pri}'
    ):
        common.add(seq)
    for (seq,) in con.execute(
        f'SELECT DISTINCT k.idseq FROM Kana k JOIN KNP p ON p.kid = k.ID WHERE p.text IN {pri}'
    ):
        common.add(seq)
    print(f'  ja: 高频词条 {len(common)}')

    words, forms, pack_words, pack_forms = {}, {}, {}, {}
    for (seq,) in con.execute('SELECT idseq FROM Entry'):
        writings = kanji.get(seq, []) + kana.get(seq, [])
        if not writings:
            continue
        head = writings[0]
        readings = kana.get(seq, [])
        ph = readings[0] if readings else ''

        seen, meanings = set(), []
        for sid in senses.get(seq, []):
            for g in gloss.get(sid, []):
                g = clean_gloss(g)
                if not g or g in seen or len(g) > 60:
                    continue
                seen.add(g)
                meanings.append(g)
                if len(meanings) >= 3:
                    break
            if len(meanings) >= 3:
                break
        if not meanings:
            continue
        meaning = to_simplified('；'.join(meanings), ts)[:MAX_MEANING]
        pos = short_pos(poss.get(senses.get(seq, [None])[0], ''))
        row = [ph, meaning, pos, 0]

        words[head] = row
        for w in writings[1:]:
            if w and w not in words:
                forms[w] = head
        if seq in common:
            pack_words[head] = row
            for w in writings[1:]:
                if w and w not in pack_words:
                    pack_forms[w] = head
    con.close()
    words_rows_common(words, forms)
    words_rows_common(pack_words, pack_forms)
    print(f'  ja: 全量 {len(words)} 词 / {len(forms)} 词形；离线包 {len(pack_words)} 词')
    return {'full': (words, forms), 'pack': (pack_words, pack_forms)}


def build_ko(src: str, ts: dict):
    import glob
    words, forms = {}, {}
    files = sorted(glob.glob(os.path.join(src, 'ko', 'vol-*.json')))
    if not files:
        raise SystemExit('缺少韩语源数据 ko/vol-*.json')
    for fp in files:
        with open(fp, encoding='utf-8') as f:
            data = json.load(f)
        for r in data.get('rows', []):
            w = (r.get('korean') or '').strip()
            meaning = clean_gloss(r.get('chinese') or '')
            if not w or not meaning or len(w) > 30:
                continue
            meaning = to_simplified(meaning, ts)[:MAX_MEANING]
            pos = clean_gloss(r.get('pos_zh') or '')[:6]
            ph = (r.get('pronunciation') or '').strip()
            row = [ph, meaning, pos, 0]
            if w not in words or len(words[w][1]) < len(meaning):
                words[w] = row
            # 去掉空格的写法（韩语常见连写）也能命中
            compact = w.replace(' ', '')
            if compact != w:
                forms.setdefault(compact, w)
    words_rows_common(words, forms)

    # Wikipedia 专名 / 外来语（纯谚文单词）只进服务端库，不塞进离线包
    server_words = dict(words)
    wiki = os.path.join(src, 'ko-zh_wiki.txt')
    added = 0
    if os.path.exists(wiki):
        with open(wiki, encoding='utf-8') as f:
            for line in f:
                if '\t' not in line:
                    continue
                w, zh = line.rstrip('\n').split('\t', 1)
                if len(w) > 12 or not re.fullmatch(r'[가-힣]+', w):
                    continue
                zh = to_simplified(clean_gloss(zh), ts)
                if not zh or zh == w:
                    continue
                if w not in server_words:
                    server_words[w] = ['', zh[:MAX_MEANING], '', 0]
                    added += 1
        print(f'  ko: Wikipedia 专名 / 外来语补 {added} 条（仅服务端）')
    print(f'  ko: 离线包 {len(words)} 词 / {len(forms)} 词形；服务端 {len(server_words)} 词')
    return {'full': (server_words, dict(forms)), 'pack': (dict(words), dict(forms))}


def build_es(src: str, ts: dict):
    def read_wikdict(fp, accented=True):
        if not os.path.exists(fp):
            return
        con = sqlite3.connect(fp)
        for w, trans in con.execute('SELECT written_rep, trans_list FROM simple_translation'):
            if not w or not trans:
                continue
            w = w.strip()
            if len(w) > 36 or w.startswith('-') or re.search(r'\d', w):
                continue
            parts = [to_simplified(clean_gloss(p), ts) for p in re.split(r'\s*\|\s*', trans)]
            # 繁简转换后原本的「電視 | 电视」会变成同两条，去重再拼接
            seen, deduped = set(), []
            for p in parts:
                if p and p != w and len(p) <= 40 and p not in seen:
                    seen.add(p)
                    deduped.append(p)
            if not deduped:
                continue
            yield w.lower(), '；'.join(deduped[:3])[:MAX_MEANING]
        con.close()

    words = {}
    for fp in [os.path.join(src, 'wikdict-es-zh.sqlite3')]:
        for w, meaning in read_wikdict(fp):
            if w not in words:
                words[w] = ['', meaning, '', 0]

    # WikDict 的 es-zh 覆盖不全（连 hablar 都没有），用同一项目的
    # es-en + en-zh 做「西→英→中」两跳补齐。只收单个英语词的直译，
    # 高分常用词进离线包，其余只进服务端库。
    en_zh_path = os.path.join(src, 'wikdict-en-zh.sqlite3')
    es_en_path = os.path.join(src, 'wikdict-es-en.sqlite3')
    two_hop_pack, two_hop_server = {}, {}
    if os.path.exists(en_zh_path) and os.path.exists(es_en_path):
        en2zh = {}
        con = sqlite3.connect(en_zh_path)
        for w, trans in con.execute('SELECT written_rep, trans_list FROM simple_translation'):
            if not w or not trans:
                continue
            first = re.split(r'\s*\|\s*', trans)[0]
            zh = to_simplified(clean_gloss(first), ts)
            if zh and len(zh) <= 24:
                en2zh[w.lower()] = zh
        con.close()
        con = sqlite3.connect(es_en_path)
        for w, trans, score in con.execute(
            'SELECT written_rep, trans_list, max_score FROM simple_translation'
        ):
            if not w or not trans:
                continue
            key = w.lower()
            if key in words or not re.fullmatch(r'[a-záéíóúñü]{2,24}', key):
                continue
            eng = re.split(r'\s*\|\s*', trans)[0].strip().lower()
            if not re.fullmatch(r'[a-z]{2,20}', eng):
                continue
            zh = en2zh.get(eng)
            if not zh or zh == key:
                continue
            row = ['', zh, '', 0]
            two_hop_server[key] = row
            if (score or 0) >= 5:
                two_hop_pack[key] = row
        con.close()
        print(f'  es: 两跳补齐 {len(two_hop_server)} 词（离线包收 {len(two_hop_pack)} 高频）')
        words.update(two_hop_pack)
    else:
        print('  ! 缺 es-en / en-zh，跳过两跳补齐（hablar 等常用词会查不到）', file=sys.stderr)

    # 重音折叠 + 阴阳性 / 复数常见变形 → 词形表
    fold = lambda s: s.replace('á', 'a').replace('é', 'e').replace('í', 'i') \
        .replace('ó', 'o').replace('ú', 'u').replace('ü', 'u').replace('ñ', 'n')
    forms = {}
    for w in list(words):
        f = fold(w)
        if f != w and f not in words:
            forms[f] = w
        if w.endswith('o'):
            forms.setdefault(w[:-1] + 'a', w)
            forms.setdefault(w + 's', w)
        elif w.endswith('a'):
            forms.setdefault(w[:-1] + 'o', w)
            forms.setdefault(w + 's', w)
        elif w.endswith('s'):
            forms.setdefault(w[:-1], w)

    # Wikipedia 专名（人名/地名）+ 两跳低频词只进服务端库，不塞进离线包
    wiki = os.path.join(src, 'es-zh_wiki.txt')
    server_words = dict(words)
    for k, row in two_hop_server.items():
        server_words.setdefault(k, row)
    if os.path.exists(wiki):
        added = 0
        with open(wiki, encoding='utf-8') as f:
            for line in f:
                if '\t' not in line:
                    continue
                w, zh = line.rstrip('\n').split('\t', 1)
                if ' ' in w or len(w) > 28 or not re.fullmatch(r'[A-Za-zÀ-ÿ]+', w):
                    continue
                zh = to_simplified(clean_gloss(zh), ts)
                if not zh or zh == w:
                    continue
                key = w.lower()
                if key not in server_words:
                    server_words[key] = ['', zh[:MAX_MEANING], '', 0]
                    added += 1
        print(f'  es: Wikipedia 专名补 {added} 条（仅服务端）')
    words_rows_common(words, forms)
    for f, lemma in list(forms.items()):
        if lemma not in words:
            del forms[f]
    print(f'  es: 离线包 {len(words)} 词 / {len(forms)} 词形；服务端 {len(server_words)} 词')
    return {'full': (server_words, dict(forms)), 'pack': (words, forms)}


# ------------------------------------------------------------------ 产出

def write_sqlite(path: str, words: dict, forms: dict) -> None:
    if os.path.exists(path):
        os.remove(path)
    con = sqlite3.connect(path)
    con.execute('PRAGMA journal_mode=OFF')
    con.execute('PRAGMA synchronous=OFF')
    con.execute('CREATE TABLE words (word TEXT PRIMARY KEY, ph TEXT, mean TEXT, pos TEXT, frq INTEGER) WITHOUT ROWID')
    con.execute('CREATE TABLE forms (form TEXT PRIMARY KEY, lemma TEXT) WITHOUT ROWID')
    con.executemany(
        'INSERT OR REPLACE INTO words (word,ph,mean,pos,frq) VALUES (?,?,?,?,?)',
        [(w, r[0], r[1], r[2], r[3]) for w, r in words.items()],
    )
    con.executemany('INSERT OR IGNORE INTO forms (form,lemma) VALUES (?,?)', list(forms.items()))
    con.commit()
    con.execute('VACUUM')
    con.close()


def write_pack(outdir: str, lang: str, words: dict, forms: dict) -> None:
    os.makedirs(outdir, exist_ok=True)
    for f in os.listdir(outdir):
        if f.startswith('part-') or f == 'manifest.json':
            os.remove(os.path.join(outdir, f))
    keys = sorted(words)
    chunks = [keys[i:i + PART_WORDS] for i in range(0, len(keys), PART_WORDS)] or [[]]
    parts, total_bytes = [], 0
    for i, ks in enumerate(chunks):
        # 词形表只放第一片，避免每片重复（客户端会把所有片合并成一张 Map）
        payload = {'w': {k: words[k] for k in ks}, 'f': forms if i == 0 else {}}
        raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        name = f'part-{i}.json.gz'
        with gzip.open(os.path.join(outdir, name), 'wb', compresslevel=9) as g:
            g.write(raw)
        n = os.path.getsize(os.path.join(outdir, name))
        total_bytes += n
        parts.append({'file': name, 'words': len(ks), 'forms': len(forms) if i == 0 else 0, 'bytes': n})
    meta = SOURCES[lang]
    manifest = {
        'lang': lang,
        'name': meta['name'],
        'version': VERSION,
        'entries': len(words),
        'forms': len(forms),
        'bytes': total_bytes,
        'parts': parts,
        'source': meta['source'],
        'license': meta['license'],
    }
    with open(os.path.join(outdir, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f'  {lang}: 离线包 {len(parts)} 片 / {total_bytes / 1048576:.2f} MB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='/tmp/lf-dict-src')
    ap.add_argument('--out', default='public/dict')
    ap.add_argument('--dbout', default='/tmp/lf-dict-out')
    ap.add_argument('--langs', default='ja,ko,es')
    args = ap.parse_args()

    ts = load_ts_map(os.path.join(args.src, 'TSCharacters.txt'))
    print(f'繁简映射 {len(ts)} 字')
    os.makedirs(args.dbout, exist_ok=True)
    for lang in args.langs.split(','):
        lang = lang.strip()
        if lang not in SOURCES:
            continue
        print(f'== {lang} ==')
        data = {'ja': build_ja, 'ko': build_ko, 'es': build_es}[lang](args.src, ts)
        write_pack(os.path.join(args.out, lang), lang, *data['pack'])
        write_sqlite(os.path.join(args.dbout, f'{lang}.db'), *data['full'])
        print(f'  {lang}.db {os.path.getsize(os.path.join(args.dbout, f"{lang}.db")) / 1048576:.1f} MB')
    print('完成。服务端库请部署到 <DATA_DIR>/dict/ 后重启服务。')


if __name__ == '__main__':
    main()
