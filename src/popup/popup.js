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
  inputFieldListener: null,

  optionsBtn: null,
  loadingOverlay: null
};

// State management
let currentTab = null;
let isTranslated = false;
let isTranslating = false;

/**
 * Initialize popup
 */
async function initialize() {
  try {
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

    showError('扩展初始化失败');
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
  elements.autoTranslate = document.getElementById('autoTranslate');
  elements.inputFieldListener = document.getElementById('inputFieldListener');

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
      'inputFieldListenerEnabled',
      'useFreeMode',
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
      elements.inputFieldListener.checked = result.inputFieldListenerEnabled !== false; // Default to true

      resolve();
    });
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Translation buttons
  elements.translateBtn.addEventListener('click', handleTranslate);
  elements.restoreBtn.addEventListener('click', handleRestore);

  // Language selection changes
  elements.sourceLanguage.addEventListener('change', saveLanguagePreferences);
  elements.targetLanguage.addEventListener('change', saveLanguagePreferences);

  // Mode changes
  elements.modeReplace.addEventListener('change', handleModeChange);
  elements.modeBilingual.addEventListener('change', handleModeChange);
  elements.modeClickTranslate.addEventListener('change', handleModeChange);

  // Settings checkboxes
  elements.autoTranslate.addEventListener('change', saveGeneralPreferences);
  elements.inputFieldListener.addEventListener('change', handleInputFieldListenerToggle);

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
      setStatus('unavailable', '此页面不可翻译');
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

      updateStatusDisplay(response);
      updateButtonStates();
    } else {
      // Content script might not be ready, but allow translation
      setStatus('ready', '就绪');
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
    setStatus('unavailable', '此页面不可翻译');
    elements.translateBtn.disabled = true;
    elements.restoreBtn.disabled = true;
  } else if (error.message && error.message.includes('Extension context invalidated')) {
    setStatus('error', '扩展需要重新加载');
    elements.translateBtn.disabled = true;
    elements.restoreBtn.disabled = true;
  } else if (error.message && error.message.includes('timeout')) {
    // Content script might be loading, allow translation attempt
    setStatus('ready', '就绪');
    isTranslated = false;
    isTranslating = false;
    updateButtonStates();
  } else {
    // Don't log connection errors as warnings since they're expected

    // Other errors - still allow translation attempt
    setStatus('ready', '就绪');
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
  if (isTranslating) return;

  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error('扩展上下文已失效，请重新加载扩展。');
    }

    isTranslating = true;
    showLoading(true);
    setStatus('translating', '正在翻译页面...');
    updateButtonStates();



    // Check if content script is supported
    if (!isContentScriptSupported(currentTab.url)) {
      throw new Error('Translation not available on this page');
    }

    // 确保模式状态正确同步
    const currentMode = getSelectedMode();

    const response = await sendMessageWithTimeout(currentTab.id, {
      action: 'translate',
      options: {
        sourceLanguage: elements.sourceLanguage.value,
        targetLanguage: elements.targetLanguage.value,
        forceRefresh: isTranslated,
        translationMode: currentMode
      }
    }, 60000);

    if (response && response.success) {
      isTranslated = response.translated;
      isTranslating = false;
      setStatus('translated', '页面翻译完成');
      updateButtonStates();

      // Close popup after successful translation
      setTimeout(() => {
        window.close();
      }, 1000);
    } else {
      throw new Error(response?.error || '翻译失败');
    }
  } catch (error) {
    isTranslating = false;

    // Use errorHandler if available
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'popup-translation', {
        logToConsole: true,
        suppressNotification: true
      });
    }

    // Provide more specific error messages
    let errorMessage = error.message || '翻译失败';
    if (error.message && error.message.includes('Extension context invalidated')) {
      errorMessage = '扩展需要重新加载，请重新加载扩展后重试。';
    } else if (error.message && error.message.includes('Receiving end does not exist')) {
      errorMessage = '内容脚本不可用，请刷新页面后重试。';
    }

    setStatus('error', errorMessage);
    showError(errorMessage);
    updateButtonStates();
  } finally {
    showLoading(false);
  }
}

/**
 * Handle restore button click
 */
async function handleRestore() {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error('扩展上下文已失效，请重新加载扩展。');
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
          setStatus('original-only', '正在显示原文');
          elements.restoreBtn.textContent = '显示翻译';
        } else {
          setStatus('translated', '正在显示双语视图');
          elements.restoreBtn.textContent = '仅显示原文';
        }
      } else {
        throw new Error(response?.error || '切换视图失败');
      }
    } else {
      // In replace mode, restore original text completely
      setStatus('restoring', '正在恢复原文...');

      const response = await sendMessageWithTimeout(currentTab.id, {
        action: 'restore'
      }, 10000);

      if (response && response.success) {
        isTranslated = false;
        isTranslating = false;
        setStatus('restored', '原文已恢复');
        updateButtonStates();

        // Close popup after successful restore
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        throw new Error(response?.error || '恢复原文失败');
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
    let errorMessage = error.message || '恢复原文失败';
    if (error.message && error.message.includes('Extension context invalidated')) {
      errorMessage = '扩展需要重新加载，请重新加载扩展后重试。';
    } else if (error.message && error.message.includes('Receiving end does not exist')) {
      errorMessage = '内容脚本不可用，请刷新页面后重试。';
    }

    setStatus('error', errorMessage);
    showError(errorMessage);
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
          setStatus('translated', `已切换至${mode === TRANSLATION_MODES.REPLACE ? '替换' : '双语'}模式`);
        } else {
          setStatus('error', '切换模式失败');
        }
      } catch (error) {
        setStatus('error', '与页面通信失败');
      }
    }
  } catch (error) {
    setStatus('error', '切换模式失败');
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
 * Handle input field listener toggle
 */
async function handleInputFieldListenerToggle() {
  try {
    const enabled = elements.inputFieldListener.checked;

    // Save preference
    await chrome.storage.sync.set({
      inputFieldListenerEnabled: enabled
    });

    // Send message to content script to toggle the listener
    if (currentTab) {
      await chrome.tabs.sendMessage(currentTab.id, {
        action: 'toggleInputFieldListener',
        enabled: enabled
      });
    }
  } catch (error) {
    if (typeof errorHandler !== 'undefined') {
      errorHandler.handle(error, 'popup-input-field-listener-toggle', {
        logToConsole: true,
        suppressNotification: true
      });
    }
  }
}



/**
 * Update status display
 */
function updateStatusDisplay(response) {
  if (response.isTranslating) {
    setStatus('translating', '翻译中...');
  } else if (response.isTranslated) {
    setStatus('translated', '页面已翻译');
  } else {
    setStatus('ready', '就绪');
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
  elements.translateBtn.disabled = isTranslating;
  elements.restoreBtn.disabled = !isTranslated || isTranslating;

  if (isTranslating) {
    elements.translateBtn.textContent = '翻译中...';
  } else {
    elements.translateBtn.textContent = '翻译页面';
  }

  // Update restore button text based on mode
  if (isTranslated && !isTranslating) {
    const mode = getSelectedMode();
    if (mode === TRANSLATION_MODES.BILINGUAL) {
      elements.restoreBtn.textContent = '仅显示原文';
    } else {
      elements.restoreBtn.textContent = '恢复原文';
    }
  } else {
    elements.restoreBtn.textContent = '恢复原文';
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
