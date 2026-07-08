# Edge Add-ons Store Listing

## 简短描述 / Short Description

**中文：**
兼顾神经多样性的网页翻译工具——三种翻译模式、双引擎支持、内置 ND 术语表，配合阅读障碍字体、Bionic Reading 等辅助功能。

**English:**
A neurodiversity-friendly web page translator with built-in ND glossary, dual engines, and reading aids including dyslexia font and Bionic Reading.

---

## 详细描述 / Detailed Description

### 中文

ND Translate 是一款兼顾神经多样性（Neurodiversity）的网页翻译扩展，帮助你轻松阅读外文网页。

**翻译功能：**
- **三种翻译模式**：替换原文 / 段落双语 / 点击翻译，适应不同阅读场景
- **双引擎支持**：免费 Google 翻译开箱即用，也可接入 OpenAI 兼容 LLM API（支持自定义端点、模型、温度等参数）
- **智能内容识别**：基于 Mozilla Readability 算法自动提取页面正文，仅翻译核心内容
- **智能批处理**：基于 token 的动态合批，最小化 API 调用次数
- **内置 ND 术语表**：强制标准化翻译神经多样性领域关键术语（如 "Neurodiversity" → "神经多样性"、"Stimming" → "调节行为"），确保翻译准确一致
- **输入框翻译**：在任意文本输入框中按快捷键即可触发翻译

**阅读辅助：**
- **OpenDyslexic 字体**：专为阅读障碍设计的英文字体，字母底部加重减少翻转错觉
- **霞鹜文楷中文字体**：字形清晰易辨识的中文字体
- **Bionic Reading 引导阅读**：加粗单词前半部分，通过视觉锚点引导眼球快速移动
- **每句换行**：按句子标点拆分段落，减少长文本阅读压力
- **间距调节**：行间距、单词间距、字间距独立可调
- **字号缩放**：全局文字缩放（0.8x–2.0x）

**隐私说明：**
- 翻译请求直接从浏览器发送至 Google 或你配置的 API 端点，不经过第三方中转
- API 密钥和所有设置仅存储在浏览器本地，不上传至任何服务器
- 不收集任何用户数据、浏览记录或翻译内容
- 不嵌入任何分析 SDK 或追踪代码

### English

ND Translate is a neurodiversity-friendly web page translation extension. It helps you read foreign-language web content with ease.

**Translation Features:**
- **Three translation modes**: Replace / Paragraph Bilingual / Click-to-Translate
- **Dual engine**: Free Google Translate out of the box, or connect any OpenAI-compatible LLM API (custom endpoint, model, temperature, etc.)
- **Smart content extraction**: Mozilla Readability-based detection extracts only the main content, skipping nav, ads, and sidebars
- **Smart batching**: Token-based dynamic batching minimizes API calls
- **Built-in ND glossary**: Standardized translations for neurodiversity terminology (e.g., "Neurodiversity" → "神经多样性", "Stimming" → "调节行为")
- **Input field translation**: Trigger translation in any text input via hotkey

**Reading Aids:**
- **OpenDyslexic font**: Designed for dyslexic readers — heavier bottoms reduce letter-flipping
- **LXGW WenKai Chinese font**: Clear, easy-to-distinguish CJK glyphs
- **Bionic Reading**: Bold the first half of each word to guide eye movement
- **Sentence break**: Split paragraphs by sentence punctuation for easier reading
- **Spacing controls**: Independent line height, word spacing, and letter spacing
- **Font size**: Global text scaling (0.8x–2.0x)

**Privacy:**
- Translation requests go directly from your browser to Google or your configured API endpoint — no intermediate servers
- API keys and all settings are stored locally in your browser only
- No user data, browsing history, or translation content is ever collected
- No analytics SDKs or tracking code embedded

---

## 截图要求
- 至少 1 张，推荐 3-5 张
- 尺寸：1280x800 或 640x400
- 建议截图内容：
  1. 弹窗界面（语言选择 + 翻译模式 + 引擎切换）
  2. 翻译前后的网页对比
  3. 设置页面（API 配置 + 阅读辅助）
  4. 阅读辅助效果（字体、Bionic Reading、每句换行）

## 图标要求
- 主图标：300x300（已就绪）
- Manifest 图标：16x16, 32x32, 48x48, 128x128（已就绪）

## 提交清单
- [x] 生成 300x300 商店图标
- [x] 打包扩展为 .zip
- [ ] 截取 3-5 张功能截图
- [ ] 注册/登录 [Edge Partner Center](https://partner.microsoft.com/zh-cn/dashboard)
- [ ] 填写隐私声明
- [ ] 提交审核
