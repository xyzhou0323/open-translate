/**
 * Free translator using Google Translate unofficial API.
 * No API key required. Falls back gracefully.
 */
class FreeTranslator {
  constructor() {
    this.baseUrl = 'https://translate.googleapis.com/translate_a/single';
    this.fallbackUrl = 'https://api.mymemory.translated.net/get';
    this.maxTextLength = 1500; // Google Translate URL length limit safety margin
    this.maxRetryAttempts = 3;
    this.retryBaseDelay = 400;
    this.requestInterval = 150;
    this.requestTimeout = 8000;
    this.fallbackTimeout = 12000;
    this.primaryUnavailableUntil = 0;
  }

  /**
   * Translate a single text string.
   * @param {string} text - source text
   * @param {string} targetLang - target language code (e.g. 'zh-CN')
   * @param {string} sourceLang - source language code (e.g. 'auto')
   * @returns {Promise<string>} translated text
   */
  async translate(text, targetLang = 'zh-CN', sourceLang = 'auto') {
    if (!text || text.trim().length === 0) return text;

    // Split long text into chunks to avoid URL length limits
    if (text.length > this.maxTextLength) {
      const chunks = this._splitText(text, this.maxTextLength);
      const results = await Promise.all(
        chunks.map(chunk => this._translateChunk(chunk, targetLang, sourceLang))
      );
      return results.join('');
    }

    return await this._translateChunk(text, targetLang, sourceLang);
  }

  /**
   * Translate a single chunk via Google Translate API.
   */
  async _translateChunk(text, targetLang, sourceLang) {
    if (Date.now() < this.primaryUnavailableUntil) {
      return await this._requestFallbackChunk(text, targetLang, sourceLang);
    }

    let lastError = null;

    for (let attempt = 0; attempt <= this.maxRetryAttempts; attempt++) {
      try {
        return await this._requestTranslationChunk(text, targetLang, sourceLang);
      } catch (error) {
        lastError = error;
        const isNetworkUnavailable = error && (
          error.name === 'TypeError' ||
          error.name === 'AbortError' ||
          /Failed to fetch|NetworkError|network/i.test(error.message || '')
        );
        const isTransient = error && (
          isNetworkUnavailable ||
          error.status === 408 || error.status === 429 || error.status >= 500
        );

        // DNS/firewall/timeouts usually affect the whole Google domain, so
        // switch providers immediately instead of repeating a doomed request.
        if (!isTransient || isNetworkUnavailable || attempt === this.maxRetryAttempts) {
          if (isNetworkUnavailable) {
            // Avoid paying the same timeout for every paragraph when the
            // Google domain is blocked or unreachable on this network.
            this.primaryUnavailableUntil = Date.now() + 5 * 60 * 1000;
          }
          break;
        }

        const retryAfter = Number(error.retryAfter) || 0;
        const backoff = Math.max(
          retryAfter * 1000,
          this.retryBaseDelay * Math.pow(2, attempt)
        );
        await this._delay(backoff);
      }
    }

    // Google domains may be unavailable on some networks. Use a second free
    // provider before marking this paragraph as failed.
    try {
      return await this._requestFallbackChunk(text, targetLang, sourceLang);
    } catch (fallbackError) {
      const primaryMessage = lastError ? lastError.message : 'Google Translate unavailable';
      throw new Error(`${primaryMessage}; fallback failed: ${fallbackError.message}`);
    }
  }

  async _requestTranslationChunk(text, targetLang, sourceLang) {
    const url = `${this.baseUrl}?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await this._fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, this.requestTimeout);

    if (!response.ok) {
      const error = new Error(`Google Translate request failed: ${response.status}`);
      error.status = response.status;
      error.retryAfter = response.headers && response.headers.get
        ? response.headers.get('Retry-After')
        : null;
      throw error;
    }

    const data = await response.json();

    // Parse the nested array response: [[["translated", "original", ...]], null, "sl"]
    if (!data || !data[0] || !Array.isArray(data[0])) {
      throw new Error('Unexpected Google Translate response format');
    }

    // Concatenate all translated segments
    return data[0]
      .filter(segment => segment && segment[0])
      .map(segment => segment[0])
      .join('');
  }

  async _requestFallbackChunk(text, targetLang, sourceLang) {
    // MyMemory's anonymous endpoint accepts shorter query strings than Google.
    if (text.length > 450) {
      const chunks = this._splitText(text, 450);
      const translated = [];
      for (const chunk of chunks) {
        translated.push(await this._requestFallbackChunk(chunk, targetLang, sourceLang));
        await this._delay(this.requestInterval);
      }
      return translated.join('');
    }

    const source = this._normalizeFallbackLanguage(sourceLang, text, true);
    const target = this._normalizeFallbackLanguage(targetLang, text, false);
    const url = `${this.fallbackUrl}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${source}|${target}`)}`;
    const response = await this._fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, this.fallbackTimeout);

    if (!response.ok) {
      throw new Error(`MyMemory request failed: ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data && data.responseData && data.responseData.translatedText;
    if (!translatedText || (data.responseStatus && Number(data.responseStatus) >= 400)) {
      throw new Error((data && data.responseDetails) || 'Unexpected MyMemory response format');
    }

    return this._decodeEntities(translatedText);
  }

  _normalizeFallbackLanguage(language, text, detectSource) {
    if (detectSource && (!language || language === 'auto')) {
      if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
      if (/[\u3040-\u30ff]/.test(text)) return 'ja';
      if (/[\uac00-\ud7af]/.test(text)) return 'ko';
      return 'en';
    }

    const aliases = {
      'zh': 'zh-CN',
      'zh-TW': 'zh-TW',
      'zh-CN': 'zh-CN'
    };
    return aliases[language] || language || 'en';
  }

  _decodeEntities(text) {
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = text;
      return textarea.value;
    }
    return text
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Split text into chunks at sentence boundaries where possible.
   */
  _splitText(text, maxLength) {
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at the last sentence break within the limit
      let splitPos = maxLength;
      const searchRegion = remaining.substring(0, maxLength);
      const lastPeriod = searchRegion.lastIndexOf('. ');
      const lastNewline = searchRegion.lastIndexOf('\n');

      if (lastPeriod > maxLength * 0.5) {
        splitPos = lastPeriod + 1; // include the period
      } else if (lastNewline > maxLength * 0.5) {
        splitPos = lastNewline;
      }

      chunks.push(remaining.substring(0, splitPos));
      remaining = remaining.substring(splitPos);
    }

    return chunks;
  }

  /**
   * Translate paragraph groups — same interface as TranslationService.translateParagraphGroups.
   * @param {Array} paragraphGroups - array of { id, container, textNodes, combinedText }
   * @param {string} targetLanguage
   * @param {string} sourceLanguage
   * @param {Function|null} progressCallback - (result, completed, total) => void
   * @param {object} options
   * @returns {Promise<Array>} array of result objects
   */
  async translateParagraphGroups(paragraphGroups, targetLanguage = 'zh-CN', sourceLanguage = 'auto', progressCallback = null, options = {}) {
    const total = paragraphGroups.length;
    const results = [];
    let completed = 0;
    const cancelCheck = options.cancelCheck || null;

    // Process paragraphs sequentially to avoid rate limiting
    for (let groupIndex = 0; groupIndex < paragraphGroups.length; groupIndex++) {
      const group = paragraphGroups[groupIndex];
      // Check for cancellation before each paragraph
      if (cancelCheck && cancelCheck()) {
        break;
      }

      try {
        const translation = await this.translate(group.combinedText, targetLanguage, sourceLanguage);

        const result = {
          success: true,
          id: group.id,
          container: group.container,
          textNodes: group.textNodes,
          originalText: group.combinedText,
          translation: translation
        };

        results.push(result);
        completed++;

        if (progressCallback) {
          try {
            await progressCallback(result, completed, total);
          } catch (e) {
            // Don't let callback errors break the translation loop
          }
        }
      } catch (error) {
        const failResult = {
          success: false,
          id: group.id,
          container: group.container,
          textNodes: group.textNodes,
          originalText: group.combinedText,
          translation: group.combinedText, // fallback to original
          error: error.message
        };

        results.push(failResult);
        completed++;

        if (progressCallback) {
          try {
            await progressCallback(failResult, completed, total);
          } catch (e) {
            // ignore
          }
        }
      }

      // Avoid sending a burst of back-to-back requests, which can cause the
      // public endpoint to intermittently reject otherwise valid paragraphs.
      if (groupIndex < paragraphGroups.length - 1) {
        await this._delay(this.requestInterval);
      }
    }

    return results;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FreeTranslator };
} else if (typeof window !== 'undefined') {
  window.FreeTranslator = FreeTranslator;
}
