/**
 * Content script for Open Translate extension
 * Handles page translation and user interactions
 */

// Import core modules
let textExtractor = null;
const translationRenderer = new TranslationRenderer();
let translationService = null;
let translationCorrector = null;
let freeTranslator = null;
let inputFieldListener = null;
let accessibilityFeatures = null;
let readingGuide = null;
let toolbar = null;

// State management
let isTranslating = false;
let isTranslated = false;
let isNavigating = false; // 新增：标记是否正在导航
let translationCancelled = false; // 用户主动取消翻译
let currentTextNodes = [];
let currentTranslations = [];
let translationMode = TRANSLATION_MODES.REPLACE; // 统一默认为替换模式
let targetLanguage = 'zh-CN';
let sourceLanguage = 'auto';
let clickableParagraphGroups = []; // paragraph groups for click-to-translate mode
let dynamicTranslationEnabled = true;
let useFreeMode = true;
let autoTranslate = false;
let scrollTimeout = null;
let retryCheckInterval = null;
let retryTimeoutId = null;
let handlingViewport = false;
let suppressObserver = false;
let lastViewportTranslation = 0;

/**
 * Initialize content script
 */
async function initialize() {
  try {
    translationService = new TranslationService();
    await translationService.initialize();
    freeTranslator = new FreeTranslator();
    if (typeof BUILTIN_GLOSSARY !== 'undefined') {
      translationCorrector = new TranslationCorrector(BUILTIN_GLOSSARY);
    }
    if (typeof AccessibilityFeatures !== 'undefined') {
      accessibilityFeatures = new AccessibilityFeatures();
      console.log('[ND Translate] AccessibilityFeatures instance created');
    } else {
      console.warn('[ND Translate] AccessibilityFeatures class not defined');
    }
    if (typeof ReadingGuide !== 'undefined') {
      readingGuide = new ReadingGuide({
        textExtractor: null,
        accessibilityFeatures: accessibilityFeatures,
        onStatusChange: (status, data) => {
          notifyStatusChange(status, data);
          if (toolbar) toolbar._onRGStatusChange(status, data);
        }
      });
      // Load reading preferences
      chrome.storage.sync.get([
        'readingGuideSpeed', 'readingGuideMuted', 'readingGuideMaskEnabled'
      ], (result) => {
        if (readingGuide) {
          readingGuide.init({
            speed: result.readingGuideSpeed || 3.0,
            muted: result.readingGuideMuted || false,
            maskEnabled: result.readingGuideMaskEnabled !== false
          });
        }
      });
    }
    await loadUserPreferences();
    if (readingGuide && textExtractor) {
      readingGuide.textExtractor = textExtractor;
    }

    // Initialize toolbar
    if (typeof Toolbar !== 'undefined') {
      toolbar = new Toolbar({
        readingGuide: readingGuide,
        accessibilityFeatures: accessibilityFeatures,
        onVisibilityChange: (visible) => {
          chrome.storage.sync.set({ toolbarVisible: visible });
        },
        onRestoreAll: async () => {
          await handleRestoreAllRequest();
        },
        onTranslate: async () => {
          const settings = await new Promise((resolve) => {
            chrome.storage.sync.get(['sourceLanguage', 'targetLanguage', 'translationMode'], resolve);
          });
          sourceLanguage = settings.sourceLanguage || sourceLanguage || 'auto';
          targetLanguage = settings.targetLanguage || targetLanguage || 'zh-CN';
          translationMode = settings.translationMode || translationMode;
          await handleTranslateRequest({
            sourceLanguage,
            targetLanguage,
            translationMode,
            forceRefresh: isTranslated
          });
        },
        onRestoreTranslation: async () => {
          if (translationMode === TRANSLATION_MODES.BILINGUAL) {
            await handleToggleBilingualView();
          } else if (isTranslated) {
            await handleRestoreRequest();
          } else if (translationRenderer.translationCache.size > 0) {
            const settings = await new Promise((resolve) => {
              chrome.storage.sync.get(['sourceLanguage', 'targetLanguage', 'translationMode'], resolve);
            });
            sourceLanguage = settings.sourceLanguage || sourceLanguage || 'auto';
            targetLanguage = settings.targetLanguage || targetLanguage || 'zh-CN';
            translationMode = settings.translationMode || translationMode;
            await handleTranslateRequest({ sourceLanguage, targetLanguage, translationMode });
          }
        },
        getTranslationState: () => ({
          isTranslated,
          isTranslating,
          mode: translationMode,
          hasCachedTranslations: translationRenderer.translationCache.size > 0,
          translationVisible: isTranslated && (
            translationMode !== TRANSLATION_MODES.BILINGUAL ||
            document.querySelector('.ot-paragraph-bilingual.ot-original-only') === null
          )
        })
      });
      toolbar.init();
    }

    setupStorageListener();
    setupMessageListeners();
    setupContextMenu();

    // 初始化输入框监听器
    await initializeInputFieldListener();

    // Auto-translate if enabled
    if (autoTranslate) {
      console.log('[ND Translate] Auto-translating page, mode:', translationMode);
      handleTranslateRequest({
        sourceLanguage,
        targetLanguage,
        translationMode
      }).catch(err => {
        console.warn('[ND Translate] Auto-translate failed:', err.message);
      });
    }
  } catch (error) {

    // Use errorHandler if available
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'content-initialization', {
        logToConsole: true,
        suppressNotification: true
      });
    }
  }
}

/**
 * Load user preferences from storage
 */
async function loadUserPreferences() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'translationMode',
      'targetLanguage',
      'batchSize',
      'enableMerge',
      'shortTextThreshold',
      'maxMergedLength',
      'maxMergedCount',
      'excludeSelectors',
      'preserveFormatting',
      'smartContentEnabled',
      'inputFieldListenerEnabled',
      'useFreeMode',
      'accessibilityEnabled',
      'dyslexicFont',
      'chineseFont',
      'bionicReading',
      'bionicBoldRatio',
      'bionicDimNonBold',
      'sentenceBreak',
      'lineSpacing',
      'wordSpacing',
      'letterSpacing',
      'fontSize',
      'autoTranslate',
      'sourceLanguage',
      'targetLanguage'
    ], (result) => {
      // 保持与初始默认值一致：如果用户没有设置，使用 REPLACE 模式
      translationMode = result.translationMode || TRANSLATION_MODES.REPLACE;
      useFreeMode = result.useFreeMode !== undefined ? result.useFreeMode : true;
      autoTranslate = result.autoTranslate === true;
      sourceLanguage = result.sourceLanguage || 'auto';
      targetLanguage = result.targetLanguage || 'zh-CN';

      // Apply accessibility features based on individual flags
      if (accessibilityFeatures) {
        accessibilityFeatures.init({
          accessibilityEnabled: result.accessibilityEnabled,
          dyslexicFont: result.dyslexicFont,
          chineseFont: result.chineseFont,
          bionicReading: result.bionicReading,
          bionicBoldRatio: result.bionicBoldRatio,
          bionicDimNonBold: result.bionicDimNonBold,
          sentenceBreak: result.sentenceBreak,
          lineSpacing: result.lineSpacing,
          wordSpacing: result.wordSpacing,
          letterSpacing: result.letterSpacing,
          fontSize: result.fontSize
        });
      }

      translationRenderer.setMode(translationMode);

      // 如果是Replace模式，确保清理任何可能的双语模式残留
      if (translationMode === TRANSLATION_MODES.REPLACE) {
        translationRenderer.cleanupAllBilingualElements();
      }

      // Initialize TextExtractor with user configuration
      textExtractor = new TextExtractor({
        excludeSelectors: result.excludeSelectors || '',
        preserveFormatting: result.preserveFormatting !== false,
        smartContentEnabled: result.smartContentEnabled !== false
      });

      // Update translation service with configuration if available
      if (translationService) {
        if (result.batchSize) {
          translationService.config.batchSize = result.batchSize;
        }
        if (result.enableMerge !== undefined) {
          translationService.config.enableMerge = result.enableMerge;
        }
        if (result.shortTextThreshold) {
          translationService.config.shortTextThreshold = result.shortTextThreshold;
        }
        if (result.maxMergedLength) {
          translationService.config.maxMergedLength = result.maxMergedLength;
        }
        if (result.maxMergedCount) {
          translationService.config.maxMergedCount = result.maxMergedCount;
        }
      }

      resolve();
    });
  });
}

/**
 * 初始化输入框监听器
 */
async function initializeInputFieldListener() {
  try {
    if (!translationService) {
      return;
    }

    // 检查用户是否启用了输入框监听功能
    const result = await new Promise((resolve) => {
      chrome.storage.sync.get(['inputFieldListenerEnabled'], resolve);
    });

    const isEnabled = result.inputFieldListenerEnabled !== false; // 默认启用

    if (isEnabled) {
      inputFieldListener = new InputFieldListener({
        debounceDelay: 300,
        minTextLength: 2,
        maxTextLength: 5000,
        enableAnimation: true
      });

      await inputFieldListener.initialize(translationService);
    }
  } catch (error) {
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'input-field-listener-initialization', {
        logToConsole: true,
        suppressNotification: true
      });
    }
  }
}

// 防止重复添加消息监听器的标志
let messageListenersSetup = false;

/**
 * Set up message listeners for communication with popup/background
 */
function setupStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    // Keep the in-page toolbar aligned with language and mode changes made in
    // the popup/options page. Without this, its retranslate action can reuse
    // the values captured when the content script first loaded.
    if (changes.sourceLanguage) sourceLanguage = changes.sourceLanguage.newValue || 'auto';
    if (changes.targetLanguage) targetLanguage = changes.targetLanguage.newValue || 'zh-CN';
    if (changes.translationMode) {
      translationMode = changes.translationMode.newValue || TRANSLATION_MODES.REPLACE;
      translationRenderer.setMode(translationMode);
    }
    if (changes.accessibilityEnabled && changes.accessibilityEnabled.newValue === false && accessibilityFeatures) {
      accessibilityFeatures.cleanup();
      Object.assign(accessibilityFeatures.state, {
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
    }
    // Toolbar visibility
    if (changes.toolbarVisible && toolbar) {
      if (changes.toolbarVisible.newValue) {
        toolbar.show();
      } else {
        toolbar.hide();
      }
    }
    // Reading guide settings from options
    if (changes.readingGuideSpeed && readingGuide) {
      readingGuide.setSpeed(changes.readingGuideSpeed.newValue);
      if (toolbar) {
        if (toolbar._speedSlider) toolbar._speedSlider.value = changes.readingGuideSpeed.newValue;
        if (typeof toolbar._updateSpeedLabel === 'function') toolbar._updateSpeedLabel(changes.readingGuideSpeed.newValue);
      }
    }
    if (changes.readingGuideMuted && readingGuide) {
      readingGuide.setMuted(changes.readingGuideMuted.newValue);
      if (toolbar && toolbar._mutedBtn) toolbar._updateToggle(toolbar._mutedBtn, changes.readingGuideMuted.newValue);
    }
    if (changes.readingGuideMaskEnabled && readingGuide) {
      readingGuide.setMaskEnabled(changes.readingGuideMaskEnabled.newValue);
      if (toolbar && toolbar._maskBtn) toolbar._updateToggle(toolbar._maskBtn, changes.readingGuideMaskEnabled.newValue);
    }
    // Accessibility settings
    if (toolbar && toolbar._updateFromStorage) {
      toolbar._updateFromStorage(changes);
    }
  });
}

function setupMessageListeners() {
  if (messageListenersSetup) return;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep message channel open for async responses
  });

  messageListenersSetup = true;
}

/**
 * Handle messages from popup and background script
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'translate':
        await handleTranslateRequest(message.options);
        sendResponse({ success: true, translated: isTranslated });
        break;
        
      case 'restore':
        await handleRestoreRequest();
        sendResponse({ success: true, translated: isTranslated });
        break;

      case 'cancel':
        handleCancelRequest();
        sendResponse({ success: true });
        break;

      case 'toggleBilingualView':
        const result = await handleToggleBilingualView();
        sendResponse({ success: true, showingOriginalOnly: result.showingOriginalOnly });
        break;

      case 'switchMode':
        await handleSwitchModeRequest(message.mode);
        sendResponse({ success: true, mode: translationMode });
        break;
        
      case 'getStatus':
        sendResponse({
          success: true,
          isTranslated: isTranslated,
          isTranslating: isTranslating,
          mode: translationMode,
          stats: translationRenderer.getTranslationStats(),
          hasCachedTranslations: translationRenderer.translationCache.size > 0
        });
        break;
        
      case 'updateConfig':
        await translationService.updateConfig(message.config);
        // Reinitialize TextExtractor with updated configuration
        await loadUserPreferences();
        // 重新初始化输入框监听器
        await initializeInputFieldListener();
        sendResponse({ success: true });
        break;

      case 'toggleInputFieldListener':
        await handleToggleInputFieldListener(message.enabled);
        sendResponse({ success: true, enabled: inputFieldListener?.isEnabled || false });
        break;

      case 'updateInputFieldSettings':
        await handleUpdateInputFieldSettings(message.settings);
        sendResponse({ success: true });
        break;

      case 'readingGuideStart':
        if (readingGuide) {
          await readingGuide.start({
            speed: message.speed,
            muted: message.muted,
            maskEnabled: message.maskEnabled
          });
        }
        sendResponse({ success: true });
        break;

      case 'readingGuidePause':
        if (readingGuide) readingGuide.pause();
        sendResponse({ success: true });
        break;

      case 'readingGuideResume':
        if (readingGuide) readingGuide.resume();
        sendResponse({ success: true });
        break;

      case 'readingGuideStop':
        if (readingGuide) readingGuide.stop();
        sendResponse({ success: true });
        break;

      case 'readingGuideSeek':
        if (readingGuide) readingGuide.enterSeekMode();
        sendResponse({ success: true });
        break;

      case 'toggleToolbar':
        if (toolbar) {
          if (message.visible) {
            toolbar.show();
          } else {
            toolbar.hide();
          }
        }
        sendResponse({ success: true });
        break;

      case 'restoreAll':
        await handleRestoreAllRequest();
        sendResponse({ success: true });
        break;

      case 'readingGuideSetSpeed':
        if (readingGuide) readingGuide.setSpeed(message.speed);
        sendResponse({ success: true });
        break;

      case 'readingGuideSetMuted':
        if (readingGuide) readingGuide.setMuted(message.muted);
        sendResponse({ success: true });
        break;

      case 'readingGuideSetMask':
        if (readingGuide) readingGuide.setMaskEnabled(message.enabled);
        sendResponse({ success: true });
        break;

      case 'readingGuideGetStatus':
        sendResponse({
          success: true,
          state: readingGuide ? readingGuide.getState() : 'idle',
          currentIndex: readingGuide ? readingGuide.getCurrentSentenceIndex() : -1
        });
        break;

      case 'updateAccessibility':
        if (accessibilityFeatures) {
          suppressObserver = true;
          if (message.key === 'enabled') {
            if (message.value) {
              // Re-read full config from storage and apply
              chrome.storage.sync.get([
                'accessibilityEnabled', 'dyslexicFont', 'chineseFont', 'bionicReading', 'bionicBoldRatio',
                'bionicDimNonBold', 'sentenceBreak', 'lineSpacing', 'wordSpacing',
                'letterSpacing', 'fontSize'
              ], (result) => {
                try {
                  accessibilityFeatures.init({
                    accessibilityEnabled: result.accessibilityEnabled,
                    dyslexicFont: result.dyslexicFont,
                    chineseFont: result.chineseFont,
                    bionicReading: result.bionicReading,
                    bionicBoldRatio: result.bionicBoldRatio,
                    bionicDimNonBold: result.bionicDimNonBold,
                    sentenceBreak: result.sentenceBreak,
                    lineSpacing: result.lineSpacing,
                    wordSpacing: result.wordSpacing,
                    letterSpacing: result.letterSpacing,
                    fontSize: result.fontSize
                  });
                } catch (e) {
                  console.error('[updateAccessibility] Failed to init accessibility features:', e);
                }
                setTimeout(() => { suppressObserver = false; }, 0);
              });
            } else {
              accessibilityFeatures.cleanup();
              setTimeout(() => { suppressObserver = false; }, 0);
            }
          } else {
            accessibilityFeatures.update(message.key, message.value);
            setTimeout(() => { suppressObserver = false; }, 0);
          }
        }
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {

    // Use errorHandler if available
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'content-message-handling', {
        logToConsole: true,
        suppressNotification: true
      });
    }

    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Get clean text from a paragraph group, excluding the click indicator "T".
 * `combinedText` is captured during extraction before the indicator is added
 * to the DOM, so it is always clean. The fallback strips the indicator node.
 */
function getGroupText(group) {
  if (group.combinedText) return group.combinedText;
  if (!group.container) return '';
  const indicator = group.container.querySelector('.ot-click-indicator');
  if (indicator) {
    const clone = group.container.cloneNode(true);
    const cloneIndicator = clone.querySelector('.ot-click-indicator');
    if (cloneIndicator) cloneIndicator.remove();
    return clone.textContent || '';
  }
  return group.container.textContent || '';
}

/**
 * Create a click-to-translate handler with cache support.
 * Returns a callback suitable for TranslationRenderer.setupClickToTranslateMode.
 */
function createClickToTranslateHandler(targetLanguage, sourceLanguage) {
  return async (group, container) => {
    try {
      if (isNavigating) return;

      const originalText = getGroupText(group);
      const cachedTranslation = translationRenderer.getCachedTranslation(originalText, sourceLanguage, targetLanguage);

      let result;
      if (cachedTranslation !== null) {
        result = {
          success: true,
          originalText: originalText,
          translation: cachedTranslation,
          container: group.container,
          textNodes: group.textNodes,
          fromCache: true
        };
      } else {
        const useFreeTranslator = useFreeMode !== false;
        const results = useFreeTranslator
          ? await freeTranslator.translateParagraphGroups([group], targetLanguage, sourceLanguage, null, { translationMode: TRANSLATION_MODES.REPLACE })
          : await translationService.translateParagraphGroups([group], targetLanguage, sourceLanguage, null, { translationMode: TRANSLATION_MODES.REPLACE });

        result = (results && results.length > 0) ? results[0] : null;
      }

      if (result && result.success) {
        const correctionEnabled = useFreeMode !== false || translationService.config?.enableCorrection !== false;
        if (translationCorrector && correctionEnabled && result.originalText && result.translation) {
          result.translation = translationCorrector.correct(result.originalText, result.translation);
        }
        suppressObserver = true;
        translationRenderer.renderSingleResult(result, TRANSLATION_MODES.REPLACE);
        container.classList.add('ot-click-translated');
        currentTextNodes.push(result);
        currentTranslations.push(result.translation);

        if (!result.fromCache) {
          translationRenderer.cacheTranslation(result.originalText, result.translation, sourceLanguage, targetLanguage);
        }
        setTimeout(() => { suppressObserver = false; }, 0);
      }
    } catch (e) {
      container.classList.remove('ot-click-translating');
    }
  };
}

/**
 * Handle translation request
 */
async function handleTranslateRequest(options = {}) {
  if (isTranslating) {
    throw new Error('Translation already in progress');
  }

  if (isNavigating) {
    throw new Error('Page is navigating, translation cancelled');
  }

  // 确保使用正确的翻译模式
  const requestedMode = options.translationMode || translationMode;

  // 验证模式有效性并更新全局状态
  if ([TRANSLATION_MODES.REPLACE, TRANSLATION_MODES.BILINGUAL, TRANSLATION_MODES.CLICK_TO_TRANSLATE].includes(requestedMode)) {
    translationMode = requestedMode;
    translationRenderer.setMode(requestedMode);
  }

  try {
    isTranslating = true;
    translationCancelled = false;

    if (contentObserver) {
      contentObserver.disconnect();
    }

    // Update status in popup
    notifyStatusChange('translating');

    const targetLanguage = options.targetLanguage || 'zh-CN';
    const sourceLanguage = options.sourceLanguage || 'auto';

    // 检查是否需要重新翻译
    const settingsChanged = window.lastTranslationSettings && (
      window.lastTranslationSettings.targetLanguage !== targetLanguage ||
      window.lastTranslationSettings.sourceLanguage !== sourceLanguage
    );

    const needsRetranslation = isTranslated && (options.forceRefresh || settingsChanged);

    if (needsRetranslation) {
      translationRenderer.restoreOriginalText();
      isTranslated = false;
      currentTranslations = [];
      currentTextNodes = [];
      if (textExtractor) {
        textExtractor.clearCache();
      }
    }

    window.lastTranslationSettings = {
      targetLanguage,
      sourceLanguage,
      translationMode
    };

    // 只在状态不一致时才清理残留元素
    if (!isTranslated) {
      const existingTranslatedElements = document.querySelectorAll('.ot-paragraph-bilingual, .ot-paragraph-translated');
      if (existingTranslatedElements.length > 0) {
        existingTranslatedElements.forEach(element => {
          if (element.classList.contains('ot-paragraph-bilingual')) {
            element.classList.remove('ot-paragraph-bilingual');
            const translatedSection = element.querySelector('.ot-paragraph-translated');
            if (translatedSection) {
              translatedSection.remove();
            }
          } else if (element.classList.contains('ot-paragraph-translated')) {
            element.remove();
          }
        });
      }
    }

    if (!isTranslated || options.forceRefresh || needsRetranslation) {
      // Ensure textExtractor is initialized
      if (!textExtractor) {
        await loadUserPreferences();
      }

      // Temporarily restore Bionic Reading and Sentence Break so the text
      // extractor sees clean text (Bionic wraps word fragments in <b> tags
      // which breaks text extraction and produces garbled translations).
      const hadBionic = accessibilityFeatures && accessibilityFeatures.state.bionicReading;
      const hadSentenceBreak = accessibilityFeatures && accessibilityFeatures.state.sentenceBreak;
      if (accessibilityFeatures) {
        if (hadBionic) accessibilityFeatures.restoreBionicReading();
        if (hadSentenceBreak) accessibilityFeatures.restoreSentenceBreaks();
      }
      // Clear cache since DOM has changed
      if (textExtractor) textExtractor.clearCache();

      // Use paragraph-based extraction for better concurrent translation
      // Pass translation mode to ensure proper text extraction
      let paragraphGroups = textExtractor.extractParagraphGroups(document.body, {
        translationMode: translationMode,
        prioritizeViewport: true // 启用视口优先翻译
      });

      if (paragraphGroups.length === 0) {
        const hasText = document.body && document.body.textContent.trim().length > 0;
        const errorMessage = hasText
          ? 'No translatable text found on this page. The page may contain only images, videos, or non-text content.'
          : 'Page appears to be empty or still loading. Please wait and try again.';
        throw new Error(errorMessage);
      }

      // 重置翻译数据
      currentTextNodes = [];
      currentTranslations = [];

      // Click-to-translate mode: set up click handlers instead of auto-translating
      if (translationMode === TRANSLATION_MODES.CLICK_TO_TRANSLATE) {
        clickableParagraphGroups = paragraphGroups;

        const clickHandler = createClickToTranslateHandler(targetLanguage, sourceLanguage);
        translationRenderer.setupClickToTranslateMode(paragraphGroups, clickHandler, accessibilityFeatures);

        // Auto-restore previously cached translations on re-translate
        let restoredCount = 0;
        for (const group of paragraphGroups) {
          const originalText = getGroupText(group);
          if (translationRenderer.getCachedTranslation(originalText, sourceLanguage, targetLanguage) !== null) {
            await clickHandler(group, group.container);
            restoredCount++;
          }
        }

        isTranslated = true;

        // Re-apply accessibility features in click-to-translate mode.
        // Set suppressObserver BEFORE re-applying — accessibility DOM changes
        // (e.g. inserting <br> tags for sentence breaks) alter layout and fire
        // scroll events, which would otherwise trigger handleViewportChange.
        suppressObserver = true;
        if (accessibilityFeatures) {
          if (hadSentenceBreak) accessibilityFeatures.applySentenceBreaks();
          if (hadBionic) accessibilityFeatures.applyBionicReading();
        }

        notifyStatusChange('translated', {
          totalTranslated: currentTranslations.length,
          mode: translationMode
        });
        return;
      }

      // 标记所有段落为"翻译中"，提供视觉等待提示
      paragraphGroups.forEach(group => {
        if (group.container) {
          group.container.classList.add('ot-translating');
        }
      });

      // 实时翻译进度回调函数
      const progressCallback = async (result, completed, total) => {
        try {
          // 检查是否正在导航或用户取消，如果是则停止翻译
          if (isNavigating || translationCancelled) {
            return;
          }

          // Post-processing glossary correction
          // Free mode: always correct. LLM mode: respect enableCorrection config.
          const correctionEnabled = useFreeMode !== false || translationService.config?.enableCorrection !== false;
          if (result.success && translationCorrector && correctionEnabled && result.originalText && result.translation) {
            result.translation = translationCorrector.correct(result.originalText, result.translation);
          }

          // 立即渲染单个翻译结果
          translationRenderer.renderSingleResult(result, translationMode);

          // 更新进度状态
          const progress = Math.round((completed / total) * 100);

          notifyStatusChange('translating', {
            progress: progress,
            completed: completed,
            total: total,
            currentText: result.originalText?.substring(0, 50) + '...'
          });

          // 存储翻译结果以便后续操作
          if (result.success) {
            // For paragraph groups, store the entire group result
            // The renderer will handle the proper replacement
            currentTextNodes.push(result);
            currentTranslations.push(result.translation);

            // Cache translation result for reuse (skip if it came from cache)
            if (!result.fromCache) {
              translationRenderer.cacheTranslation(
                result.originalText, result.translation, sourceLanguage, targetLanguage
              );
            }
          } else {
            // Handle failed translations - keep original text
            if (result.textNodes) {
              result.textNodes.forEach(textNode => {
                currentTextNodes.push(textNode);
                currentTranslations.push(textNode.text);
              });
            }
          }

        } catch (renderError) {
        }
      };

      // Separate cached vs uncached groups to avoid unnecessary API calls
      const uncachedGroups = [];
      let completedCount = 0;

      for (const group of paragraphGroups) {
        const originalText = getGroupText(group);
        const cachedTranslation = (!options.forceRefresh)
          ? translationRenderer.getCachedTranslation(originalText, sourceLanguage, targetLanguage)
          : null;

        if (cachedTranslation !== null) {
          completedCount++;
          const cachedResult = {
            success: true,
            originalText: originalText,
            translation: cachedTranslation,
            container: group.container,
            textNodes: group.textNodes,
            fromCache: true
          };
          await progressCallback(cachedResult, completedCount, paragraphGroups.length);
        } else {
          uncachedGroups.push(group);
        }
      }

      // Only call API for uncached groups
      if (uncachedGroups.length > 0) {
        // Route to free translator based on user preference
        const cancelCheck = () => translationCancelled;

        if (useFreeMode !== false) {
          await freeTranslator.translateParagraphGroups(
            uncachedGroups,
            targetLanguage,
            sourceLanguage,
            progressCallback,
            { translationMode: translationMode, cancelCheck }
          );
        } else {
          await translationService.translateParagraphGroups(
            uncachedGroups,
            targetLanguage,
            sourceLanguage,
            progressCallback,
            { translationMode: translationMode, cancelCheck }
          );
          // 检查是否有失败的元素需要重试
          await handleTranslationRetries(targetLanguage, sourceLanguage);
        }
      }

      // Re-apply accessibility features temporarily restored before extraction.
      // Set suppressObserver BEFORE re-applying — accessibility DOM changes
      // (e.g. inserting <br> tags for sentence breaks) alter layout and fire
      // scroll events, which would otherwise trigger handleViewportChange.
      // Order must match init(): sentence break first, then bionic.
      suppressObserver = true;
      if (accessibilityFeatures) {
        if (hadSentenceBreak) accessibilityFeatures.applySentenceBreaks();
        if (hadBionic) accessibilityFeatures.applyBionicReading();
      }

    }

    // If cancelled, don't mark as translated
    if (translationCancelled) {
      isTranslating = false;
      return;
    }

    isTranslated = true;

    // 启动定期重试检查 (LLM mode only — free translator doesn't have per-element retry)
    if (useFreeMode === false) {
      startRetryMonitoring(targetLanguage, sourceLanguage);
    }

    notifyStatusChange('translated', {
      totalTranslated: currentTranslations.length,
      mode: translationMode
    });

  } catch (error) {
    // 检查是否已经有部分翻译成功
    const hasPartialTranslation = currentTranslations.length > 0 ||
                                  translationRenderer.getTranslationStats().translatedElements > 0;

    if (hasPartialTranslation) {
      // 如果有部分翻译成功，将状态设置为已翻译而不是错误
      isTranslated = true;
      notifyStatusChange('translated', {
        totalTranslated: currentTranslations.length,
        mode: translationMode,
        warning: error.message
      });
    } else {
      // 只有在完全没有翻译成功时才报告错误
      // Use errorHandler if available
      if (typeof errorHandler !== 'undefined') {
        errorHandler.handle(error, 'content-translation', {
          logToConsole: true,
          suppressNotification: false
        });
      }

      notifyStatusChange('error', error.message);
      throw error;
    }
  } finally {
    // Set suppressObserver FIRST so the subsequent observer reconnection
    // doesn't immediately fire from queued DOM changes (scroll, etc).
    suppressObserver = true;
    isTranslating = false;

    // 翻译期间会主动断开观察器，这里统一恢复监听。
    if (contentObserver) {
      contentObserver.disconnect();
    }

    if (!contentObserver) {
      contentObserver = setupContentObserver();
    } else {
      contentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    // Delay clearing suppressObserver so post-translation DOM settle
    // (retry rendering, accessibility re-application) doesn't trigger
    // unnecessary viewport translation cycles.
    setTimeout(() => {
      suppressObserver = false;
    }, 1000);
  }
}

/**
 * Handle restore original text request
 */
async function handleRestoreRequest() {
  suppressObserver = true;
  try {
    // 停止重试监控
    stopRetryMonitoring();

    // Save accessibility state before restore — innerHTML replacement
    // destroys all bionic/sentence-break wrappers, so we must re-apply after.
    const hadBionic = accessibilityFeatures && accessibilityFeatures.state.bionicReading;
    const hadSentenceBreak = accessibilityFeatures && accessibilityFeatures.state.sentenceBreak;

    if (translationMode === TRANSLATION_MODES.CLICK_TO_TRANSLATE) {
      // Restore all individually translated paragraphs
      translationRenderer.restoreOriginalText();

      // Re-apply click-to-translate indicators on stored paragraph groups (with cache support)
      translationRenderer.cleanupClickToTranslateMode();
      translationRenderer.setupClickToTranslateMode(clickableParagraphGroups,
        createClickToTranslateHandler(targetLanguage, sourceLanguage), accessibilityFeatures);

      isTranslated = false;
      currentTextNodes = [];
      currentTranslations = [];

      // Re-apply accessibility features after DOM restoration.
      // Order must match init(): sentence break first, then bionic.
      // _bionicApplied must be reset since restoreOriginalText()
      // replaced innerHTML and destroyed all bionic wrappers.
      if (accessibilityFeatures) {
        console.log('[ND Translate] handleRestoreRequest: reapplying accessibility. hadBionic=%s, hadSentenceBreak=%s',
          hadBionic, hadSentenceBreak);
        if (hadSentenceBreak) {
          accessibilityFeatures.restoreSentenceBreaks();
          accessibilityFeatures.applySentenceBreaks();
        }
        if (hadBionic) {
          console.log('[ND Translate] handleRestoreRequest: resetting _bionicApplied and applying bionic');
          accessibilityFeatures._bionicApplied = false;
          accessibilityFeatures.applyBionicReading();
        }
      } else {
        console.log('[ND Translate] handleRestoreRequest: accessibilityFeatures is null/undefined!');
      }

      notifyStatusChange('restored');
      suppressObserver = false;
      return;
    }

    if (translationMode === 'paragraph-bilingual') {
      translationRenderer.showOriginalOnly();
      isTranslated = true;
    } else {
      translationRenderer.restoreOriginalText();
      isTranslated = false;
      currentTextNodes = [];
      currentTranslations = [];

      // Re-apply accessibility features after DOM restoration.
      // Order must match init(): sentence break first, then bionic.
      if (accessibilityFeatures) {
        console.log('[ND Translate] handleRestoreRequest (replace): reapplying. hadBionic=%s, hadSentenceBreak=%s',
          hadBionic, hadSentenceBreak);
        if (hadSentenceBreak) {
          accessibilityFeatures.restoreSentenceBreaks();
          accessibilityFeatures.applySentenceBreaks();
        }
        if (hadBionic) {
          console.log('[ND Translate] handleRestoreRequest (replace): resetting _bionicApplied and applying bionic');
          accessibilityFeatures._bionicApplied = false;
          accessibilityFeatures.applyBionicReading();
        }
      } else {
        console.log('[ND Translate] handleRestoreRequest (replace): accessibilityFeatures is null!');
      }
    }

    notifyStatusChange('restored');
  } catch (error) {
    throw error;
  } finally {
    suppressObserver = false;
  }
}

/**
 * Handle user cancel request — stop translation loop, keep already-translated content.
 */
function handleCancelRequest() {
  translationCancelled = true;
  isTranslating = false;

  // Remove all "translating" indicators
  document.querySelectorAll('.ot-translating').forEach(el => {
    el.classList.remove('ot-translating');
  });

  // Keep already-translated paragraphs — don't restore
  isTranslated = true;
  notifyStatusChange('translated', {
    totalTranslated: currentTranslations.length,
    mode: translationMode
  });
}

/**
 * Handle toggle bilingual view request (show original only vs show both)
 */
async function handleToggleBilingualView() {
  suppressObserver = true;
  try {
    if (translationMode !== 'paragraph-bilingual') {
      throw new Error('Toggle view only available in bilingual mode');
    }

    // Check if currently showing original only
    const isShowingOriginalOnly = document.querySelector('.ot-paragraph-bilingual.ot-original-only') !== null;

    if (isShowingOriginalOnly) {
      // Currently showing original only, switch to show both
      translationRenderer.showBilingual();
      notifyStatusChange('bilingual-view');
      return { showingOriginalOnly: false };
    } else {
      // Currently showing both, switch to show original only
      translationRenderer.showOriginalOnly();

      // Ensure accessibility features are present on original text.
      // After translation, bionic/sentence-break were re-applied to the
      // original text in bilingual containers; but if anything stripped
      // them (e.g. viewport change handler), re-apply now.
      const hasBionic = accessibilityFeatures && accessibilityFeatures.state.bionicReading;
      const hasSentence = accessibilityFeatures && accessibilityFeatures.state.sentenceBreak;
      if (hasBionic) {
        accessibilityFeatures._bionicApplied = false;
        accessibilityFeatures.applyBionicReading();
      }
      if (hasSentence) {
        accessibilityFeatures.applySentenceBreaks();
      }

      notifyStatusChange('original-only-view');
      return { showingOriginalOnly: true };
    }
  } catch (error) {
    throw error;
  } finally {
    suppressObserver = false;
  }
}

/**
 * Handle translation mode switch request
 */
async function handleSwitchModeRequest(newMode) {
  if (!['replace', 'paragraph-bilingual', 'click-to-translate'].includes(newMode)) {
    throw new Error(`Invalid translation mode: ${newMode}`);
  }

  try {
    // 如果模式相同，无需切换
    if (translationMode === newMode) {
      return;
    }

    const oldMode = translationMode;

    // Clean up click-to-translate handlers when switching away
    if (oldMode === TRANSLATION_MODES.CLICK_TO_TRANSLATE && newMode !== TRANSLATION_MODES.CLICK_TO_TRANSLATE) {
      translationRenderer.cleanupClickToTranslateMode();
      clickableParagraphGroups = [];
    }

    // 更新全局状态
    translationMode = newMode;
    translationRenderer.setMode(newMode);

    // 保存用户偏好
    await chrome.storage.sync.set({ translationMode: newMode });

    // 如果页面已翻译，需要重新渲染为新模式
    if (isTranslated && currentTranslations.length > 0) {
      // 清理当前渲染和提取器缓存
      translationRenderer.restoreOriginalText();
      isTranslated = false;
      currentTextNodes = [];
      currentTranslations = [];
      if (textExtractor) {
        textExtractor.clearCache();
      }

      // 使用缓存重新渲染（翻译结果不变，仅渲染方式变化）
      await handleTranslateRequest({
        translationMode: newMode
      });
    }

    notifyStatusChange('modeChanged', newMode);
  } catch (error) {
    throw error;
  }
}

/**
 * 处理输入框监听器开关请求
 */
async function handleToggleInputFieldListener(enabled) {
  try {
    // 保存用户偏好
    await chrome.storage.sync.set({ inputFieldListenerEnabled: enabled });

    if (enabled) {
      // 启用输入框监听器
      if (!inputFieldListener) {
        await initializeInputFieldListener();
      } else {
        inputFieldListener.enable();
      }
    } else {
      // 禁用输入框监听器
      if (inputFieldListener) {
        inputFieldListener.disable();
      }
    }

    notifyStatusChange('inputFieldListenerToggled', { enabled });
  } catch (error) {
    throw error;
  }
}

/**
 * 处理输入框设置更新请求
 */
async function handleUpdateInputFieldSettings(settings) {
  try {
    // 保存设置到存储
    await chrome.storage.sync.set(settings);

    // 更新输入框监听器设置
    if (inputFieldListener) {
      await inputFieldListener.updateSettings(settings);
    }

    notifyStatusChange('inputFieldSettingsUpdated', settings);
  } catch (error) {
    throw error;
  }
}

/**
 * Set up context menu interactions and link click handling
 */
function setupContextMenu() {
  // Handle text selection for targeted translation
  document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      // Store selection for potential translation
      chrome.runtime.sendMessage({
        action: 'textSelected',
        text: selection.toString().trim()
      });
    }
  });

  // 防止链接点击时进行二次翻译
  setupLinkClickHandler();
}

/**
 * 设置链接点击处理，防止二次翻译
 */
function setupLinkClickHandler() {
  document.addEventListener('click', (event) => {
    const target = event.target;

    // 检查是否点击了链接或链接内的元素
    const link = target.closest('a[href]');
    if (link && link.href) {
      // 标记页面即将跳转，暂停翻译相关操作
      isNavigating = true;

      // 如果当前正在翻译，停止翻译
      if (isTranslating) {
        isTranslating = false;
      }

      // 清理当前翻译状态，为新页面做准备
      setTimeout(() => {
        cleanup();
      }, 100);
    }
  }, true); // 使用捕获阶段确保早期处理
}

/**
 * Notify popup/background about status changes
 */
function notifyStatusChange(status, data = null) {
  try {
    if (toolbar && typeof toolbar._updateTranslationControls === 'function') {
      toolbar._updateTranslationControls();
    }
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }

    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      status: status,
      data: data,
      url: window.location.href
    }).catch((error) => {
      // Handle different types of errors silently
    });
  } catch (error) {
    // Handle errors silently
  }
}

/**
 * Handle dynamic content changes
 */
function setupContentObserver() {
  const observer = translationRenderer.observeContentChanges(() => {
    // 避免在翻译过程中触发重新翻译，或辅助功能正在操作 DOM
    if (isTranslating || suppressObserver) {
      return;
    }

    clearTimeout(window.otContentChangeTimeout);
    window.otContentChangeTimeout = setTimeout(() => {
      if (isTranslated && !isTranslating && !suppressObserver && dynamicTranslationEnabled) {
        // 使用动态翻译而不是完全重新翻译
        handleViewportChange().catch(() => {});
      }
    }, 500); // 减少延迟以提高响应性
  });

  return observer;
}

/**
 * Restore everything — translations, accessibility, reading guide, toolbar.
 * One-click "restore original page" handler.
 */
async function handleRestoreAllRequest() {
  // 1. Cancel any ongoing translation
  translationCancelled = true;
  isTranslating = false;

  // 2. Restore original text
  if (isTranslated) {
    translationRenderer.restoreOriginalText();
    isTranslated = false;
    currentTextNodes = [];
    currentTranslations = [];
  }

  // 3. Stop reading guide
  if (readingGuide) {
    try { readingGuide.stop(); } catch (e) { /* ignore */ }
  }

  // 4. Remove every accessibility style/wrapper instead of applying default
  // spacing values again. "Clear" must leave the page without plugin formatting.
  if (accessibilityFeatures) {
    suppressObserver = true;
    try {
      accessibilityFeatures.cleanup();
      Object.assign(accessibilityFeatures.state, {
        enabled: false,
        dyslexicFont: false,
        chineseFont: false,
        bionicReading: false,
        bionicBoldRatio: 0.5,
        bionicDimNonBold: false,
        sentenceBreak: false,
        lineSpacing: 1.5,
        wordSpacing: 0.08,
        letterSpacing: 0.02,
        fontSize: 1.0
      });
    } catch (e) { /* ignore */ }
    suppressObserver = false;
  }

  // 5. Persist all resets to storage (toolbar stays visible)
  const resetConfig = {
    readingGuideSpeed: 3.0,
    readingGuideMuted: false,
    readingGuideMaskEnabled: true,
    accessibilityEnabled: false,
    dyslexicFont: false,
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
  chrome.storage.sync.set(resetConfig);
}

/**
 * Clean up resources
 */
function cleanup() {
  // Clean up click-to-translate mode
  if (translationMode === TRANSLATION_MODES.CLICK_TO_TRANSLATE) {
    translationRenderer.cleanupClickToTranslateMode();
    clickableParagraphGroups = [];
  }

  // Clean up reading aloud
  if (readingGuide) {
    readingGuide.cleanup();
  }

  // Clean up accessibility features
  if (accessibilityFeatures) {
    accessibilityFeatures.cleanup();
  }

  if (isTranslated) {
    translationRenderer.restoreOriginalText();
  }

  // Clear timeouts
  if (window.otContentChangeTimeout) {
    clearTimeout(window.otContentChangeTimeout);
  }

  // 清理输入框监听器
  if (inputFieldListener) {
    inputFieldListener.cleanup();
  }

  // Reset state
  isTranslating = false;
  isTranslated = false;
  isNavigating = false;
  currentTextNodes = [];
  currentTranslations = [];
}

window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

// 监听页面导航开始
window.addEventListener('beforeunload', () => {
  isNavigating = true;
  isTranslating = false;
});

// 监听历史记录变化（SPA导航）
window.addEventListener('popstate', () => {
  isNavigating = true;
  setTimeout(() => {
    isNavigating = false;
    cleanup();
  }, 500);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initialize();
    setupDynamicTranslation();
  });
} else {
  initialize();
  setupDynamicTranslation();
}

// Set up content observer
let contentObserver = null;
window.addEventListener('load', () => {
  contentObserver = setupContentObserver();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, pause any ongoing operations
  } else {
    // Page is visible again, reset navigation state
    isNavigating = false;

    if (isTranslated) {
      // Verify translation state is still valid
      const stats = translationRenderer.getTranslationStats();
      if (stats.translatedElements === 0 && stats.paragraphBilingualContainers === 0) {
        isTranslated = false;
      }
    }
  }
});

/**
 * Setup dynamic translation listeners
 */
function setupDynamicTranslation() {
  if (!dynamicTranslationEnabled) return;

  // 滚动监听 - 当用户滚动时检查新进入视口的元素
  let scrollTimeout = null;
  window.addEventListener('scroll', () => {
    if (!isTranslated || isTranslating || suppressObserver) return;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      handleViewportChange();
    }, 300);
  }, { passive: true });

  // 窗口大小变化监听
  window.addEventListener('resize', () => {
    if (!isTranslated || isTranslating || suppressObserver) return;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      handleViewportChange();
    }, 500);
  }, { passive: true });
}

/**
 * Handle viewport changes for dynamic translation
 */
async function handleViewportChange() {
  if (!textExtractor || !isTranslated || isTranslating) return;
  if (handlingViewport) return;
  // Never auto-translate in click-to-translate mode — the user picks
  // individual paragraphs to translate manually.
  if (translationMode === TRANSLATION_MODES.CLICK_TO_TRANSLATE) return;

  // Enforce a minimum cooldown between viewport translation passes.
  // Accessibility feature re-application (sentence breaks, bionic reading)
  // changes DOM layout which can fire scroll events — without a cooldown
  // those scroll events re-trigger handleViewportChange in a tight loop.
  const now = Date.now();
  if (now - lastViewportTranslation < 5000) return;
  lastViewportTranslation = now;

  handlingViewport = true;
  suppressObserver = true;

  // Disconnect observer entirely during viewport translation,
  // same as handleTranslateRequest. This prevents any DOM changes
  // (restore/render/re-apply) from queueing observer callbacks.
  if (contentObserver) {
    contentObserver.disconnect();
  }

  try {
    // 查找视口内未翻译的元素
    textExtractor.clearCache();
    const untranslatedGroups = textExtractor.extractParagraphGroups(document.body, {
      translationMode: translationMode,
      prioritizeViewport: true
    }).filter(group => {
      return !group.container.closest('.ot-bilingual-container, .ot-paragraph-bilingual') &&
             !group.container.classList.contains('ot-paragraph-bilingual') &&
             !translationRenderer.translatedElements.has(group.container);
    });

    if (untranslatedGroups.length === 0) return;

    // 只翻译视口内的元素
    const viewportGroups = untranslatedGroups.filter(group => {
      const rect = group.container.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });

    if (viewportGroups.length === 0) return;

    // Only manipulate accessibility features when we actually have content to translate.
    // Restore-reapply cycles cause layout oscillation that triggers repeated scroll
    // events, leading to an infinite loop.
    const hadBionic = accessibilityFeatures && accessibilityFeatures.state.bionicReading;
    const hadSentenceBreak = accessibilityFeatures && accessibilityFeatures.state.sentenceBreak;
    if (accessibilityFeatures) {
      if (hadBionic) accessibilityFeatures.restoreBionicReading();
      if (hadSentenceBreak) accessibilityFeatures.restoreSentenceBreaks();
    }

    // 进行增量翻译
    await performIncrementalTranslation(viewportGroups);

    // Re-apply accessibility after translation (order: sentence break first)
    if (accessibilityFeatures) {
      if (hadSentenceBreak) accessibilityFeatures.applySentenceBreaks();
      if (hadBionic) accessibilityFeatures.applyBionicReading();
    }
  } catch (error) {
    console.warn('Dynamic translation failed:', error);
  } finally {
    handlingViewport = false;

    // Re-connect observer for future dynamic content.
    // Delay resetting suppressObserver so any post-translation DOM
    // settling doesn't immediately trigger another cycle.
    if (contentObserver) {
      contentObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    setTimeout(() => {
      suppressObserver = false;
    }, 1000);
  }
}

/**
 * 处理翻译重试
 */
async function handleTranslationRetries(targetLanguage, sourceLanguage) {
  try {
    const stats = translationRenderer.getTranslationStats();

    if (stats.retryableElements > 0) {
      console.log(`[Content] Found ${stats.retryableElements} elements ready for retry`);

      if (retryTimeoutId) {
        return;
      }

      // 延迟执行一次重试，避免与主翻译流程重叠。
      retryTimeoutId = setTimeout(async () => {
        try {
          const retryResults = await translationRenderer.retryFailedElements(
            translationService,
            targetLanguage,
            sourceLanguage
          );

          if (retryResults.length > 0) {
            const successCount = retryResults.filter(r => r.success).length;
            console.log(`[Content] Retry completed: ${successCount}/${retryResults.length} elements succeeded`);

            // 更新翻译状态
            retryResults.forEach(result => {
              if (result.success && result.result) {
                currentTextNodes.push(result.result);
                currentTranslations.push(result.result.translation);
              }
            });
          }
        } catch (error) {
          console.warn('[Content] Translation retry failed:', error);
        } finally {
          retryTimeoutId = null;
        }
      }, 3000); // 3秒延迟
    }
  } catch (error) {
    console.warn('[Content] Error handling translation retries:', error);
  }
}

/**
 * 启动重试监控
 */
function startRetryMonitoring(targetLanguage, sourceLanguage) {
  // 清除现有的监控
  if (retryCheckInterval) {
    clearInterval(retryCheckInterval);
  }

  // 每3秒检查一次是否有可重试的元素，全部清除后自动停止
  retryCheckInterval = setInterval(async () => {
    try {
      if (isTranslating || isNavigating) return;

      const stats = translationRenderer.getTranslationStats();
      if (stats.retryableElements > 0) {
        console.log(`[Content] Periodic retry check: ${stats.retryableElements} elements ready`);
        await handleTranslationRetries(targetLanguage, sourceLanguage);
      } else {
        // No more retryable elements — stop the interval
        stopRetryMonitoring();
      }
    } catch (error) {
      console.warn('[Content] Error in retry monitoring:', error);
    }
  }, 3000);
}

/**
 * 停止重试监控
 */
function stopRetryMonitoring() {
  if (retryCheckInterval) {
    clearInterval(retryCheckInterval);
    retryCheckInterval = null;
  }

  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

/**
 * Perform incremental translation for new elements
 */
async function performIncrementalTranslation(paragraphGroups) {
  if (isTranslating || paragraphGroups.length === 0) return;

  isTranslating = true;

  try {
    const progressCallback = async (result, completed, total) => {
      if (isNavigating) return;

      // Post-processing glossary correction
      const correctionEnabled = useFreeMode !== false || translationService.config?.enableCorrection !== false;
      if (result.success && translationCorrector && correctionEnabled && result.originalText && result.translation) {
        result.translation = translationCorrector.correct(result.originalText, result.translation);
      }

      translationRenderer.renderSingleResult(result, translationMode);

      if (result.success) {
        currentTextNodes.push(result);
        currentTranslations.push(result.translation);
      }
    };

    const targetLanguage = window.lastTranslationSettings?.targetLanguage || 'zh-CN';
    const sourceLanguage = window.lastTranslationSettings?.sourceLanguage || 'auto';

    // Route through the same translator backend as the main flow
    if (useFreeMode !== false) {
      await freeTranslator.translateParagraphGroups(
        paragraphGroups,
        targetLanguage,
        sourceLanguage,
        progressCallback,
        { translationMode: translationMode }
      );
    } else {
      await translationService.translateParagraphGroups(
        paragraphGroups,
        targetLanguage,
        sourceLanguage,
        progressCallback,
        { translationMode: translationMode }
      );
      // Only retry failed elements for LLM mode (free mode doesn't have per-element failures)
      await handleTranslationRetries(targetLanguage, sourceLanguage);
    }

  } catch (error) {
    console.warn('Incremental translation failed:', error);
  } finally {
    isTranslating = false;
  }
}
