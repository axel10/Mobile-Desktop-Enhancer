# Mobile Desktop Enhancer (桌面增强套件)

为手机端能运行脚本的浏览器添加桌面浏览器的一些增强功能，提升操作体验。


## 🌟 核心功能

### 1. 工具提示 (Smart Tooltips)
- **自定义样式**：简约半透明深色设计，优于浏览器原生样式。
- **边界检测**：自动调整位置，确保提示框始终在可视区域内。

![Image](https://github.com/user-attachments/assets/adb9d82f-a7aa-4e29-9bfb-4b9ab64fdcc4)

### 2. Shift 文本选择 (Shift Selection)
- **快捷操作**：按住 `Shift` 键即可进入选择模式。
- **全场景兼容**：完美支持标准输入框 (`input`, `textarea`) 及富文本编辑器。

![Image](https://github.com/user-attachments/assets/6df6f02e-a93a-4e75-a024-ae997c67fa8e)

### 3. 全桌面样式滚动条 (Desktop Scrollbars)
- **智能隐藏**：仅在滚动或悬停时显示，不遮挡内容。
- **多级交互**：支持点击轨道翻页、长按箭头平滑滚动及滚轮缩放。

![Image](https://github.com/user-attachments/assets/1af51545-07f3-417a-acfe-9a73eea12889)

### 4. 中键增强 (Middle Mouse Power)
- **超链接跳转**：中键点击链接快速在新标签页打开。
- **平滑自滚动**：中键点击空白处开启自动滚动模式，随鼠标移动速度自动调整，带有视觉指示点。

![Image](https://github.com/user-attachments/assets/618aa63e-4735-460c-8a98-92427515c601)

### 5. 滚轮网页缩放 (Alt+Scroll Zoom)
- **快捷缩放**：按住 `Alt` 键滚动滚轮即可实时放大/缩小网页。
- **持久化记忆**：自动记录每个域名的缩放设置，刷新页面依然有效。

![Image](https://github.com/user-attachments/assets/9e70d149-ffca-43d2-8862-29b76fd94671)

## 🚀 安装说明

1. 确保浏览器已安装 **Tampermonkey** 或类似的脚本管理扩展。
2. 创建新脚本并粘贴 `main.js` 的内容。
3. 保存并刷新页面即可生效。

## 🛠️ 配置与开关

- **站点开关**：点击脚本管理器的菜单，可以针对当前域名快速 `禁用/启用` 增强功能。
- **默认参数**：可在脚本开头的 `CONFIG` 对象中调整滚动条宽度、滚动速度等参数。

## 📝 许可

MIT License