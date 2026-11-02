# 可选网页 GPT-6 完整编码运行时

基础插件已打包本地 MCP，不需要 Bun、tunnel 或账户 API key。只有完整 agent 模式需要锁定的独立上游运行时。它通过网页模型和原生 Codex 工具循环工作，不调用模型推理 API。

## 准备

需要 Node.js 22+、Git、Codex CLI、**Bun 1.4.0**。Bun 从官方发行版或官方 npm 包安装；也可在 JSON 中传绝对 bun 可执行路径。本插件不全局安装/替换 Bun。

```sh
node dist/cli.mjs runtime prepare
```

它克隆 `miuuyy/codex-chatgpt-web` v6.1.13 并 checkout 固定 SHA `6f43747eb5585ca623c0617e729826dfd680c5b7`，校验 HEAD 和 tracked diff，按两个 bun.lock 安装主程序与 launcher 依赖。Git 下载中断保留 source.staging 供检查；不会把不完整克隆当成功。运行时约束见 runtime/integration-policy.json。源码留在用户数据目录，不写入插件缓存。

数据目录优先使用 `CCB_HOME`，未设置时兼容 `CWC_HOME`。两者均未设置时，旧默认目录 `~/.local/share/codex-web-capabilities` 存在则继续使用；否则使用新默认目录 `~/.local/share/codex-chatgpt-bridge`。新旧默认目录同时存在时停止并要求通过 `CCB_HOME` 明确选择，不覆盖或合并任何目录。运行时位于选定目录下的 `runtime/`。

- source：锁定上游源码，独立升级。
- profile：桥接配置、tunnel、日志。
- codex-home：完整编码使用的独立 Codex 配置。
- launcher-data：独立嵌入式浏览器登录态，不迁移 Chrome cookies。
- transaction.json、config.before.toml：安装阶段和配置备份。
- runs：每次原生工具循环的 JSONL 事件与执行记录。

## 独立浏览器和账号配置

```sh
node dist/cli.mjs runtime launcher
```

launcher 顺序构建 browser helper、构建 launcher renderer，再运行 launcher 的 `start` 生产入口。上游 `app`/`dev` 入口会传入 `--dev-profile`，进入模拟工具的 DEV harness；本插件使用生产入口，保留所选数据目录下 `runtime/profile`、`runtime/codex-home`、`runtime/launcher-data` 三个隔离目录。prepare、launcher、configure、doctor 和 exec 应使用同一个数据目录。子进程显式使用已记录的 Bun 路径，并清理继承的 DEV/Vite、外部 launcher 和额外 Codex home 等环境覆盖。

在独立 launcher 完成 ChatGPT 登录。这里与技能默认 Chrome 会话独立。首次构建 launcher 可能较慢。不要把主 Codex 的 Chrome cookie 复制过来。必须使用 launcher 生成的 browser-host descriptor；不推测固定位置。可在 profile/runtime 中查看 launcher 写出的描述文件名，文件内容可能包含本地 token，不在答复中打印。旧 DEV 窗口应正常退出，随后用本命令打开隔离生产窗口并完成登录。

完整模式需要 ChatGPT Developer Mode/相应 MCP 连接权限，以及官方 tunnel ID 和仅具有 Tunnels Read + Use 的 runtime key 文件。它用于 MCP 隧道，不是模型推理。账户/工作区没有权限时报告阻塞，不用其他接口绕过。

准备 configure.json（权限建议 0600；只放 key 文件路径，不放 key 本身）：

```json
{
  "tunnelId": "YOUR_TUNNEL_ID",
  "runtimeKeyFile": "/absolute/private/runtime-key.txt",
  "browserHostDescriptor": "/absolute/path/from-launcher/browser-host.json",
  "port": 43187,
  "retainedSession": true,
  "biggerContext": false,
  "acknowledgeUnofficial": true
}
```

```sh
node dist/cli.mjs runtime configure --input configure.json
node dist/cli.mjs runtime doctor
```

configure 仅在独立 codex-home 中运行上游 setup，首次可复制当前 config.toml（不复制 auth、cookies 或会话）。审批、sandbox、agents/features 原样保留，强制 native 协议、不启用 auto-approve、不传 replace-codex-route。若原配置的外部 provider/route 与上游不兼容，setup 会拒绝；可显式提供 `codexConfig` 指向用户审核的独立配置，保留需要的审批/沙箱设置后再配置。不要为了“能跑”直接关审批或改全局 provider。首次连接器授权由用户在网页完成。独立 codex-home 不复制主账号的 auth 文件；如果子 Codex CLI 提示需要登录，需在这个独立 profile 内通过 Codex 的正常登录流程完成认证，再运行 exec。

默认会话续接和正常 compaction；retainedSession 与 biggerContext 同时 true 会在修改前拒绝。Bigger Context 是实验选项，必须显式 retainedSession=false。不承诺固定型号、上下文大小或额度。

## 从 Codex 发起编码

在 Codex 调用 `$web-agent`，用运行时可见模型的真实标识创建 exec.json：

```json
{
  "root": "/absolute/path/to/authorized/repo",
  "promptFile": "/absolute/path/to/task.txt",
  "model": "VISIBLE_WEB_GPT6_MODEL_ID",
  "codex": "/absolute/path/to/codex"
}
```

```sh
node dist/cli.mjs runtime exec --input exec.json
```

先跑上游 doctor，要求 full/native、未自动批准工具调用。子 Codex 在独立 CODEX_HOME 下执行 `codex exec --json`，保持原配置审批和沙箱，不使用 --yolo/--full-auto。网页 Pro 通过上游 task/turn token 调用真正的原生工具，输出流同步到 Codex，事件写入 runs。Ctrl-C 转发中断；中断后查看原上游会话和 runs，不能自动重新运行写操作。CLI 只传任务文本给 Codex，不将网页字符串作为 shell 执行。

完成进程不等于验收通过：必须看到真实读取/修改/终端测试的工具事件，并检查本地改动与测试结果。缺少 tunnel/登录/模型时不可声称已接管编码。

## 回滚与卸载

```sh
node dist/cli.mjs runtime rollback
```

调用上游 journal-aware route disconnect 恢复其拥有的配置字段，保留后来用户修改，冲突由上游报告而不强制覆盖。若 setup 尚未写入 route，disconnect 可能报告尚未安装；备份和 transaction 仍保留。备份不能盲目覆盖后续用户修改。

关闭独立 launcher，按 Codex 的插件卸载入口卸载本地插件。主 Codex 配置从未由本安装器写入；数据默认保留，便于恢复。确认不需要任务/图片/证据后，用户可删除自己明确选定的数据目录；不自动递归删除用户目录。无需改变其他模型、任务或多 agent 配置。

## 版本融合说明

当前基线已经包含 30 分钟 retained turn tab、增量 conversation 和 compaction 恢复；不重复移植 fork 的相同代码。Evanlau 的会话优先/扩大上下文互斥作为 wrapper 配置策略采纳。runtime/patches/README.md 记录当前无源码 diff 与后续补丁校验规则；不声称已移植全部 Enhanced fork。Claude Code 客户端不是本首版范围。
