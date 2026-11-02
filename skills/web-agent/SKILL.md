---
name: web-agent
description: Use when the user explicitly wants an available ChatGPT Web model such as GPT-6 to drive a complete native Codex coding/tool loop through the optional pinned full runtime, or asks to install/configure that runtime.
---

# 网页 GPT-6 完整编码

先读 ../../docs/runtime.md。仅在用户明确要求完整网页 agent 时推进本入口；之前的网页普通 chat 验收不能证明完整工具循环通过。使用 node <插件根>/dist/cli.mjs runtime status/prepare/launcher/configure/doctor/exec。真实工具循环由锁定上游完成，不能将网页文本命令直接 exec。保留 native 协议和原审批/沙箱；本插件不隐式启用 compatibility-v1、auto-approve 或扩大上下文。首次独立浏览器登录与 tunnel 授权需要用户完成。

MCP 工具以本地 codex-chatgpt-bridge 服务器实际提供的名称调用。若未加载 MCP，可使用同包 CLI JSON 文件输入，见 README；不要假称后台正在调用原生浏览器。

任务期间持续向用户报告可验证进展。区分实现、离线测试、实机成功；遇到账户前置条件保留明确恢复点。
