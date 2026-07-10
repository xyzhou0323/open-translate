/**
 * Reading Aloud — TTS + reading mask (spotlight) engine.
 * Uses browser SpeechSynthesis API; supports mute mode (spotlight only).
 */
class ReadingGuide {
  constructor(options = {}) {
    this.textExtractor = options.textExtractor || null;
    this.accessibilityFeatures = options.accessibilityFeatures || null;
    this.onStatusChange = options.onStatusChange || (() => {});

    this.state = 'idle'; // idle | reading | paused | stopped
    this.speed = 1.0;
    this.muted = false;
    this.maskEnabled = true;

    // Sentence data
    this.sentences = [];
    this.currentSentenceIndex = -1;

    // TTS
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this._ttsId = 0;
    this._ttsTimeout = null;
    this._ttsKeepAlive = null;

    // Mute mode timers
    this._muteSentenceTimer = null;

    // Overlay
    this._maskEl = null;
    this._currentMaskRect = null;
    this._styleInjected = false;

    // Scroll throttle
    this._scrollPending = false;
    this._programmaticScroll = false;

    // Seek mode
    this._seekActive = false;
    this._continuousSeek = false;
    this._containerIndex = null;

    // Bound handlers
    this._onVisibility = this._onVisibility.bind(this);
    this._onBeforeUnload = this._onBeforeUnload.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onResize = this._onResize.bind(this);
    this._onMaskClick = this._onMaskClick.bind(this);
    this._onSeekClick = this._onSeekClick.bind(this);
  }

  // ── Lifecycle ──────────────────────────────────────────

  init(config = {}) {
    this.speed = config.speed || 1.0;
    this.muted = config.muted || false;
    this.maskEnabled = config.maskEnabled !== false;
    this._injectStyles();
  }

  cleanup() {
    this.stop();
    this._removeOverlays();
    this._removeListeners();
  }

  // ── Control API ────────────────────────────────────────

  async start(opts = {}) {
    if (this.state === 'reading') return;

    if (opts.speed !== undefined) this.speed = opts.speed;
    if (opts.muted !== undefined) this.muted = opts.muted;
    if (opts.maskEnabled !== undefined) this.maskEnabled = opts.maskEnabled;

    if (this.sentences.length === 0 || this.state === 'stopped') {
      this.sentences = this._extractSentences();
      if (this.sentences.length === 0) {
        this.onStatusChange('readingGuideError', { error: 'No readable content found on this page' });
        return;
      }
    }

    this.state = 'reading';
    this._exitSeekMode();
    this._ensureMask();
    this._addListeners();

    const startIdx = this.currentSentenceIndex >= 0 ? this.currentSentenceIndex : 0;

    if (this.muted) {
      this._startMuteTimed(startIdx);
    } else {
      this._startTTS(startIdx);
    }

    this.onStatusChange('readingGuideStarted');
  }

  pause() {
    if (this.state !== 'reading') return;
    this._stopVoice();
    this._clearTimers();
    this.state = 'paused';
    this.onStatusChange('readingGuidePaused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'reading';
    this._ensureMask();
    this._updateMask();

    if (this.muted) {
      this._startMuteTimed(this.currentSentenceIndex);
    } else {
      this._startTTS(this.currentSentenceIndex);
    }

    this.onStatusChange('readingGuideResumed');
  }

  stop() {
    this._stopVoice();
    this._clearTimers();
    this._exitSeekMode();
    this._removeOverlays();
    this._removeListeners();
    this.state = 'idle';
    this.currentSentenceIndex = -1;
    this.onStatusChange('readingGuideStopped');
  }

  setSpeed(speed) {
    this.speed = Math.max(0.5, Math.min(6.0, parseFloat(speed) || 1.0));

    // Above 3x, TTS engines cap out — force mute mode for fast mask reading
    if (this.speed > 3.0 && !this.muted) {
      this.setMuted(true);
      return;
    }

    if (this.state === 'reading' && !this.muted) {
      this._stopVoice();
      setTimeout(() => {
        if (this.state === 'reading' && !this.muted) this._speakCurrent();
      }, 50);
    }
  }

  setMuted(muted) {
    if (this.muted === muted) return;
    const wasReading = this.state === 'reading';
    const idx = this.currentSentenceIndex;

    this._stopVoice();
    this._clearTimers();
    this.muted = muted;

    if (wasReading && idx >= 0 && idx < this.sentences.length) {
      this.state = 'reading';
      setTimeout(() => {
        if (this.state !== 'reading') return;
        if (this.muted) {
          this._startMuteTimed(idx);
        } else {
          this._startTTS(idx);
        }
      }, 50);
    }
  }

  setMaskEnabled(enabled) {
    this.maskEnabled = !!enabled;
    if (enabled) {
      this._updateMask();
    } else if (this._maskEl) {
      this._maskEl.style.setProperty('display', 'none', 'important');
    }
  }

  isReading() { return this.state === 'reading'; }
  isPaused() { return this.state === 'paused'; }
  getState() { return this.state; }
  getCurrentSentenceIndex() { return this.currentSentenceIndex; }

  // ── Seek-to-click ───────────────────────────────────────

  enterSeekMode(continuous = false) {
    if (this.state !== 'paused') return;
    // If already in seek mode and same mode, exit
    if (this._seekActive && this._continuousSeek === continuous) {
      this.exitSeekMode();
      return;
    }
    this._seekActive = true;
    this._continuousSeek = continuous;
    document.body.style.cursor = 'crosshair';
    document.addEventListener('click', this._onSeekClick, true);
    this.onStatusChange('readingGuideSeekMode', { active: true, continuous });
  }

  exitSeekMode() {
    this._exitSeekMode();
    this.onStatusChange('readingGuideSeekMode', { active: false, continuous: false });
  }

  _exitSeekMode() {
    this._seekActive = false;
    this._continuousSeek = false;
    document.body.style.cursor = '';
    document.removeEventListener('click', this._onSeekClick, true);
  }

  _onSeekClick(e) {
    // Don't intercept clicks on our own UI (toolbar, mask)
    if (e.target.closest('#ot-toolbar, #ot-toolbar-min, #ot-reading-mask')) return;

    e.preventDefault();
    e.stopPropagation();
    // In one-shot mode, exit seek on first click; in continuous mode, stay active
    if (!this._continuousSeek) {
      this.exitSeekMode();
    }

    const x = e.clientX;
    const y = e.clientY;

    // Find the element at click position (hide mask temporarily to reach page content)
    if (this._maskEl) this._maskEl.style.setProperty('display', 'none', 'important');
    const el = document.elementFromPoint(x, y);
    if (this._maskEl) this._maskEl.style.setProperty('display', 'block', 'important');

    if (!el) return;

    // Walk up to find a container in our index
    let cur = el;
    while (cur && cur !== document.body) {
      if (this._containerIndex && this._containerIndex.has(cur)) {
        const baseIdx = this._containerIndex.get(cur);
        const textNodes = this._collectVisibleTextNodes(cur);

        // Find the closest sentence within this container by Y position
        let bestIdx = baseIdx;
        let bestDist = Infinity;
        for (let i = baseIdx; i < this.sentences.length; i++) {
          if (this.sentences[i].container !== cur) break;
          const s = this.sentences[i];
          const rect = this._rangeFromOffset(textNodes, s._charOffset || 0, s.text.length);
          if (rect && rect.height > 0) {
            const cy = rect.top + rect.height / 2;
            const dist = Math.abs(cy - y);
            if (dist < bestDist) { bestDist = dist; bestIdx = i; }
          }
        }

        this.currentSentenceIndex = bestIdx;
        this._positionMask(this.sentences[bestIdx]);
        this.onStatusChange('readingGuideSeeked', { index: bestIdx });
        return;
      }
      cur = cur.parentElement;
    }
  }

  // ── Sentence Extraction ────────────────────────────────

  _extractSentences() {
    const sentences = [];
    const readingRoot = this._findReadingRoot();

    const a11y = this.accessibilityFeatures;
    const hadBionic = a11y && a11y.state && a11y.state.bionicReading;
    const hadSentenceBreak = a11y && a11y.state && a11y.state.sentenceBreak;
    if (a11y) {
      if (hadBionic) a11y.restoreBionicReading();
      if (hadSentenceBreak) a11y.restoreSentenceBreaks();
    }
    if (this.textExtractor) this.textExtractor.clearCache();

    try {
      const blockTags = new Set([
        'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'li', 'td', 'th', 'blockquote', 'figcaption',
        'dt', 'dd', 'legend', 'caption', 'option',
        'div', 'article', 'section', 'main', 'aside', 'header', 'footer'
      ]);

      const walker = document.createTreeWalker(
        readingRoot,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            const tag = parent.tagName;
            // Only skip truly non-content elements
            if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
                tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' ||
                tag === 'OPTION' || tag === 'SVG' || tag === 'TSPAN' || tag === 'TEXTPATH') {
              return NodeFilter.FILTER_REJECT;
            }
            if (this._shouldSkipReadingNode(parent, readingRoot)) return NodeFilter.FILTER_REJECT;
            // Skip extension's own UI elements
            if (parent.closest && parent.closest('#ot-toolbar, #ot-toolbar-min, #ot-reading-mask')) {
              return NodeFilter.FILTER_REJECT;
            }
            // Skip translated bilingual wrappers
            if (parent.closest && parent.closest('.ot-bilingual-container, .ot-paragraph-bilingual')) {
              return NodeFilter.FILTER_REJECT;
            }
            // Keep whitespace-only nodes: spaces between inline elements are
            // meaningful for both spoken text and character-based Range offsets.
            if (!node.textContent) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const findBlock = (el) => {
        let cur = el;
        while (cur && cur !== readingRoot) {
          if (blockTags.has(cur.tagName.toLowerCase())) return cur;
          cur = cur.parentElement;
        }
        return readingRoot;
      };

      // Group text nodes by block container
      const containerTexts = new Map();
      let node;
      while ((node = walker.nextNode())) {
        const container = findBlock(node.parentElement);
        if (!container) continue;
        const text = node.textContent;
        if (containerTexts.has(container)) {
          containerTexts.set(container, containerTexts.get(container) + text);
        } else {
          containerTexts.set(container, text);
        }
      }

      // Split each container's accumulated text into sentences, recording character offsets.
      // The offsets must point at the trimmed sentence text, not at whitespace between
      // sentences, otherwise every later Range starts one or more characters too early.
      for (const [container, rawText] of containerTexts) {
        if (!rawText.trim()) continue;
        const parts = this._splitSentences(rawText);
        let charOffset = 0;
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length > 0) {
            const leadingWhitespace = part.length - part.trimStart().length;
            sentences.push({
              text: trimmed,
              container: container,
              _charOffset: charOffset + leadingWhitespace
            });
          }
          charOffset += part.length;
        }
      }
    } catch (e) {
      const bodyText = document.body.textContent || '';
      const parts = this._splitSentences(bodyText);
      let charOffset = 0;
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length > 0) {
          const leadingWhitespace = part.length - part.trimStart().length;
          sentences.push({
            text: trimmed,
            container: document.body,
            _charOffset: charOffset + leadingWhitespace
          });
        }
        charOffset += part.length;
      }
    }

    // The walker already yields DOM (authoring) order. Do not re-sort all blocks
    // by viewport coordinates: sidebars and article paragraphs often share the
    // same Y positions, which interleaved their sentences in the previous logic.

    // Re-apply accessibility features FIRST so the final layout (fonts, spacing,
    // bionic, sentence breaks) is in place before we capture sentence positions.
    if (a11y) {
      if (hadSentenceBreak) a11y.applySentenceBreaks();
      if (hadBionic) a11y.applyBionicReading();
    }

    // Capture sentence bounding rects from the FINAL DOM layout.
    // Store as viewport-relative coords so _positionMask can use them directly.
    this._captureRects(sentences);

    // Build container index for seek-to-position
    this._containerIndex = new Map();
    for (let i = 0; i < sentences.length; i++) {
      const c = sentences[i].container;
      if (!this._containerIndex.has(c)) {
        this._containerIndex.set(c, i);
      }
    }

    return sentences;
  }

  /**
   * Prefer a semantic article/main container. Reading the entire body makes
   * independent UI regions (navigation, sidebars and footers) look like one flow.
   */
  _findReadingRoot() {
    const selector = [
      'article', 'main', '[role="main"]', '[itemprop="articleBody"]',
      '.article-content', '.article-body', '.entry-content', '.post-content', '.post-body'
    ].join(', ');
    const candidates = [...document.querySelectorAll(selector)]
      .filter((element) => !this._shouldSkipReadingNode(element, document.body));

    if (candidates.length === 0) return document.body;

    const score = (element) => {
      const textLength = (element.innerText || element.textContent || '').trim().length;
      const rect = element.getBoundingClientRect();
      const semanticBonus = element.matches('article, main, [role="main"], [itemprop="articleBody"]') ? 5000 : 0;
      return semanticBonus + Math.min(textLength, 10000) + Math.min(rect.width * rect.height / 100, 5000);
    };
    return candidates.sort((a, b) => score(b) - score(a))[0];
  }

  /**
   * Exclude UI and content that is not currently exposed to the reader.
   */
  _shouldSkipReadingNode(element, root) {
    if (!element) return true;

    const uiSelector = [
      'nav', 'aside', 'header', 'footer', 'form', 'button',
      '[role="navigation"]', '[role="menu"]', '[role="menubar"]',
      '[role="tablist"]', '[role="dialog"]', '[role="alertdialog"]',
      '[hidden]', '[aria-hidden="true"]', '[inert]'
    ].join(', ');
    if (element.closest(uiSelector)) return true;

    const closedDetails = element.closest('details:not([open])');
    if (closedDetails && !element.closest('summary')) return true;

    const uiNamePattern = /(^|[-_\s])(nav|navbar|menu|sidebar|side[-_ ]?bar|sidenav|toc|breadcrumb|pagination|toolbar|drawer|modal|popup|dropdown)([-_\s]|$)/i;
    let current = element;
    while (current) {
      const className = typeof current.className === 'string' ? current.className : '';
      if (uiNamePattern.test(`${current.id || ''} ${className}`)) return true;
      if (current.getAttribute && current.getAttribute('aria-expanded') === 'false') return true;

      try {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || style.contentVisibility === 'hidden') return true;

        // Collapsed panels may leave text in the DOM under a zero-height,
        // overflow-clipped ancestor, so checking only the text node is not enough.
        const rect = current.getBoundingClientRect();
        const clipsOverflow = /hidden|clip/.test(style.overflowY) || /hidden|clip/.test(style.overflow);
        if (current !== root && style.display !== 'contents' && rect.height === 0 && clipsOverflow) return true;
      } catch (e) { /* allow nodes whose style cannot be read */ }

      if (current === root || current === document.body) break;
      current = current.parentElement;
    }
    return false;
  }

  _splitSentences(text) {
    if (!text) return [];
    const result = [];
    let last = 0;
    const re = /[.!?。！？]/g;
    let m;

    while ((m = re.exec(text)) !== null) {
      const punct = m[0];
      const idx = m.index;
      let isEnd = false;

      // CJK punctuation is always a sentence end
      if (/[。！？]/.test(punct)) {
        isEnd = true;
      } else if (punct === '?') {
        // Don't split URL query strings (e.g. "example.com?q=foo")
        const before = text.slice(Math.max(0, idx - 3), idx);
        if (/[&=\/]/.test(before) || /:\/\//.test(text.slice(Math.max(0, idx - 8), idx))) {
          isEnd = false;
        } else {
          isEnd = true;
        }
      } else if (punct === '!') {
        isEnd = true;
      } else if (punct === '.') {
        const after = text.slice(idx + 1);
        const afterTrimmed = after.trimStart();
        const before = text.slice(Math.max(0, idx - 1), idx);

        // Period before closing paren — not a sentence end
        if (text[idx + 1] === ')') {
          isEnd = false;
        }
        // Decimal number (e.g. "3.14")
        else if (/\d/.test(before) && /^\d/.test(afterTrimmed)) {
          isEnd = false;
        }
        // Single-letter abbreviation (e.g. "Dr.", "Mr.", "e.g.")
        else if (/[A-Z]\.[A-Z]/.test(text.slice(Math.max(0, idx - 2), idx + 2))) {
          isEnd = false;
        }
        // URL path segment (e.g. "example.com/page")
        else if (/\/\S*\./.test(text.slice(Math.max(0, idx - 20), idx + 1)) || /\.\S*\//.test(text.slice(idx, idx + 20))) {
          isEnd = false;
        }
        // End of text
        else if (afterTrimmed.length === 0) {
          isEnd = true;
        }
        // Followed by capital letter, CJK, or digit (new sentence)
        else {
          const next = afterTrimmed[0];
          if (/[A-Z0-9一-鿿぀-ゟ゠-ヿ가-힯]/.test(next)) {
            isEnd = true;
          }
          // Followed by whitespace and then lowercase = likely sentence end too
          // (some authors don't capitalize after periods, but the gap indicates a break)
          else if (after.length > afterTrimmed.length && after[0] !== afterTrimmed[0]) {
            isEnd = true;
          }
        }
      }

      if (isEnd && idx === last) {
        isEnd = false;
      }

      if (isEnd) {
        result.push(text.slice(last, idx + 1));
        last = idx + 1;
      }
    }

    if (last < text.length) {
      const tail = text.slice(last).trim();
      if (tail) result.push(tail);
    }

    return result;
  }

  // ── TTS Mode ───────────────────────────────────────────

  _startTTS(fromIndex) {
    this.currentSentenceIndex = fromIndex;
    this._startKeepAlive();
    this._speakCurrent();
  }

  _startKeepAlive() {
    this._stopKeepAlive();
    // Chrome's SpeechSynthesis stops after ~15s of continuous speech.
    // Pause/resume on an interval resets the internal timer and prevents stalling.
    this._ttsKeepAlive = setInterval(() => {
      if (this.synth.speaking) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 10000);
  }

  _stopKeepAlive() {
    if (this._ttsKeepAlive) {
      clearInterval(this._ttsKeepAlive);
      this._ttsKeepAlive = null;
    }
  }

  _speakCurrent() {
    if (this.state !== 'reading') return;
    if (this.currentSentenceIndex >= this.sentences.length) {
      this._onComplete();
      return;
    }

    clearTimeout(this._ttsTimeout);

    const sentence = this.sentences[this.currentSentenceIndex];
    const speakText = sentence.text.replace(/https?:\/\/\S+/g, '');
    if (!speakText.trim()) {
      this.currentSentenceIndex++;
      if (this.state === 'reading') this._speakCurrent();
      return;
    }

    const utt = new SpeechSynthesisUtterance(speakText);
    const ttsId = ++this._ttsId;

    utt.lang = this._detectLang(sentence.text);
    utt.rate = Math.min(this.speed, 4.0); // Chrome clamps internally, but be explicit
    utt.volume = 1.0;
    utt.pitch = 1.0;

    // Scroll first so _positionMask uses the post-scroll viewport position
    this._scrollTo(sentence);
    this._positionMask(sentence);

    let ended = false;
    const advance = () => {
      if (ended) return;
      ended = true;
      clearTimeout(this._ttsTimeout);
      if (this._ttsId !== ttsId) return;
      this.currentSentenceIndex++;
      setTimeout(() => {
        if (this.state === 'reading') this._speakCurrent();
      }, 80);
    };

    utt.onend = () => advance();
    utt.onerror = (e) => {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      if (this._ttsId !== ttsId) return;
      // Chrome sometimes drops utterances silently — advance on error too
      setTimeout(() => advance(), 150);
    };

    // Do not advance based on an estimated duration: actual voice speed differs
    // substantially by browser, voice, language and punctuation. Advancing early
    // moves the mask to the next sentence while the previous one is still spoken.
    // Keep a conservative recovery check only for a silent engine that failed to
    // dispatch `onend`; it never interrupts speech that is still in progress.
    const watchdogMs = Math.max(15000, Math.min(120000, speakText.length * 1000));
    this._ttsTimeout = setTimeout(() => {
      if (this._ttsId === ttsId && !this.synth.speaking && !this.synth.pending) {
        advance();
      }
    }, watchdogMs);

    this.utterance = utt;
    this.synth.speak(utt);
  }

  _stopVoice() {
    clearTimeout(this._ttsTimeout);
    this._stopKeepAlive();
    if (this.synth) this.synth.cancel();
    this.utterance = null;
  }

  // ── Mute Mode ──────────────────────────────────────────

  _speedToWPM(speed) {
    return Math.round(100 + (speed - 0.5) * (400 / 2.5));
  }

  _startMuteTimed(fromIndex) {
    this.currentSentenceIndex = fromIndex;
    this._advanceMute();
  }

  _advanceMute() {
    if (this.state !== 'reading') return;
    if (this.currentSentenceIndex >= this.sentences.length) {
      this._onComplete();
      return;
    }

    const sentence = this.sentences[this.currentSentenceIndex];
    this._scrollTo(sentence);
    this._positionMask(sentence);

    const text = sentence.text;
    // Count reading units: CJK characters individually, Latin words by spaces
    const cjkCount = (text.match(/[一-鿿㐀-䶿　-〿ぁ-ゟ゠-ヿ가-힣]/g) || []).length;
    const latinWords = text.replace(/[^\x00-\x7F]+/g, ' ').split(/\s+/).filter(w => /\w/.test(w)).length;
    const units = cjkCount + latinWords || 1;
    const wpm = this._speedToWPM(this.speed);
    const durationMs = Math.max((units / wpm) * 60000, 800);

    this._muteSentenceTimer = setTimeout(() => {
      this.currentSentenceIndex++;
      if (this.state === 'reading') this._advanceMute();
    }, durationMs);
  }

  _clearTimers() {
    clearTimeout(this._muteSentenceTimer);
    this._muteSentenceTimer = null;
  }

  // ── Mask (Spotlight) ───────────────────────────────────

  /**
   * Capture initial bounding rects for sentences. These are a fallback only;
   * _positionMask measures again before drawing so reflowed content stays aligned.
   */
  _captureRects(sentences) {
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    for (const s of sentences) {
      try {
        const container = s.container;
        if (!container) continue;
        const cr = container.getBoundingClientRect();
        if (cr.width === 0 && cr.height === 0) continue;

        // Walk the current visible text nodes.
        const textNodes = this._collectVisibleTextNodes(container);
        if (textNodes.length === 0) continue;

        const rect = this._rangeFromOffset(textNodes, s._charOffset || 0, s.text.length);
        if (rect && rect.height > 0) {
          s._rect = { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
          s._capturedScrollY = scrollY;
          s._capturedScrollX = scrollX;
        }
      } catch (e) { /* skip this sentence */ }
    }
  }

  /**
   * Collect visible text nodes inside a container, using the same filter as extraction.
   */
  _collectVisibleTextNodes(container) {
    const textNodes = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' ||
          tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' ||
          tag === 'OPTION' || tag === 'SVG' || tag === 'TSPAN' || tag === 'TEXTPATH') continue;
      if (parent.hasAttribute('hidden') || parent.getAttribute('aria-hidden') === 'true') continue;
      if (parent.closest('[hidden], [aria-hidden="true"]')) continue;
      if (parent.closest('.ot-bilingual-container, .ot-paragraph-bilingual, #ot-toolbar, #ot-toolbar-min, #ot-reading-mask')) continue;
      if (parent.style.display === 'none' || parent.style.visibility === 'hidden') continue;
      const rect = parent.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      try {
        const cs = getComputedStyle(parent);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      } catch (e) { /* allow */ }
      // Whitespace-only nodes between inline elements are part of the text
      // coordinate system (for example: <b>Hello</b> <i>world</i>). Dropping
      // them makes both speech text and later character offsets drift.
      if (!node.textContent) continue;
      textNodes.push(node);
    }
    return textNodes;
  }

  /**
   * Return the sentence's current range rect. Re-measuring is necessary after
   * font loading, images, responsive layout changes, or page-side DOM updates.
   */
  _measureSentenceRect(sentence) {
    if (!sentence || !sentence.container) return null;
    const textNodes = this._collectVisibleTextNodes(sentence.container);
    if (textNodes.length === 0) return null;
    const rect = this._rangeFromOffset(textNodes, sentence._charOffset || 0, sentence.text.length);
    return rect && rect.height > 0 ? rect : null;
  }

  /**
   * Position the reading mask over the sentence using its current layout rect.
   */
  _positionMask(sentence) {
    this._ensureMask();
    try {
      const container = sentence.container;
      if (!container) return;

      const cr = container.getBoundingClientRect();
      if (cr.width === 0 && cr.height === 0) return;

      const currentRect = this._measureSentenceRect(sentence);
      if (currentRect) {
        this._currentMaskRect = {
          top: Math.max(cr.top, Math.min(cr.bottom - 24, currentRect.top)),
          left: cr.left,
          width: cr.width,
          height: Math.max(Math.min(cr.bottom - Math.max(cr.top, currentRect.top), currentRect.height), 28)
        };
      } else if (sentence._rect) {
        // Use the captured rect only when the current text can no longer be ranged.
        const dY = window.scrollY - (sentence._capturedScrollY || 0);
        const r = sentence._rect;
        this._currentMaskRect = {
          top: Math.max(cr.top, Math.min(cr.bottom - 24, r.top - dY)),
          left: cr.left,
          width: cr.width,
          height: Math.max(Math.min(cr.bottom - Math.max(cr.top, r.top - dY), r.height), 28)
        };
      } else {
        // No captured rect — fall back to container-level highlight
        this._currentMaskRect = {
          top: cr.top,
          left: cr.left,
          width: cr.width,
          height: Math.max(cr.height, 28)
        };
      }
      this._updateMask();
    } catch (e) { /* ignore */ }
  }

  /**
   * Create a Range from a character offset within a list of text nodes.
   */
  _rangeFromOffset(textNodes, targetOffset, length) {
    let offset = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;

    for (const node of textNodes) {
      const nodeLen = node.textContent.length;
      const nodeStart = offset;
      const nodeEnd = offset + nodeLen;

      if (startNode === null && targetOffset < nodeEnd) {
        startNode = node;
        startOffset = targetOffset - nodeStart;
      }

      if (startNode !== null && targetOffset + length <= nodeEnd) {
        endNode = node;
        endOffset = targetOffset + length - nodeStart;
        break;
      }

      offset = nodeEnd;
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, Math.max(0, startOffset));
      range.setEnd(endNode, Math.min(endNode.textContent.length, endOffset));
      return range.getBoundingClientRect();
    }

    return null;
  }

  _updateMask() {
    if (!this.maskEnabled || this.state === 'idle' || this.state === 'stopped') {
      if (this._maskEl) this._maskEl.style.setProperty('display', 'none', 'important');
      return;
    }
    const r = this._currentMaskRect;
    if (!r) {
      if (this._maskEl) this._maskEl.style.setProperty('display', 'none', 'important');
      return;
    }

    const spread = Math.max(window.innerWidth, window.innerHeight,
      document.body.scrollWidth || 0, document.body.scrollHeight || 0) * 2;

    this._maskEl.style.setProperty('display', 'block', 'important');
    this._maskEl.style.setProperty('top', r.top + 'px', 'important');
    this._maskEl.style.setProperty('left', r.left + 'px', 'important');
    this._maskEl.style.setProperty('width', r.width + 'px', 'important');
    this._maskEl.style.setProperty('height', Math.max(r.height, 24) + 'px', 'important');
    this._maskEl.style.setProperty('box-shadow', '0 0 0 ' + spread + 'px rgba(0, 0, 0, 0.55)', 'important');
  }

  _ensureMask() {
    if (!this._maskEl) {
      this._maskEl = document.createElement('div');
      this._maskEl.id = 'ot-reading-mask';
      this._maskEl.className = 'ot-reading-mask';
      this._maskEl.addEventListener('click', this._onMaskClick);
      document.body.appendChild(this._maskEl);
    }
  }

  _removeOverlays() {
    if (this._maskEl && this._maskEl.parentNode) {
      this._maskEl.parentNode.removeChild(this._maskEl);
    }
    this._maskEl = null;
    this._currentMaskRect = null;
  }

  // ── Scroll ─────────────────────────────────────────────

  _scrollTo(sentence) {
    try {
      // Prefer the current range so page reflows do not leave scrolling and
      // highlighting at the old captured location.
      const currentRect = this._measureSentenceRect(sentence);
      const dY = window.scrollY - (sentence._capturedScrollY || 0);
      const sentenceTop = currentRect
        ? currentRect.top
        : sentence._rect
        ? sentence._rect.top - dY
        : sentence.container.getBoundingClientRect().top;
      const idealTop = window.innerHeight * 0.3;
      const delta = sentenceTop - idealTop;
      if (Math.abs(delta) > 30) {
        this._programmaticScroll = true;
        window.scrollBy({ top: delta, behavior: 'instant' });
        requestAnimationFrame(() => { this._programmaticScroll = false; });
      }
    } catch (e) { /* ignore */ }
  }

  // ── Helpers ────────────────────────────────────────────

  _detectLang(text) {
    if (/[一-鿿]/.test(text)) return 'zh-CN';
    if (/[぀-ゟ゠-ヿ]/.test(text)) return 'ja-JP';
    if (/[가-힯]/.test(text)) return 'ko-KR';
    return 'en-US';
  }

  // ── Event Listeners ────────────────────────────────────

  _addListeners() {
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('beforeunload', this._onBeforeUnload);
    window.addEventListener('scroll', this._onScroll, { passive: true });
    window.addEventListener('resize', this._onResize);
  }

  _removeListeners() {
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('beforeunload', this._onBeforeUnload);
    window.removeEventListener('scroll', this._onScroll);
    window.removeEventListener('resize', this._onResize);
  }

  _onVisibility() {
    if (document.hidden && this.state === 'reading') {
      this.pause();
    }
  }

  _onBeforeUnload() {
    this.cleanup();
  }

  _onScroll() {
    if (this._scrollPending) return;
    if (this._programmaticScroll) return;
    if (this.state !== 'reading' && this.state !== 'paused') return;
    if (this.currentSentenceIndex < 0 || this.currentSentenceIndex >= this.sentences.length) return;
    this._scrollPending = true;
    const sentence = this.sentences[this.currentSentenceIndex];
    requestAnimationFrame(() => {
      this._scrollPending = false;
      if (this.state === 'reading' || this.state === 'paused') {
        this._positionMask(sentence);
      }
    });
  }

  _onResize() {
    if (this.state !== 'reading' && this.state !== 'paused') return;
    if (this.currentSentenceIndex < 0 || this.currentSentenceIndex >= this.sentences.length) return;
    this._positionMask(this.sentences[this.currentSentenceIndex]);
  }

  _onMaskClick(e) {
    if (this.state === 'reading') {
      this.pause();
    } else if (this.state === 'paused') {
      this.resume();
    }
    e.stopPropagation();
  }

  _onComplete() {
    this._stopVoice();
    this._clearTimers();
    this._stopKeepAlive();
    this._removeOverlays();
    this._removeListeners();
    this.state = 'idle';
    this.currentSentenceIndex = -1;
    this.onStatusChange('readingGuideStopped');
  }

  // ── CSS Injection ──────────────────────────────────────

  _injectStyles() {
    if (this._styleInjected) return;
    this._styleInjected = true;

    const css = `
      .ot-reading-mask {
        position: fixed;
        z-index: 2147483642;
        background: transparent;
        pointer-events: auto;
        cursor: pointer;
        border-radius: 6px;
        transition: top 0.08s, left 0.08s;
      }
    `;

    const style = document.createElement('style');
    style.id = 'ot-reading-guide-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReadingGuide;
} else if (typeof window !== 'undefined') {
  window.ReadingGuide = ReadingGuide;
}
