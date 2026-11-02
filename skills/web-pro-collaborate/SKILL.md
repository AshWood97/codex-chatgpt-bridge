---
name: web-pro-collaborate
description: Use when the user wants ongoing architecture or coding consultation with ChatGPT Web GPT-6 or an explicitly requested Pro model while Codex remains the local executor, including context additions and test-failure feedback.
---

# 网页 GPT-6 / Pro 持续协作

按 ../../docs/browser-workflow.md 执行 kind=collaborate、mode=chat，默认实际可见的 GPT-6；记录独立 effort，不能因缺少 Pro 阻止普通协作。保留同一仓库与会话，每轮通过 parent 续接并附新上下文/测试失败。网页提供推理，Codex 根据已授权范围落实和验证；需要网页直接驱动原生工具时转 web-agent，其完整工具循环仍待实机验收。

用户明确要求 Pro 时确认独立 Pro 模型或实际可见 Pro 思考强度，设置 mode=pro，不用 High/高/Max 或订阅徽章替代，也不静默降级。重连只恢复观察，核对完整请求和任务标识，不重新发送。用户明确选择桌面 ChatGPT「聊天」对话时，改用 chatgpt-pro-bridge。

MCP 工具以本地 codex-chatgpt-bridge 服务器实际提供的名称调用。若未加载 MCP，可使用同包 CLI JSON 文件输入，见 README；不要假称后台正在调用原生浏览器。

任务期间持续向用户报告可验证进展。区分实现、离线测试、实机成功；遇到账户前置条件保留明确恢复点。
