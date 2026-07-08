# Edge Add-ons Store Listing

## 扩展名称
ND Translate

## 作者
XyZ（基于 Open Translate 二次开发）

## 简短描述（132字符以内）
网页翻译扩展，内置神经多样性术语标准化翻译，兼容 OpenAI 兼容 API。

## 详细描述

### 中文

ND Translate 是一款基于大语言模型（LLM）的网页翻译扩展，兼容所有 OpenAI API 格式的服务（支持自定义 API 端点）。基于 Open Translate 二次开发，专为神经多样性领域文献翻译优化。

**核心功能：**
- 支持替换原文和段落双语两种翻译模式
- 逐段渐进渲染：翻译完成的段落即时显示，无需等待整页完成
- 内置神经多样性领域标准化术语表，确保 ~80 个关键术语翻译一致（如 "Neurodiversity" → "神经多样性"）
- 智能去病理化规则：对神经发育特质（ASD、ADHD 等）自动使用非病理化表达
- 上下文感知翻译：同一术语根据语法角色自动选择不同译法（如 "self-advocate" 作动作时译为"（进行）自我倡权"，作人称时译为"自我倡权者"）
- 支持自定义 API 端点、模型选择、温度参数等完整配置
- 输入框翻译：在任意文本框中按快捷键即可触发翻译

**隐私说明：**
- 所有翻译请求直接发送至您配置的 API 端点，不经过任何第三方服务器
- 设置数据仅存储在浏览器本地和浏览器同步存储中
- 不收集任何用户数据、浏览记录或翻译内容

### English

ND Translate is an LLM-powered web page translation extension compatible with all OpenAI-format APIs. Built on Open Translate, optimized for neurodiversity literature translation.

**Key Features:**
- Replace and paragraph-bilingual translation modes
- Progressive per-paragraph rendering with visual indicators
- Built-in neurodiversity terminology glossary (~80 terms) ensuring consistent translations
- Smart de-pathologization for neurodevelopmental conditions
- Context-dependent translations (different forms for adjective vs. noun vs. verb)
- Custom API endpoint, model selection, full LLM parameter configuration
- Input field translation via hotkey

**Privacy:**
- All requests go directly to your configured API endpoint
- Settings stored locally and in browser sync storage only
- No user data, browsing history, or translation content is ever collected

## 截图要求
- 至少 1 张，推荐 3-5 张
- 尺寸：1280x800 或 640x400
- 建议截图内容：
  1. 弹窗界面（语言选择 + 翻译模式）
  2. 翻译前后的网页对比
  3. 选项设置页面
  4. 输入框翻译功能展示

## 图标要求
- 主图标：300x300（已就绪）
- Manifest 图标：16x16, 32x32, 48x48, 128x128（已就绪）

## 提交清单
- [x] 生成 300x300 商店图标
- [ ] 截取 3-5 张功能截图
- [ ] 注册/登录 [Edge Partner Center](https://partner.microsoft.com/zh-cn/dashboard)
- [ ] 打包扩展为 .zip（`npm run package:zip` 或手动压缩）
- [ ] 提交审核
