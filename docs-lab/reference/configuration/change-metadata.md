# 变更元数据（.openspec.yaml）

> 每个变更存储的元数据所支持的字段与校验规则。

## 位置

每个变更将其元数据存放在 `openspec/changes/<change-name>/.openspec.yaml`，与其制品放在一起。创建变更时会写入该文件，并自动填入 `schema` 和 `created`。

## 字段

| 键 | 类型 | 必填 | 作用 |
| --- | --- | --- | --- |
| `schema` | string | Yes | 该变更遵循的工作流 schema |
| `created` | string, YYYY-MM-DD | No | 记录变更创建的日期 |
| `goal` | string | No | 记录变更打算达成的目标 |
| `affected_areas` | list of strings | No | 记录变更预期触及的领域 |
| `initiative` | map: `store` and `id` | No | 记录该变更所属的 initiative |
| `skip_specs` | boolean | No | 声明该变更不产生任何 spec 增量，因此零增量可通过校验 |
| `retire_capabilities` | boolean | No | 授权归档删除该变更清空的某项能力 |

### schema

该变更遵循的工作流 schema。它在变更创建时被设置，并且优先于项目配置，因此即使之后 `openspec/config.yaml` 发生变化，变更也会保留自己的 schema。运行 [`openspec schemas`](../cli.md#openspec-schemas) 可列出可用的 schema 名称。

### initiative

该变更所属的 initiative，以 store id 和 initiative id 表示，两者均为 kebab-case：

```yaml
initiative:
  store: platform-specs
  id: unify-billing
```

`store` 和 `id` 之外的键会被拒绝。目前没有任何命令读取该链接。

### skip_specs

声明该变更有意不产生 spec 增量：例如纯重构、工具或文档变更。设置后，校验接受零增量，且本会生成 spec 文件的制品也视为完成。若在 specs/ 下已存在 spec 文件时设置该字段，则是校验错误。

### retire_capabilities

授权归档时退役某项能力。当本变更的 REMOVED 增量移除了某能力所拥有的最后一条需求时，归档会删除该能力的主 spec，而不是中止。此标志之所以存在，是因为删除只能通过 git 恢复，所以由作者决定。

### 扩展键

以小写 `x-` 开头的顶层键归你所有，用于存放其他工具或你的团队保存在变更旁边的数据，例如追踪 ID 或负责人：

```yaml
schema: spec-driven
x-tracker: SB-5497
x-jiraKey: ABC-1
x-owner:
  team: payments
```

- **名称**：小写 `x-` 前缀后跟至少一个字符，任何位置都不能有空白字符。前缀之后大小写或拼写不限，所以 `x-jiraKey` 和 `x-trackerID` 均可。`X-Tracker`、裸的 `x-` 和 `x- tracker` 均不行，会被报告为未知键。
- **值**：任意 YAML 值。OpenSpec 不读取也不校验它，且不改变任何行为。
- **范围**：仅限顶层。`initiative` 内部的 `x-` 键与其他键一样仍会被拒绝。
- **校验**：扩展键永远不会被报告为未知，因此携带它们的变更可以通过 `openspec validate --strict`。
- **归档**：该文件随变更原样移动，扩展键一并保留。

## 示例

一个填写完整的 .openspec.yaml：

```yaml
schema: spec-driven
created: 2026-08-14
goal: Add magic-link login to the API
affected_areas:
  - auth
  - api
```

## 校验

每当命令写入或读取该文件时都会进行校验。写入校验失败会抛出异常且不写入任何内容。读取已有文件时，若 YAML 无效、字段违反其约定，或 schema 名称不可用，则失败。文件缺失不算错误，该变更视为没有元数据。

与 [config.yaml](config-yaml.md) 不同，坏值不会仅以警告方式丢弃。元数据错误会中止命令。

- **未知的顶级键**：OpenSpec 会忽略它们。`status`、`instructions`、`validate` 和 `archive` 会报告这些键没有生效。JSON 输出会在结构化结果中携带该警告。[扩展键](#扩展键)不是未知键，永远不会被报告。
- **严格校验**：`openspec validate --strict` 会把未知键的警告视为失败。仅多出扩展键的变更可以通过。
