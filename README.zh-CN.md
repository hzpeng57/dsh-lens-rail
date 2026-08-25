# @hzpeng/dsh-lens-rail

为 DeepSeek Harness（DSH）Web 对话界面提供的 **Codex 风格左侧消息导航轨道**。

在对话记录**左侧**边缘，有一列短横线——每一条横线代表一轮对话（包含你的提问和 agent 的回复）。它是一个 scroll-spy 定位器：当前阅读位置对应的横线以品牌色高亮；鼠标悬停时，光标下的横线变长、上下相邻的横线向两端平滑渐短（Codex 的「镜头」效果）；点击任意横线可跳转到对应消息（必要时自动加载更早的历史）。

> 与 `@max-null/dsh-chat-rail`（右侧、悬停时展开成带标题/编号/时间的面板）不同，本轨道始终保持一列干净的短横线，并锚定在**左侧**，贴合 Codex（ChatGPT）App 的交互。

## 特性

- **左侧定位**——位于对话滚动区（scrollBody）内、距左侧约 8px，垂直居中，高度不超过滚动区的 60%；上下两端带淡出渐变。
- **每条消息一条线**——每个用户 turn 及其后的 agent 回复都对应一条横线；工具行、命令、turn-tail 不参与，轨道呈现的是「对话」而非「步骤流水」。
- **镜头悬停**——聚焦的横线最长，向上下各 4 条内**线性**衰减回基准长度（与 Codex 一致：从聚焦线向上下数到第 4 条即回到未激活长度）。
- **连续悬停区**——每条横线是一个 30×12 的命中块，块之间零间距，鼠标上下移动不会在间隙处丢失悬停（无跳变）。
- **滚动定位高亮**——距视口 40% 线最近的横线高亮（品牌色），跟随阅读位置；滚动不会反向改变横线长度。
- **悬停预览**——用户消息（单行高亮省略）+ agent 回复（最多 3 行省略）在横线右侧浮出。
- **点击跳转**——`loadOlder` 按需翻页加载更早历史，再滚动到目标行；长跳转时顶部显示「正在加载历史消息…」提示。
- **主题适配**——使用 DSH 别名 token（`--dsw-alias-*`），浅色/深色主题均正常。

## 工作原理

- **Host 半端**注册 `chatRail` 会话投影：从会话日志按顺序枚举每条用户消息（`seq`/`time`/`id`/预览文本），并把后续的 `assistant/message` 回复配对到最近的用户 turn（`assistantText`）。投影注册后会重放完整历史日志，因此**未加载进窗口的旧消息也有横线**。
- **Client 半端**读取投影 + 会话快照的 chat 节点，每个节点携带的 `.key` 即 `data-chat-anchor-key`，同一把 key 同时驱动 scroll-spy 扫描、悬停命中与点击跳转。

## 安装

插件通过 `cordis.patch.yml` 的 insert 挂载，并从 profile 依赖树解析。

```bash
dsh plugin --profile web add @hzpeng/dsh-lens-rail
```

重启 `dsh web` 并硬刷新浏览器。客户端 bundle 由 `/plugins/@hzpeng/dsh-lens-rail/client.js` 运行时下发，无需重建 DSH Web 产物——只需重启进程以加载新的 loader 条目。

## 卸载

从 `$DSH_HOME/profiles/web/cordis.patch.yml` 移除 `- insert: { id: dsh-lens-rail, ... }` 块，并从 `package.json` 移除对应依赖，然后重启 `dsh web`。

## License

MIT
