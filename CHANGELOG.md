# Changelog

All notable changes to LinguaFlow are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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
