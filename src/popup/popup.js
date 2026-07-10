/**
 * Popup script for Open Translate extension
 * Handles user interactions and communication with content/background scripts
 */

// DOM elements
const elements = {
  statusIndicator: null,
  statusText: null,
  sourceLanguage: null,
  targetLanguage: null,
  modeReplace: null,
  modeBilingual: null,
  translateBtn: null,
  restoreBtn: null,
  autoTranslate: null,
  optionsBtn: null,
  loadingOverlay: null
};

// State management
let currentTab = null;
let isTranslated = false;
let isTranslating = false;
let hasCachedTranslations = false;
let translationCancelled = false;
/**
 * Initialize popup
 */
async function initialize() {
  try {
    await I18n.init();
    I18n.localizePage();

    // Get DOM elements
    initializeElements();

    // Get current tab
    currentTab = await getCurrentTab();

    // Load user preferences
    await loadPreferences();

    // Set up event listeners
    setupEventListeners();

    // Update UI based on current state
    await updateUIState();

  } catch (error) {

    // Use errorHandler if available, otherwise fallback to simple error display
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'popup-initialization', {
        logToConsole: true,
        suppressNotification: true
      });
    }

    showError(I18n.getMessage('popup_init_failed') || '扩展初始化失败');
  }
}

/**
 * Get DOM elements
 */
function initializeElements() {
  elements.statusIndicator = document.getElementById('statusIndicator');
  elements.statusText = document.getElementById('statusText');
  elements.sourceLanguage = document.getElementById('sourceLanguage');
  elements.targetLanguage = document.getElementById('targetLanguage');
  elements.modeReplace = document.getElementById('modeReplace');
  elements.modeBilingual = document.getElementById('modeBilingual');
  elements.modeClickTranslate = document.getElementById('modeClickTranslate');
  elements.translateBtn = document.getElementById('translateBtn');
  elements.restoreBtn = document.getElementById('restoreBtn');
  elements.restoreAllBtn = document.getElementById('restoreAllBtn');
  elements.autoTranslate = document.getElementById('autoTranslate');
  elements.toolbarVisible = document.getElementById('toolbarVisible');

  elements.optionsBtn = document.getElementById('optionsBtn');
  elements.freeLabel = document.getElementById('freeLabel');
  elements.llmLabel = document.getElementById('llmLabel');
  elements.useLLM = document.getElementById('useLLM');
  elements.loadingOverlay = document.getElementById('loadingOverlay');
}

/**
 * Get the currently selected translation mode from radio buttons
 */
function getSelectedMode() {
  if (elements.modeReplace.checked) return TRANSLATION_MODES.REPLACE;
  if (elements.modeBilingual.checked) return TRANSLATION_MODES.BILINGUAL;
  if (elements.modeClickTranslate && elements.modeClickTranslate.checked) return TRANSLATION_MODES.CLICK_TO_TRANSLATE;
  return TRANSLATION_MODES.REPLACE;
}

/**
 * Get current active tab
 */
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Load user preferences from storage
 */
async function loadPreferences() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([
      'sourceLanguage',
      'targetLanguage',
      'translationMode',
      'autoTranslate',
      'useFreeMode',
      'toolbarVisible',
      'translationConfig'
    ], (result) => {
      // Set engine toggle state
      const hasApiKey = result.translationConfig && result.translationConfig.apiKey;
      const useFreeMode = hasApiKey
        ? (result.useFreeMode !== undefined ? result.useFreeMode : true)
        : true;

      elements.useLLM.checked = !useFreeMode;
      elements.useLLM.disabled = !hasApiKey;
      elements.freeLabel.classList.toggle('active', useFreeMode);
      elements.llmLabel.classList.toggle('active', !useFreeMode);
      elements.llmLabel.classList.toggle('disabled', !hasApiKey);

      elements.toolbarVisible.checked = result.toolbarVisible === true;

      // Set language selections
      elements.sourceLanguage.value = result.sourceLanguage || 'auto';
      elements.targetLanguage.value = result.targetLanguage || 'zh-CN';

      // Set translation mode - 统一默认为替换模式
      const mode = result.translationMode || TRANSLATION_MODES.REPLACE;
      if (mode === TRANSLATION_MODES.REPLACE) {
        elements.modeReplace.checked = true;
      } else if (mode === TRANSLATION_MODES.BILINGUAL) {
        elements.modeBilingual.checked = true;
      } else if (mode === TRANSLATION_MODES.CLICK_TO_TRANSLATE) {
        elements.modeClickTranslate.checked = true;
      }

      // Set checkboxes
      elements.autoTranslate.checked = result.autoTranslate || false;

      resolve();
    });
  });
}

/**
 * Handle status updates from content script (e.g. auto-translate completing)
 */
function handleStatusUpdate(message) {
  const { status, data } = message;

  switch (status) {
    case 'translating':
      isTranslating = true;
      isTranslated = false;
      if (data && data.progress !== undefined) {
        setStatus('translating', `${I18n.getMessage('popup_translating') || '正在翻译页面...'} ${data.progress}%`);
      } else {
        setStatus('translating', I18n.getMessage('popup_translating') || '正在翻译页面...');
      }
      updateButtonStates();
      break;

    case 'translated':
      isTranslating = false;
      isTranslated = true;
      hasCachedTranslations = true;
      translationCancelled = false;
      setStatus('translated', I18n.getMessage('popup_translated') || '页面翻译完成');
      updateButtonStates();

      // Auto-close popup after translation completes
      setTimeout(() => {
        window.close();
      }, 1000);
      break;

    case 'restored':
      isTranslating = false;
      isTranslated = false;
      translationCancelled = false;
      setStatus('restored', I18n.getMessage('popup_restored') || '原文已恢复');
      updateButtonStates();
      break;

    case 'error':
      isTranslating = false;
      setStatus('error', data || I18n.getMessage('popup_generic_fail') || '翻译失败');
      updateButtonStates();
      break;

  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Listen for status updates from content script (e.g. auto-translate completing)
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (message.action === 'statusUpdate' && sender.tab && sender.tab.id === currentTab?.id) {
      handleStatusUpdate(message);
    }
  });

  // Translation buttons
  elements.translateBtn.addEventListener('click', handleTranslate);
  elements.restoreBtn.addEventListener('click', handleRestore);
  elements.restoreAllBtn.addEventListener('click', handleRestoreAll);

  // Language selection changes
  elements.sourceLanguage.addEventListener('change', saveLanguagePreferences);
  elements.targetLanguage.addEventListener('change', saveLanguagePreferences);

  // Mode changes
  elements.modeReplace.addEventListener('change', handleModeChange);
  elements.modeBilingual.addEventListener('change', handleModeChange);
  elements.modeClickTranslate.addEventListener('change', handleModeChange);

  // Settings checkboxes
  elements.autoTranslate.addEventListener('change', saveGeneralPreferences);

  // Navigation buttons
  elements.optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  // Engine toggle
  elements.useLLM.addEventListener('change', () => {
    const useFreeMode = !elements.useLLM.checked;
    elements.freeLabel.classList.toggle('active', useFreeMode);
    elements.llmLabel.classList.toggle('active', !useFreeMode);
    chrome.storage.sync.set({ useFreeMode });
  });

  // Click labels to toggle engine
  elements.freeLabel.addEventListener('click', () => {
    if (elements.useLLM.checked) {
      elements.useLLM.checked = false;
      elements.useLLM.dispatchEvent(new Event('change'));
    }
  });
  elements.llmLabel.addEventListener('click', () => {
    if (elements.useLLM.disabled) return;
    if (!elements.useLLM.checked) {
      elements.useLLM.checked = true;
      elements.useLLM.dispatchEvent(new Event('change'));
    }
  });

  // Toolbar visibility toggle
  elements.toolbarVisible.addEventListener('change', () => {
    const visible = elements.toolbarVisible.checked;
    chrome.storage.sync.set({ toolbarVisible: visible });
    if (currentTab && currentTab.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'toggleToolbar',
        visible: visible
      }).catch(() => {});
    }
  });

}

/**
 * Update UI state based on current translation status
 */
async function updateUIState() {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error('Extension context invalidated');
    }

    // Check if current tab is valid and supports content scripts
    if (!currentTab || !currentTab.id || !isContentScriptSupported(currentTab.url)) {
      setStatus('unavailable', I18n.getMessage('popup_unavailable') || '此页面不可翻译');
      elements.translateBtn.disabled = true;
      elements.restoreBtn.disabled = true;
      return;
    }

    // Get translation status from content script with timeout
    const response = await sendMessageWithTimeout(currentTab.id, {
      action: 'getStatus'
    }, 2000);

    if (response && response.success) {
      isTranslated = response.isTranslated;
      isTranslating = response.isTranslating;
      hasCachedTranslations = response.hasCachedTranslations || false;

      updateStatusDisplay(response);
      updateButtonStates();
    } else {
      // Content script might not be ready, but allow translation
      setStatus('ready', I18n.getMessage('popup_ready') || '就绪');
      isTranslated = false;
      isTranslating = false;
      updateButtonStates();
    }
  } catch (error) {
    handleUIStateError(error);
  }
}

/**
 * Handle errors in UI state update
 */
function handleUIStateError(error) {
  // Don't log "Receiving end does not exist" as an error since it's expected on some pages
  if (error.message && error.message.includes('Receiving end does not exist')) {
    setStatus('unavailable', I18n.getMessage('popup_unavailable') || '此页面不可翻译');
    elements.translateBtn.disabled = true;
    elements.restoreBtn.disabled = true;
  } else if (error.message && error.message.includes('Extension context invalidated')) {
    setStatus('error', I18n.getMessage('popup_reload_extension') || '扩展需要重新加载');
    elements.translateBtn.disabled = true;
    elements.restoreBtn.disabled = true;
  } else if (error.message && error.message.includes('timeout')) {
    // Content script might be loading, allow translation attempt
    setStatus('ready', I18n.getMessage('popup_ready') || '就绪');
    isTranslated = false;
    isTranslating = false;
    updateButtonStates();
  } else {
    // Don't log connection errors as warnings since they're expected

    // Other errors - still allow translation attempt
    setStatus('ready', I18n.getMessage('popup_ready') || '就绪');
    isTranslated = false;
    isTranslating = false;
    updateButtonStates();
  }
}



/**
 * Send message with timeout to avoid hanging
 */
async function sendMessageWithTimeout(tabId, message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Message timeout'));
    }, timeoutMs);

    chrome.tabs.sendMessage(tabId, message, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Handle translate button click
 */
async function handleTranslate() {
  // If already translating, this click means "cancel"
  if (isTranslating) {
    await handleCancelTranslation();
    return;
  }

  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error(I18n.getMessage('popup_context_invalidated') || '扩展上下文已失效，请重新加载扩展。');
    }

    if (!isContentScriptSupported(currentTab.url)) {
      throw new Error('Translation not available on this page');
    }

    // Translation settings may have changed since the previous run. A new
    // translate action must apply the currently selected languages/mode rather
    // than merely restoring the old translation.

    isTranslating = true;
    setStatus('translating', I18n.getMessage('popup_translating') || '正在翻译页面...');
    updateButtonStates();

    // 确保模式状态正确同步
    const currentMode = getSelectedMode();

    const response = await sendMessageWithTimeout(currentTab.id, {
      action: 'translate',
      options: {
        sourceLanguage: elements.sourceLanguage.value,
        targetLanguage: elements.targetLanguage.value,
        translationMode: currentMode,
        forceRefresh: isTranslated
      }
    }, 300000);

    if (response && response.success) {
      isTranslated = response.translated;
      isTranslating = false;
      hasCachedTranslations = true; // Translation populated cache
      if (translationCancelled) {
        setStatus('translated', I18n.getMessage('popup_translation_paused') || '翻译已暂停');
      } else {
        setStatus('translated', I18n.getMessage('popup_translated') || '页面翻译完成');
      }
      updateButtonStates();

      // Close popup after successful translation (not on pause)
      if (!translationCancelled) {
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } else {
      throw new Error(response?.error || I18n.getMessage('popup_generic_fail') || '翻译失败');
    }
  } catch (error) {
    // If user paused, don't show error
    if (translationCancelled) {
      isTranslating = false;
      updateButtonStates();
      return;
    }

    isTranslating = false;

    // Use errorHandler if available
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'popup-translation', {
        logToConsole: true,
        suppressNotification: true
      });
    }

    // Provide more specific error messages
    let errorMessage = error.message || I18n.getMessage('popup_generic_fail') || '翻译失败';
    if (error.message && error.message.includes('Extension context invalidated')) {
      errorMessage = I18n.getMessage('popup_context_invalidated') || '扩展上下文已失效，请重新加载扩展后重试。';
    } else if (error.message && error.message.includes('Receiving end does not exist')) {
      errorMessage = I18n.getMessage('popup_script_unavailable') || '内容脚本不可用，请刷新页面后重试。';
    }

    setStatus('error', errorMessage);
    showError(errorMessage);
    updateButtonStates();
  } finally {
    showLoading(false);
  }
}

/**
 * Cancel an ongoing translation.
 */
/**
 * Pause an ongoing translation — stop the loop, keep already-translated content.
 */
async function handleCancelTranslation() {
  translationCancelled = true;
  setStatus('translating', I18n.getMessage('popup_pausing') || '正在暂停...');
  try {
    await sendMessageWithTimeout(currentTab.id, {
      action: 'cancel'
    }, 3000);
  } catch (e) {
    // Content script may not respond, that's OK
  }
  // The translate response handler will update the UI with the final state
}

/**
 * Handle restore button click
 */
async function handleRestore() {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error(I18n.getMessage('popup_context_invalidated') || '扩展上下文已失效，请重新加载扩展。');
    }

    // Check if content script is supported
    if (!isContentScriptSupported(currentTab.url)) {
      throw new Error('Restore not available on this page');
    }

    showLoading(true);

    // Check current mode to determine restore behavior
    const mode = getSelectedMode();

    if (mode === TRANSLATION_MODES.BILINGUAL) {
      // In bilingual mode, toggle between showing original only and showing both
      const response = await sendMessageWithTimeout(currentTab.id, {
        action: 'toggleBilingualView'
      }, 10000);

      if (response && response.success) {
        if (response.showingOriginalOnly) {
          setStatus('original-only', I18n.getMessage('popup_original_only') || '正在显示原文');
          elements.restoreBtn.textContent = I18n.getMessage('popup_show_translation') || '显示翻译';
        } else {
          setStatus('translated', I18n.getMessage('popup_translated') || '正在显示双语视图');
          elements.restoreBtn.textContent = I18n.getMessage('popup_original_only') || '仅显示原文';
        }
      } else {
        throw new Error(response?.error || I18n.getMessage('popup_mode_switch_failed') || '切换视图失败');
      }
    } else {
      // In replace mode, toggle between showing original and showing translation
      if (!isTranslated && hasCachedTranslations) {
        // Currently showing original — re-apply cached translation
        await handleTranslate();
        return;
      }

      // Restore original text
      setStatus('restoring', I18n.getMessage('popup_restoring') || '正在恢复原文...');

      const response = await sendMessageWithTimeout(currentTab.id, {
        action: 'restore'
      }, 10000);

      if (response && response.success) {
        isTranslated = false;
        isTranslating = false;
        setStatus('restored', I18n.getMessage('popup_restored') || '原文已恢复');
        updateButtonStates();
      } else {
        throw new Error(response?.error || I18n.getMessage('popup_restore_fail') || '恢复原文失败');
      }
    }

  } catch (error) {
    isTranslating = false;

    // Use errorHandler if available
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'popup-restore', {
        logToConsole: true,
        suppressNotification: true
      });
    }

    // Provide more specific error messages
    let errorMessage = error.message || I18n.getMessage('popup_restore_fail') || '恢复原文失败';
    if (error.message && error.message.includes('Extension context invalidated')) {
      errorMessage = I18n.getMessage('popup_context_invalidated') || '扩展上下文已失效，请重新加载扩展后重试。';
    } else if (error.message && error.message.includes('Receiving end does not exist')) {
      errorMessage = I18n.getMessage('popup_script_unavailable') || '内容脚本不可用，请刷新页面后重试。';
    }

    setStatus('error', errorMessage);
    showError(errorMessage);
    updateButtonStates();
  } finally {
    showLoading(false);
  }
}

/**
 * Handle restore-all button click — remove all modifications and restore original page.
 */
async function handleRestoreAll() {
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error(I18n.getMessage('popup_context_invalidated') || '扩展上下文已失效，请重新加载扩展。');
    }

    if (!isContentScriptSupported(currentTab.url)) {
      throw new Error(I18n.getMessage('popup_page_not_supported') || '此页面不支持此操作');
    }

    showLoading(true);
    setStatus('restoring', I18n.getMessage('popup_restoring_webpage') || '正在恢复原网页...');

    const response = await sendMessageWithTimeout(currentTab.id, {
      action: 'restoreAll'
    }, 10000);

    if (response && response.success) {
      isTranslated = false;
      isTranslating = false;
      hasCachedTranslations = false;
      translationCancelled = false;
      elements.toolbarVisible.checked = false;
      setStatus('restored', I18n.getMessage('popup_webpage_restored') || '已恢复原网页');
      updateButtonStates();
      setTimeout(() => window.close(), 1000);
    } else {
      throw new Error(response?.error || I18n.getMessage('popup_restore_webpage_fail') || '恢复失败');
    }
  } catch (error) {
    setStatus('error', error.message || I18n.getMessage('popup_restore_webpage_fail') || '恢复原网页失败');
    updateButtonStates();
  } finally {
    showLoading(false);
  }
}

/**
 * Handle translation mode change
 */
async function handleModeChange() {
  const mode = getSelectedMode();

  try {
    // 保存用户偏好
    await chrome.storage.sync.set({ translationMode: mode });

    // 立即更新按钮状态
    updateButtonStates();

    // 如果页面已翻译且支持内容脚本，发送模式切换消息
    if (isTranslated && isContentScriptSupported(currentTab.url)) {
      try {
        const response = await sendMessageWithTimeout(currentTab.id, {
          action: 'switchMode',
          mode: mode
        }, 5000);

        if (response && response.success) {
          // 更新状态显示
          const switchKey = mode === TRANSLATION_MODES.REPLACE ? 'popup_switched_replace' : 'popup_switched_bilingual';
          const switchFallback = mode === TRANSLATION_MODES.REPLACE ? '已切换至替换模式' : '已切换至双语模式';
          setStatus('translated', I18n.getMessage(switchKey) || switchFallback);
        } else {
          setStatus('error', I18n.getMessage('popup_mode_switch_failed') || '切换模式失败');
        }
      } catch (error) {
        setStatus('error', I18n.getMessage('popup_comm_failed') || '与页面通信失败');
      }
    }
  } catch (error) {
    setStatus('error', I18n.getMessage('popup_mode_switch_failed') || '切换模式失败');
  }
}

/**
 * Save language preferences
 */
async function saveLanguagePreferences() {
  await chrome.storage.sync.set({
    sourceLanguage: elements.sourceLanguage.value,
    targetLanguage: elements.targetLanguage.value
  });
}

/**
 * Save general preferences
 */
async function saveGeneralPreferences() {
  await chrome.storage.sync.set({
    autoTranslate: elements.autoTranslate.checked
  });
}

/**
 * Update status display
 */
function updateStatusDisplay(response) {
  if (response.isTranslating) {
    setStatus('translating', I18n.getMessage('popup_translating') || '翻译中...');
  } else if (response.isTranslated) {
    setStatus('translated', I18n.getMessage('popup_translated') || '页面已翻译');
  } else {
    setStatus('ready', I18n.getMessage('popup_ready') || '就绪');
  }
}

/**
 * Set status indicator
 */
function setStatus(type, message) {
  elements.statusText.textContent = message;
  elements.statusIndicator.className = `status-indicator ${type}`;
}

/**
 * Update button states
 */
function updateButtonStates() {
  elements.translateBtn.disabled = false;

  if (isTranslating) {
    elements.translateBtn.textContent = I18n.getMessage('popup_pause_translation') || '暂停翻译';
    elements.translateBtn.classList.add('cancel-btn');
    elements.restoreBtn.disabled = true;
    elements.restoreBtn.textContent = I18n.getMessage('popup_restore_original') || '恢复原文';
  } else if (!isTranslated && hasCachedTranslations) {
    elements.translateBtn.textContent = I18n.getMessage('popup_retranslate') || '重新翻译';
    elements.translateBtn.classList.remove('cancel-btn');
    elements.restoreBtn.disabled = false;
    elements.restoreBtn.textContent = I18n.getMessage('popup_show_translation') || '显示译文';
  } else if (isTranslated) {
    elements.translateBtn.textContent = I18n.getMessage('popup_retranslate') || '重新翻译';
    elements.translateBtn.classList.remove('cancel-btn');
    elements.restoreBtn.disabled = false;
    const mode = getSelectedMode();
    if (mode === TRANSLATION_MODES.BILINGUAL) {
      elements.restoreBtn.textContent = I18n.getMessage('popup_original_only') || '仅显示原文';
    } else {
      elements.restoreBtn.textContent = I18n.getMessage('popup_restore_original') || '恢复原文';
    }
  } else {
    elements.translateBtn.textContent = I18n.getMessage('popup_translate_page') || '翻译页面';
    elements.translateBtn.classList.remove('cancel-btn');
    elements.restoreBtn.disabled = true;
    elements.restoreBtn.textContent = I18n.getMessage('popup_restore_original') || '恢复原文';
  }
}

/**
 * Show/hide loading overlay
 */
function showLoading(show) {
  if (show) {
    elements.loadingOverlay.classList.remove('hidden');
  } else {
    elements.loadingOverlay.classList.add('hidden');
  }
}

/**
 * Show error message
 */
function showError(message) {
  // Simple error display - could be enhanced with toast notifications
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
