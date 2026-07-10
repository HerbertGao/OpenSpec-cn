# 发布 `@herbertgao/openspec-cn`

本包通过 **npm OIDC 可信发布（Trusted Publishing）** 从 GitHub Actions 发布——
无需 npm token、无需管理 2FA、无需轮换密钥。

## 一次性配置（npm 端）

在把本包切到 OIDC 之前，先在 npm 上配置信任发布者：

1. 登录 npmjs.com → 打开包 [`@herbertgao/openspec-cn`](https://www.npmjs.com/package/@herbertgao/openspec-cn) → **Settings** → **Trusted Publisher**。
2. 选 **GitHub Actions**，填：
   - **Organization or user**：`HerbertGao`
   - **Repository**：`OpenSpec-cn`
   - **Workflow filename**：`release.yml`
   - **Environment**：留空
   - **Allowed actions**：勾 `npm publish`
3. 保存。

> 包必须已存在才能配置信任发布者（首个 1.5.0 已用 token 发布，满足条件）。

配置完成后即可删除仓库里的 `NPM_TOKEN` secret —— OIDC 不再需要它。

## 发布新版本

```bash
# 1) 在 main 上更新版本号（package.json version）
# 2) 打 tag 并推送，触发 .github/workflows/release.yml
git checkout main && git pull
git tag vX.Y.Z && git push origin vX.Y.Z
```

工作流会：pnpm 安装/构建 → 升级 npm 到 ≥ 11.5.1 → 校验打包版本 →
`npm publish --access public`（经 GitHub OIDC 认证，自动附带 provenance 溯源）。

## 要点 / 排错

- **权限**：`release.yml` 顶部已声明 `id-token: write`（生成 OIDC 令牌所需）。
- **版本**：需 npm CLI ≥ 11.5.1、Node ≥ 22.14（工作流已用 Node 22 并升级 npm）。
- **用 npm 而非 pnpm 发布**：pnpm 对 OIDC 支持不稳定（pnpm 11 会 404），故发布步骤显式用 `npm publish`；pnpm 仅用于安装/构建。
- **版本号策略**：跟随上游 OpenSpec；我们自己的补丁在同版本号内叠加，分叉点记录在 `CHANGELOG.md`。
- 若 OIDC 发布报找不到 trusted publisher，检查 npm 端 workflow 文件名是否正好是 `release.yml`、组织/仓库名是否与实际一致（大小写敏感）。
