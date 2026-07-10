/**
 * Options page script for Open Translate extension
 * Handles settings management and user preferences
 */

// DOM elements
const elements = {};

/**
 * Initialize options page
 */
async function initialize() {
  try {
    // Get DOM elements
    initializeElements();

    // Load current settings
    await loadSettings();

    // Initialize models if needed
    await initializeModelsIfNeeded();

    // Set up event listeners
    setupEventListeners();
  } catch (error) {
    errorHandler.handle(error, 'options-initialize');
    showStatusMessage(ERROR_MESSAGES.TRANSLATION_FAILED, 'error');
  }
}

/**
 * Initialize models if needed (first time setup)
 */
async function initializeModelsIfNeeded() {
  try {
    const apiUrl = elements.apiUrl.value.trim();
    const apiKey = elements.apiKey.value.trim();

    // Check if we have valid API configuration
    if (!apiUrl || !apiKey) {
      return;
    }

    // Check if models are already cached and valid
    const isCacheValid = await configManager.isModelCacheValid(apiUrl);
    if (isCacheValid) {
      return;
    }

    // Fetch and cache models in background
    try {
      const models = await fetchAvailableModels(apiUrl, apiKey);
      await configManager.saveAvailableModels(models, apiUrl);

      // Reload models in UI
      await loadAvailableModels();
    } catch (error) {
      console.warn('Failed to initialize models:', error);
    }

  } catch (error) {
    console.warn('Model initialization error:', error);
  }
}

/**
 * Get DOM elements
 */
function initializeElements() {
  // API Configuration
  elements.apiUrl = document.getElementById('apiUrl');
  elements.apiKey = document.getElementById('apiKey');
  elements.toggleApiKey = document.getElementById('toggleApiKey');
  elements.model = document.getElementById('model');
  elements.customModel = document.getElementById('customModel');
  elements.refreshModels = document.getElementById('refreshModels');
  elements.modelPriorityIndicator = document.getElementById('modelPriorityIndicator');
  elements.modelHelp = document.getElementById('modelHelp');
  elements.temperature = document.getElementById('temperature');
  elements.temperatureValue = document.getElementById('temperatureValue');
  elements.maxTokens = document.getElementById('maxTokens');
  elements.timeout = document.getElementById('timeout');
  elements.testConnection = document.getElementById('testConnection');
  elements.testResult = document.getElementById('testResult');
  

  // Advanced Settings
  elements.smartContentEnabled = document.getElementById('smartContentEnabled');
  elements.inputFieldListenerEnabled = document.getElementById('inputFieldListenerEnabled');
  elements.inputFieldTriggerKey = document.getElementById('inputFieldTriggerKey');
  elements.inputFieldCtrlKey = document.getElementById('inputFieldCtrlKey');
  elements.inputFieldAltKey = document.getElementById('inputFieldAltKey');
  elements.inputFieldShiftKey = document.getElementById('inputFieldShiftKey');
  elements.autoDetectPageLanguage = document.getElementById('autoDetectPageLanguage');
  elements.defaultTargetLanguage = document.getElementById('defaultTargetLanguage');
  elements.excludeSelectors = document.getElementById('excludeSelectors');
  elements.batchSize = document.getElementById('batchSize');
  elements.retryAttempts = document.getElementById('retryAttempts');

  // Batch Merge Settings
  elements.enableMerge = document.getElementById('enableMerge');
  elements.shortTextThreshold = document.getElementById('shortTextThreshold');
  elements.maxMergedLength = document.getElementById('maxMergedLength');
  elements.maxMergedCount = document.getElementById('maxMergedCount');

  // Smart Batching Settings
  elements.enableSmartBatching = document.getElementById('enableSmartBatching');

  // Glossary Settings
  elements.enableGlossary = document.getElementById('enableGlossary');
  elements.enableCorrection = document.getElementById('enableCorrection');

  // Accessibility Settings
  elements.dyslexicFont = document.getElementById('dyslexicFont');
  elements.chineseFont = document.getElementById('chineseFont');
  elements.bionicReading = document.getElementById('bionicReading');
  elements.bionicSubSettings = document.getElementById('bionicSubSettings');
  elements.bionicBoldRatio = document.getElementById('bionicBoldRatio');
  elements.bionicBoldRatioValue = document.getElementById('bionicBoldRatioValue');
  elements.bionicDimNonBold = document.getElementById('bionicDimNonBold');
  elements.sentenceBreak = document.getElementById('sentenceBreak');
  elements.lineSpacing = document.getElementById('lineSpacing');
  elements.lineSpacingValue = document.getElementById('lineSpacingValue');
  elements.wordSpacing = document.getElementById('wordSpacing');
  elements.wordSpacingValue = document.getElementById('wordSpacingValue');
  elements.fontSize = document.getElementById('fontSize');
  elements.fontSizeValue = document.getElementById('fontSizeValue');
  elements.letterSpacing = document.getElementById('letterSpacing');
  elements.letterSpacingValue = document.getElementById('letterSpacingValue');
  elements.resetSpacing = document.getElementById('resetSpacing');
  elements.accessibilityStatus = document.getElementById('accessibilityStatus');
  elements.clearAccessibilityFormats = document.getElementById('clearAccessibilityFormats');
  elements.previewBox = document.getElementById('previewBox');

  // Reading Guide Settings
  elements.readingGuideSpeed = document.getElementById('readingGuideSpeed');
  elements.readingGuideSpeedValue = document.getElementById('readingGuideSpeedValue');
  elements.readingGuideMuted = document.getElementById('readingGuideMuted');
  elements.readingGuideMaskEnabled = document.getElementById('readingGuideMaskEnabled');

  // Actions
  elements.saveSettings = document.getElementById('saveSettings');
  elements.resetSettings = document.getElementById('resetSettings');
  elements.statusMessage = document.getElementById('statusMessage');
}

/**
 * Load current settings from storage
 */
async function loadSettings() {
  try {
    const config = await configManager.loadConfig();

    // API Configuration
    const translationConfig = config.translationConfig;
    elements.apiUrl.value = translationConfig.apiUrl;
    elements.apiKey.value = translationConfig.apiKey || '';

    // Load models first, then set the selected model
    await loadAvailableModels();
    elements.model.value = translationConfig.model;

    elements.customModel.value = translationConfig.customModel || '';
    elements.temperature.value = translationConfig.temperature;
    elements.temperatureValue.textContent = elements.temperature.value;
    elements.maxTokens.value = translationConfig.maxTokens;
    elements.timeout.value = translationConfig.timeout / 1000;



    // Advanced Settings
    elements.smartContentEnabled.checked = config.smartContentEnabled !== false; // Default to true
    elements.inputFieldListenerEnabled.checked = config.inputFieldListenerEnabled !== false; // Default to true

    // Input Field Settings
    elements.inputFieldTriggerKey.value = config.inputFieldTriggerKey || 'F2';
    elements.inputFieldCtrlKey.checked = config.inputFieldCtrlKey || false;
    elements.inputFieldAltKey.checked = config.inputFieldAltKey || false;
    elements.inputFieldShiftKey.checked = config.inputFieldShiftKey || false;
    elements.autoDetectPageLanguage.checked = config.autoDetectPageLanguage !== false; // Default to true
    elements.defaultTargetLanguage.value = config.defaultTargetLanguage || 'en';

    const defaultSelectors = DOM_SELECTORS.EXCLUDE_DEFAULT.join('\n');
    const userSelectors = config.excludeSelectors || '';

    let displayContent = `# 默认排除选择器（内置）：\n${defaultSelectors}\n\n# 用户自定义排除选择器：`;
    if (userSelectors) {
      displayContent += `\n${userSelectors}`;
    }

    elements.excludeSelectors.value = displayContent;
    elements.batchSize.value = config.batchSize;
    elements.retryAttempts.value = config.retryAttempts;

    if (elements.enableMerge) {
      elements.enableMerge.checked = config.enableMerge !== false; // Default to true
    }
    if (elements.shortTextThreshold) {
      elements.shortTextThreshold.value = config.shortTextThreshold || 50;
    }
    if (elements.maxMergedLength) {
      elements.maxMergedLength.value = config.maxMergedLength || 1000;
    }
    if (elements.maxMergedCount) {
      elements.maxMergedCount.value = config.maxMergedCount || 10;
    }

    // Smart Batching Settings
    if (elements.enableSmartBatching) {
      elements.enableSmartBatching.checked = config.enableSmartBatching !== false; // Default to true
    }

    // Glossary Settings
    if (elements.enableGlossary) {
      elements.enableGlossary.checked = config.enableGlossary !== false; // Default to true
    }
    if (elements.enableCorrection) {
      elements.enableCorrection.checked = config.enableCorrection !== false; // Default to true
    }

    // Accessibility Settings
    elements.dyslexicFont.checked = config.dyslexicFont === true;
    elements.chineseFont.checked = config.chineseFont === true;
    elements.bionicReading.checked = config.bionicReading === true;
    elements.bionicBoldRatio.value = config.bionicBoldRatio || 0.5;
    elements.bionicBoldRatioValue.textContent = Math.round((config.bionicBoldRatio || 0.5) * 100) + '%';
    elements.bionicDimNonBold.checked = config.bionicDimNonBold === true;
    syncBionicSubSettings();
    updateAccessibilityStatus(config.accessibilityEnabled !== false);
    elements.sentenceBreak.checked = config.sentenceBreak === true;
    elements.lineSpacing.value = config.lineSpacing || 1.5;
    elements.lineSpacingValue.textContent = config.lineSpacing || 1.5;
    elements.wordSpacing.value = config.wordSpacing || 0.08;
    elements.wordSpacingValue.textContent = config.wordSpacing || 0.08;
    elements.letterSpacing.value = config.letterSpacing || 0.02;
    elements.letterSpacingValue.textContent = config.letterSpacing || 0.02;
    elements.fontSize.value = config.fontSize || 1.0;
    elements.fontSizeValue.textContent = (config.fontSize || 1.0).toFixed(2) + ' (' + Math.round((config.fontSize || 1.0) * 100) + '%)';

    // Reading Guide Settings
    elements.readingGuideSpeed.value = config.readingGuideSpeed || 3.0;
    elements.readingGuideSpeedValue.textContent = (config.readingGuideSpeed || 3.0).toFixed(1) + 'x';
    elements.readingGuideMuted.checked = config.readingGuideMuted === true;
    elements.readingGuideMaskEnabled.checked = config.readingGuideMaskEnabled !== false; // Default to true

    // Update model selection UI
    updateModelSelectionUI();

    // Apply current settings to preview
    updatePreview();
  } catch (error) {
    errorHandler.handle(error, 'options-load-settings');
    showStatusMessage(ERROR_MESSAGES.TRANSLATION_FAILED, 'error');
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // API Key toggle
  elements.toggleApiKey.addEventListener('click', toggleApiKeyVisibility);
  
  // Temperature slider
  elements.temperature.addEventListener('input', (e) => {
    elements.temperatureValue.textContent = e.target.value;
  });
  
  // Test connection
  elements.testConnection.addEventListener('click', testApiConnection);

  // Refresh models
  elements.refreshModels.addEventListener('click', refreshAvailableModels);

  // Model selection changes
  elements.model.addEventListener('change', updateModelSelectionUI);
  elements.customModel.addEventListener('input', updateModelSelectionUI);

  // Save settings
  elements.saveSettings.addEventListener('click', saveSettings);
  
  // Reset settings
  elements.resetSettings.addEventListener('click', resetSettings);
  elements.clearAccessibilityFormats.addEventListener('click', clearAccessibilityFormats);

  // Accessibility sliders
  elements.lineSpacing.addEventListener('input', (e) => {
    elements.lineSpacingValue.textContent = e.target.value;
  });
  elements.wordSpacing.addEventListener('input', (e) => {
    elements.wordSpacingValue.textContent = e.target.value;
  });
  elements.letterSpacing.addEventListener('input', (e) => {
    elements.letterSpacingValue.textContent = e.target.value;
  });

  // Reset spacing to defaults
  elements.resetSpacing.addEventListener('click', () => {
    elements.lineSpacing.value = 1.5;
    elements.lineSpacingValue.textContent = '1.5';
    elements.wordSpacing.value = 0.08;
    elements.wordSpacingValue.textContent = '0.08';
    elements.fontSize.value = 1.0;
    elements.fontSizeValue.textContent = '1.00 (100%)';
    elements.letterSpacing.value = 0.02;
    elements.letterSpacingValue.textContent = '0.02';
    elements.bionicBoldRatio.value = 0.5;
    elements.bionicBoldRatioValue.textContent = '50%';
    elements.bionicDimNonBold.checked = false;
    updatePreview();
  });

  // Reading Guide settings
  elements.readingGuideSpeed.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    elements.readingGuideSpeedValue.textContent = speed.toFixed(1) + 'x';
    if (speed > 3.0 && !elements.readingGuideMuted.checked) {
      elements.readingGuideMuted.checked = true;
    }
  });
  elements.readingGuideMuted.addEventListener('change', () => {
    const speed = parseFloat(elements.readingGuideSpeed.value);
    if (!elements.readingGuideMuted.checked && speed > 3.0) {
      elements.readingGuideMuted.checked = true;
    }
  });

  // Preview live update
  elements.dyslexicFont.addEventListener('change', updatePreview);
  elements.chineseFont.addEventListener('change', updatePreview);
  elements.bionicReading.addEventListener('change', () => {
    syncBionicSubSettings();
    updatePreview();
  });
  elements.sentenceBreak.addEventListener('change', updatePreview);
  elements.bionicBoldRatio.addEventListener('input', () => {
    const val = parseFloat(elements.bionicBoldRatio.value);
    elements.bionicBoldRatioValue.textContent = Math.round(val * 100) + '%';
    updatePreview();
  });
  elements.bionicDimNonBold.addEventListener('change', updatePreview);
  elements.lineSpacing.addEventListener('input', () => {
    elements.lineSpacingValue.textContent = elements.lineSpacing.value;
    updatePreview();
  });
  elements.wordSpacing.addEventListener('input', () => {
    elements.wordSpacingValue.textContent = elements.wordSpacing.value;
    updatePreview();
  });
  elements.letterSpacing.addEventListener('input', () => {
    elements.letterSpacingValue.textContent = elements.letterSpacing.value;
    updatePreview();
  });
  elements.fontSize.addEventListener('input', () => {
    const val = parseFloat(elements.fontSize.value);
    elements.fontSizeValue.textContent = val.toFixed(2) + ' (' + Math.round(val * 100) + '%)';
    updatePreview();
  });

  // Status message close
  const statusClose = elements.statusMessage.querySelector('.status-close');
  statusClose.addEventListener('click', hideStatusMessage);


}

function syncBionicSubSettings() {
  const enabled = elements.bionicReading.checked;
  if (elements.bionicSubSettings) {
    elements.bionicSubSettings.classList.toggle('is-disabled', !enabled);
  }
  for (const control of [elements.bionicBoldRatio, elements.bionicDimNonBold]) {
    if (!control) continue;
    control.disabled = !enabled;
    control.setAttribute('aria-disabled', String(!enabled));
  }
}

function updateAccessibilityStatus(enabled) {
  if (!elements.accessibilityStatus) return;
  elements.accessibilityStatus.classList.toggle('is-cleared', !enabled);
  const title = elements.accessibilityStatus.querySelector('strong');
  const description = elements.accessibilityStatus.querySelector('p');
  if (title) title.textContent = enabled ? '页面格式增强：已开启' : '页面格式增强：已清除';
  if (description) {
    description.textContent = enabled
      ? '保存后会在新页面应用下方的阅读格式设置。'
      : '新页面将保持网站原有格式；调整任一阅读格式并保存即可重新开启。';
  }
}

async function clearAccessibilityFormats() {
  const clearedSettings = {
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
  try {
    await chrome.storage.sync.set(clearedSettings);
    elements.dyslexicFont.checked = false;
    elements.chineseFont.checked = false;
    elements.bionicReading.checked = false;
    elements.bionicDimNonBold.checked = false;
    elements.sentenceBreak.checked = false;
    elements.bionicBoldRatio.value = 0.5;
    elements.bionicBoldRatioValue.textContent = '50%';
    elements.lineSpacing.value = 1.5;
    elements.lineSpacingValue.textContent = '1.5';
    elements.wordSpacing.value = 0.08;
    elements.wordSpacingValue.textContent = '0.08';
    elements.letterSpacing.value = 0.02;
    elements.letterSpacingValue.textContent = '0.02';
    elements.fontSize.value = 1.0;
    elements.fontSizeValue.textContent = '1.00 (100%)';
    syncBionicSubSettings();
    updateAccessibilityStatus(false);
    updatePreview();
    showStatusMessage('已清除阅读格式，新页面将保持原有样式。', 'success');
  } catch (error) {
    errorHandler.handle(error, 'options-clear-accessibility-formats');
    showStatusMessage(ERROR_MESSAGES.TRANSLATION_FAILED, 'error');
  }
}

/**
 * Toggle API key visibility
 */
function toggleApiKeyVisibility() {
  const isPassword = elements.apiKey.type === 'password';
  elements.apiKey.type = isPassword ? 'text' : 'password';
  
  const icon = elements.toggleApiKey.querySelector('svg path');
  if (isPassword) {
    // Show eye-off icon
    icon.setAttribute('d', 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92 1.41-1.41L3.51 1.93 2.1 3.34l2.36 2.36C4.06 6.53 3.5 7.93 3.5 9.5c0 4.39 4 7.5 9 7.5 1.59 0 3.04-.2 4.28-.57l2.92 2.92 1.41-1.41-11.7-11.7zm0 7c-.83 0-1.5-.67-1.5-1.5 0-.39.15-.74.39-1.01l1.12 1.12c-.27.24-.01.39-.01.39z');
  } else {
    // Show eye icon
    icon.setAttribute('d', 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z');
  }
}

/**
 * Collect current API configuration from form
 */
function collectApiConfig() {
  return {
    apiUrl: elements.apiUrl.value.trim(),
    apiKey: elements.apiKey.value.trim(),
    model: elements.model.value,
    customModel: elements.customModel.value.trim(),
    temperature: parseFloat(elements.temperature.value),
    maxTokens: parseInt(elements.maxTokens.value),
    timeout: parseInt(elements.timeout.value) * 1000
  };
}

/**
 * Test API connection
 */
async function testApiConnection() {
  const testBtn = elements.testConnection;
  const testResult = elements.testResult;

  try {
    testBtn.disabled = true;
    testBtn.innerHTML = '<span>测试中...</span>';
    testResult.classList.add('hidden');

    const config = collectApiConfig();

    if (!config.apiUrl || !config.apiKey) {
      throw new ConfigurationError(ERROR_MESSAGES.API_KEY_MISSING);
    }

    // Test with a simple translation request
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'user',
            content: `Translate the following text from English to Simplified Chinese.
Follow these guidelines:
1. Maintain the original meaning and tone
2. Use natural, fluent Chinese that sounds native
3. Only return the translation without any additional text or explanation

Text to translate:
Hello

Translation:`
          }
        ],
        temperature: config.temperature,
        max_tokens: 50
      }),
      signal: AbortSignal.timeout(config.timeout)
    });

    if (!response.ok) {
      const apiError = errorHandler.createAPIError(await response.text(), response.status);
      throw apiError;
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new APIError(ERROR_MESSAGES.INVALID_RESPONSE);
    }

    testResult.className = 'test-result success';
    testResult.textContent = '连接成功！API 工作正常。';
    testResult.classList.remove('hidden');

  } catch (error) {
    errorHandler.handle(error, 'options-test-connection');
    testResult.className = 'test-result error';
    testResult.textContent = `连接失败：${formatError(error)}`;
    testResult.classList.remove('hidden');
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = '测试连接';
  }
}

/**
 * Update model selection UI based on current values
 */
function updateModelSelectionUI() {
  const customModelValue = elements.customModel.value.trim();
  const selectedModel = elements.model.value;

  if (customModelValue) {
    // Custom model has priority
    elements.modelPriorityIndicator.textContent = '（生效中）';
    elements.modelPriorityIndicator.className = 'priority-indicator active';
    elements.customModel.classList.add('active');
    elements.model.classList.add('inactive');
    elements.modelHelp.textContent = `正在使用自定义模型："${customModelValue}"（覆盖下拉选择）`;
  } else {
    // Using dropdown selection
    elements.modelPriorityIndicator.textContent = '（未生效）';
    elements.modelPriorityIndicator.className = 'priority-indicator inactive';
    elements.customModel.classList.remove('active');
    elements.model.classList.remove('inactive');
    elements.modelHelp.textContent = `正在使用所选模型："${selectedModel}"（输入自定义模型名可覆盖）`;
  }
}

/**
 * Load available models from storage or fetch from API
 */
async function loadAvailableModels() {
  const modelSelect = elements.model;
  const currentValue = modelSelect.value;

  try {
    // Try to load from storage first
    const storedModels = await configManager.loadAvailableModels();

    if (storedModels && storedModels.models && storedModels.models.length > 0) {
      populateModelSelect(storedModels.models);

      // Restore selection if it still exists
      if (Array.from(modelSelect.options).some(opt => opt.value === currentValue)) {
        modelSelect.value = currentValue;
      }
      return;
    }

    // If no stored models, try to fetch from API if credentials are available
    const apiUrl = elements.apiUrl.value.trim();
    const apiKey = elements.apiKey.value.trim();

    if (apiUrl && apiKey) {
      const models = await fetchAvailableModels(apiUrl, apiKey);
      await configManager.saveAvailableModels(models, apiUrl);
      populateModelSelect(models);

      // Restore selection if it still exists
      if (Array.from(modelSelect.options).some(opt => opt.value === currentValue)) {
        modelSelect.value = currentValue;
      }
    } else {
      // Show empty state with instruction
      modelSelect.innerHTML = '<option value="">请先配置 API 设置并刷新模型列表</option>';
    }

  } catch (error) {
    console.warn('Failed to load models:', error);
    modelSelect.innerHTML = '<option value="">加载模型列表失败</option>';
  }
}

/**
 * Populate model select with options
 */
function populateModelSelect(models) {
  const modelSelect = elements.model;
  modelSelect.innerHTML = '';

  if (models && models.length > 0) {
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.owned_by ? `${model.name} (${model.owned_by})` : model.name;
      modelSelect.appendChild(option);
    });
  } else {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '无可用模型';
    modelSelect.appendChild(option);
  }
}

/**
 * Fetch available models from API
 */
async function fetchAvailableModels(apiUrl, apiKey) {
  try {
    const baseUrl = apiUrl.replace('/chat/completions', '');
    const modelsUrl = `${baseUrl}/models`;

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const apiError = errorHandler.createAPIError(await response.text(), response.status);
      throw apiError;
    }

    const data = await response.json();

    if (data.data && Array.isArray(data.data)) {
      return data.data.map(model => ({
        id: model.id,
        name: model.id,
        owned_by: model.owned_by || 'unknown'
      }));
    } else {
      throw new APIError(ERROR_MESSAGES.INVALID_RESPONSE);
    }
  } catch (error) {
    errorHandler.handle(error, 'options-fetch-models', { suppressNotification: true });
    throw error;
  }
}

/**
 * Refresh available models from API
 */
async function refreshAvailableModels() {
  const refreshBtn = elements.refreshModels;
  const modelSelect = elements.model;

  try {
    refreshBtn.disabled = true;
    refreshBtn.textContent = '加载中...';

    // Get API configuration for model fetching
    const apiUrl = elements.apiUrl.value.trim();
    const apiKey = elements.apiKey.value.trim();

    if (!apiUrl || !apiKey) {
      throw new ConfigurationError(ERROR_MESSAGES.API_KEY_MISSING);
    }

    // Save current selection
    const currentValue = modelSelect.value;

    // Fetch models directly from API
    const models = await fetchAvailableModels(apiUrl, apiKey);

    // Save models to storage
    await configManager.saveAvailableModels(models, apiUrl);

    // Populate the select with new models
    populateModelSelect(models);

    // Restore selection if it still exists
    if (Array.from(modelSelect.options).some(opt => opt.value === currentValue)) {
      modelSelect.value = currentValue;
    }

    showStatusMessage('模型列表刷新成功！', 'success');

  } catch (error) {
    errorHandler.handle(error, 'options-refresh-models');
    showStatusMessage(`刷新模型失败：${formatError(error)}`, 'error');
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = '刷新模型';
  }
}

/**
 * Extract user-defined selectors from the textarea content
 */
function extractUserSelectors(textareaValue) {
  if (!textareaValue) return '';

  const lines = textareaValue.split('\n');
  const userSelectors = [];
  let inUserSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 检查是否进入用户自定义区域
    if (trimmedLine.startsWith('#') && (trimmedLine.includes('User Additional Selectors') || trimmedLine.includes('用户自定义排除选择器'))) {
      inUserSection = true;
      continue;
    }

    // 跳过空行和其他注释行
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // 只有在用户自定义区域的选择器才会被保存
    if (inUserSection) {
      userSelectors.push(trimmedLine);
    }
  }

  return userSelectors.join('\n').trim();
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  try {
    const settings = {
      translationConfig: collectApiConfig(),
      smartContentEnabled: elements.smartContentEnabled.checked,
      inputFieldListenerEnabled: elements.inputFieldListenerEnabled.checked,
      inputFieldTriggerKey: elements.inputFieldTriggerKey.value,
      inputFieldCtrlKey: elements.inputFieldCtrlKey.checked,
      inputFieldAltKey: elements.inputFieldAltKey.checked,
      inputFieldShiftKey: elements.inputFieldShiftKey.checked,
      autoDetectPageLanguage: elements.autoDetectPageLanguage.checked,
      defaultTargetLanguage: elements.defaultTargetLanguage.value,
      excludeSelectors: extractUserSelectors(elements.excludeSelectors.value),
      batchSize: parseInt(elements.batchSize.value),
      retryAttempts: parseInt(elements.retryAttempts.value),
      enableMerge: elements.enableMerge ? elements.enableMerge.checked : true,
      shortTextThreshold: elements.shortTextThreshold ? parseInt(elements.shortTextThreshold.value) : 50,
      maxMergedLength: elements.maxMergedLength ? parseInt(elements.maxMergedLength.value) : 1000,
      maxMergedCount: elements.maxMergedCount ? parseInt(elements.maxMergedCount.value) : 10,
      // Smart Batching Settings
      enableSmartBatching: elements.enableSmartBatching ? elements.enableSmartBatching.checked : true,
      // Glossary Settings
      enableGlossary: elements.enableGlossary ? elements.enableGlossary.checked : true,
      enableCorrection: elements.enableCorrection ? elements.enableCorrection.checked : true,
      // Accessibility Settings
      accessibilityEnabled: elements.dyslexicFont.checked ||
        elements.chineseFont.checked || elements.bionicReading.checked ||
        elements.bionicDimNonBold.checked || elements.sentenceBreak.checked ||
        parseFloat(elements.lineSpacing.value) !== 1.5 ||
        parseFloat(elements.wordSpacing.value) !== 0.08 ||
        parseFloat(elements.letterSpacing.value) !== 0.02 ||
        parseFloat(elements.fontSize.value) !== 1.0,
      dyslexicFont: elements.dyslexicFont.checked,
      chineseFont: elements.chineseFont.checked,
      bionicReading: elements.bionicReading.checked,
      bionicBoldRatio: parseFloat(elements.bionicBoldRatio.value) || 0.5,
      bionicDimNonBold: elements.bionicDimNonBold.checked,
      sentenceBreak: elements.sentenceBreak.checked,
      lineSpacing: parseFloat(elements.lineSpacing.value) || 1.5,
      wordSpacing: parseFloat(elements.wordSpacing.value) || 0.08,
      letterSpacing: parseFloat(elements.letterSpacing.value) || 0.02,
      fontSize: parseFloat(elements.fontSize.value) || 1.0,
      // Reading Guide Settings
      readingGuideSpeed: parseFloat(elements.readingGuideSpeed.value) || 3.0,
      readingGuideMuted: elements.readingGuideMuted.checked,
      readingGuideMaskEnabled: elements.readingGuideMaskEnabled.checked
    };

    await configManager.saveConfig(settings);
    updateAccessibilityStatus(settings.accessibilityEnabled);
    showStatusMessage('设置保存成功！', 'success');

  } catch (error) {
    errorHandler.handle(error, 'options-save-settings');
    showStatusMessage(ERROR_MESSAGES.TRANSLATION_FAILED, 'error');
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings() {
  if (!confirm('确定要恢复所有设置为默认值吗？此操作不可撤销。')) {
    return;
  }

  try {
    await configManager.resetToDefaults();
    await loadSettings();
    showStatusMessage('设置已恢复为默认值！', 'success');

  } catch (error) {
    errorHandler.handle(error, 'options-reset-settings');
    showStatusMessage(ERROR_MESSAGES.TRANSLATION_FAILED, 'error');
  }
}

/**
 * Show status message
 */
function showStatusMessage(message, type = 'success') {
  const statusMessage = elements.statusMessage;
  const statusText = statusMessage.querySelector('.status-text');

  statusText.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
}

/**
 * Hide status message
 */
function hideStatusMessage() {
  elements.statusMessage.classList.add('hidden');
}



/**
 * Update the preview box with current accessibility settings.
 */
function updatePreview() {
  const box = elements.previewBox;
  if (!box) return;

  const lineSpacing = parseFloat(elements.lineSpacing.value) || 1.5;
  const wordSpacing = parseFloat(elements.wordSpacing.value) || 0.08;
  const letterSpacing = parseFloat(elements.letterSpacing.value) || 0.02;
  const fontSize = parseFloat(elements.fontSize.value) || 1.0;
  const useDyslexic = elements.dyslexicFont.checked;
  const useBionic = elements.bionicReading.checked;
  const useChinese = elements.chineseFont.checked;

  box.style.lineHeight = lineSpacing;
  box.style.wordSpacing = wordSpacing + 'em';
  box.style.letterSpacing = letterSpacing + 'em';
  box.style.fontSize = fontSize !== 1.0 ? (fontSize * 100).toFixed(0) + '%' : '';

  // Manage CDN font links
  const dyslexicLinkId = 'ot-preview-dyslexic-font-link';
  const chineseLinkId = 'ot-preview-chinese-font-link';
  if (useDyslexic) {
    if (!document.getElementById(dyslexicLinkId)) {
      const link = document.createElement('link');
      link.id = dyslexicLinkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic-cdn@0.0.1/dist/OpenDyslexic-Regular.css';
      document.head.appendChild(link);
    }
  } else {
    const link = document.getElementById(dyslexicLinkId);
    if (link) link.remove();
  }
  if (useChinese) {
    if (!document.getElementById(chineseLinkId)) {
      const link = document.createElement('link');
      link.id = chineseLinkId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/lxgwwenkaigbscreen.css';
      document.head.appendChild(link);
    }
  } else {
    const link = document.getElementById(chineseLinkId);
    if (link) link.remove();
  }

  // Build font stack: Latin → OpenDyslexic, CJK → LXGW WenKai (unicode-range), fallback → system
  if (useDyslexic && useChinese) {
    box.style.fontFamily = "'OpenDyslexic', 'LXGW WenKai Screen', 'LXGW WenKai', sans-serif";
  } else if (useDyslexic) {
    box.style.fontFamily = "'OpenDyslexic', sans-serif";
  } else if (useChinese) {
    box.style.fontFamily = "'LXGW WenKai Screen', 'LXGW WenKai', system-ui, -apple-system, sans-serif";
  } else {
    box.style.fontFamily = '';
  }

  // Sentence break must apply before bionic (bionic fragments text nodes)
  restoreBionicPreview();
  restoreSentenceBreakPreview();
  if (elements.sentenceBreak.checked) {
    applySentenceBreakPreview();
  }
  if (useBionic) {
    applyBionicPreview();
  }
}

function applyBionicPreview() {
  const box = elements.previewBox;
  if (!box) return;
  const dimEnabled = elements.bionicDimNonBold && elements.bionicDimNonBold.checked;
  const ratio = parseFloat(elements.bionicBoldRatio.value) || 0.5;

  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) { nodes.push(walker.currentNode); }
  for (const node of nodes) {
    const text = node.textContent;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    const re = /([a-zA-Z]+)/g;
    let match;

    function makeTextSegment(str) {
      if (dimEnabled && str) {
        const span = document.createElement('span');
        span.className = 'ot-bionic-dim-preview';
        span.setAttribute('data-ot-preview-bionic-dim', '');
        span.style.opacity = '0.55';
        span.textContent = str;
        return span;
      }
      return document.createTextNode(str);
    }

    while ((match = re.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(makeTextSegment(text.slice(lastIndex, match.index)));
      }
      const word = match[0];
      if (word.length <= 3) {
        frag.appendChild(makeTextSegment(word));
      } else {
        const boldLen = Math.max(1, Math.ceil(word.length * ratio));
        const b = document.createElement('b');
        b.textContent = word.slice(0, boldLen);
        b.setAttribute('data-ot-preview-bionic', '');
        b.style.fontWeight = '700';
        frag.appendChild(b);
        if (boldLen < word.length) {
          frag.appendChild(makeTextSegment(word.slice(boldLen)));
        }
      }
      lastIndex = match.index + word.length;
    }
    if (lastIndex < text.length) {
      frag.appendChild(makeTextSegment(text.slice(lastIndex)));
    }
    const span = document.createElement('span');
    span.setAttribute('data-ot-preview-bionic', '');
    span.appendChild(frag);
    node.parentNode.replaceChild(span, node);
  }
}

function restoreBionicPreview() {
  const markers = document.querySelectorAll('[data-ot-preview-bionic], [data-ot-preview-bionic-dim]');
  for (const el of markers) {
    const parent = el.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(el.textContent), el);
  }
  try { elements.previewBox.normalize(); } catch (e) { /* skip */ }
}

function splitSentences(text) {
  const result = [];
  let last = 0;
  const re = /[.!?。！？]/g;
  let m;

  while ((m = re.exec(text)) !== null) {
    const punct = m[0];
    const after = text.slice(m.index + 1);

    let isEnd = false;

    if (/[。！？]/.test(punct)) {
      isEnd = true;
    } else if (/[!?]/.test(punct)) {
      isEnd = true;
    } else if (punct === '.') {
      // Citation pattern: period right after ) like (2022). → not a sentence end
      if (m.index > 0 && text[m.index - 1] === ')') {
        isEnd = false;
      } else {
        const trimmed = after.trimStart();
        if (trimmed.length === 0) {
          isEnd = true;
        } else {
          const next = trimmed[0];
          if (/[A-Z一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/.test(next)) {
            isEnd = true;
          }
        }
      }
    }

    // Don't split if the segment is empty (consecutive punctuation like ?. or !.)
    if (isEnd && m.index === last) {
      isEnd = false;
    }

    if (isEnd) {
      result.push(text.slice(last, m.index + 1));
      last = m.index + 1;
    }
  }

  if (last < text.length) {
    result.push(text.slice(last));
  }

  return result;
}

function applySentenceBreakPreview() {
  const box = elements.previewBox;
  if (!box) return;
  const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) { nodes.push(walker.currentNode); }
  for (const node of nodes) {
    const text = node.textContent;
    if (!/[.!?。！？]/.test(text)) continue;
    const sentences = splitSentences(text);
    const filtered = sentences.filter(s => s.trim());
    if (filtered.length <= 1) continue;
    const wrapper = document.createElement('span');
    wrapper.setAttribute('data-ot-preview-sentence-break', '');
    wrapper.style.display = 'contents';
    for (const sentence of filtered) {
      const span = document.createElement('span');
      span.setAttribute('style', 'display: block !important;');
      span.textContent = sentence;
      wrapper.appendChild(span);
    }
    node.parentNode.replaceChild(wrapper, node);
  }
}

function restoreSentenceBreakPreview() {
  const wrappers = document.querySelectorAll('span[data-ot-preview-sentence-break]');
  for (const wrapper of wrappers) {
    const parent = wrapper.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(wrapper.textContent), wrapper);
  }
  try { elements.previewBox.normalize(); } catch (e) { /* skip */ }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);
