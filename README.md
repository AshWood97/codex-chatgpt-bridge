# Codex ↔ ChatGPT Bridge

由 Codex 发起并掌控的双路线桥接：通过 **ChatGPT 网页**进行代码审查、持续协作、深度研究和图像任务；或通过 **Codex 桌面环境提供的会话工具**与已有的 ChatGPT 聊天协作。Codex 负责核对本地代码、修改和测试。另有可选的完整网页 agent 运行时，实时语音接口返回 `not_implemented`。

这是验证版。2026-10-22 曾在 Chrome 普通 GPT-6 chat + 高档位完成代码审查、本地修复、同会话复审、研究报告提取与单图编辑下载；2026-11-02 单独验证了用户手动选择 Pro 的桌面聊天单轮消息接力。**完整 agent 工具循环、桌面自动选 Pro 和无人值守长任务仍未验收。**历史证据和实际限制见 [验收记录](docs/acceptance.md)，接力从 [HANDOFF.md](HANDOFF.md) 开始。

## 两条使用路线

| 路线 | 入口与适用场景 | 运行边界 |
|---|---|---|
| 网页 | `$web-pro-review`、`$web-pro-collaborate`、`$web-deep-research`、`$web-image` | Codex 通过原生 Browser Use 操作 Chrome；按当前工具规则支持内置浏览器回退。账户模型和 Pro 档位以绑定页面实际选择为准。详见 [网页工作流](docs/browser-workflow.md)。 |
| 桌面聊天 | `$chatgpt-pro-bridge` | 在用户明确指定并授权的已有 ChatGPT「聊天」对话中协作；用户选 Pro，Codex 用当前桌面提供的 `codex-app-tools` 发送、读取并在本地验证。插件本身不提供这些桌面工具，不能自动新建普通 ChatGPT 聊天或独立设置、验证 Pro。详见 [桌面聊天接力](docs/desktop-chat.md)。 |

桌面聊天的单轮实测由用户手动选择并确认 Pro；会话工具没有返回模型档位证据。读取曾有延迟，需要用户切换并重新打开对话，不能据此宣称无人值守稳定。两条路线不自动互相切换，也不自动回退为模型 API。

## 安装

需要 Node.js 22+ 和 Codex 本地执行环境。网页路线需要当前会话的原生 Browser Use 和 Chrome 扩展，或按其工具文档使用内置浏览器；桌面聊天路线还需要当前 Codex 桌面环境提供 `codex-app-tools`。普通网页流程无需 Bun 或 tunnel。源码仓库中运行：

```sh
npm ci
npm run package
codex plugin marketplace add "$PWD/release/codex-chatgpt-bridge-marketplace"
codex plugin add codex-chatgpt-bridge@codex-chatgpt-bridge-local
```

发行文件以 `codex-chatgpt-bridge-plugin-<版本>.tar.gz` 和 `codex-chatgpt-bridge-source-<版本>.tar.gz` 命名。已有插件包时，解压后注册其中的本地 marketplace；安装后刷新当前会话的插件列表。发行包的 Node MCP 包含生产依赖，插件缓存无需另装 npm 依赖；Git 仓库不提交 node_modules 或 dist。新名称候选已在独立临时 CODEX_HOME 中完成 CLI 注册、安装、启用与卸载；当前桌面会话加载仍未验收。

七个技能入口：

| 入口 | 用途 |
|---|---|
| `$web-pro-review` | 网页 CR、源码快照与行号、本地核验、修复和复审 |
| `$web-pro-collaborate` | 同仓库同网页会话的多轮咨询与测试反馈 |
| `$web-deep-research` | 真正网页研究模式、当前轮次报告全文和引用 |
| `$web-image` | 网页图像生成、参考图编辑、原图导入与批次数量检查 |
| `$web-agent` | 可选完整网页 agent，真实工具循环尚未验收 |
| `$web-diagnostics` | 浏览器与桌面连接、模型档位、任务和运行时诊断 |
| `$chatgpt-pro-bridge` | 用户授权的既有桌面 ChatGPT 聊天接力 |

## 使用和迁移

例如：“用 `$web-pro-review` 审查当前 diff，核对后修复，再在同一网页会话复审”，或“用 `$chatgpt-pro-bridge` 向我指定的 ChatGPT 对话发送这段审查请求”。默认网页 CR/协作使用普通 chat；明确要求 Pro 时核对实际选择，不能把 High/高/Max 或订阅徽章当成 Pro，也不静默降级。桌面接力由用户选择并确认 Pro；工具的读取结果不能独立证明模型。

任务数据路径优先使用 `CCB_HOME`；未设置时兼容旧的 `CWC_HOME`。均未设置时，已有旧目录 `~/.local/share/codex-web-capabilities` 会继续使用；没有旧目录的新安装使用 `~/.local/share/codex-chatgpt-bridge`。若新旧默认目录都存在，程序要求通过 `CCB_HOME` 明确选择，两个目录均不覆盖、不自动合并。历史任务的 `CWC-` 标识和恢复合同保留。

包可执行文件在安装到 PATH 后提供新命令 `ccb`、`ccb-mcp`，旧名称 `cwc`、`cwc-mcp` 保留为兼容入口。源码目录也可直接使用同一 CLI：

```sh
node dist/cli.mjs capabilities
node dist/cli.mjs prepare --input task.json
node dist/cli.mjs list
node dist/cli.mjs status --input job-id.json
```

`task.json` 示例中的仓库路径由使用者填写，仅发送任务相关内容：

```json
{
  "kind": "review",
  "mode": "chat",
  "prompt": "审查本次修改中的可复现缺陷，优先检查边界条件。",
  "context": {
    "root": "/PATH/TO/AUTHORIZED/REPOSITORY",
    "scope": "changes",
    "files": ["src/related-module.ts"]
  }
}
```

网页任务绑定快照、浏览器、标签页、会话和轮次，默认最多两任务并发。发送前持久化 `send_pending`；中断后观察原会话，不重复发送。桌面聊天使用当前 app-tools 追踪已有对话，并不自动使用网页任务 MCP 管理浏览器。

## 当前结果与边界

- **网页 CR/协作，2026-10-22：** Chrome 普通 GPT-6 chat + 高发现 `shipping.mjs:3` 的免邮边界问题；Codex 修复后 2 项本地测试通过，同会话复审 0 findings。第三轮协作后新增 0、正负 Infinity 断言，合成仓库 3 项测试通过。重开已保存的 Chrome 会话时两条旧助手回复无法加载，不能称为网页重载恢复通过。
- **网页 Deep Research，2026-10-22：** 组件加载错误后仅重试组件一次，未新增用户消息；取得当前轮次 3832 字符报告。UI 显示 9 来源 / 9 引用 / 122 搜索，DOM 正文含 8 条 HTTPS 来源；技术断言未逐条独立审核，澄清和计划分支未触发。
- **网页图像，2026-10-22：** 初始图和参考图编辑结果均为 1254×1254，Chrome 预览 Download 保存原图，文件均已打开。初始图没有预点击文件系统基线；编辑图用完整基线定位唯一新增文件。`pageAssets` 未覆盖本轮 blob；真实多图 batch 仍待验收。
- **桌面聊天，2026-11-02：** 用户手动选择并确认 Pro，允许发送一次测试消息；会话工具随后读到对应请求和 `PRO_BRIDGE_OK` 回复。模型选择来自用户确认，工具不回传档位；读取有延迟，曾需用户重新打开对话。这不是桌面完整 CR、自动新建/选档或长任务通过的证明。
- **本次整合检查，2026-11-02：** `npm run check` 的 37 项自动测试与七技能格式检查通过，覆盖身份迁移与历史任务续接；不代替网页和完整 agent 实机验收。
- **历史本地检查，2026-10-22：** 当时版本 `npm run check` 的 31 项自动测试和六技能 `quick_validate` 通过；不将旧候选的测试结果当作本次改名和新增技能的验证结果。

网页源码包明确覆盖范围、排除项与过期状态；秘密扫描是启发式过滤。研究拒收普通长回复、旧报告和进度占位；图像要求当前轮次原文件并校验格式、尺寸、重复和数量。可选只读 MCP 仅提供冻结快照读取。

## 可选完整 agent

可选完整模式复用锁定上游的独立浏览器和 task-bound tool broker，将网页模型接入 Codex 原生工具循环，需要独立 launcher 登录、MCP/tunnel 权限及配置；不迁移 Chrome 登录状态。当前基线为 `miuuyy/codex-chatgpt-web` v6.1.13（`6f43747eb5585ca623c0617e729826dfd680c5b7`）。2026-10-22 production launcher 曾真实启动，但独立登录、授权和真实读取→修改→终端测试工具循环尚未完成，不能把启动成功当作编码验收。详见 [运行时说明](docs/runtime.md)。

## 开发与交接

在源码目录运行 `npm run check` 检查类型、测试、许可证和插件格式；发行构建使用 `npm run package`。[接力计划](docs/plans/2026-10-16-agent-handoff.md) 和 [证据索引](docs/evidence/README.md) 保留历史记录，[参考项目](docs/reference-projects.md) 与 [第三方声明](THIRD_PARTY_NOTICES.md) 记录固定快照、许可证和采用方式。

卸载新插件可使用 `codex plugin remove codex-chatgpt-bridge@codex-chatgpt-bridge-local` 或桌面插件目录。旧插件若曾安装，需要按旧安装来源单独处理；卸载不自动删除任务、图片或证据。配置过可选运行时的使用者先按运行时文档执行 rollback 并关闭 launcher。
