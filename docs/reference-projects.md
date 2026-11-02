# 参考项目与采用记录

最近更新：**2026-11-02**。本次重新核查的固定快照和具体日期见下表；其余记录保留原核查日期，不将旧调研冒称本日重查。下表固定源码快照和对应许可证；机器可读记录见 [`runtime/reference-lock.json`](../runtime/reference-lock.json)。stars/forks 只是同日调研信息，不代表功能验证或采用程度。

“运行时依赖”指独立安装的上游；“设计借鉴”指本项目独立实现或原生浏览器流程适配；“代码移植”指复制并修改上游源码。**当前没有代码移植**。候选模块与实机结果分别记录，具体范围见 [`acceptance.md`](acceptance.md)。

本轮 2026-10-22 实机结果限定在已绑定的 Chrome 会话，网页可见模型为 **GPT-6 + 高**：

| 能力 | 本轮观察与归因范围 |
|---|---|
| 普通 chat CR 闭环 | 找到 `shipping.mjs:3` 的 `>= 100` 免邮边界问题；Codex 本地修复后 2 项测试通过，同会话复审为 0 findings。这是普通 chat 审查与本地修复闭环，不能代替完整上游 agent 运行时验收。 |
| 真正 Deep Research | 组件初次加载错误后，点击组件重试一次，用户消息数未增加；恢复取得当前轮次 iframe 报告，正文 3832 字符。UI 显示 9 来源 / 9 引用 / 122 搜索，提取的 DOM 正文含 8 条 HTTPS 来源，保留这两个口径。报告技术断言未逐条独立审核。 |
| 图像生成与参考图编辑下载 | 两张结果均为 1254×1254；初始原图 1,721,014 bytes，编辑原图 1,660,188 bytes，均已打开查看。Chrome 预览 Download 落到 Downloads，pageAssets 未包含 blob。初始图事件超时后按唯一图名/点击时间定位，没有预点击文件系统基线；编辑图才由 `src/native-downloads.ts` 完整基线和唯一新增匹配文件定位，再交既有导入校验。 |

## 2026-11-02 双路线调研

本次核查客户端路线和网页路线的下列固定快照。均为公开源码、文档研究；**未移植上游代码，未安装或运行这些新版本**。已有实现和实机结果不因参考新项目而自动升级。

| 项目与本次核查快照 | 许可证 | 类型及可研究模块 | 取舍与限制 |
|---|---|---|---|
| [JHees/chatgpt-codex-bridge](https://github.com/JHees/chatgpt-codex-bridge/tree/e110a3eeb178fef87465c5f6ef9ae2afeed10975) · v0.2.0 · `e110a3eeb178fef87465c5f6ef9ae2afeed10975` | [MIT](https://github.com/JHees/chatgpt-codex-bridge/blob/e110a3eeb178fef87465c5f6ef9ae2afeed10975/LICENSE) | 仅调研；任务、会话、请求绑定及未知发送结果恢复 | 通过第三方 Script Loader 向桌面应用 renderer 注入后调用内部 Chat 服务；交付说明以 Windows、PowerShell 7 为主。历史记录曾发现 `gpt-6-pro`，但 [v0.2.0 发布说明](https://github.com/JHees/chatgpt-codex-bridge/blob/e110a3eeb178fef87465c5f6ef9ae2afeed10975/docs/RELEASE-0.2.0.md) 没有重测真实 Pro 生成或完整模型矩阵。未采用其源码、加载器或传输方式，也未证明在 macOS 上可运行。 |
| [hxmzadmr/probridge](https://github.com/hxmzadmr/probridge/tree/e9ed93fb92f39a04eb106488be7733b396eecff0) · 1.2.0 · `e9ed93fb92f39a04eb106488be7733b396eecff0` | [MIT](https://github.com/hxmzadmr/probridge/blob/e9ed93fb92f39a04eb106488be7733b396eecff0/LICENSE) | 仅调研；消息绑定及中断后的单次发送语义 | macOS Accessibility 操作桌面 Quick Chat；[MCP 实现](https://github.com/hxmzadmr/probridge/blob/e9ed93fb92f39a04eb106488be7733b396eecff0/src/server.mjs) 固定 GPT-5.6 Sol + Pro，没有任意 GPT-6 参数。本地文件／工具访问依赖另配 LocalAnt 或 DevSpace；未移植其驱动或集成。 |
| [miuuyy/codex-chatgpt-web](https://github.com/miuuyy/codex-chatgpt-web/tree/860fa576eb47d9e20d7d8289235bfea94392d2fd) · v6.1.17 · `860fa576eb47d9e20d7d8289235bfea94392d2fd` | [MIT](https://github.com/miuuyy/codex-chatgpt-web/blob/860fa576eb47d9e20d7d8289235bfea94392d2fd/LICENSE) | 仅评估的运行时升级候选 | [发布说明](https://github.com/miuuyy/codex-chatgpt-web/releases/tag/v6.1.17) 涉及新版模型控件及 compaction 后新增目录的恢复。当前运行时锁定仍为下表 v6.1.13；v6.1.17 未安装、未通过 wrapper 兼容与实机验证，不能把草案中的长任务恢复功能当成该版本已交付。 |
| [steipete/oracle](https://github.com/steipete/oracle/tree/b49ae76a1e57f6779872cd62fa891f82d7a8e6c0) · v0.22.2 · `b49ae76a1e57f6779872cd62fa891f82d7a8e6c0` | [MIT](https://github.com/steipete/oracle/blob/b49ae76a1e57f6779872cd62fa891f82d7a8e6c0/LICENSE) | 仅调研；明确选择 Pro 的优先级、页面加载与登录状态诊断 | [发布说明](https://github.com/steipete/oracle/releases/tag/v0.22.2) 的相关修复可作设计参考。未移植该版本代码或引入完整 Oracle；已有研究报告的适配和实机证据仍对应下表旧核查版本。 |
| [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt/tree/535a07dbb7aee887924c53767d985c09d405319d) · v0.1.4 · `535a07dbb7aee887924c53767d985c09d405319d` | [MIT](https://github.com/XiaoDuoYa/codex-with-chatgpt/blob/535a07dbb7aee887924c53767d985c09d405319d/LICENSE) | 仅调研；按范围读取仓库、测试结果及执行后复核 | ChatGPT 通过授权与一次性配对的 MCP 读取材料，Codex 负责执行；授权读取的片段仍会发送给 ChatGPT。它不等同桌面内置 Chat API；未引入其服务或配对流程。该快照同时保留在下面的历史候选表。 |
| [Toolsai/GPT-Relay-Codex-Plugin-](https://github.com/Toolsai/GPT-Relay-Codex-Plugin-/tree/c33aa512c9d80ed5310af4c6f8eb64e13cdc0ff8) · `c33aa512c9d80ed5310af4c6f8eb64e13cdc0ff8` | 未发现许可证文件 | 仅调研；Chrome 会话中的回复、图像及研究轮询 | 核查固定树未发现 LICENSE、COPYING 或 NOTICE，GitHub license 元数据为 null；不移植或分发代码。README 的能力介绍不是本机实测。 |

客户端路线目前使用 Codex 桌面环境提供的会话工具，并非上述项目的私有传输实现。网页和桌面会话的实际验收范围见 [验收记录](acceptance.md)。本次调查不代表完成完整 agent、自动创建 Chat 或自动验证 Pro。

## 运行时与已有设计适配

| 项目与固定快照 | 许可证 | 类型 | 已采用模块 | 修改/整合方式与限制 |
|---|---|---|---|---|
| [miuuyy/codex-chatgpt-web](https://github.com/miuuyy/codex-chatgpt-web/tree/6f43747eb5585ca623c0617e729826dfd680c5b7) · `6f43747eb5585ca623c0617e729826dfd680c5b7` · v6.1.13 | [MIT](https://github.com/miuuyy/codex-chatgpt-web/blob/6f43747eb5585ca623c0617e729826dfd680c5b7/LICENSE) | 可选运行时依赖 | Responses/SSE、task-bound MCP、原生工具循环、compaction、保留会话 | `src/runtime.ts` 固定快照安装，不改上游源码；原生浏览器、审批、沙箱及独立配置约束在 wrapper 中实现。升级固定版本不等于完整编码链路已实机通过。 |
| [openai/tunnel-client](https://github.com/openai/tunnel-client/tree/aa603c51565b6b1f55b5bcf10880d79033fb3987) · `aa603c51565b6b1f55b5bcf10880d79033fb3987` | [Apache-2.0](https://github.com/openai/tunnel-client/blob/aa603c51565b6b1f55b5bcf10880d79033fb3987/LICENSE) | 间接可选运行时依赖 | 官方出站 MCP tunnel | 上游固定发行版 v0.0.16；本行 SHA 是源码核查快照，不表示它就是发行 tag。不打包 tunnel 二进制，不自动跟随 main。 |
| [pauljunsukhan/codex-chatgpt-pro-plugin](https://github.com/pauljunsukhan/codex-chatgpt-pro-plugin/tree/0cc5c5509ebaccfc7dad45b9e02a0f86407c817c) · `0cc5c5509ebaccfc7dad45b9e02a0f86407c817c` | [MIT](https://github.com/pauljunsukhan/codex-chatgpt-pro-plugin/blob/0cc5c5509ebaccfc7dad45b9e02a0f86407c817c/LICENSE) | 设计借鉴 | repo rooms、源码包、行号映射、审查 receipts | `src/context.ts` 与 `src/jobs.ts` 独立实现；不使用其 CDP 或全局浏览器锁。 |
| [rebel0789/codexpro](https://github.com/rebel0789/codexpro/tree/113472c6ff0a1516b6f223a43cd355abdf2e61ae) · `113472c6ff0a1516b6f223a43cd355abdf2e61ae` | [MIT](https://github.com/rebel0789/codexpro/blob/113472c6ff0a1516b6f223a43cd355abdf2e61ae/LICENSE) | 设计借鉴 | 仓库导出、工作区路径边界、可选只读 MCP | `src/context.ts` 处理路径和秘密过滤；`mcp --readonly` 只开放冻结快照，仍由 Codex 发起操作。 |
| [NAMUORI00/cross-review-bridge](https://github.com/NAMUORI00/cross-review-bridge/tree/61ba6108ae59be3860b97adf5baff4bd7bb33489) · `61ba6108ae59be3860b97adf5baff4bd7bb33489` | [MIT](https://github.com/NAMUORI00/cross-review-bridge/blob/61ba6108ae59be3860b97adf5baff4bd7bb33489/LICENSE) | 设计借鉴 | 审查材料组织、apply/consider/reject/needs_user、本地验证 | `record_findings` 与网页 CR/协作技能独立适配；普通 chat CR、修复及同会话复审闭环已实测。用户已授权修复时不额外引入审批流程。 |
| [Evanlau1798/codex-chatgpt-web](https://github.com/Evanlau1798/codex-chatgpt-web/tree/b4531c897662f1da4aa6a08190cf351e1571ae31) · `b4531c897662f1da4aa6a08190cf351e1571ae31` | [MIT](https://github.com/Evanlau1798/codex-chatgpt-web/blob/b4531c897662f1da4aa6a08190cf351e1571ae31/LICENSE) | 部分设计借鉴 | 会话保留、保留会话与 Bigger Context 互斥 | 基线已有 30 分钟保留；wrapper 实现互斥。新核查的 compaction 进展/存活区分和局部停滞边界仅列设计候选，未整套移植 Enhanced fork。 |
| [steipete/oracle](https://github.com/steipete/oracle/tree/bfd25bd1d85c028af60bb708391d49e936c40701) · `bfd25bd1d85c028af60bb708391d49e936c40701` | [MIT](https://github.com/steipete/oracle/blob/bfd25bd1d85c028af60bb708391d49e936c40701/LICENSE) | 部分设计借鉴，报告提取已实测 | 当前轮次研究报告归属、附件就绪、计划/进度占位拒收、当前轮次 iframe 正文提取 | 原生 Browser Use 已恢复并提取真正研究报告；组件重试一次且未新增用户消息，报告和来源口径见上表。未复制上游实现，排除 CDP、cookies、私有 HTTP 和 cookie 图像下载路径。 |
| [Yubo-Cao/codex-chatgpt-pro-bridge](https://github.com/Yubo-Cao/codex-chatgpt-pro-bridge/tree/5f2fbd530db0b7c8d05159571860b9ec2b19c0f9) · `5f2fbd530db0b7c8d05159571860b9ec2b19c0f9` | [MIT](https://github.com/Yubo-Cao/codex-chatgpt-pro-bridge/blob/5f2fbd530db0b7c8d05159571860b9ec2b19c0f9/LICENSE) | 设计借鉴 | 单次发送、两次稳定观察、长任务恢复 | `src/jobs.ts` 持久化 `send_pending`、nonce 与 15 秒稳定观察；缺少提交证据时不自动重发。 |
| [yuyou-dev/ChatGPT-Bridge](https://github.com/yuyou-dev/ChatGPT-Bridge/tree/6b5eef1343158d37ce2bc4245892f7b3238fc5f0) · `6b5eef1343158d37ce2bc4245892f7b3238fc5f0` | [MIT](https://github.com/yuyou-dev/ChatGPT-Bridge/blob/6b5eef1343158d37ce2bc4245892f7b3238fc5f0/LICENSE) | 部分设计借鉴 | 当前轮次原图导入、期望批次数量、实际尺寸验证、`pageAssets.list/bundle` 精确资源导出 helper | `src/native-browser.ts` 独立实现 `exportObservedImages`；本轮 Chrome 清单未暴露结果 blob。实际预览 Download 成功：初始图按唯一图名/点击时间定位，编辑图用 `src/native-downloads.ts` 完整预点击基线，再交 `src/jobs.ts` 校验；这不算 `pageAssets.bundle` 的 blob 导出验证。 |

Evan 行的 `b4531c897662f1da4aa6a08190cf351e1571ae31` 是本轮 2026-10-22 核查快照；既有设计借鉴依据 `de76195c82a33fa70ec1cb60a277fe55b0332664` 属于 2026-10-16 的历史记录。该分支同日为 39 stars / 7 forks。值得借鉴的是 [区分 compaction progress 与 generation liveness](https://github.com/Evanlau1798/codex-chatgpt-web/commit/d380c4585bc6dcdc7267a686a37ed8449de1721f) 和 [限定局部 compaction 停滞](https://github.com/Evanlau1798/codex-chatgpt-web/commit/525e377233cc47e22c110681b25abf6262f6733c)：仍在生成不等于取得了压缩进展，静默也不能直接当失败。这两项源码调研不表示补丁已移植，也不更换可选运行时来源。

## 2026-10-22 设计借鉴、候选与未采用项

| 项目与固定快照 | 许可证 | 类型/状态 | 有用模块 | 适配决定 |
|---|---|---|---|---|
| [adamallcock/codex-chatgpt-control](https://github.com/adamallcock/codex-chatgpt-control/tree/1e505394a01cec91d0b4880f3bc6c0cfbd45275c) · `1e505394a01cec91d0b4880f3bc6c0cfbd45275c` | [MIT](https://github.com/adamallcock/codex-chatgpt-control/blob/1e505394a01cec91d0b4880f3bc6c0cfbd45275c/LICENSE) | 设计借鉴候选，未移植 | 归一化观察中的新旧轮次、消息归属及歧义判定 | 用于核对原生观察的归属条件；当前已有 binding/turn 合同，不声称完整采用上游分类器。普通聊天的归属算法不能证明真实 Deep Research。 |
| [TianLin0509/chatgpt-web-images](https://github.com/TianLin0509/chatgpt-web-images/tree/44ba51a33b63a982e5a19778911eabe08969d28a) · `44ba51a33b63a982e5a19778911eabe08969d28a` | [MIT](https://github.com/TianLin0509/chatgpt-web-images/blob/44ba51a33b63a982e5a19778911eabe08969d28a/LICENSE) | 普通下载 UI 的设计借鉴 | 通过网页正常 UI 下载图片的思路 | 本轮实测使用 Chrome 预览 Download；具体 share-image → This image → Download 路径未采用。私有 backend/session/fetch 代码和 Codex imagegen 回退仍排除，没有移植上游代码。 |
| [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt/tree/535a07dbb7aee887924c53767d985c09d405319d) · `535a07dbb7aee887924c53767d985c09d405319d` | [MIT](https://github.com/XiaoDuoYa/codex-with-chatgpt/blob/535a07dbb7aee887924c53767d985c09d405319d/LICENSE) | 仅调研，2026-11-02 复核 | 只读 `test_status` / `execution_output` 合同及范围约束 | 可参考状态与执行输出的只读表达；没有采用新服务、执行桥或其 MCP 实现。该方案会向 ChatGPT 发送授权读取内容，不能等同桌面 Chat 原生调用。 |
| [leeheewon-01/chatgpt-bridge](https://github.com/leeheewon-01/chatgpt-bridge/tree/ca69f099b0a4fc9c808cd80460def1b45f4d5cfb) · `ca69f099b0a4fc9c808cd80460def1b45f4d5cfb` | [MIT](https://github.com/leeheewon-01/chatgpt-bridge/blob/ca69f099b0a4fc9c808cd80460def1b45f4d5cfb/LICENSE) | 格式设计借鉴，独立实现 | 引用转 Markdown 编号链接及 Sources 列表 | `src/jobs.ts` 对原生提取的 HTTPS 来源独立格式处理；排除 CDP 和 `widgetState` 读取，未复制上游转换代码。本轮真实报告提取证据来自原生 iframe 观察，其模拟测试不作实机证明。 |
| [Wangnov/chatgpt-skill](https://github.com/Wangnov/chatgpt-skill/tree/0dab47ec4bd7966e1a714bac45ad3c4e935f0f4c) · `0dab47ec4bd7966e1a714bac45ad3c4e935f0f4c` | **未发现许可证文件** | 仅调研，未采用 | 未采用模块 | 完整固定树没有 LICENSE/COPYING/NOTICE，GitHub license 为 null；不标为 MIT，不复制或分发其代码/技能文本。 |

## 可复核的源码锚点

- 当前运行时：[turn-broker.ts](https://github.com/miuuyy/codex-chatgpt-web/blob/6f43747eb5585ca623c0617e729826dfd680c5b7/src/adapters/chatgpt-web/turn-broker.ts)、[turn-execution.ts](https://github.com/miuuyy/codex-chatgpt-web/blob/6f43747eb5585ca623c0617e729826dfd680c5b7/src/adapters/chatgpt-web/turn-execution.ts)、[codex-integration.ts](https://github.com/miuuyy/codex-chatgpt-web/blob/6f43747eb5585ca623c0617e729826dfd680c5b7/src/codex-integration.ts)、[tunnel.ts](https://github.com/miuuyy/codex-chatgpt-web/blob/6f43747eb5585ca623c0617e729826dfd680c5b7/src/tunnel.ts)。
- Oracle：[deepResearch.ts](https://github.com/steipete/oracle/blob/bfd25bd1d85c028af60bb708391d49e936c40701/src/browser/actions/deepResearch.ts) 的计划、启动和旧 target 排除条件，以及 [deepResearchResult.ts](https://github.com/steipete/oracle/blob/bfd25bd1d85c028af60bb708391d49e936c40701/src/browser/deepResearchResult.ts) 的不完整报告识别；[chatgptImages.ts](https://github.com/steipete/oracle/blob/bfd25bd1d85c028af60bb708391d49e936c40701/src/browser/chatgptImages.ts) 的 cookie 下载部分明确排除。
- Adam：[turn-ownership.ts](https://github.com/adamallcock/codex-chatgpt-control/blob/1e505394a01cec91d0b4880f3bc6c0cfbd45275c/packages/node/src/operations/turn-ownership.ts) 的 `classifyTurnOwnership` 接受归一化观察；只借鉴归属条件，不复制其完整证据摘要体系。
- yuyou：[image-generator 技能](https://github.com/yuyou-dev/ChatGPT-Bridge/blob/6b5eef1343158d37ce2bc4245892f7b3238fc5f0/plugins/chatgpt-bridge/skills/chatgpt-image-generator/SKILL.md) 与 [pageAssets 导出逻辑](https://github.com/yuyou-dev/ChatGPT-Bridge/blob/6b5eef1343158d37ce2bc4245892f7b3238fc5f0/plugins/chatgpt-bridge/scripts/chatgpt-bridge.mjs#L927-L941)，重点是当前图像、精确资源匹配和期望数量，不照搬其旧浏览器入口。
- TianLin：[chatgpt_dom.py:150–162](https://github.com/TianLin0509/chatgpt-web-images/blob/44ba51a33b63a982e5a19778911eabe08969d28a/scripts/chatgpt_dom.py#L150-L162) 是正常 UI 下载的调研锚点；本项目未采用其具体 share/This image 序列，同文件前段的 backend/fetch 分支也不采用。
- XiaoDuo：[MCP 只读状态/输出定义](https://github.com/XiaoDuoYa/codex-with-chatgpt/blob/535a07dbb7aee887924c53767d985c09d405319d/src/mcp/server.ts#L406-L473)；Leeheewon：[reportMarkdown](https://github.com/leeheewon-01/chatgpt-bridge/blob/ca69f099b0a4fc9c808cd80460def1b45f4d5cfb/src/deepresearch.js#L65-L99)。

旧核查记录未删除：2026-10-16 的 runtime `f137c2f84da5df214c1e228d74f5ff43e7641c48`、Evan 历史设计参考 `de76195c82a33fa70ec1cb60a277fe55b0332664`、Oracle `14ae9f9a00e222d4b08f34ceccafc86b5a3e815f` 保存在锁文件的 `previouslyInspected` 中；上表明确列出本轮新核查快照。

## 保留的早期排除记录

以下是 **2026-10-16 的历史取舍**，本轮未重新核查其版本、许可证或服务状态，也没有新增采用。

| 项目 | 当时取舍 |
|---|---|
| [Matchameleon/gpt-codex-plugin](https://github.com/Matchameleon/gpt-codex-plugin) | 核查仓库树未发现许可证文件，不移植代码。 |
| [Microck/chatgpt-webui-mcp](https://github.com/Microck/chatgpt-webui-mcp) | 已归档，不作为主干。 |
| [FirstWari/chatgpt-web](https://github.com/FirstWari/chatgpt-web) | stealth/代理轮换不符合本项目的原生浏览器边界。 |
| [yxhpy/chatgpt-pro-browser](https://github.com/yxhpy/chatgpt-pro-browser) | cookie 解密路线不采用。 |
| [Liao330/codex-chatgpt-bridge](https://github.com/Liao330/codex-chatgpt-bridge) | HTTP 默认模式与本项目网页原生交互的主路径不匹配。 |
| [robotlearning123/gpt2agent](https://github.com/robotlearning123/gpt2agent) | 私有 token/REST 路线不采用。 |
| [Fanch-hui/codex-bridge](https://github.com/Fanch-hui/codex-bridge) | 网页为主控的反向多 harness 路线，首版无需再叠一套。 |
| [herrkaefer/micpipe](https://github.com/herrkaefer/micpipe) | GPL 语音 UI 控制，后续研究；未集成/分发。 |
| [miuuyy/ChatGPT-Persona-Voice](https://github.com/miuuyy/ChatGPT-Persona-Voice) | 输出变声不等于网页实时语音代理。 |
| [malhashemi/opencode-gpt-live](https://github.com/malhashemi/opencode-gpt-live) | 不同服务路线，不作为 ChatGPT 网页语音实现。 |

官方插件规范参考：[打包插件](https://developers.openai.com/plugins/build/plugins)、[桌面插件](https://developers.openai.com/plugins/deploy/desktop-only)。
