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

## Installation

### Developer Mode

```bash
git clone https://github.com/xyzhou0323/open-translate.git
cd open-translate
```

1. Go to `chrome://extensions/`, enable "Developer mode"
2. Click "Load unpacked" and select the project directory

## Configuration

Click the extension icon → "Advanced Settings":

- **API Endpoint / Key / Model**: Set up LLM translation. Leave blank to use free Google Translate
- **Target language**: Default to Simplified Chinese
- **Glossary toggle**: Enable/disable neurodiversity glossary
- **Reading aids**: Fonts, Bionic Reading, sentence break, spacing controls

## License

MIT
