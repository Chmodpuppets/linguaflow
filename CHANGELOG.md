# Changelog

All notable changes to LinguaFlow are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/Chmodpuppets/linguaflow/releases/tag/v0.1.0
