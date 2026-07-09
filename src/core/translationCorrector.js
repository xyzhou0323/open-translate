/**
 * Post-processing correction module.
 * After translation (free API or LLM), scans the translation output and
 * replaces incorrect Chinese terms with glossary-approved translations —
 * but only when the corresponding English term appears in the source text.
 */
class TranslationCorrector {
  constructor(glossary) {
    this.rules = [];

    for (const [en, entry] of Object.entries(glossary)) {
      if (!entry.incorrect || entry.incorrect.length === 0) continue;

      const enPattern = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Normalize: plain strings use entry.zh, [wrong, correct] tuples use specific target.
      // Sort longest-first so "孤独症患者" is replaced before "孤独症" within the same rule.
      const replacements = entry.incorrect
        .map(item => {
          if (Array.isArray(item)) {
            return { wrong: item[0], correct: item[1] };
          }
          return { wrong: item, correct: entry.zh };
        })
        .sort((a, b) => b.wrong.length - a.wrong.length);

      this.rules.push({
        enRegex: new RegExp(`\\b${enPattern}\\b`, 'gi'),
        replacements
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

      // Replacements already sorted longest-first in constructor
      for (const { wrong, correct } of rule.replacements) {
        const escaped = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wrongRegex = new RegExp(escaped, 'g');
        result = result.replace(wrongRegex, correct);
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
