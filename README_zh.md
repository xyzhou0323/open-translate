# ND Translate

<img src="assets/icons/icon128.png" alt="ND Translate" width="64" height="64">

神经多样性友好的网页翻译扩展。

内置神经多样性（Neurodiversity）术语表，并提供 OpenDyslexic 字体、Bionic Reading、每句换行等阅读辅助功能。

> Forked from [sxueck/open-translate](https://github.com/sxueck/open-translate)

## 功能

### 翻译

- **三种翻译模式**：替换原文 / 双语对照 / 点击翻译
- **双引擎支持**：免费 Google 翻译 + LLM API（OpenAI 兼容接口）
- **智能内容识别**：基于 Mozilla Readability 算法自动提取页面正文
- **智能批处理**：基于 token 的动态合批，最小化 API 调用
- **术语表**：内置神经多样性标准化术语表，确保 ND 术语翻译准确
- **输入框翻译**：在任意输入框中按快捷键即可翻译

### 阅读辅助

- **OpenDyslexic 字体**：专为阅读障碍设计的英文字体
- **霞鹜文楷中文字体**：字形清晰易辨识
- **Bionic Reading**：加粗单词前半部分，引导眼球快速移动
- **每句换行**：按句号、问号等标点拆分，减少长段落阅读压力
- **间距调整**：行间距、单词间距、字间距独立调节
- **字号调整**：全局缩放页面文字

## 安装

### 开发者模式

```bash
git clone https://github.com/xyzhou0323/open-translate.git
cd open-translate
```

1. 打开 `chrome://extensions/`，启用「开发者模式」
2. 点击「加载已解压的扩展程序」，选择项目目录

## 配置

点击扩展图标 →「高级设置」：

- **API 端点 / 密钥 / 模型**：配置 LLM 翻译服务。留空则自动使用免费 Google 翻译
- **目标语言**：默认翻译为简体中文
- **术语表开关**：启用/关闭神经多样性术语表
- **阅读辅助**：字体、Bionic Reading、每句换行、间距等独立开关

## 许可证

MIT
