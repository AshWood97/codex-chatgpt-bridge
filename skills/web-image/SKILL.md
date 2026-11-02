---
name: web-image
description: Use when the user asks Codex to create or edit images through ChatGPT website, upload reference images, continue image iterations, or download complete batches of originals. Not for API image generation.
---

# 网页创建与编辑图像

按 ../../docs/browser-workflow.md 执行 kind=image，尤其第 5 节。选择“创建图像”chip 后用原生 `.type(prompt)` 保留它，发送前核对功能状态。保存参考图关系，绑定当前轮次；参考图编辑可在原图预览的“描述修改内容”中输入要求并只发一次，页面自动附带“原始图像”，随后核对新用户轮次与参考图关系。

仅选择本轮实际观察到的 `Generated img` 结果，排除 source/原始图像、旧轮次图片和 baseline URL，打开完整预览后点击“下载”导出原图。控件和图片选择器必须先从当前 DOM 观察，不能写死图片或轮次索引。本次 Chrome 的 pageAssets 不含 blob 图片，不能宣称 dist/native-browser.mjs 已成功导出 ChatGPT 图像；该 helper 只适用于库存确实包含本轮完整图像 URL 的情况。

原生 download 事件可能超时而文件已保存。在点击前用 dist/native-downloads.mjs 的 `snapshotImageDownload(authorizedDownloadRoot, observedImageName + '.png')` 记录基线；图名来自该预览 UI，若已含扩展名则使用完整文件名。只点击一次下载，之后 `findImageDownload(snapshot)` 仅定位唯一新增同名或 Chrome 数字重名后缀文件；null 可继续观察，多候选保持 partial，不选最新文件，不因事件超时重复点击或生成。禁止读取浏览器 profile、下载数据库、私有状态或使用 CDP/HTTP 绕过原生路径。

取得原文件后按正确 approvedDownloadRoot 调用 import_image，复用已有格式、尺寸、重复内容及数量验证，打开文件确认可查看，再做两次稳定状态观察。数量不足、旧图、缩略图或截图均不能作为原图完成；在 Codex 预览交付原文件。

MCP 工具以本地 codex-chatgpt-bridge 服务器实际提供的名称调用。若未加载 MCP，可使用同包 CLI JSON 文件输入，见 README；不要假称后台正在调用原生浏览器。

任务期间持续向用户报告可验证进展。区分实现、离线测试、实机成功；遇到账户前置条件保留明确恢复点。
