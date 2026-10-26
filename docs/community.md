# 社区展示

一个由社区维护的"精选列表"，收录基于 OpenSpec 构建的项目与资源。欢迎提交工具、集成、工作流和学习资源。社区成员通过提交 issue 共同丰富这份展示，由维护者添加条目。

所列项目均为独立维护。收录不代表 OpenSpec 官方支持或背书。设置与支持请查看各项目的文档与 issue 跟踪器。

## 项目与资源

- **[OpenSpec Workbench](https://github.com/VeryComplexAndLongName/OpenSpec-UI)**：在 OpenSpec 变更上运行和监督 agent。
- **[openspec-guard](https://github.com/guillaume-flambard/spec-guard)**：一个 CLI 和 GitHub Action，无需运行测试即可报告哪些 OpenSpec 场景被 Vitest 或 Jest 测试覆盖。

## 托管服务

为 OpenSpec 增加 CLI 尚未提供的能力的托管产品。每个条目都说明其账号、付费与数据处理条款。

- **[MySpec](https://myspec.dev)**：云端 beta（需要账号；免费档，无需信用卡），提供引导式 spec 访谈，导出四文件包或与 OpenSpec 兼容的变更。其 MCP 服务器（`@myspec/mcp-server`）和 [Claude Code 插件](https://github.com/myspecs/claude-plugins)让编码代理能够读取这些 spec、编写 OpenSpec 变更并按任务逐个实现。该服务会将提交的内容发送给第三方 AI 提供商，不适合敏感数据。
- **[Entalpa](https://entalpa.com/en/openspec)**：将公开 GitHub 仓库的 `openspec/specs/`（最多 300 条需求）导入为可浏览的项目，添加利益相关者、故事和标注为推断性的开放问题，并将结果导出为 `openspec/specs/` 树；它从不写入仓库。导入和阅读无需账号；保存或编辑需要账号，AI 功能使用付费额度。导入的内容会发送给第三方 AI 提供商。
- **[OpenSpec Review](https://skillgild.dev/skills/openspec-review) 和 [OpenSpec Compact](https://skillgild.dev/skills/openspec-compact)**：SkillGild 为 Claude Code、Codex、Cursor、Gemini CLI 或任何 MCP 客户端提供的托管技能。Review 将变更发布为一个链接，任何持有该链接的人无需账号即可按需求批准、请求修改或评论，展示主 spec（如同 `openspec archive` 会写出的样子），并标记其他开放变更也涉及的需求。Compact 在主 spec 之间查找词汇相似的需求和重复的场景，并将清理工作写成一个 OpenSpec 变更。需要 SkillGild CLI 和免费账号（每个技能每月 25 次运行）。两者都会将 spec 内容发送到 SkillGild 的服务器（运行闭源代码，不调用 AI 模型）；Review 还会发送提案、设计和任务，并保留该变更 30 天。

## 添加你的项目

提交一个 issue，附上你想添加的那一行内容：你的项目名称、直接链接，以及一段关于它与 OpenSpec 关系的简短描述。维护者会把它加到本文件中。

- 条目应聚焦于用 OpenSpec 构建的内容或支持其使用的内容，而不是一般性的产品宣传。
- 描述人们能使用什么。避免推广性声明、推荐链接和跟踪链接。
- 如有条目涉及付费功能或需要注册账户，请在条目中说明。
- 托管或付费服务只有在为 OpenSpec 增加 CLI 尚未提供的能力且有免费试用方式时，才列入"托管服务"。重新打包 OpenSpec 自身技能或命令的服务不予列出。

也欢迎对现有条目的更正与更新。
