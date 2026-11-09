# Changelog

All notable changes to LinguaFlow are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Server-side TTS proxy + OSS persistence** (`GET/POST {COMMUNITY_URL}/tts/audio`).
  Qwen's audio CDN answers `ACAO: null`, so the browser could play an audio URL but
  never read its bytes — the cache could only remember a 24-hour presigned link and
  re-synthesize once it expired. The relay fixes both halves: the client gets a real
  Blob (cached forever in IndexedDB) and the server PUTs the audio into an Aliyun OSS
  bucket. Object keys are content-addressed (`sha256("v1|<voice>|<text>")`), so the
  same word resolves to the same address on every device without any coordination.
  Works without OSS configured (relay only, no persistence); SSRF-guarded by an
  upstream host allowlist; authenticated and rate-limited per IP.
- **`services/serverBridge.ts`**: single source of truth for "is the online relay
  usable" (`COMMUNITY_URL` + sync token). Previously duplicated inline, where a
  missed check silently degraded AI calls to browser-direct and got blocked by CORS.

### Changed
- `fetchQwenTtsUrl` now tries the shared server cache before calling Qwen, and the
  API-key check moved below the cache lookups — cached audio still plays for a user
  who has no Qwen key configured.
- **Reading studio 「意群 & 难词」 no longer calls AI on its own.** The panel used to
  fire a request the moment a page rendered, and silently pre-fetched the next page.
  Now each page needs an explicit click ("用 AI 提取本页意群与难词"); turning the page
  neither calls nor pre-fetches, so a book costs zero tokens until the reader asks.
  Per-page results are still cached in memory, so revisiting a page costs nothing, and
  a "先看本地生词候选（不联网）" escape hatch keeps the panel usable without any AI.
- **Reading assist now prefers DeepSeek `deepseek-flash`** (V4.1 Flash — cheapest and
  fastest for a one-page JSON task), falling back to the `fast` tier (GLM / Qwen) when
  no DeepSeek key is configured. DeepSeek's thinking mode is switched off for these
  short structured calls (`thinking: {type:'disabled'}`, forwarded by `/llm/chat`).

### Fixed
- **DeepSeek default model was a retired name.** `deepseek-chat` / `deepseek-reasoner`
  were shut down on 2026-07-24, so any DeepSeek call from a fresh install 400'd. The
  default is now `deepseek-flash`, and saved configs are migrated on read
  (`deepseek-chat` / `deepseek-reasoner` / `deepseek-v4-flash` → `deepseek-flash`).

## [0.2.0] - 2026-11-09

Largest update since `0.1.0`: production deployment, the reading studio,
full multi-language account support, an explicit AI consent gate, first-run
learning content, and a persistent TTS cache.

### Added
- **Production deployment**: `https://linguaflow.pathmora.cn` on a single origin —
  Caddy serves the SPA and reverse-proxies `/api/*` to the local Hono + SQLite
  service. Let's Encrypt certificate, automated atomic web deploys.
- **Two editions, one repo**: `npm run build` (open-source, no community URL) and
  `npm run build:online` (reads `.env.online`, injects `COMMUNITY_URL` / `APP_EDITION`).
  Optional light backend provides cloud sync, an authenticated LLM relay with an
  upstream host allowlist, and compliance chat logging. **No API key is embedded
  in any production build**; all providers (GLM / Qwen / OpenRouter / DeepSeek /
  custom) are configured by the user in-app.
- **Reading Studio (book mode)**: right-hand rail with Bilibili companion video
  (float / drag / resize), AI-extracted sense groups & difficult words with IPA,
  one-tap vocab & sentence collection, adjustable and collapsible rail, and
  cross-day book vocabulary. Book pagination now splits on sentence boundaries
  (~550 chars/page) with a versioned migration for existing books.
- **Language switcher**: one-click switching from the sidebar header (plus
  collapsed and mobile variants). Only languages already started are listed;
  "Add language" jumps straight to settings. Switching remounts the view with the
  new language.
- **AI consent gate**: a one-time disclosure dialog plus a persistent toggle in
  Model Settings. Enforced at the single AI network boundary (`callProvider`,
  `callProviderStream`, `fetchQwenTtsUrl`) so **automatically triggered** calls
  are covered too. The dialog names the triggering feature and model, and discloses
  key ownership, data sent, the online relay, and the 180-day chat log. Granting
  resumes the pending call automatically; denying falls back to local content.
- **First-run content**: one-click A1 starter vocabulary (Japanese / Korean derived
  from built-in study books, plus an English list), and a Japanese kana typing
  specialty with 8 drills built from the shared romaji table — **zero AI calls,
  zero API key**. Daily tasks are now reconciled against actually available
  content, so an empty vocabulary no longer produces "review 10 words" tasks.
- **Persistent TTS cache**: in-memory URL LRU plus IndexedDB audio storage
  (200 entries / 20 MB). Blob storage when the audio can be fetched, otherwise
  URL + official `expires_at` fallback (Qwen's OSS CDN sends no CORS header).
  The same word is synthesized once — and still hits cache after a page reload.
- **QA suite**: Playwright E2E and Node unit scripts covering consent, language
  switching, per-language task cache & flywheel, newcomer content, and both TTS
  persistence paths. Unit tests bundle the real TypeScript sources with esbuild.

### Changed
- Daily task cache and daily output flywheel are now keyed by **date × language**.
  Flywheel: the second language completed in a day grants XP again, while
  `commitDailyStreak` keeps the streak to one increment per day.
- `playWord` / `generateSpeech` prefer Qwen TTS for all languages and fall back to
  Web Speech; `reasoning_content` is used when a reasoning model returns empty
  `content`.
- LLM stream responses use `c.body()` so CORS headers survive the relay.
- `package.json` version bumped to `0.2.0`; README, setup, AI/voice docs and this
  changelog synchronized with the code.

### Fixed
- Switching language no longer shows the previous language's daily tasks or a
  completed flywheel from another language.
- `TtsAudioPlayer` cache-key mismatch that prevented stale audio URLs from being
  evicted (it used an undefined voice while the underlying writer used the
  effective one).
- STT / Paraformer removed from code and docs (the feature is intentionally not
  being restored).

[0.2.0]: https://github.com/Chmodpuppets/linguaflow/releases/tag/v0.2.0

## [0.1.1] - 2026-08-26

Documentation and licensing follow-up to the `0.1.0` milestone. No code /
behavior changes — purely project metadata and public-facing docs.

### Added
- **LICENSE**: the project was previously published without an explicit license
  file. Added `LICENSE` under **CC BY-NC 4.0** (Creative Commons
  Attribution-NonCommercial 4.0 International) with a supplementary
  "COMMERCIAL USE — SEPARATE LICENSE REQUIRED" notice: non-commercial use is
  free with attribution; **commercial use is prohibited unless a paid commercial
  license is obtained from the author**.
- **CHANGELOG.md** release-note discipline (this file), so every version is
  reviewable.

### Changed
- **README.md** synchronized with `0.1.0`:
  - Module count `19 -> 20`; added the **Books** module to the nav table and a
    dedicated section (renumbered core-feature sections `4-19 -> 5-20`).
  - Typing: documented the TypeLit refactor + Literata serif and the
    language-gated word pronunciation.
  - RPGView: documented one-click vocab add/remove and the default-hidden
    native-language translation toggle.
  - TTS: default model `sambert-zhide-v1 -> qwen3-tts-flash`; English words now
    route to Youdao dictvoice.
  - License section renamed `开源与贡献 -> 许可与贡献`, now states CC BY-NC 4.0
    and the commercial-licensing contact (GitHub @Chmodpuppets / repo issues).

### Changed
- `package.json` version bumped to `0.1.1` to anchor this patch tag.

## [0.1.0] - 2026-08-26

First feature milestone after the initial scaffold. This release focuses on two
new learning surfaces: a **Books** reader and a **Typing** trainer, plus the
infrastructure they depend on.

### Added
- **Books module**
  - Local book library with **EPUB** and **PDF** file import.
  - Cover rendering: EPUB `cover-image` and PDF first-page rasterization.
  - Storage upgraded to **IndexedDB**, removing the previous ~5MB `localStorage`
    ceiling so large books and libraries persist reliably.
- **Typing trainer (TypeLit-style)**
  - Non-blocking input with a smooth caret, paragraph/line-break handling, and
    space/blur fixes for a fluid typing experience.
  - Typing body now uses the **Literata** serif variable font for long-read
    comfort.
- **TTS / pronunciation** (shipped in earlier commits, summarized here)
  - Language-gated `playWord`: English → Youdao dictvoice, Chinese → Qwen TTS,
    Japanese → Web Speech; sentence-level playback retains Qwen + Web Speech.
  - RPGView vocabulary chips: one-click add/remove to vocab with emerald pop
    feedback, per-word speaker, and a default-hidden native-language translation
    toggle.

### Fixed
- Typing `RunSpan`: leading/trailing spaces now use `\u00A0` to prevent collapse
  and disappearance in the rendered line.

### Changed
- `package.json` version bumped to `0.1.0` to anchor this milestone tag.

[0.1.1]: https://github.com/Chmodpuppets/linguaflow/releases/tag/v0.1.1
[0.1.0]: https://github.com/Chmodpuppets/linguaflow/releases/tag/v0.1.0
