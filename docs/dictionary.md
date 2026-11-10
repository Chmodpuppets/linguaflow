# 本地词典（离线查词）

> 目标：**查词不再一个单词调一次大模型**。常用词走浏览器离线包，生僻词落到服务器词典，两者都没有才退回 AI。
> 目前支持 **英语 / 日语 / 韩语 / 西班牙语** 四门语言，均为「→ 中文释义」。

## 三层结构

| 层 | 位置 | 说明 |
| --- | --- | --- |
| ① 浏览器离线包 | `public/dict/<lang>/part-N.json.gz` → IndexedDB | 用户在「我的资料 → 模型设置 → 本地词典」按语言分别下载 / 删除；线上版首次打开只在空闲时静默预装**英语**，其余按需下载。装好后断网也能查 |
| ② 服务器在线词典 | `<DATA_DIR>/dict/<lang>.db`（SQLite，四语各一库） | `GET /api/dict/lookup?w=word&lang=ja`，公开只读、按 IP 限流（默认 1200 次/小时）。没装本地包也能查，覆盖生僻词、变形词、专名 |
| ③ AI 兜底 | —— | 只有①②都查不到时才走 AI（且仍受「AI 调用授权」闸门约束） |

各语言规模（`GET /api/dict/stats` 可查实时数字）：

| 语言 | 离线包 | 服务端库 | 覆盖率取向 |
| --- | --- | --- | --- |
| `en` 英语 | 57,134 词 / 1.9 MB | 395,793 词 / 27 MB | ECDICT 精简单词表 + 全量变形表 |
| `ja` 日语 | 22,286 高频词 / 0.68 MB | 189,620 词 / 19.3 MB | 高频词进包；假名读音作词形，查 `たべる` 也能命中 `食べる` |
| `ko` 韩语 | 4,055 词 / 0.06 MB | 46,497 词 / 1.5 MB | 延世教材词汇进包；Wikipedia 专名 / 外来语只进服务端 |
| `es` 西语 | 18,950 词 / 0.31 MB | 93,777 词 / 3.2 MB | WikDict 直译 + 西→英→中两跳补齐常用词 |

词典命中时返回值统一为 `{ word, phonetic, meaning, pos }`，`word` 是**词条原形**。

## 语言口径与形态还原

全站同时存在三种语言标识：`types.ts` 的 `Language` 枚举（`Japanese`）、书库里的 BCP-47（`ja-JP`）、词典短码（`ja`）。
**`services/dictLang.ts` 是唯一收口处**，其它模块只管把原始值丢给 `lookupWord()`。

各语言有自己的词头清洗与活用候选（不止英语的复数规则）：

| 语言 | 词头清洗 | 还原规则 |
| --- | --- | --- |
| `en` | `a-z` + 撇号 / 连字符 | `ies/es/ed/ing/er/est/ly/s` 后缀表 |
| `ja` | 平假名 / 片假名 / 汉字 / 々 / 长音 | 一段·五段动词、い/な形容词、礼貌形、て/た形；い段→う段（読み→読む）；片假名↔平假名 |
| `ko` | 谚文 / 谚文字母 | 助词与词尾剥离（`은/는/을/를/습니다/어요…`），补 `다` / `하다` |
| `es` | Unicode 字母（保留重音） | 复数 / 阴阳性 / 分词 / 副动词 + 重音折叠 |

**服务端不重复实现这套规则**：客户端把还原候选通过 `alt=` 参数一次性带上，服务端只按索引查（`words` 精确 → `forms` → 逐个候选），避免前后端规则漂移。

`lookupWord()` 的回退顺序：目标语言 → 按文字系统推断的语言 → 拉丁字母词补查英语。
最后一条同时修掉了历史 bug：过去传进来的其实是 `Language.English`（不是 `'en'`），英语查词是靠一条 Latin 兜底路径碰巧生效的。

## 数据来源与许可

**四份数据的许可各不相同，且 ja/ko/es 都是 CC BY-SA** —— 详见 [`public/dict/LICENSES.md`](../public/dict/LICENSES.md)（随产物分发，再分发时必须保留署名与相同许可）。

| 语言 | 来源 | 许可 |
| --- | --- | --- |
| `en` | [ECDICT](https://github.com/skywind3000/ECDICT) | MIT |
| `ja` | [JMdict / EDRDG](https://www.edrdg.org/jmdict/edict_doc.html) + [jamdict-cn](https://github.com/5945ggh/jamdict-cn)（中文释义） | CC BY-SA 4.0 |
| `ko` | [Open Yonsei Korean Vocabulary](https://github.com/Amulopapa67/open-yonsei-korean-vocabulary) | CC BY-SA 3.0 |
| `es` | [WikDict / DBnary](https://www.wikdict.com/) + [wikidict-zh](https://github.com/open-dict-data/wikidict-zh) 专名（CC0） | CC BY-SA |

生成时统一做了：释义取前 2~3 条、去括注 / 标签 / LLM 自曝「误译」的条目、繁体转简体（OpenCC 单字表，构建期工具）、最多 160 字；日语补词性短标签，韩语保留教材词性和发音。

## 生成（本机）

英语沿用旧脚本：

```bash
curl -L -o /tmp/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
node scripts/build-dict.mjs /tmp/ecdict.csv            # → public/dict/en/
node scripts/build-dict-db.mjs /tmp/ecdict.csv /tmp/lf-dict-out/en.db
```

日 / 韩 / 西用 `scripts/build-dict-multi.py`（Python 3 标准库，源数据只在构建时读一次）：

```bash
# 把下列源数据放到 /tmp/lf-dict-src/：
#   jamdict_cn/jamdict_cn_deduplicated.db  ← jamdict-cn release "database" 的 deduplicated zip
#   ko/vol-01..06.json                     ← Open Yonsei 的 data/json/
#   wikdict-{es-zh,es-en,en-zh,ja-zh}.sqlite3 ← https://download.wikdict.com/dictionaries/sqlite/2/
#   es-zh_wiki.txt / ko-zh_wiki.txt        ← open-dict-data/wikidict-zh 的 data/
#   TSCharacters.txt                       ← OpenCC data/dictionary/
python3 scripts/build-dict-multi.py --src /tmp/lf-dict-src --out public/dict --dbout /tmp/lf-dict-out
```

产物：`public/dict/<lang>/`（会进仓库、随构建进 dist）+ `/tmp/lf-dict-out/<lang>.db`（只部署到服务器）。

## 部署

```bash
# 前端：public/dict/ 随 npm run build 一起进 dist，无需额外步骤
# 服务端：四个库放同一个目录，重启后按语言懒加载
gzip -9 -k /tmp/lf-dict-out/ja.db /tmp/lf-dict-out/ko.db /tmp/lf-dict-out/es.db
scp /tmp/lf-dict-out/*.db.gz root@<host>:/opt/linguaflow-server/data/dict/
ssh root@<host> 'cd /opt/linguaflow-server/data/dict && gunzip -f *.db.gz && chown -R linguaflow:linguaflow . && systemctl restart linguaflow-sync'
```

`GET /api/dict/stats` 返回四语各自的 `ready / entries / bytes`；单个库缺失只影响该语言（返回 503），不影响其它语言与其它接口。

## 前端接入点

| 位置 | 行为 |
| --- | --- |
| 阅读工作台划词（`TypingView`） | 浮层显示词典释义 + 音标 + 词性；**喇叭按钮**调 `playWord()` 按文字系统选语音（英语走有道真人词典音、日语 Web Speech ja-JP、其它 Qwen / Web Speech 兜底），不消耗词典也不走 AI；「加入词库」自动带上释义 |
| 阅读工作台「意群 & 难词」 | AI 失败 / 选「只看本地候选」时，用词典补释义；标签变成「生词候选（本地词典）」 |
| 词汇页「自动填充」 | 先查词典（不花额度），查不到才调 `generateWordDetails` 让 AI 补例句 |
| 我的资料 → 本地词典 | 四语分别安装 / 更新 / 删除、显示词数体积版本，标出「你正在学」 |

## 代码

- `services/dictLang.ts`：语言码归一化、按文字系统的词头清洗、四语活用候选
- `services/dictionary.ts`：manifest → 分片下载 → `DecompressionStream` 解压 → IndexedDB → 内存 `Map` 查询；`lookupWord()` / `enrichWords()` / `installDictionary()` / `getAllDictionaryStates()` / `preinstallForEdition()`
- `components/DictionarySettingsCard.tsx`：按语言分别下载 / 更新 / 删除与进度
- `server/src/dict.ts`：`/dict/lookup?w=&lang=&alt=`、`/dict/stats`（四语懒加载）
- `scripts/build-dict.mjs`、`scripts/build-dict-db.mjs`（en）；`scripts/build-dict-multi.py`（ja/ko/es）
