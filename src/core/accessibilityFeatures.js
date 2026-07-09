/**
 * Accessibility features for dyslexia-friendly reading.
 * Applies via style injection (font/spacing) and text-node processing (Bionic Reading, Sentence Break).
 */
console.log('[ND Translate] accessibilityFeatures.js loaded');

class AccessibilityFeatures {
  constructor() {
    this.fontStyleId = 'ot-accessibility-font';
    this.fontLinkIds = {
      dyslexic: 'ot-dyslexic-font-link',
      chinese: 'ot-chinese-font-link'
    };
    this.spacingStyleId = 'ot-accessibility-spacing';
    this.paraSpacingStyleId = 'ot-para-spacing';
    this.fontSizeStyleId = 'ot-font-size';
    this.bionicMark = 'data-ot-bionic';
    this.sentenceBreakMark = 'data-ot-sentence-break';
    this.bionicDimStyleId = 'ot-bionic-dim';
    this.state = {
      font: false,
      chineseFont: false,
      bionicReading: false,
      bionicBoldRatio: 0.5,
      bionicDimNonBold: false,
      sentenceBreak: false,
      lineSpacing: 1.5,
      wordSpacing: 0.08,
      letterSpacing: 0.02,
      fontSize: 1.0
    };
  }

  /**
   * Initialize with user config.
   */
  init(config) {
    this.state.font = config.dyslexicFont === true;
    this.state.chineseFont = config.chineseFont === true;
    this.state.bionicReading = config.bionicReading === true;
    this.state.bionicBoldRatio = parseFloat(config.bionicBoldRatio) || 0.5;
    this.state.bionicDimNonBold = config.bionicDimNonBold === true;
    this.state.sentenceBreak = config.sentenceBreak === true;
    this.state.lineSpacing = parseFloat(config.lineSpacing) || 1.5;
    this.state.wordSpacing = parseFloat(config.wordSpacing) || 0.08;
    this.state.letterSpacing = parseFloat(config.letterSpacing) || 0.02;
    this.state.fontSize = parseFloat(config.fontSize) || 1.0;

    document.documentElement.setAttribute('data-ot-a11y', '');
    console.log('[ND Translate] Accessibility init, sentenceBreak=%s, bionicReading=%s',
      this.state.sentenceBreak, this.state.bionicReading);
    this._applyFontStyles();
    this.applySpacing(this.state.lineSpacing, this.state.wordSpacing, this.state.letterSpacing);
    this._applyFontSize();
    // Sentence break MUST run before bionic: bionic fragments text nodes,
    // which prevents sentence break from finding multi-sentence text.
    if (this.state.sentenceBreak) {
      this.applySentenceBreaks();
    }
    if (this.state.bionicReading) {
      this.applyBionicReading();
    }
    if (this.state.bionicDimNonBold) {
      this._applyBionicDimStyle();
    }
  }

  /**
   * Update a single config value and re-apply.
   */
  update(key, value) {
    if (key in this.state) {
      this.state[key] = value;
    }

    switch (key) {
      case 'dyslexicFont':
      case 'chineseFont':
        this._applyFontStyles();
        break;
      case 'bionicReading':
        if (this.state.bionicReading) {
          this.applyBionicReading();
        } else {
          this.restoreBionicReading();
        }
        break;
      case 'bionicBoldRatio':
        if (this.state.bionicReading) {
          this.restoreBionicReading();
          this.applyBionicReading();
        }
        break;
      case 'bionicDimNonBold':
        if (this.state.bionicDimNonBold) {
          this._applyBionicDimStyle();
        } else {
          this._removeStyle(this.bionicDimStyleId);
        }
        if (this.state.bionicReading) {
          this.restoreBionicReading();
          this.applyBionicReading();
        }
        break;
      case 'sentenceBreak':
        if (this.state.sentenceBreak) {
          this.applySentenceBreaks();
        } else {
          this.restoreSentenceBreaks();
        }
        break;
      case 'fontSize':
        this._applyFontSize();
        break;
      case 'lineSpacing':
      case 'wordSpacing':
      case 'letterSpacing':
        this.applySpacing(this.state.lineSpacing, this.state.wordSpacing, this.state.letterSpacing);
        break;
    }
  }

  // ── Fonts (combined) ──────────────────────────────────
  // LXGW WenKai's @font-face uses unicode-range for CJK only,
  // so Latin chars fall through to the next font in the stack.
  // Order: OpenDyslexic (Latin) → LXGW WenKai (CJK via unicode-range) → system fallback

  _applyFontStyles() {
    const useDyslexic = this.state.font;
    const useChinese = this.state.chineseFont;

    // Manage CDN links
    this._manageFontLink(this.fontLinkIds.dyslexic,
      useDyslexic,
      'https://cdn.jsdelivr.net/npm/open-dyslexic-cdn@0.0.1/dist/OpenDyslexic-Regular.css');
    this._manageFontLink(this.fontLinkIds.chinese,
      useChinese,
      'https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/lxgwwenkaigbscreen.css');

    this._removeStyle(this.fontStyleId);
    if (!useDyslexic && !useChinese) return;

    // Build font stack: Latin → OpenDyslexic, CJK → LXGW WenKai (unicode-range), fallback → system
    let fontStack;
    if (useDyslexic && useChinese) {
      fontStack = "'OpenDyslexic', 'LXGW WenKai Screen', 'LXGW WenKai', sans-serif";
    } else if (useDyslexic) {
      fontStack = "'OpenDyslexic', sans-serif";
    } else {
      fontStack = "'LXGW WenKai Screen', 'LXGW WenKai', system-ui, -apple-system, sans-serif";
    }

    const css = `
      html, body, p, div, span, li, td, th,
      h1, h2, h3, h4, h5, h6, hgroup,
      a, blockquote, article, section, aside, nav,
      main, header, footer, dl, dt, dd, ul, ol,
      form, label, button, summary, details,
      figure, figcaption, caption, legend,
      .ot-clickable-paragraph,
      .ot-click-indicator {
        font-family: ${fontStack} !important;
      }
      .fa, .fas, .far, .fal, .fab, .fad, .glyphicon,
      .material-icons, .material-icons-outlined,
      .material-icons-round, .material-icons-sharp,
      .material-icons-two-tone, [class^="fa-"] {
        font-family: inherit !important;
      }
      pre, code, kbd, samp, var {
        font-family: monospace !important;
      }
    `;
    this._injectStyle(this.fontStyleId, css);
  }

  _manageFontLink(id, enabled, url) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    if (!enabled) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = url;
    link.onerror = () => console.warn('[ND Translate] Font CSS failed to load:', url);
    document.head.appendChild(link);
  }

  // ── Spacing ───────────────────────────────────────────

  applySpacing(lineHeight, wordSpacing, letterSpacing) {
    this._removeStyle(this.spacingStyleId);

    const css = `
      html[data-ot-a11y] body,
      html[data-ot-a11y] body p,
      html[data-ot-a11y] body div,
      html[data-ot-a11y] body article,
      html[data-ot-a11y] body section,
      html[data-ot-a11y] body main,
      html[data-ot-a11y] body li,
      html[data-ot-a11y] body td,
      html[data-ot-a11y] body th,
      html[data-ot-a11y] body dd,
      html[data-ot-a11y] body dt,
      html[data-ot-a11y] body blockquote,
      html[data-ot-a11y] body figcaption,
      html[data-ot-a11y] body aside,
      html[data-ot-a11y] body nav {
        line-height: ${lineHeight} !important;
        word-spacing: ${wordSpacing}em !important;
        letter-spacing: ${letterSpacing}em !important;
      }
      .ot-bilingual-container.ot-bilingual-container,
      .ot-bilingual-container .ot-original-text,
      .ot-bilingual-container .ot-translated-text,
      .ot-original-text.ot-original-text,
      .ot-translated-text.ot-translated-text,
      .ot-paragraph-translated,
      .ot-paragraph-bilingual {
        letter-spacing: normal !important;
        word-spacing: normal !important;
      }
    `;
    this._injectStyle(this.spacingStyleId, css);
  }

  // ── Font Size ─────────────────────────────────────────

  _applyFontSize() {
    const size = this.state.fontSize;
    if (size === 1.0) {
      this._removeStyle(this.fontSizeStyleId);
      return;
    }
    const css = `
      html[data-ot-a11y] body {
        font-size: ${(size * 100).toFixed(0)}% !important;
      }
    `;
    this._injectStyle(this.fontSizeStyleId, css);
  }

  // ── Bionic Reading ────────────────────────────────────

  _isInTranslatedElement(parent) {
    if (!parent) return true;
    return parent.closest(
      '.ot-paragraph-translated, .ot-click-translated, .ot-translated-text, span[data-ot-bionic]'
    ) !== null;
  }

  applyBionicReading() {
    if (this._bionicApplied) {
      console.log('[ND Translate] applyBionicReading: skipped (_bionicApplied already true)');
      return;
    }
    this._bionicApplied = true;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
              tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CODE' ||
              tag === 'PRE' || tag === 'KBD' || tag === 'VAR') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest(`[${this.bionicMark}]`)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (this._isInTranslatedElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = node.textContent.trim();
          if (!text || !/[a-zA-Z]{2,}/.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    console.log('[ND Translate] applyBionicReading: found %d text nodes to process', nodes.length);
    for (const node of nodes) {
      this._processBionicNode(node);
    }
  }

  _processBionicNode(textNode) {
    const parent = textNode.parentNode;
    const text = textNode.textContent;
    const frag = document.createDocumentFragment();

    let lastIndex = 0;
    const wordRe = /([a-zA-Z]+)/g;
    let match;

    while ((match = wordRe.exec(text)) !== null) {
      // Text before this word
      if (match.index > lastIndex) {
        frag.appendChild(this._createTextSegment(text.slice(lastIndex, match.index)));
      }

      const word = match[0];
      if (word.length <= 3) {
        frag.appendChild(this._createTextSegment(word));
      } else {
        const boldLen = Math.max(1, Math.ceil(word.length * this.state.bionicBoldRatio));
        const boldPart = word.slice(0, boldLen);
        const restPart = word.slice(boldLen);

        const boldEl = document.createElement('b');
        boldEl.className = 'ot-bionic-bold';
        boldEl.setAttribute(this.bionicMark, '');
        boldEl.textContent = boldPart;
        frag.appendChild(boldEl);

        if (restPart) {
          frag.appendChild(this._createTextSegment(restPart));
        }
      }

      lastIndex = match.index + word.length;
    }

    // Remaining text after last word
    if (lastIndex < text.length) {
      frag.appendChild(this._createTextSegment(text.slice(lastIndex)));
    }

    const wrapper = document.createElement('span');
    wrapper.setAttribute(this.bionicMark, '');
    wrapper.appendChild(frag);
    parent.replaceChild(wrapper, textNode);
  }

  _createTextSegment(text) {
    if (!text) return document.createTextNode('');
    if (this.state.bionicDimNonBold) {
      const span = document.createElement('span');
      span.className = 'ot-bionic-dim';
      span.setAttribute('data-ot-bionic-dim', '');
      span.textContent = text;
      return span;
    }
    return document.createTextNode(text);
  }

  restoreBionicReading() {
    this._bionicApplied = false;
    const markers = document.querySelectorAll(`[${this.bionicMark}], [data-ot-bionic-dim]`);
    for (const el of markers) {
      const parent = el.parentNode;
      if (!parent) continue;
      const text = document.createTextNode(el.textContent);
      parent.replaceChild(text, el);
    }
    this._normalizeTextNodes(document.body);
  }

  _applyBionicDimStyle() {
    const css = `.ot-bionic-dim { opacity: 0.55; }`;
    this._injectStyle(this.bionicDimStyleId, css);
  }

  // ── Sentence Break ────────────────────────────────────

  applySentenceBreaks() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
              tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'CODE' ||
              tag === 'PRE' || tag === 'KBD' || tag === 'VAR') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest(`[${this.sentenceBreakMark}]`)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (this._isInTranslatedElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = node.textContent.trim();
          if (!text || !/[.!?。！？]/.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }

    for (const node of nodes) {
      this._processSentenceBreakNode(node);
    }
    this._applyParaSpacing();
    if (nodes.length > 0) {
      console.log('[ND Translate] Sentence break: processed %d text nodes, split %d into blocks',
        nodes.length, document.querySelectorAll(`span[${this.sentenceBreakMark}]`).length);
    }
  }

  _applyParaSpacing() {
    const css = `
      html[data-ot-a11y] body p,
      html[data-ot-a11y] body article,
      html[data-ot-a11y] body section,
      html[data-ot-a11y] body main,
      html[data-ot-a11y] body aside,
      html[data-ot-a11y] body nav,
      html[data-ot-a11y] body div > p,
      html[data-ot-a11y] body li,
      html[data-ot-a11y] body blockquote,
      html[data-ot-a11y] body h1,
      html[data-ot-a11y] body h2,
      html[data-ot-a11y] body h3,
      html[data-ot-a11y] body h4,
      html[data-ot-a11y] body h5,
      html[data-ot-a11y] body h6,
      html[data-ot-a11y] body figure,
      html[data-ot-a11y] body figcaption {
        margin-bottom: 1.5em !important;
      }
    `;
    this._injectStyle(this.paraSpacingStyleId, css);
  }

  _processSentenceBreakNode(textNode) {
    try {
      const parent = textNode.parentNode;
      if (!parent) return;
      const text = textNode.textContent;

      const sentences = this._splitSentences(text);
      const filtered = sentences.filter(s => s.trim());
      if (filtered.length <= 1) return;

      const wrapper = document.createElement('span');
      wrapper.setAttribute(this.sentenceBreakMark, '');

      for (let i = 0; i < filtered.length; i++) {
        wrapper.appendChild(document.createTextNode(filtered[i]));
        if (i < filtered.length - 1) {
          wrapper.appendChild(document.createElement('br'));
        }
      }

      parent.replaceChild(wrapper, textNode);
    } catch (e) {
      console.warn('[ND Translate] Sentence break node processing failed:', e);
    }
  }

  _splitSentences(text) {
    const result = [];
    let last = 0;
    const re = /[.!?。！？]/g;
    let m;

    while ((m = re.exec(text)) !== null) {
      const punct = m[0];
      const after = text.slice(m.index + 1);
      const seg = text.slice(last, m.index + 1);

      let isEnd = false;

      if (/[。！？]/.test(punct)) {
        // Chinese punctuation always ends a sentence
        isEnd = true;
      } else if (/[!?]/.test(punct)) {
        isEnd = true;
      } else if (punct === '.') {
        // Citation pattern: period right after ) like (2022). → not a sentence end
        if (m.index > 0 && text[m.index - 1] === ')') {
          isEnd = false;
        } else {
          // Period only ends a sentence when followed by:
          // whitespace + capital / CJK / Japanese / Korean, or end of text
          const trimmed = after.trimStart();
          if (trimmed.length === 0) {
            isEnd = true;
          } else {
            const next = trimmed[0];
            if (/[A-Z一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/.test(next)) {
              isEnd = true;
            }
          }
        }
      }

      // Don't split if the segment is empty (consecutive punctuation like ?. or !.)
      if (isEnd && m.index === last) {
        isEnd = false;
      }

      if (isEnd) {
        result.push(seg);
        last = m.index + 1;
      }
    }

    if (last < text.length) {
      result.push(text.slice(last));
    }

    return result;
  }

  restoreSentenceBreaks() {
    const wrappers = document.querySelectorAll(`span[${this.sentenceBreakMark}]`);
    for (const wrapper of wrappers) {
      const parent = wrapper.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(wrapper.textContent), wrapper);
    }
    this._normalizeTextNodes(document.body);
    this._removeStyle(this.paraSpacingStyleId);
  }

  // Decouple adjacent text nodes after unwrapping
  _normalizeTextNodes(element) {
    // normalize() merges adjacent text nodes — this is what we want
    // but we need to skip script/style
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const tag = node.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    const elements = [];
    while (walker.nextNode()) { elements.push(walker.currentNode); }
    for (const el of elements) {
      try { el.normalize(); } catch (e) { /* skip */ }
    }
  }

  // ── Cleanup ───────────────────────────────────────────

  cleanup() {
    document.documentElement.removeAttribute('data-ot-a11y');
    this._removeStyle(this.fontStyleId);
    Object.values(this.fontLinkIds).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    this._removeStyle(this.spacingStyleId);
    this._removeStyle(this.fontSizeStyleId);
    this._removeStyle(this.bionicDimStyleId);
    this.restoreBionicReading();
    this.restoreSentenceBreaks();
  }

  // ── Helpers ───────────────────────────────────────────

  _injectStyle(id, css) {
    let el = document.getElementById(id);
    if (el) {
      el.textContent = css;
    } else {
      el = document.createElement('style');
      el.id = id;
      el.textContent = css;
      document.head.appendChild(el);
    }
  }

  _removeStyle(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AccessibilityFeatures;
} else if (typeof window !== 'undefined') {
  window.AccessibilityFeatures = AccessibilityFeatures;
}
