/**
 * Runtime language switcher for ND Translate.
 * Allows users to override the browser locale setting.
 */
const I18n = {
  _lang: 'auto',
  _messages: {},
  _localeDirs: {
    en: 'en',
    'en-US': 'en',
    'en-GB': 'en',
    zh: 'zh_CN',
    'zh-CN': 'zh_CN',
    zh_CN: 'zh_CN'
  },

  /**
   * Initialize: load user preference and locale data.
   * Call once at page startup before any getMessage() calls.
   */
  async init() {
    try {
      const result = await chrome.storage.sync.get('uiLanguage');
      this._lang = result.uiLanguage || 'auto';
    } catch (e) {
      this._lang = 'auto';
    }

    if (this._lang !== 'auto') {
      await this._loadMessages(this._lang);
    }
  },

  /**
   * Load locale messages for a given language code ('en' or 'zh-CN').
   */
  async _loadMessages(lang) {
    try {
      const localeDir = this._getLocaleDir(lang);
      const url = chrome.runtime.getURL(`_locales/${localeDir}/messages.json`);
      const resp = await fetch(url);
      const json = await resp.json();
      this._messages = {};
      for (const [key, entry] of Object.entries(json)) {
        this._messages[key] = entry.message;
      }
    } catch (e) {
      this._messages = {};
    }
  },

  /**
   * Convert user-facing language codes to Chrome locale directory names.
   */
  _getLocaleDir(lang) {
    return this._localeDirs[lang] || this._localeDirs[String(lang).replace('_', '-')] || lang;
  },

  /**
   * Get a translated message by key.
   * Falls back to chrome.i18n.getMessage, then the provided fallback.
   */
  getMessage(key, fallback) {
    if (this._lang !== 'auto' && this._messages[key] !== undefined) {
      return this._messages[key];
    }
    return chrome.i18n.getMessage(key) || fallback || key;
  },

  /**
   * Change language at runtime and persist.
   * @param {'auto'|'en'|'zh-CN'} lang
   */
  async setLanguage(lang) {
    this._lang = lang;
    await chrome.storage.sync.set({ uiLanguage: lang });
    if (lang !== 'auto') {
      await this._loadMessages(lang);
    }
  },

  /**
   * Get current language setting.
   */
  getLanguage() {
    return this._lang;
  },

  /**
   * Walk the DOM and update all elements with data-i18n attributes.
   * Works regardless of language setting (auto uses chrome.i18n.getMessage).
   */
  localizePage() {
    // Update text content
    const textElements = document.querySelectorAll('[data-i18n]');
    for (const el of textElements) {
      const key = el.dataset.i18n;
      const msg = this.getMessage(key);
      if (!msg) continue;

      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        el.placeholder = msg;
      } else if (tag === 'OPTION') {
        el.textContent = msg;
      } else {
        el.textContent = msg;
      }
    }

    // Update title attributes separately (data-i18n-title)
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    for (const el of titleElements) {
      const key = el.dataset.i18nTitle;
      const msg = this.getMessage(key);
      if (msg) el.title = msg;
    }

    this._replaceMessagePlaceholders(document);
  },

  /**
   * Replace literal __MSG_key__ placeholders in extension HTML.
   * Chrome only expands these in the manifest, so popup/options pages need
   * this runtime pass for text nodes and common UI attributes.
   */
  _replaceMessagePlaceholders(root) {
    const placeholderPattern = /__MSG_([A-Za-z0-9_]+)__/g;
    const skipTags = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);

    const replaceValue = (value) => {
      if (!value || value.indexOf('__MSG_') === -1) return value;
      return value.replace(placeholderPattern, (match, key) => {
        const msg = this.getMessage(key);
        return msg && msg !== key ? msg : match;
      });
    };

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.includes('__MSG_')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP;
      }
    });

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    for (const node of textNodes) {
      node.nodeValue = replaceValue(node.nodeValue);
    }

    const localizedAttributes = ['placeholder', 'title', 'aria-label', 'alt', 'value'];
    for (const el of root.querySelectorAll('*')) {
      for (const attr of localizedAttributes) {
        if (el.hasAttribute(attr)) {
          el.setAttribute(attr, replaceValue(el.getAttribute(attr)));
        }
      }
    }

    document.title = replaceValue(document.title);
  }
};

// Shorthand for use in other modules
const _t = (key, fallback) => I18n.getMessage(key, fallback);
