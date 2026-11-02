---
name: web-diagnostics
description: Use for Codex ChatGPT Bridge installation, account/model discovery, browser connectivity, task recovery, runtime diagnostics/rollback, or web voice availability questions.
---

# 网页能力诊断配置

先调用 capabilities/list/status；读 ../../docs/browser-workflow.md 和 ../../docs/runtime.md。分别报告插件接口、原生浏览器连接、账户可见模型/工具、运行时健康、Developer Mode/tunnel 权限与实机验收状态。桌面聊天路线另读 ../../docs/desktop-chat.md，检查当前环境是否提供 app-tools；该工具不由本插件提供。用户自行选择已有对话和 Pro，工具不能独立验证档位或新建普通聊天。检查当前可见模型和 effort 选中状态，账号 Pro 徽章不算证据。断连后核对原 session、会话、完整用户请求及 CWC marker，未知提交只观察不重发。缺失权限不等于插件故障。voice 返回 not_implemented，不开麦克风，不用 TTS 替代。

MCP 工具以本地 codex-chatgpt-bridge 服务器实际提供的名称调用。若未加载 MCP，可使用同包 CLI JSON 文件输入，见 README；不要假称后台正在调用原生浏览器。

任务期间持续向用户报告可验证进展。区分实现、离线测试、实机成功；遇到账户前置条件保留明确恢复点。
