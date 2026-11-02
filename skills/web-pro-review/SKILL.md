---
name: web-pro-review
description: Use when the user asks Codex to review a repository or diff with ChatGPT Web GPT-6 or an explicitly requested Pro model, validate findings, or re-review fixes in the same web conversation. Not for ordinary local code review without a webpage request.
---

# 网页 GPT-6 / Pro 代码审查

按 ../../docs/browser-workflow.md 执行 kind=review、mode=chat，默认选择当前账户可见 GPT-6，分别确认模型与推理档位（本轮默认“高”）。准备带原始行号的 diff 和相关源码，单次提交，核对发现与本地测试；已授权修复时完成修复再同会话复审。用户明确要求且网页实际可用时使用 mode=pro。独立 Pro 模型或当前可见 Pro 思考强度均可；不把 High/高/Max 或账号徽章当作 Pro，Pro 不可用时不降级。

每轮记录实际 model/mode/effort，parent 复审继承相同会话和模式。用户明确选择桌面 ChatGPT「聊天」对话时，改用 chatgpt-pro-bridge，不把网页会话当成桌面会话。

MCP 工具以本地 codex-chatgpt-bridge 服务器实际提供的名称调用。若未加载 MCP，可使用同包 CLI JSON 文件输入，见 README；不要假称后台正在调用原生浏览器。

任务期间持续向用户报告可验证进展。区分实现、离线测试、实机成功；遇到账户前置条件保留明确恢复点。
