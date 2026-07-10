/**
 * Bottom toolbar for in-page reading guide and accessibility controls.
 */
class Toolbar {
  constructor(options = {}) {
    this.readingGuide = options.readingGuide || null;
    this.accessibilityFeatures = options.accessibilityFeatures || null;
    this.onVisibilityChange = options.onVisibilityChange || (() => {});
    this.onRestoreAll = options.onRestoreAll || (() => {});
    this.onTranslate = options.onTranslate || (async () => {});
    this.onRestoreTranslation = options.onRestoreTranslation || (async () => {});
    this.getTranslationState = options.getTranslationState || (() => ({
      isTranslated: false,
      isTranslating: false,
      mode: 'replace'
    }));

    this.visible = false;
    this.expanded = false;

    // DOM
    this._minEl = null;       // collapsed minimap button (▼)
    this._barEl = null;       // expanded toolbar bar
    this._styleEl = null;
    this._styleInjected = false;

    // Slider refs
    this._speedSlider = null;
    this._speedLabel = null;
    this._fontSizeSlider = null;
    this._fontSizeLabel = null;
    this._lineSpacingSlider = null;
    this._lineSpacingLabel = null;
    this._wordSpacingSlider = null;
    this._wordSpacingLabel = null;
    this._letterSpacingSlider = null;
    this._letterSpacingLabel = null;
    this._bionicRatioSlider = null;
    this._bionicRatioLabel = null;

    // Toggle refs
    this._mutedBtn = null;
    this._maskBtn = null;
    this._dyslexicBtn = null;
    this._chineseFontBtn = null;
    this._bionicBtn = null;
    this._bionicDimBtn = null;
    this._sentenceBreakBtn = null;
    this._translateBtn = null;
    this._restoreTranslationBtn = null;
    this._displayBtn = null;
    this._displayPanel = null;
    this._onPanelResize = this._onPanelResize.bind(this);

    // Button refs
    this._playBtn = null;
    this._pauseBtn = null;
    this._stopBtn = null;
    this._seekBtn = null;

  }

  // ── Lifecycle ──────────────────────────────────────────

  init() {
    this._injectStyles();
    this._createDOM();
    this._bindEvents();
    this._loadStoredVisibility();
  }

  show() {
    if (this.visible && this.expanded) return;
    this.visible = true;
    this.expanded = true;
    if (this._minEl) this._minEl.style.setProperty('display', 'none', 'important');
    if (this._barEl) this._barEl.style.setProperty('display', 'flex', 'important');
    this._populateFromState();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.expanded = false;
    if (this._minEl) this._minEl.style.setProperty('display', 'none', 'important');
    if (this._barEl) this._barEl.style.setProperty('display', 'none', 'important');
    this.onVisibilityChange(false);
  }

  _expand() {
    if (this.expanded) return;
    this.expanded = true;
    if (this._minEl) this._minEl.style.setProperty('display', 'none', 'important');
    if (this._barEl) this._barEl.style.setProperty('display', 'flex', 'important');
    this._populateFromState();
  }

  _collapse() {
    if (!this.expanded) return;
    this.expanded = false;
    if (this._barEl) this._barEl.style.setProperty('display', 'none', 'important');
    if (this._minEl) this._minEl.style.setProperty('display', 'flex', 'important');
  }

  destroy() {
    window.removeEventListener('resize', this._onPanelResize);
    if (this._minEl && this._minEl.parentNode) this._minEl.parentNode.removeChild(this._minEl);
    if (this._barEl && this._barEl.parentNode) this._barEl.parentNode.removeChild(this._barEl);
    if (this._styleEl && this._styleEl.parentNode) this._styleEl.parentNode.removeChild(this._styleEl);
    this._minEl = null;
    this._barEl = null;
    this._styleEl = null;
  }

  // ── State sync ─────────────────────────────────────────

  _populateFromState() {
    // Reading guide state
    if (this.readingGuide) {
      const state = this.readingGuide.getState();
      this._updateRGButtons(state);
      const speed = this.readingGuide.speed || 3.0;
      if (this._speedSlider) this._speedSlider.value = speed;
      this._updateSpeedLabel(speed);
      this._updateToggle(this._mutedBtn, this.readingGuide.muted);
      this._updateToggle(this._maskBtn, this.readingGuide.maskEnabled);
    }

    // Accessibility state
    if (this.accessibilityFeatures && this.accessibilityFeatures.state) {
      const s = this.accessibilityFeatures.state;
      this._updateToggle(this._dyslexicBtn, s.dyslexicFont);
      this._updateToggle(this._chineseFontBtn, s.chineseFont);
      this._updateToggle(this._bionicBtn, s.bionicReading);
      this._updateToggle(this._bionicDimBtn, s.bionicDimNonBold);
      this._updateToggle(this._sentenceBreakBtn, s.sentenceBreak);
      if (this._bionicRatioSlider) this._bionicRatioSlider.value = s.bionicBoldRatio || 0.5;
      this._updateBionicRatioLabel(s.bionicBoldRatio || 0.5);
      if (this._fontSizeSlider) this._fontSizeSlider.value = s.fontSize || 1.0;
      this._updateSliderLabel(this._fontSizeLabel, s.fontSize || 1.0, 'x');
      if (this._lineSpacingSlider) this._lineSpacingSlider.value = s.lineSpacing || 1.5;
      this._updateSliderLabel(this._lineSpacingLabel, s.lineSpacing || 1.5, '');
      if (this._wordSpacingSlider) this._wordSpacingSlider.value = s.wordSpacing || 0.08;
      this._updateSliderLabel(this._wordSpacingLabel, s.wordSpacing || 0.08, '');
      if (this._letterSpacingSlider) this._letterSpacingSlider.value = s.letterSpacing || 0.02;
      this._updateSliderLabel(this._letterSpacingLabel, s.letterSpacing || 0.02, '');
      this._syncBionicControls(s.bionicReading);
    }
    this._updateTranslationControls();
  }

  _onRGStatusChange(status, data) {
    if (!this.visible) return;
    switch (status) {
      case 'readingGuideStarted':
      case 'readingGuideResumed':
        this._updateRGButtons('reading');
        break;
      case 'readingGuidePaused':
        this._updateRGButtons('paused');
        break;
      case 'readingGuideStopped':
      case 'readingGuideError':
        this._updateRGButtons('idle');
        break;
      case 'readingGuideSeekMode':
        if (this._seekBtn) {
          this._seekBtn.classList.toggle('active', !!(data && data.continuous));
        }
        break;
    }
  }

  _updateRGButtons(state) {
    const reading = state === 'reading';
    const paused = state === 'paused';
    const active = reading || paused;
    if (this._playBtn) { this._playBtn.disabled = reading; this._playBtn.classList.toggle('active', reading); }
    if (this._pauseBtn) this._pauseBtn.disabled = !reading;
    if (this._stopBtn) this._stopBtn.disabled = !active;
    if (this._seekBtn) this._seekBtn.disabled = !paused;
  }

  _updateFromStorage(changes) {
    if (!this.visible) return;
    const a11y = this.accessibilityFeatures;
    if (!a11y) return;

    if (changes.accessibilityEnabled) {
      if (changes.accessibilityEnabled.newValue === false) {
        a11y.cleanup();
        Object.assign(a11y.state, {
          enabled: false,
          dyslexicFont: false,
          chineseFont: false,
          bionicReading: false,
          bionicDimNonBold: false,
          sentenceBreak: false,
          bionicBoldRatio: 0.5,
          lineSpacing: 1.5,
          wordSpacing: 0.08,
          letterSpacing: 0.02,
          fontSize: 1.0
        });
        this._populateFromState();
        return;
      }
      if (changes.accessibilityEnabled.newValue === true) a11y.state.enabled = true;
    }

    const keyMap = {
      dyslexicFont: [this._dyslexicBtn, null],
      chineseFont: [this._chineseFontBtn, null],
      bionicReading: [this._bionicBtn, null],
      bionicDimNonBold: [this._bionicDimBtn, null],
      sentenceBreak: [this._sentenceBreakBtn, null],
      bionicBoldRatio: [null, this._bionicRatioSlider],
      fontSize: [null, this._fontSizeSlider],
      lineSpacing: [null, this._lineSpacingSlider],
      wordSpacing: [null, this._wordSpacingSlider],
      letterSpacing: [null, this._letterSpacingSlider]
    };

    for (const [key, [btn, slider]] of Object.entries(keyMap)) {
      if (changes[key] && changes[key].newValue !== undefined) {
        const val = changes[key].newValue;
        if (btn) this._updateToggle(btn, val);
        if (slider) slider.value = val;
        if (key === 'fontSize') this._updateSliderLabel(this._fontSizeLabel, val, 'x');
        if (key === 'lineSpacing') this._updateSliderLabel(this._lineSpacingLabel, val, '');
        if (key === 'wordSpacing') this._updateSliderLabel(this._wordSpacingLabel, val, '');
        if (key === 'letterSpacing') this._updateSliderLabel(this._letterSpacingLabel, val, '');
        if (key === 'bionicBoldRatio') this._updateBionicRatioLabel(val);
        a11y.update(key, val);
      }
    }
    if (changes.bionicReading) this._syncBionicControls(changes.bionicReading.newValue);
  }

  // ── Helpers ────────────────────────────────────────────

  _updateToggle(btn, active) {
    if (!btn) return;
    btn.classList.toggle('active', !!active);
    btn.textContent = active ? (btn.dataset.on || 'ON') : (btn.dataset.off || 'OFF');
    btn.setAttribute('aria-pressed', String(!!active));
  }

  _syncBionicControls(enabled) {
    const disabled = !enabled;
    for (const control of [this._bionicDimBtn, this._bionicRatioSlider]) {
      if (!control) continue;
      control.disabled = disabled;
      control.setAttribute('aria-disabled', String(disabled));
    }
  }

  _updateTranslationControls() {
    const state = this.getTranslationState();
    const translating = state.isTranslating === true;
    const translated = state.isTranslated === true;
    const hasCachedTranslations = state.hasCachedTranslations === true;
    const translationVisible = state.translationVisible === true;
    if (this._translateBtn) {
      this._translateBtn.disabled = translating;
      this._translateBtn.textContent = translating ? '翻译中' : ((translated || hasCachedTranslations) ? '重译' : '翻译');
      this._translateBtn.setAttribute('aria-busy', String(translating));
    }
    if (this._restoreTranslationBtn) {
      this._restoreTranslationBtn.disabled = translating || (!translated && !hasCachedTranslations);
      this._restoreTranslationBtn.textContent = translationVisible ? '隐藏译文' : '显示译文';
      this._restoreTranslationBtn.title = translationVisible ? '隐藏译文并显示原文' : '显示译文';
    }
  }

  _updateSpeedLabel(speed) {
    if (!this._speedLabel) return;
    this._speedLabel.textContent = speed.toFixed(1) + 'x' + (speed > 3.0 ? ' (静音)' : '');
  }

  _updateBionicRatioLabel(val) {
    if (this._bionicRatioLabel) this._bionicRatioLabel.textContent = Math.round(val * 100) + '%';
  }

  _updateSliderLabel(el, val, suffix) {
    if (el) el.textContent = val.toFixed(2) + suffix;
  }

  _persistSetting(key, value) {
    chrome.storage.sync.set({ [key]: value });
  }

  // ── Event Binding ──────────────────────────────────────

  _bindEvents() {
    try {
      // Minimap button: click to expand
      if (this._minEl) {
        this._minEl.addEventListener('click', () => this._expand());
      }

      // Event delegation on toolbar bar for ALL button clicks
      if (this._barEl) {
        this._barEl.addEventListener('click', (e) => this._onBarClick(e));
      }
      window.addEventListener('resize', this._onPanelResize);

      // Sliders need direct listeners (input/change events)
      this._bindSliderInput(this._speedSlider, this._speedLabel, 'readingGuideSpeed', null,
        (v) => {
          this._updateSpeedLabel(v);
          if (this.readingGuide) {
            this.readingGuide.setSpeed(v);
            this._updateToggle(this._mutedBtn, this.readingGuide.muted);
            if (v > 3.0 && this.readingGuide.muted) this._persistSetting('readingGuideMuted', true);
          }
        });
      this._bindSliderInput(this._fontSizeSlider, this._fontSizeLabel, 'fontSize', 'fontSize',
        (v) => this._updateSliderLabel(this._fontSizeLabel, v, 'x'));
      this._bindSliderInput(this._lineSpacingSlider, this._lineSpacingLabel, 'lineSpacing', 'lineSpacing',
        (v) => this._updateSliderLabel(this._lineSpacingLabel, v, ''));
      this._bindSliderInput(this._wordSpacingSlider, this._wordSpacingLabel, 'wordSpacing', 'wordSpacing',
        (v) => this._updateSliderLabel(this._wordSpacingLabel, v, ''));
      this._bindSliderInput(this._letterSpacingSlider, this._letterSpacingLabel, 'letterSpacing', 'letterSpacing',
        (v) => this._updateSliderLabel(this._letterSpacingLabel, v, ''));
      this._bindSliderInput(this._bionicRatioSlider, this._bionicRatioLabel, 'bionicBoldRatio', 'bionicBoldRatio',
        (v) => this._updateBionicRatioLabel(v));

      console.log('[ND Translate] Toolbar events bound successfully');
    } catch (e) {
      console.error('[ND Translate] Toolbar _bindEvents error:', e);
    }
  }

  _onBarClick(e) {
    try {
      const btn = e.target.closest('button[id]');
      if (!btn) return;
      const id = btn.id;

      switch (id) {
        case 'ot-tb-play': this._handlePlay(); break;
        case 'ot-tb-pause': this._handlePause(); break;
        case 'ot-tb-stop': this._handleStop(); break;
        case 'ot-tb-seek': this._handleSeek(); break;
        case 'ot-tb-muted': this._handleMuted(); break;
        case 'ot-tb-mask': this._handleMask(); break;
        case 'ot-tb-translate': this._handleTranslate(); break;
        case 'ot-tb-restore-translation': this._handleRestoreTranslation(); break;
        case 'ot-tb-display': this._toggleDisplayPanel(); break;
        case 'ot-tb-dyslexic': this._handleToggle(btn, 'dyslexicFont'); break;
        case 'ot-tb-chinese': this._handleToggle(btn, 'chineseFont'); break;
        case 'ot-tb-bionic':
          this._handleToggle(btn, 'bionicReading');
          this._syncBionicControls(btn.classList.contains('active'));
          break;
        case 'ot-tb-bionic-dim': this._handleToggle(btn, 'bionicDimNonBold'); break;
        case 'ot-tb-sbreak': this._handleToggle(btn, 'sentenceBreak'); break;
        case 'ot-tb-collapse': this._collapse(); break;
        case 'ot-tb-restore-all': this._handleRestoreAll(); break;
        case 'ot-tb-close': this.hide(); break;
      }
    } catch (err) {
      console.error('[ND Translate] Toolbar click handler error:', err);
    }
  }

  _handlePlay() {
    if (!this.readingGuide) return;
    if (this.readingGuide.isPaused()) {
      this.readingGuide.resume();
    } else {
      this.readingGuide.start({
        speed: parseFloat(this._speedSlider ? this._speedSlider.value : 3.0),
        muted: this._mutedBtn ? this._mutedBtn.classList.contains('active') : false,
        maskEnabled: this._maskBtn ? this._maskBtn.classList.contains('active') : true
      });
    }
  }

  _handlePause() {
    if (this.readingGuide) this.readingGuide.pause();
  }

  _handleStop() {
    if (this.readingGuide) this.readingGuide.stop();
  }

  _handleSeek() {
    if (!this.readingGuide) return;
    // Toggle: if continuous seek is active, exit; otherwise enter continuous
    if (this.readingGuide._seekActive && this.readingGuide._continuousSeek) {
      this.readingGuide.exitSeekMode();
    } else {
      this.readingGuide.enterSeekMode(true);
    }
  }

  _handleMuted() {
    if (!this._mutedBtn) return;
    const active = !this._mutedBtn.classList.contains('active');
    if (active && this._speedSlider && parseFloat(this._speedSlider.value) > 3.0) return;
    this._updateToggle(this._mutedBtn, active);
    if (this.readingGuide) this.readingGuide.setMuted(active);
    this._persistSetting('readingGuideMuted', active);
  }

  _handleMask() {
    if (!this._maskBtn) return;
    const active = !this._maskBtn.classList.contains('active');
    this._updateToggle(this._maskBtn, active);
    if (this.readingGuide) this.readingGuide.setMaskEnabled(active);
    this._persistSetting('readingGuideMaskEnabled', active);
  }

  async _handleTranslate() {
    this._updateTranslationControls();
    try {
      await this.onTranslate();
    } catch (e) {
      console.warn('[ND Translate] Toolbar translation failed:', e);
    } finally {
      this._updateTranslationControls();
    }
  }

  async _handleRestoreTranslation() {
    this._updateTranslationControls();
    try {
      await this.onRestoreTranslation();
    } catch (e) {
      console.warn('[ND Translate] Toolbar restore failed:', e);
    } finally {
      this._updateTranslationControls();
    }
  }

  async _handleRestoreAll() {
    try {
      await this.onRestoreAll();
    } catch (e) {
      console.warn('[ND Translate] Toolbar full restore failed:', e);
    } finally {
      this._populateFromState();
    }
  }

  _toggleDisplayPanel() {
    if (!this._displayPanel || !this._displayBtn) return;
    const open = !this._displayPanel.classList.contains('open');
    if (open) this._positionDisplayPanel();
    this._displayPanel.classList.toggle('open', open);
    this._displayBtn.classList.toggle('active', open);
    this._displayBtn.setAttribute('aria-expanded', String(open));
  }

  _positionDisplayPanel() {
    if (!this._displayPanel || !this._displayBtn) return;
    const rect = this._displayBtn.getBoundingClientRect();
    const panelWidth = Math.min(420, Math.max(260, window.innerWidth - 16));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
    // Place the menu immediately above its trigger, with a small visual gap.
    const bottom = Math.max(8, window.innerHeight - rect.top + 6);
    this._displayPanel.style.setProperty('left', left + 'px', 'important');
    this._displayPanel.style.setProperty('right', 'auto', 'important');
    this._displayPanel.style.setProperty('bottom', bottom + 'px', 'important');
  }

  _onPanelResize() {
    if (this._displayPanel && this._displayPanel.classList.contains('open')) {
      this._positionDisplayPanel();
    }
  }

  _handleToggle(btn, key) {
    const active = !btn.classList.contains('active');
    this._updateToggle(btn, active);
    if (this.accessibilityFeatures) this.accessibilityFeatures.update(key, active);
    chrome.storage.sync.set({ [key]: active, accessibilityEnabled: true });
  }

  _bindSliderInput(slider, label, storageKey, a11yKey, onInput) {
    if (!slider) return;
    if (onInput) {
      slider.addEventListener('input', () => { try { onInput(parseFloat(slider.value)); } catch (e) {} });
    }
    slider.addEventListener('change', () => {
      try {
        const val = parseFloat(slider.value);
        if (a11yKey && this.accessibilityFeatures) {
          this.accessibilityFeatures.update(a11yKey, val);
        }
        if (storageKey) {
          if (a11yKey) {
            chrome.storage.sync.set({ [storageKey]: val, accessibilityEnabled: true });
          } else {
            this._persistSetting(storageKey, val);
          }
        }
      } catch (e) { console.error('[ND Translate] Slider change error:', e); }
    });
  }

  // ── Storage ────────────────────────────────────────────

  _loadStoredVisibility() {
    chrome.storage.sync.get(['toolbarVisible'], (result) => {
      if (result.toolbarVisible) {
        this.show();
      }
    });
  }

  // ── DOM Creation ───────────────────────────────────────

  _createDOM() {
    // Minimap button (collapsed state)
    this._minEl = document.createElement('div');
    this._minEl.id = 'ot-toolbar-min';
    this._minEl.innerHTML = '&#9660;';
    this._minEl.title = '展开工具栏';
    this._minEl.style.setProperty('display', 'none', 'important');
    document.body.appendChild(this._minEl);

    // Expanded toolbar bar
    this._barEl = document.createElement('div');
    this._barEl.id = 'ot-toolbar';
    this._barEl.style.setProperty('display', 'none', 'important');
    this._barEl.innerHTML = this._buildBarHTML();
    document.body.appendChild(this._barEl);

    // Cache refs
    this._playBtn = document.getElementById('ot-tb-play');
    this._pauseBtn = document.getElementById('ot-tb-pause');
    this._stopBtn = document.getElementById('ot-tb-stop');
    this._seekBtn = document.getElementById('ot-tb-seek');
    this._speedSlider = document.getElementById('ot-tb-speed');
    this._speedLabel = document.getElementById('ot-tb-speed-val');
    this._mutedBtn = document.getElementById('ot-tb-muted');
    this._maskBtn = document.getElementById('ot-tb-mask');
    this._dyslexicBtn = document.getElementById('ot-tb-dyslexic');
    this._chineseFontBtn = document.getElementById('ot-tb-chinese');
    this._bionicBtn = document.getElementById('ot-tb-bionic');
    this._bionicDimBtn = document.getElementById('ot-tb-bionic-dim');
    this._sentenceBreakBtn = document.getElementById('ot-tb-sbreak');
    this._bionicRatioSlider = document.getElementById('ot-tb-bionic-ratio');
    this._bionicRatioLabel = document.getElementById('ot-tb-bionic-ratio-val');
    this._fontSizeSlider = document.getElementById('ot-tb-fontsize');
    this._fontSizeLabel = document.getElementById('ot-tb-fontsize-val');
    this._lineSpacingSlider = document.getElementById('ot-tb-linespacing');
    this._lineSpacingLabel = document.getElementById('ot-tb-linespacing-val');
    this._wordSpacingSlider = document.getElementById('ot-tb-wordspacing');
    this._wordSpacingLabel = document.getElementById('ot-tb-wordspacing-val');
    this._letterSpacingSlider = document.getElementById('ot-tb-letterspacing');
    this._letterSpacingLabel = document.getElementById('ot-tb-letterspacing-val');
    this._translateBtn = document.getElementById('ot-tb-translate');
    this._restoreTranslationBtn = document.getElementById('ot-tb-restore-translation');
    this._displayBtn = document.getElementById('ot-tb-display');
    this._createDisplayPanel();
  }

  _createDisplayPanel() {
    if (!this._barEl) return;
    const inner = this._barEl.querySelector('.ot-tb-inner');
    if (!inner) return;

    this._displayPanel = document.createElement('div');
    this._displayPanel.id = 'ot-tb-display-panel';
    this._displayPanel.className = 'ot-tb-display-panel';
    this._displayPanel.innerHTML = `
      <div class="ot-tb-panel-title">显示与阅读设置</div>
      <div class="ot-tb-panel-section" data-section="fonts"><span>字体</span></div>
      <div class="ot-tb-panel-section" data-section="bionic"><span>Bionic 阅读</span></div>
      <div class="ot-tb-panel-section" data-section="layout"><span>排版</span></div>
    `;
    this._barEl.appendChild(this._displayPanel);

    const moveGroups = (section, ids) => {
      const target = this._displayPanel.querySelector(`[data-section="${section}"]`);
      for (const id of ids) {
        const control = document.getElementById(id);
        const group = control && control.closest('.ot-tb-group');
        if (target && group) target.appendChild(group);
      }
    };

    moveGroups('fonts', ['ot-tb-dyslexic', 'ot-tb-chinese']);
    moveGroups('bionic', ['ot-tb-bionic', 'ot-tb-bionic-dim', 'ot-tb-bionic-ratio']);
    moveGroups('layout', [
      'ot-tb-sbreak', 'ot-tb-fontsize', 'ot-tb-linespacing',
      'ot-tb-wordspacing', 'ot-tb-letterspacing'
    ]);

    // The bottom bar keeps only high-frequency actions. Separators belonging
    // to controls moved into the panel would otherwise leave visual gaps.
    inner.querySelectorAll('.ot-tb-sep').forEach((separator) => separator.remove());
  }

  _buildBarHTML() {
    return `
      <div class="ot-tb-inner">
        <!-- Collapse -->
        <button id="ot-tb-collapse" class="ot-tb-btn ot-tb-icon" title="收起">&#9660;</button>

        <!-- Translation actions -->
        <div class="ot-tb-group">
          <button id="ot-tb-translate" class="ot-tb-btn ot-tb-action" title="翻译当前页面">翻译</button>
          <button id="ot-tb-restore-translation" class="ot-tb-btn ot-tb-action" title="隐藏译文并显示原文" disabled>隐藏译文</button>
        </div>

        <div class="ot-tb-sep"></div>

        <!-- Reading Guide controls -->
        <div class="ot-tb-group">
          <button id="ot-tb-play" class="ot-tb-btn ot-tb-icon" title="播放">&#9654;</button>
          <button id="ot-tb-pause" class="ot-tb-btn ot-tb-icon" title="暂停" disabled>&#9646;&#9646;</button>
          <button id="ot-tb-stop" class="ot-tb-btn ot-tb-icon" title="停止" disabled>&#9632;</button>
          <button id="ot-tb-seek" class="ot-tb-btn ot-tb-icon" title="点击页面定位（再次点击退出连续定位）" disabled>&#9906;</button>
        </div>

        <div class="ot-tb-sep"></div>

        <!-- Speed -->
        <div class="ot-tb-group">
          <span class="ot-tb-label">速度</span>
          <input type="range" id="ot-tb-speed" class="ot-tb-range ot-tb-range-sm"
                 min="0.5" max="6.0" step="0.1" value="3.0">
          <span id="ot-tb-speed-val" class="ot-tb-val">3.0x</span>
        </div>

        <div class="ot-tb-sep"></div>

        <!-- Mute / Mask toggles -->
        <div class="ot-tb-group">
          <button id="ot-tb-muted" class="ot-tb-toggle" data-on="有声" data-off="静音" title="点击静音/取消静音">静音</button>
          <button id="ot-tb-mask" class="ot-tb-toggle active" data-on="遮罩" data-off="遮罩关" title="阅读遮罩">遮罩</button>
        </div>

        <div class="ot-tb-sep"></div>

        <button id="ot-tb-display" class="ot-tb-btn ot-tb-action" title="显示与阅读设置" aria-expanded="false">显示</button>

        <div class="ot-tb-sep"></div>

        <!-- Accessibility: Font toggles -->
        <div class="ot-tb-group">
          <button id="ot-tb-dyslexic" class="ot-tb-toggle" data-on="Dys" data-off="Dys" title="OpenDyslexic 字体">Dys</button>
          <button id="ot-tb-chinese" class="ot-tb-toggle" data-on="楷" data-off="楷" title="霞鹜文楷中文字体">楷</button>
        </div>

        <div class="ot-tb-sep"></div>

        <!-- Accessibility: Reading mode toggles -->
        <div class="ot-tb-group">
          <button id="ot-tb-bionic" class="ot-tb-toggle" data-on="Bionic" data-off="Bionic" title="Bionic Reading">Bionic</button>
        </div>

        <!-- Bionic ratio slider (inline) -->
        <div class="ot-tb-group">
          <span class="ot-tb-label">加粗</span>
          <input type="range" id="ot-tb-bionic-ratio" class="ot-tb-range ot-tb-range-xs"
                 min="0.3" max="0.6" step="0.05" value="0.5">
          <span id="ot-tb-bionic-ratio-val" class="ot-tb-val">50%</span>
        </div>

        <div class="ot-tb-sep"></div>

        <div class="ot-tb-group">
          <button id="ot-tb-bionic-dim" class="ot-tb-toggle" data-on="淡字" data-off="淡字" title="降低非加粗部分不透明度">淡字</button>
        </div>

        <div class="ot-tb-sep"></div>

        <div class="ot-tb-group">
          <button id="ot-tb-sbreak" class="ot-tb-toggle" data-on="换行" data-off="换行" title="每句换行">换行</button>
        </div>

        <div class="ot-tb-sep"></div>

        <!-- Accessibility: Spacing sliders -->
        <div class="ot-tb-group">
          <span class="ot-tb-label">字号</span>
          <input type="range" id="ot-tb-fontsize" class="ot-tb-range ot-tb-range-xs"
                 min="0.8" max="2.0" step="0.05" value="1.0">
          <span id="ot-tb-fontsize-val" class="ot-tb-val">1.00x</span>
        </div>
        <div class="ot-tb-group">
          <span class="ot-tb-label">行距</span>
          <input type="range" id="ot-tb-linespacing" class="ot-tb-range ot-tb-range-xs"
                 min="1.0" max="5.0" step="0.1" value="1.5">
          <span id="ot-tb-linespacing-val" class="ot-tb-val">1.50</span>
        </div>
        <div class="ot-tb-group">
          <span class="ot-tb-label">词距</span>
          <input type="range" id="ot-tb-wordspacing" class="ot-tb-range ot-tb-range-xs"
                 min="0" max="2.0" step="0.05" value="0.08">
          <span id="ot-tb-wordspacing-val" class="ot-tb-val">0.08</span>
        </div>
        <div class="ot-tb-group">
          <span class="ot-tb-label">字距</span>
          <input type="range" id="ot-tb-letterspacing" class="ot-tb-range ot-tb-range-xs"
                 min="-0.05" max="0.5" step="0.01" value="0.02">
          <span id="ot-tb-letterspacing-val" class="ot-tb-val">0.02</span>
        </div>

        <div class="ot-tb-sep"></div>

        <!-- Clear all page modifications -->
        <button id="ot-tb-restore-all" class="ot-tb-btn" title="清除翻译与阅读格式" style="color:#d32f2f; font-size:11px; width:auto; padding:0 6px;">清除</button>

        <!-- Close -->
        <button id="ot-tb-close" class="ot-tb-btn ot-tb-icon" title="关闭工具栏">&#10005;</button>
      </div>
    `;
  }

  // ── CSS Injection ──────────────────────────────────────

  _injectStyles() {
    if (this._styleInjected) return;
    this._styleInjected = true;

    const css = `
      /* ── Toolbar Bar ──────────────────────── */
      #ot-toolbar {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 44px !important;
        background: #fff !important;
        border-top: 1px solid #e0e0e0 !important;
        box-shadow: 0 -2px 8px rgba(0,0,0,0.1) !important;
        z-index: 2147483640 !important;
        display: flex !important;
        align-items: center !important;
        pointer-events: auto !important;
        user-select: none !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 12px !important;
        color: #333 !important;
        padding: 0 !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        line-height: 1.3 !important;
        overflow: visible !important;
      }
      #ot-toolbar * {
        box-sizing: border-box !important;
      }

      .ot-tb-inner {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        padding: 0 8px !important;
        width: 100% !important;
        height: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        white-space: nowrap !important;
        flex-wrap: nowrap !important;
      }
      .ot-tb-inner::-webkit-scrollbar {
        height: 3px !important;
      }
      .ot-tb-inner::-webkit-scrollbar-thumb {
        background: #ccc !important;
        border-radius: 3px !important;
      }

      /* ── Groups & Separators ─────────────── */
      .ot-tb-group {
        display: flex !important;
        align-items: center !important;
        gap: 3px !important;
        flex-shrink: 0 !important;
      }
      .ot-tb-sep {
        width: 1px !important;
        height: 24px !important;
        background: #ddd !important;
        flex-shrink: 0 !important;
        margin: 0 2px !important;
      }

      /* ── Buttons ──────────────────────────── */
      .ot-tb-btn {
        width: 30px !important;
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: none !important;
        height: 30px !important;
        border: 1px solid #d1d5db !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 13px !important;
        color: #374151 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        margin: 0 !important;
        flex-shrink: 0 !important;
        transition: all 0.1s ease !important;
        line-height: 1 !important;
        font-family: inherit !important;
      }
      .ot-tb-btn:hover:not(:disabled) {
        background: #f5f5f5 !important;
        border-color: #f09b9c !important;
      }
      .ot-tb-btn:disabled {
        opacity: 0.35 !important;
        cursor: not-allowed !important;
      }
      .ot-tb-btn.active {
        background: #2a588f !important;
        color: #fff !important;
        border-color: #2a588f !important;
      }
      .ot-tb-action {
        width: auto !important;
        padding: 0 8px !important;
        font-size: 11px !important;
      }

      /* Close button — smaller than regular buttons */
      #ot-tb-close {
        width: 22px !important;
        height: 22px !important;
        font-size: 11px !important;
      }

      /* ── Minimap (collapsed) button ────────── */
      #ot-toolbar-min {
        position: fixed !important;
        bottom: 8px !important;
        left: 8px !important;
        width: 24px !important;
        height: 24px !important;
        border-radius: 4px !important;
        background: #2a588f !important;
        color: #fff !important;
        font-size: 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        z-index: 2147483640 !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.25) !important;
        border: none !important;
        pointer-events: auto !important;
        user-select: none !important;
        line-height: 1 !important;
        padding: 0 !important;
        margin: 0 !important;
        opacity: 0.7 !important;
        transition: opacity 0.15s ease !important;
      }
      #ot-toolbar-min:hover {
        opacity: 1 !important;
      }

      /* ── Toggle chips ──────────────────────── */
      .ot-tb-toggle {
        height: 26px !important;
        min-width: 36px !important;
        min-height: 0 !important;
        max-width: none !important;
        border: 1px solid #d1d5db !important;
        border-radius: 4px !important;
        background: #fff !important;
        cursor: pointer !important;
        font-size: 11px !important;
        color: #888 !important;
        padding: 0 6px !important;
        margin: 0 !important;
        flex-shrink: 0 !important;
        transition: all 0.1s ease !important;
        font-family: inherit !important;
        white-space: nowrap !important;
      }
      .ot-tb-toggle:hover {
        border-color: #f09b9c !important;
      }
      .ot-tb-toggle.active {
        background: #2a588f !important;
        color: #fff !important;
        border-color: #2a588f !important;
      }
      .ot-tb-toggle:disabled,
      .ot-tb-range:disabled {
        opacity: 0.4 !important;
        cursor: not-allowed !important;
      }

      /* ── Display settings panel ───────────── */
      .ot-tb-display-panel {
        position: fixed !important;
        left: 8px !important;
        bottom: 52px !important;
        width: min(420px, calc(100vw - 16px)) !important;
        max-height: min(60vh, 360px) !important;
        overflow-y: auto !important;
        display: none !important;
        padding: 12px !important;
        border: 1px solid #d1d5db !important;
        border-radius: 8px !important;
        background: #fff !important;
        box-shadow: 0 6px 24px rgba(0,0,0,0.18) !important;
        color: #333 !important;
      }
      .ot-tb-display-panel.open { display: block !important; }
      .ot-tb-panel-title {
        margin-bottom: 10px !important;
        font-size: 13px !important;
        font-weight: 600 !important;
      }
      .ot-tb-panel-section {
        display: flex !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 6px !important;
        padding: 8px 0 !important;
        border-top: 1px solid #eee !important;
      }
      .ot-tb-panel-section > span {
        width: 100% !important;
        color: #666 !important;
        font-size: 11px !important;
      }
      .ot-tb-display-panel .ot-tb-group { gap: 4px !important; }

      /* ── Labels & Values ──────────────────── */
      .ot-tb-label {
        font-size: 11px !important;
        color: #666 !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
      }
      .ot-tb-val {
        font-size: 10px !important;
        color: #888 !important;
        min-width: 32px !important;
        text-align: left !important;
        flex-shrink: 0 !important;
        white-space: nowrap !important;
      }

      /* ── Range sliders ────────────────────── */
      .ot-tb-range {
        margin: 0 2px !important;
        min-width: 0 !important;
        padding: 0 !important;
        cursor: pointer !important;
        accent-color: #2a588f !important;
        flex-shrink: 0 !important;
        background: transparent !important;
        border: none !important;
        outline: none !important;
      }
      .ot-tb-range-sm { width: 70px !important; }
      .ot-tb-range-xs { width: 50px !important; }

      /* Google pages set global minimum button widths. Keep the extension UI
         self-contained so those site rules cannot stretch toolbar controls. */
      #ot-toolbar button,
      #ot-toolbar input {
        min-width: 0 !important;
        min-height: 0 !important;
        max-width: none !important;
        text-transform: none !important;
      }
      #ot-toolbar .ot-tb-toggle { min-width: 36px !important; }

      /* ── Dark mode ────────────────────────── */
      @media (prefers-color-scheme: dark) {
        #ot-toolbar-min {
          background: #4a90d9 !important;
        }
        #ot-toolbar {
          background: #1e1e1e !important;
          border-top-color: #333 !important;
          color: #e0e0e0 !important;
        }
        .ot-tb-sep { background: #333 !important; }
        .ot-tb-btn {
          background: #2d2d2d !important;
          border-color: #444 !important;
          color: #e0e0e0 !important;
        }
        .ot-tb-btn:hover:not(:disabled) { background: #3d3d3d !important; }
        .ot-tb-btn.active { background: #4a90d9 !important; border-color: #4a90d9 !important; }
        .ot-tb-toggle {
          background: #2d2d2d !important;
          border-color: #444 !important;
          color: #888 !important;
        }
        .ot-tb-toggle.active { background: #4a90d9 !important; color: #fff !important; border-color: #4a90d9 !important; }
        .ot-tb-label { color: #999 !important; }
        .ot-tb-val { color: #777 !important; }
        .ot-tb-range { accent-color: #4a90d9 !important; }
        .ot-tb-display-panel {
          background: #1e1e1e !important;
          border-color: #444 !important;
          color: #e0e0e0 !important;
        }
        .ot-tb-panel-section { border-top-color: #333 !important; }
        .ot-tb-panel-section > span { color: #999 !important; }
      }
    `;

    this._styleEl = document.createElement('style');
    this._styleEl.id = 'ot-toolbar-styles';
    this._styleEl.textContent = css;
    document.head.appendChild(this._styleEl);
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Toolbar;
} else if (typeof window !== 'undefined') {
  window.Toolbar = Toolbar;
}
