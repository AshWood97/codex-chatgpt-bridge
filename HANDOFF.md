# 接力入口：Codex ↔ ChatGPT Bridge

更新日期：**2026-11-03**。本候选将仓库、包和插件统一为 `codex-chatgpt-bridge`，有七个技能及两条路线：网页能力通过原生 Browser Use 操作 Chrome／内置浏览器；桌面聊天通过当前 Codex 环境提供的 `codex-app-tools` 继续用户授权的现有 ChatGPT 对话。两条路线的认证和验收分开记录。

桌面聊天在 2026-11-03 完成同一对话两轮短消息接力：用户确认 Pro，每轮发送一次，自动取得完整结果，无人工切换和复制；第一轮自动打开目标聊天一次，两轮均有读取延迟。接口不回传模型/档位，无法独立证明 Pro；主动 MCP 回传、三轮 CR、长回复和真实进程中断恢复仍未验收。它不能自动新建普通 ChatGPT 聊天、设置 Pro，或被当作完整 agent。使用范围与操作见 [桌面聊天接力](docs/desktop-chat.md)。

数据路径按 `CCB_HOME`、旧 `CWC_HOME` 优先；均未设置时，保留已存在的旧默认目录，新安装使用新默认目录。如果新旧默认目录同时存在，程序要求设置 `CCB_HOME` 明确选择；不自动覆盖、合并或删除。新命令为 `ccb` / `ccb-mcp`，旧 `cwc` / `cwc-mcp` 保留兼容。历史任务 `CWC-` 标识继续识别。

新名称和第七技能的安装、桌面加载与运行时整合结果须按本候选实际检查记录，不能沿用旧版本的安装结果。

先读 [验收记录](docs/acceptance.md) 和 [接力计划](docs/plans/2026-10-16-agent-handoff.md)，保留已有实现与已完成结果。真实观察摘要在 [实机简报](docs/evidence/2026-10-22-live.md)，历史日志见 [证据索引](docs/evidence/README.md)。

## 历史证据（2026-10-22）

以下为当时 `0.1.0` 候选及 Chrome 普通 GPT-6 chat + 高档位的结果，不自动继承为本次改名候选的测试结果。

- 本地 TypeScript MCP、19 个工具、六个技能、持久任务、单次发送、仓库快照和冻结快照只读接口。
- 本轮 `npm run check` 的 **31 项自动测试通过**，六技能 `quick_validate` 全部通过。自动测试涵盖新增普通 chat 模式与原生下载 helper；历史 21 项和旧上游 143 测试 / 1276 断言不作新 pin 结果。
- Chrome 普通 GPT-6 chat + 高完成 CR → Codex 修复 → 2 项本地测试通过 → 同会话复审 0 findings，定位问题为 `shipping.mjs:3` 的免邮边界。
- 同会话第三轮持续协作静态核对 8 种输入；网页明确未运行测试，Codex 补 0、正负 Infinity 的 3 个断言，合成仓库 3 项测试通过。新 CLI 进程 resume 无重发，任务两次稳定观察后完成；新增测试使先前快照 stale，符合设计。
- 真正 Deep Research 在组件加载错误后重试组件一次恢复，未新增用户消息；提取当前轮次 3832 字符报告。UI 9 来源 / 9 引用 / 122 搜索，DOM 8 条 HTTPS 来源；未逐条独立审核报告技术断言。
- 初始原图 1,721,014 bytes，编辑原图 1,660,188 bytes，均为 1254×1254 且已打开查看。Chrome 预览 Download 落盘；初始图事件超时后按唯一图名/点击时间定位，没有预点击文件系统基线，编辑图才使用完整基线 helper。pageAssets 未暴露结果 blob。
- 可选上游 v6.1.13 固定 SHA `6f43747eb5585ca623c0617e729826dfd680c5b7` 的 `runtime prepare` 源码与依赖已就绪。
- production launcher 已真实构建启动，界面显示 v6.1.13、无 DEV，保留 wrapper 隔离目录；停在首次引导。
- 候选 archive 已构建；独立新 CODEX_HOME 安装 marketplace/plugin 后 list enabled，缓存无 node_modules，MCP 冷启动 19 工具、collaborate 默认 chat，两个 helper bundle 可导入，卸载/移除来源通过。日常 Codex 配置未改；桌面当前会话加载未验收。

当时发行物已按当时的冻结文档生成：本地 marketplace 插件包与源码包。新名称版本需要重新构建和验证，不将旧上游测试当作新 pin 的结果。

## 下一步

| 优先级 | 待办 | 当前限制与完成标准 |
|---|---|---|
| P0 | 桌面聊天多轮与可靠读取 | 已验证用户确认 Pro 的两轮短消息，工具不返回模型/档位，读取出现延迟；主动 MCP 回传、三轮 CR 和真实进程中断恢复仍未验收；当前接口不支持新建普通聊天或自动选档。 |
| P0 | 完整 agent 的独立登录、配置与工具循环 | 已修复 `app` → `dev` / `--dev-profile` 的模拟工具入口，production launcher 真实启动成功。使用者尚未完成独立登录和平台授权；doctor 返回 `ok=false`，提示缺少 `config.json`、Run setup。之后还需 MCP/tunnel 权限、真实读取/修改/终端测试事件与本地结果，才能验收。 |
| P1 | 已保存 CR 会话的网页重载 | 新 Chrome 标签页重开已存会话后，两条旧助手回复无法加载；当次实时回复和本地结果成功。保留原结果并定位重载限制，不能把本轮 CR 成功写成 reload 恢复通过。 |
| P1 | 研究澄清与计划分支 | 本轮研究直接完成，未触发实际澄清或计划确认；需要网页真实触发时验证同任务新轮次和报告归属。 |
| P1 | 真实多图 batch | 目前只验证初始图和单图参考编辑；需实际多图、数量不足和重复图拒收，不用截图补齐数量。 |
| P1 | 真实长任务及写工具断连 | 本轮第三轮任务的新 CLI 进程 resume 已通过，未重发；真实超过 1 小时网页任务与完整写工具断连尚未验收。恢复时查明原操作状态，不重发或重放不确定写入。 |
| P1 | 线上 setup/rollback 与桌面加载 | 2026-10-22 旧候选包独立 CLI 安装、冷启动和卸载通过；新名称候选的安装与七技能桌面加载，以及完整在线配置和回滚保留后续用户字段仍待验收。 |

语音首版只保留 `not_implemented` 接口，不在这次接力实现范围。完整 agent 的阻塞不应阻止其余 Chrome 流程。

## 浏览器与权限

网页 CR、持续协作、研究和图像由 Codex 原生 Browser Use 操作 Chrome，内置浏览器按当前工具规则回退。桌面聊天使用当前 Codex 桌面环境的 app-tools，该工具不由本插件提供；用户选择已有对话和 Pro，并对目标对话发消息明确授权。完整 agent 沿用上游独立 Browser + tool broker，所以需要单独登录。不得复制 cookies、浏览器 profile、凭证或主账号 auth 来填补独立登录。

保留原审批、沙箱和模型路由；不启用自动批准，不把网页普通文本执行为 shell，不用模型 API 或私有 HTTP 接口替代网页权限。登录、CAPTCHA 和连接器授权由使用者按平台流程完成。公开证据不包含主机绝对路径、nonce、扩展身份、私人会话 URL 或任务数据库。

## 源码入口

| 文件 | 用途 |
|---|---|
| [src/api.ts](src/api.ts)、[src/types.ts](src/types.ts) | 参数、chat/pro/research/image 模式与观察合同 |
| [src/jobs.ts](src/jobs.ts)、[src/store.ts](src/store.ts) | 预约、确认、恢复、澄清、结果与持久化 |
| [src/context.ts](src/context.ts) | 快照、覆盖范围、秘密过滤、行号与 stale |
| [src/page-evidence.ts](src/page-evidence.ts) | 页面错误和进度分类；不凭全页完成字样判成功 |
| [src/native-browser.ts](src/native-browser.ts)、[src/native-downloads.ts](src/native-downloads.ts) | pageAssets 精确资源导出及正常下载的文件名基线定位 |
| [src/runtime.ts](src/runtime.ts)、[docs/runtime.md](docs/runtime.md) | 固定上游、生产 launcher、独立配置与回滚 |
| [docs/browser-workflow.md](docs/browser-workflow.md)、[docs/desktop-chat.md](docs/desktop-chat.md)、[skills/](skills/) | 网页和桌面接力流程；每次按实际工具确认接口 |

## 交给接力 Agent 的提示

> 阅读 HANDOFF、验收记录、接力计划和当前差异后，只继续未完成项。网页默认普通 chat，实际核对可见模型与档位；明确要求 Pro 时不能静默降级。桌面聊天由用户在指定会话中选择 Pro 并授权发送，不把用户选择当作工具独立验证。复用已验证的 CR、本地修复、研究报告和单图编辑下载结果；关注 production launcher、独立登录及真实工具循环、CR 重载限制、研究澄清/计划、真实批次和长任务恢复。常规范围内修复直接做，缺少登录或平台授权时保留页面，只暂停受影响项。未知提交先查原会话，不重复发送；未知写工具状态不重放。把自动测试、真实网页观察和完整 agent 工具事件分别记录。不要复制登录状态、关闭审批/沙箱或自动切模型 API。仅发布脱敏证据，完成后同步验收和发行范围。
