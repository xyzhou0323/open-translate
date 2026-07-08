/**
 * Post-processing correction module.
 * After translation (free API or LLM), scans the translation output and
 * replaces incorrect Chinese terms with glossary-approved translations —
 * but only when the corresponding English term appears in the source text.
 */
class TranslationCorrector {
  constructor(glossary) {
    // Build correction rules: only include entries with incorrect[] defined
    this.rules = [];

    for (const [en, entry] of Object.entries(glossary)) {
      if (!entry.incorrect || entry.incorrect.length === 0) continue;

      // Escape regex-special chars in the English term for word-boundary matching
      const enPattern = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      this.rules.push({
        // Match English term with case-insensitive word boundaries
        enRegex: new RegExp(`\\b${enPattern}\\b`, 'gi'),
        correct: entry.zh,
        incorrect: entry.incorrect
      });
    }

    // Sort by English term length descending — longest-match-first
    // avoids "disorder" firing before "bipolar disorder"
    this.rules.sort((a, b) => {
      const aLen = a.enRegex.source.length;
      const bLen = b.enRegex.source.length;
      return bLen - aLen;
    });
  }

  /**
   * Correct a single translation result.
   * @param {string} originalText - source English text
   * @param {string} translatedText - translated Chinese text
   * @returns {string} corrected Chinese text
   */
  correct(originalText, translatedText) {
    if (!originalText || !translatedText) return translatedText;

    let result = translatedText;

    for (const rule of this.rules) {
      // Only correct if the English term appears in the source
      if (!rule.enRegex.test(originalText)) continue;

      // Reset lastIndex after test()
      rule.enRegex.lastIndex = 0;

      // Replace each incorrect Chinese variant with the correct one
      for (const wrong of rule.incorrect) {
        // Escape the Chinese text for regex (no special chars in Chinese, but be safe)
        const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wrongRegex = new RegExp(escaped, 'g');
        result = result.replace(wrongRegex, rule.correct);
      }
    }

    return result;
  }

  /**
   * Batch-correct an array of translation results.
   * Each item must have { originalText, translation }.
   * Returns a new array with corrected translations (mutates translation field).
   */
  correctBatch(results) {
    return results.map(item => ({
      ...item,
      translation: this.correct(item.originalText, item.translation)
    }));
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TranslationCorrector };
} else if (typeof window !== 'undefined') {
  window.TranslationCorrector = TranslationCorrector;
}
