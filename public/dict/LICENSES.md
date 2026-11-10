# 词典数据许可与署名

本目录下的 `*.json.gz` / `manifest.json` 是**词典数据**，与 LinguaFlow 应用代码（MIT）分开授权。
按语言分别适用下列许可；再分发时请保留本文件。

| 语言 | 数据来源 | 许可 | 说明 |
| --- | --- | --- | --- |
| `en/` | [ECDICT](https://github.com/skywind3000/ECDICT) by skywind3000 | MIT | 英汉词典，裁剪为精简单词表 + 变形表 |
| `ja/` | [JMdict / EDRDG](https://www.edrdg.org/jmdict/edict_doc.html)（原始词条与读音）；[jamdict-cn](https://github.com/5945ggh/jamdict-cn) by 5945ggh（中文释义，MIT） | **CC BY-SA 4.0** | 中文释义由上游项目用 LLM 从 JMdict 英文义项翻译，可能有个别偏差；本目录的派生数据按 CC BY-SA 4.0 提供 |
| `ko/` | [Open Yonsei Korean Vocabulary](https://github.com/Amulopapa67/open-yonsei-korean-vocabulary) contributors v0.1.0 | **CC BY-SA 3.0** | 延世韩国语 1–6 册词汇，面向中文学习者 |
| `es/` | [WikDict](https://www.wikdict.com/) / [DBnary](http://kaiko.getalp.org/about-dbnary)（Wiktionary 抽取数据） | **CC BY-SA** | 西汉直译 + 西→英→中两跳补齐；Wikipedia 专名来自 [wikidict-zh](https://github.com/open-dict-data/wikidict-zh)（CC0，仅服务端库） |

署名建议（CC BY-SA 要求）：

> Dictionary data: ECDICT (MIT); JMdict/EDRDG & jamdict-cn (CC BY-SA 4.0);
> Open Yonsei Korean Vocabulary contributors (CC BY-SA 3.0); WikDict/DBnary (CC BY-SA).
> Modified by LinguaFlow: filtered, deduplicated, converted to Simplified Chinese, repacked.

构建期用到的工具数据（**不随产品分发**）：
[OpenCC](https://github.com/BYVoid/OpenCC) `TSCharacters.txt`（Apache-2.0），用于把 WikDict 的繁体释义统一成简体。

- 本目录的派生词典数据按各来源中**最严格的 CC BY-SA 条款**提供；若你二次分发或改造这些数据，需保留署名并以相同许可共享。
- 应用代码（`services/`、`components/`、`server/`）仍为 MIT，不受上述 share-alike 约束。
- 详见 [docs/dictionary.md](../../docs/dictionary.md)。
