# CODEBUDDY.md

当前项目是OpenSpec项目的汉化版，当前项目汉化后名叫@studyzy/openspec-cn，只有在命令行下是执行openspec-cn命令，而不是openspec命令了，但新建的目录也还是叫openspec，对应的SKILL也是保持openspec-XXX不变，不用变成openspec-cn-XXX。

在汉化过程中Schema作为特殊计算机词汇，不需要翻译成中文，保持不变即可。
## 项目概述

`@studyzy/openspec-cn` 是 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的简体中文汉化分支。OpenSpec 是一个面向 AI 编程助手的规范驱动开发框架——在写代码前通过提案(proposal)、规范(spec)、设计(design)、任务(tasks)四类制品与 AI 对齐意图。

- 原版 npm: `@fission-ai/openspec`
- 本仓库 npm: `@studyzy/openspec-cn`
- 汉化作者: @studyzy (Devin Zeng)

## 技术栈

- TypeScript, ESM 模块 (`"type": "module"`)
- Node.js ≥ 20.19.0
- pnpm 包管理
- CLI 框架: Commander.js
- 测试: Vitest
- 构建: `node build.js` (内部调用 tsc)
- ESLint: typescript-eslint

## 常用命令

```bash
# 安装与构建
pnpm install
pnpm build          # 编译 src/ → dist/
pnpm dev            # tsc --watch 增量编译

# 测试
pnpm test           # 运行全部测试 (vitest run)
pnpm test:watch     # watch 模式
pnpm test:ui        # Vitest UI 仪表盘
pnpm test:coverage  # 覆盖率报告

# 运行单个测试
pnpm exec vitest run test/path/to/file.test.ts
pnpm exec vitest run test/path/to/file.test.ts -t "case name"

# 注意：修改 src/ 后运行 CLI E2E 测试前需先 pnpm build，否则测试会使用过期的 dist/

# Lint
pnpm lint           # eslint src/

# 本地 CLI 调试
pnpm dev:cli        # 构建并运行 bin/openspec.js
```

## 代码架构

```
src/
├── cli/          # CLI 入口，Commander.js 定义所有命令与子命令
│   └── index.ts  # ~590行，注册 init/list/view/change/archive/spec/config/schema/store/doctor 命令
├── commands/     # 各命令的实现逻辑（与 cli 注册分离）
├── core/         # 核心抽象（最大模块）
│   ├── artifact-graph/  # 制品图系统：schema 解析、依赖图、状态追踪、指令生成
│   │   ├── types.ts     # Artifact, SchemaYaml 的 Zod schema
│   │   ├── schema.ts    # YAML schema 加载与校验（重复ID检测、引用完整性、DFS环检测）
│   │   ├── graph.ts     # 制品依赖图
│   │   ├── state.ts     # 运行时状态追踪
│   │   └── resolver.ts  # 依赖解析
│   ├── command-generation/  # 为 30+ 种 AI 工具生成斜杠命令
│   │   └── adapters/        # 每种工具一个适配器（claude, cursor, codebuddy, copilot 等）
│   ├── store/            # Store 系统（注册、注销、Git 操作、诊断）
│   │   └── operations.ts # ~1200行，Store 完整生命周期管理
│   ├── shared/           # 共享工具：Agent Skills 模板生成、工具检测
│   ├── config.ts         # AI_TOOLS 常量（31种工具），OpenSpec 可用性检测
│   ├── config-prompts.ts # 交互式配置提示
│   ├── init.ts           # 项目初始化（动态导入 @inquirer，ESLint 豁免静态导入限制）
│   ├── profiles.ts       # Profile 定义（core, custom）
│   └── legacy-cleanup.ts # 旧版制品清理
├── utils/        # 工具函数
│   ├── file-system.ts   # FileSystemUtils：路径操作、规范化、跨平台兼容
│   ├── item-discovery.ts # Spec/Change/Store 项目发现
│   └── ...
├── prompts/      # 自定义交互式提示（searchable-multi-select）
├── ui/           # CLI 输出美化（ASCII art、欢迎屏）
└── telemetry/    # PostHog 匿名遥测
```

### 入口文件

- `src/index.ts` — 库入口，导出 `cli/index` 和 `core/index`
- `bin/openspec.js` — CLI 可执行入口，调用 `runCli()`

### 关键设计决策

1. **动态导入 @inquirer**: 因预提交钩子挂起问题(#367)，所有 `@inquirer/*` 必须用 `dynamic import()` 而非静态导入。此规则由 ESLint `no-restricted-imports` 强制执行。唯一的例外是 `src/core/init.ts`（它本身被动态加载，静态导入 @inquirer 是安全的）。

2. **跨平台路径**: 必须使用 `path.join()` / `path.resolve()`，禁止硬编码斜杠。测试中预期路径值也必须用 `path.join()` 构建。路径同一性比较前需规范化（`FileSystemUtils.canonicalizeExistingPath()`）。

3. **制品图系统**: 核心抽象。每个 schema 定义制品及其依赖关系(`requires`)。系统追踪完成状态，按依赖顺序生成任务。

4. **Schema 驱动**: `schemas/spec-driven/schema.yaml` 定义��� 4 种制品（proposal → spec → design → tasks）及其依赖和模板。Schema 包通过独立仓库分发，类似 GitHub spec-kit 社区扩展模式。

5. **命令注册模式**: CLI 定义在 `cli/index.ts`，命令实现逻辑在 `commands/`。子命令注册通过 `registerSpecCommand`、`registerConfigCommand` 等函数完成。

6. **汉化范围**: 界面文字、文档、模板已汉化。代码标识符、CLI 参数名保持英文。`src/` 中中文字符串用 `// 中文注释` 标注。

## OpenSpec 开发工作流

本仓库自身使用 OpenSpec 管理开发。`openspec/` 目录结构：

```
openspec/
├── config.yaml      # 项目配置（schema: spec-driven, 技术上下文, 编码规则）
├── specs/           # 20+ 规范目录（每个含 spec.md）
├── changes/         # 当前活跃的变更提案
├── changes/archive/ # 已归档的变更
└── explorations/    # 设计探索文档
```

工作流：`/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`

## 测试结构

```
test/
├── AGENTS.md          # 测试编写指引
├── vocabulary-sweep.test.ts  # 确保退役术语不会重新出现
├── cli-e2e/           # CLI 端到端测试
│   ├── basic.test.ts  # help/version/init/validate
│   └── commands/      # 各命令测试（~17+ 文件）
├── core/              # 核心模块单元测试（~35 文件）
├── helpers/
│   └── run-cli.ts     # runCLI() 辅助函数，spawn dist/cli/index.js
└── fixtures/          # 测试固件（示例 openspec 项目）
```

CLI E2E 测试通过 `runCLI()` spawn 已构建的 `dist/cli/index.js`，创建临时目录，设置 `OPEN_SPEC_INTERACTIVE=0` 禁用交互提示，使用 `--json` 标志获取机器可解析输出。`vitest.setup.ts` 确保测试前 CLI 已构建。

## 发布

使用 Changesets 管理版本发布：

```bash
pnpm changeset     # 交互式创建 changeset
pnpm release       # 发布流程
```

Nix 支持通过 `flake.nix` 提供（`pnpm_9`, `nodejs_20`），支持 x86_64-linux, aarch64-linux, x86_64-darwin, aarch64-darwin。