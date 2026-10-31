# Kimi Code CLI · `/inj` fork

这是 [MoonshotAI/kimi-code](https://github.com/MoonshotAI/kimi-code) 的一个 fork。它只额外维护一个功能：**`/inj` 思考前缀注入（thinking prefill）**。除此之外的行为都与上游保持一致，上游的安装、使用和文档请看 [README.zh-CN.md](README.zh-CN.md) 或[官方文档](https://moonshotai.github.io/kimi-code/zh/)。

- 基线版本：上游 `main` @ `a2afdbc7d`（kimi-code 2.4.1）
- Fork 仓库：[Yifang-Qin/kimi-code-inj](https://github.com/Yifang-Qin/kimi-code-inj)

## `/inj` 做什么

`/inj <text>` 把 `<text>` 当作一条普通的 user prompt 提交，同时给这个 prompt 对应的 turn 带上一段**思考前缀**。在这个 turn 第一个模型 step 的实际请求里，会在消息列表末尾额外追加一条只包含 thinking 的 assistant 消息（Kimi 平台的 [Partial Mode](https://platform.kimi.ai/docs/guide/use-partial-mode-feature-of-kimi-api)）：

```json
{ "role": "assistant", "content": "", "reasoning_content": "<prefix>", "partial": true }
```

模型会**从这段前缀开始接着往下思考**，而不是把它当成一段已经说完的回答，也不是一条额外的指令。实测时，把前缀停在半个算式 `… = 23*10 + 23*` 上，模型返回的思考直接以 `7 = 230 + 161 = 391` 开头。

默认前缀：

```text
I should follow the user command. Now consider what to do. Should plan.
```

### 命令

| 命令 | 作用 |
|---|---|
| `/inj <text>` | 带思考前缀发送一条 prompt；turn 运行中时，与普通 prompt 一样排队 |
| `/inj-setup` | 打开选择器：默认前缀 / 自定义前缀 / 编辑自定义文本 / 查看当前设置 |
| `/inj-setup default` · `custom` | 切换前缀来源；切回 `default` 不会删除已保存的自定义文本 |
| `/inj-setup edit` | 把 `/inj-setup set <当前文本>` 填进编辑器，可多行编辑，也可用 Ctrl-G 打开外部编辑器 |
| `/inj-setup set <text>` | 直接设置自定义前缀，并切到 `custom` |
| `/inj-setup show` | 查看当前模式、生效的前缀和已保存的自定义文本 |

设置保存在 `tui.toml` 中，保存后立即生效：

```toml
[inj]
mode = "default" # "default" | "custom"
custom_text = ""
```

TUI 中，本地前缀会在第一步开始时以 accent 颜色显示为 `[prefill] <prefix>`，模型真正返回的 thinking 仍是原来的弱化斜体，两者不会混在一起。

### 适用范围与报错

- 只支持 **Kimi provider（`type = "kimi"`）+ OpenAI Chat Completions 协议**，并且 thinking 不能是 `off`。Kimi Code 托管端点和 Kimi 开放平台都属于这种情况。其他 provider 或协议会**明确报错**，不会静默忽略。
- 功能默认开启。设置 `KIMI_CODE_EXPERIMENTAL_THINKING_PREFILL=0` 可以关闭，关闭后使用 `/inj` 会报错。
- goal 运行中 `/inj` 会报错并把输入还给编辑器：goal 期间的 prompt 会被转成 steer，而 steer 不携带前缀。
- 已在 Kimi Code 网关上实测通过：`kimi-for-coding`、`k3.1-pro`。

## 作用链路

```
TUI  /inj <text>
 │  commands/inj.ts        解析前缀（默认常量或 tui.toml 自定义），生成 restoreText = "/inj <text>"
 │  kimi-tui.ts            随 prompt 生成 promptId；排队、恢复编辑器时用 restoreText；不参与 steer
 ▼
SDK  session.prompt(input, { promptId, thinkingPrefill })        packages/node-sdk
 ▼
klient  promptPayloadSchema.thinkingPrefill（zod 合约）           packages/klient
 ▼
引擎  AgentPromptChannel.submit                                   packages/agent-core-v2
 │   ① 检查开关 + 当前模型（kimi / openai / thinking≠off），不满足直接报错
 │   ② loop.submit(entry, { thinkingPrefill })
 ▼
AgentLoopService
 │   前缀只挂在内存里：PromptWaiter → 当前 turn（ActiveTurn）
 │   requesterFacade：只给"当前 turn 的 turn 请求"加上 overrides.thinkingPrefill
 │   stepCompleted 之后清空 → 同一步的重试（退避 / 投影 / 媒体降级）仍然带，下一步不带
 ▼
AgentLoopRequester.resolveRequest
 │   ③ 用这一轮固定下来的模型再检查一次，然后 request.with({ protocol: { options: { thinkingPrefill } } })
 ▼
kimiOpenAIProtocol.flatten
     在最终的 wire messages 末尾追加 partial assistant 消息 → 发往 Kimi
```

几条不变量：

- **不持久化**：前缀不进入 context、history、wire 记录或 replay，也不改写用户的原始输入。
- **只作用于第一个 step**：工具执行之后的下一步、下一条 prompt、恢复后的会话都不会再带。
- **只在 Kimi 编码层生效**：通用 OpenAI 协议不会发出这条消息。
- 平台不会回显前缀，所以模型返回的 thinking 里只有续写的部分，前缀本身只通过 TUI 的 `[prefill]` 行显示。续写出的 thinking 是模型的真实输出，会照常留在历史里。

## 改动文件

同步上游时主要关注这些文件：

| 层 | 文件 |
|---|---|
| 引擎 | `packages/agent-core-v2/src/agent/loop/thinkingPrefill.ts`（新增：flag + 支持性检查）<br>`agent/loop/{loop,promptChannel,loopService,requester,requesterContract}.ts`<br>`human/llm/builtin/protocol/openai/index.ts`（`OpenAIOptions.thinkingPrefill`）<br>`human/llm/builtin/provider/kimi/protocol.ts`（`flatten` 追加 partial 消息）<br>`src/index.ts`（导出） |
| 合约 / SDK | `packages/klient/src/contract/agent/schemas.ts`、`packages/klient/src/core/facade/agent.ts`<br>`packages/node-sdk/src/{session,rpc,sdk-rpc-client-v2}.ts` |
| TUI | `apps/kimi-code/src/tui/commands/inj.ts`、`constant/inj.ts`、`components/messages/thinking-prefill.ts`（新增）<br>`commands/{registry,dispatch,config,reload}.ts`、`config.ts`、`types.ts`、`kimi-tui.ts`<br>`controllers/{session-event-handler,streaming-ui,editor-keyboard}.ts`、`components/panes/queue-pane.ts` |
| 测试 | `agent-core-v2`：`test/agent/loop/loop.test.ts`、`src/human/test/llm/thinking.test.ts`<br>`node-sdk`：`test/session-prompt-events.test.ts`（假 Kimi 服务端到端）<br>`kimi-code`：`test/tui/config.test.ts`、`test/tui/controllers/session-event-handler-step-retry.test.ts` |

## 构建

环境要求：Node.js ≥ 24.15.0，pnpm 10.33.0。

```sh
pnpm install
pnpm run build:packages            # 构建 workspace 包
pnpm -C apps/kimi-code run build   # 构建 CLI → apps/kimi-code/dist/main.mjs
```

用独立的数据目录运行，避免与官方安装的 `kimi` 互相影响：

```sh
KIMI_CODE_HOME="$HOME/.kimi-code-dev" node apps/kimi-code/dist/main.mjs
```

相关测试：

```sh
(cd packages/agent-core-v2 && npx vitest run test/agent/loop/loop.test.ts src/human/test/llm/thinking.test.ts)
(cd packages/node-sdk && npx vitest run test/session-prompt-events.test.ts)
(cd apps/kimi-code && npx vitest run test/tui)
```

## 同步上游

```sh
git remote add upstream https://github.com/MoonshotAI/kimi-code.git   # 只需一次
git fetch upstream
git rebase upstream/main
```

冲突最可能出现在 `loopService.ts`、`requester.ts`、`kimi-tui.ts` 和 `tui/config.ts`。解决冲突后重新跑上面的测试；`packages/agent-core-v2` 是无注释区，提交前请运行 `node scripts/check-no-comments.mjs`。

## License

沿用上游的 [MIT License](LICENSE)。TUI 基于 [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui) 构建。
