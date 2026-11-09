# 本地词典（离线查词）

> 目标：**查词不再一个单词调一次大模型**。常用词走浏览器离线包，生僻词落到服务器词典，两者都没有才退回 AI。

## 三层结构

| 层 | 位置 | 规模 | 说明 |
| --- | --- | --- | --- |
| ① 浏览器离线包 | `public/dict/en/part-N.json.gz` → IndexedDB | 5.7 万词 / 1.9 MB | 用户在「我的资料 → 模型设置 → 本地词典」下载；线上版首次打开会在空闲时静默预装。装好后断网也能查 |
| ② 服务器在线词典 | `server/data/dict/en.db`（SQLite） | 39.6 万词 / 27 MB | `GET /api/dict/lookup?w=word`，公开只读、按 IP 限流（默认 1200 次/小时）。没装本地包也能查 |
| ③ AI 兜底 | —— | —— | 只有①②都查不到时才走 AI（且仍受「AI 调用授权」闸门约束） |

词典命中时返回值统一为 `{ word, phonetic, meaning, pos }`，`word` 是**词条原形**（查 `abandoned` 会按变形表还原）。

## 数据来源与许可

[ECDICT](https://github.com/skywind3000/ECDICT)（MIT）——英汉词典数据库。
生成时做了裁剪：

- 只保留**单词**（不含词组），释义取前 2~3 条、去 `[网络]`/`[法]` 等标签，最多 120 字
- 保留音标（`ә`→`ə`、去首部重音点）、词性、COCA/BNC 词频
- 额外产出「变形 → 原形」表（`abandoned/abandoning → abandon`），划词才有意义

## 生成（本机）

```bash
# 1) 取数据（约 63MB）
curl -L -o /tmp/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv

# 2) 浏览器离线包（→ public/dict/en/）
node scripts/build-dict.mjs /tmp/ecdict.csv
#    可选：--rank=120000 放宽入选词频阈值

# 3) 服务器完整库（→ /tmp/en.db，用系统 sqlite3 建库，不依赖原生模块）
node scripts/build-dict-db.mjs /tmp/ecdict.csv /tmp/en.db
```

## 部署

```bash
# 前端：public/dict/ 会随 npm run build 一起进 dist，无需额外步骤
# 服务端：
gzip -9 -k /tmp/en.db
scp /tmp/en.db.gz root@<host>:/opt/linguaflow-server/data/dict/
ssh root@<host> 'cd /opt/linguaflow-server/data/dict && gunzip -f en.db.gz && chown -R linguaflow:linguaflow . && systemctl restart linguaflow-sync'
```

启动日志会打印 `在线词典：已就绪` 或 `未安装`。文件缺失时接口返回 503，不影响其它功能。

## 前端接入点

| 位置 | 行为 |
| --- | --- |
| 阅读工作台划词（`TypingView`） | 浮层显示词典释义 + 音标 + 词性；「加入词库」自动带上释义 |
| 阅读工作台「意群 & 难词」 | AI 失败 / 选「只看本地候选」时，用词典补释义；标签变成「生词候选（本地词典）」 |
| 词汇页「自动填充」 | 先查词典（不花额度），查不到才调 `generateWordDetails` 让 AI 补例句 |

## 代码

- `services/dictionary.ts`：manifest → 分片下载 → `DecompressionStream` 解压 → IndexedDB → 内存 `Map` 查询；`lookupWord()` / `enrichWords()` / `installDictionary()` / `preinstallForEdition()`
- `components/DictionarySettingsCard.tsx`：设置页下载 / 更新 / 删除与进度
- `server/src/dict.ts`：`/dict/lookup`、`/dict/stats`
- `scripts/build-dict.mjs`、`scripts/build-dict-db.mjs`
