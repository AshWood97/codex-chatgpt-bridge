---
name: web-deep-research
description: Use when the user asks Codex to invoke the actual ChatGPT website Deep Research capability and retrieve its complete report and citations, including long-running research recovery.
---

# 网页深度研究

按 ../../docs/browser-workflow.md 执行 kind=research，尤其第 4 节。必须选择真实 Deep Research 工具，跟踪澄清/计划/运行状态，提取当前轮次报告。本次验证成功的入口是输入 `@深度研究`，选择可见的“深度研究 获取详细报告”，确认 chip 后用 `.type(prompt)` 保留它并单次提交；以每次实际 DOM 和功能状态为准。当前账户没有该工具或组件持续失败时如实报告，不得用普通 GPT-6/Pro 长回答或 API 替代。

已提交任务显示“未能显示 深度研究”时，若当前 DOM 提供研究组件自己的重试按钮，可点击一次恢复该组件；复核会话、完整请求、marker 和用户轮次没有变化，不重新 reserve/Send，不用助手回复的重新生成代替。组件与助手外层可能状态不同，外层“无法加载此回复”不能直接否定同轮已恢复的报告。

通过当前原生运行时支持的 frameLocator 和只读 evaluate，进入本轮研究 iframe 及其内层 iframe，读取 body 全文及 a[href]。本次实际锚点为 `main [data-content-search-turn-key='fallback-turn-0'] iframe[title='深度研究']` → 内层 iframe；后续必须重新从本轮 DOM 定位，不能硬编码 fallback-turn-0、iframe 索引或最后一份报告。本次恢复后真实研究完成，显示 9 个来源、122 次搜索，提取 3832 字符正文和 8 个 HTTPS 来源；这些是本次结果，不能作为所有任务的数量要求或补造缺失链接。

保存当前任务轮次的 reportOwnerTurn、真实研究完成/进度 UI 支持的 researchStarted、正文和 citations；复核生成结束并做两次稳定观察。拒绝旧报告、研究计划、进度占位、截断正文和仅有完成标签的结果。读取仅限原生只读页面接口，不用 CDP、私有状态或 HTTP 接口；复用已有验证，不新增哈希层。

MCP 工具以本地 codex-chatgpt-bridge 服务器实际提供的名称调用。若未加载 MCP，可使用同包 CLI JSON 文件输入，见 README；不要假称后台正在调用原生浏览器。

任务期间持续向用户报告可验证进展。区分实现、离线测试、实机成功；遇到账户前置条件保留明确恢复点。
