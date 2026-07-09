/**
 * Free translator using Google Translate unofficial API.
 * No API key required. Falls back gracefully.
 */
class FreeTranslator {
  constructor() {
    this.baseUrl = 'https://translate.googleapis.com/translate_a/single';
    this.maxTextLength = 1500; // Google Translate URL length limit safety margin
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
    const url = `${this.baseUrl}?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Google Translate request failed: ${response.status}`);
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
    for (const group of paragraphGroups) {
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
