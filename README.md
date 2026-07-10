# ND Translate

<img src="assets/icons/icon128.png" alt="ND Translate" width="64" height="64">

A neurodiversity-friendly web page translation extension.

Features a built-in neurodiversity glossary, plus reading aids like OpenDyslexic font, Bionic Reading, and sentence break.

> Forked from [sxueck/open-translate](https://github.com/sxueck/open-translate)

## Features

### Translation

- **Three modes**: Replace / Bilingual / Click-to-translate
- **Dual engine**: Free Google Translate + LLM API (OpenAI-compatible)
- **Smart extraction**: Mozilla Readability-based content detection
- **Smart batching**: Token-based dynamic batching to minimize API calls
- **Glossary**: Built-in neurodiversity terminology for accurate ND translation
- **Input field translation**: Trigger translation in any text input via shortcut

### Reading Aids

- **OpenDyslexic font**: Designed for dyslexic readers
- **LXGW WenKai Chinese font**: Clear CJK glyphs
- **Bionic Reading**: Bold the first half of each word to guide eye movement
- **Sentence break**: Split paragraphs by sentence punctuation for easier reading
- **Spacing controls**: Line height, word spacing, and letter spacing
- **Font size**: Global text scaling
- **Reading guide**: Browser TTS, sentence spotlight, speed control, mute mode, and click-to-seek
- **In-page toolbar**: Translate/retranslate, show or hide translations, and compact reading controls
- **Clear format mode**: Remove all extension-applied reading formats and keep future pages in their original style until a reading format is enabled again

## Installation

### From ZIP (Recommended)

1. Download `nd-translate.zip` from [Releases](https://github.com/xyzhou0323/open-translate/releases)
2. Extract to any local directory
3. Go to `chrome://extensions/`, enable "Developer mode"
4. Click "Load unpacked" and select the extracted `dist/extension` folder

### Developer Mode

```bash
git clone https://github.com/xyzhou0323/open-translate.git
cd open-translate
```

1. Go to `chrome://extensions/`, enable "Developer mode"
2. Click "Load unpacked" and select the `dist/extension` folder under the project directory

## Configuration

Click the extension icon → "Advanced Settings":

- **API Endpoint / Key / Model**: Set up LLM translation. Leave blank to use free Google Translate
- **Target language**: Default to Simplified Chinese
- **Glossary toggle**: Enable/disable neurodiversity glossary
- **Reading aids**: Fonts, Bionic Reading, sentence break, spacing controls, and reading-guide defaults

## In-page Toolbar

The page-bottom toolbar provides the most common actions without reopening the popup:

- **Translate / Retranslate**: Uses the currently selected source language, target language, and translation mode.
- **Show / Hide translation**: Toggle between the original page and cached translations. In bilingual mode, it switches between original-only and bilingual views.
- **Reading guide**: Play, pause, stop, seek, speed, mute, and spotlight controls.
- **Display**: Opens nearby settings for fonts, Bionic Reading, sentence breaks, and spacing.
- **Clear**: Removes translations and all extension-applied reading formats. The cleared format state is remembered for new pages.

## Reading Format State

Advanced Settings shows whether page format enhancement is active. Use **Clear and keep off** to preserve websites' original typography on future pages. Changing a reading-format setting and saving enables format enhancement again.

## License

MIT
