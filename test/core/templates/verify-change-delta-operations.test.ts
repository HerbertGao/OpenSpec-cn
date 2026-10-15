import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  getVerifyChangeSkillTemplate,
  getOpsxVerifyCommandTemplate,
} from '../../../src/core/templates/skill-templates.js';

// #1959: verify treated every "### Requirement:" in a change's delta specs as
// behavior that must exist, whichever section it sat under. A REMOVED
// requirement that was removed correctly came back as CRITICAL "Requirement not
// found" with the recommendation to implement it, so an agent following the
// report restored what the change had just deleted.
const bodies: Array<[string, string]> = [
  ['skill', getVerifyChangeSkillTemplate().instructions],
  ['command', getOpsxVerifyCommandTemplate().content],
  // The committed skills.sh mirror is what `npx skills add` installs.
  [
    'committed skill file',
    readFileSync(new URL('../../../skills/openspec-verify-change/SKILL.md', import.meta.url), 'utf8'),
  ],
];

function section(body: string, start: string, end: string, label: string): string {
  const from = body.indexOf(start);
  const to = body.indexOf(end, from + start.length);
  expect(from, `${label}: "${start}" not found`).toBeGreaterThanOrEqual(0);
  expect(to, `${label}: "${end}" not found after "${start}"`).toBeGreaterThan(from);
  return body.slice(from, to);
}

describe('verify checks each requirement by its delta operation', () => {
  it.each(bodies)('%s: classifies requirements by delta section before checking them', (label, body) => {
    const coverage = section(body, '**Spec 覆盖**', '6. **验证正确性**', label);

    // RENAMED entries carry no "### Requirement:" heading, so a rename-only
    // delta must not read as empty.
    expect(coverage, label).toContain('或在 `## RENAMED Requirements` 下列为 `FROM:`/`TO:` 对');
    for (const header of ['## ADDED', '## MODIFIED', '## REMOVED', '## RENAMED Requirements']) {
      expect(coverage, label).toContain(header);
    }
    // The unscoped loop is what produced the bug.
    expect(coverage, label).not.toMatch(/^\s*- 对每条需求：$/m);
  });

  it.each(bodies)('%s: reports a missing requirement only for ADDED or MODIFIED', (label, body) => {
    const coverage = section(body, '**Spec 覆盖**', '6. **验证正确性**', label);
    const addedOrModified = section(coverage, '- 对每条 ADDED 或 MODIFIED 需求', '- 对每条 REMOVED 需求', label);

    expect(addedOrModified, label).toContain('添加 CRITICAL 问题："未找到需求：<需求名>"');
  });

  it.each(bodies)('%s: inverts the check for a REMOVED requirement', (label, body) => {
    const coverage = section(body, '**Spec 覆盖**', '6. **验证正确性**', label);
    const removed = section(coverage, '- 对每条 REMOVED 需求', '- 对每条 RENAMED 条目', label);

    expect(removed, label).toContain('找不到实现是预期结果，但前提是你搜索的正是基线行为。');
    expect(removed, label).toContain('绝不把 REMOVED 需求报告为 "未找到需求"');
    expect(removed, label).toContain('添加 CRITICAL 问题："被移除的需求仍有实现：<需求名>"');
    expect(removed, label).not.toContain('建议："实现需求 X');
  });

  it.each(bodies)('%s: does not report the old name of a RENAMED requirement as missing', (label, body) => {
    const renamed = section(body, '- 对每条 RENAMED 条目', '6. **验证正确性**', label);

    expect(renamed, label).toContain('不要把 FROM 名称报告为缺失');
    expect(renamed, label).toContain('也不要要求重命名代码符号、标识符或文件名');
  });

  // A rename keeps behavior, so a rename-only change must still prove the
  // behavior exists before verify can call it ready. Its evidence is the
  // baseline requirement in the main spec, not the RENAMED entry itself.
  it.each(bodies)('%s: verifies the unchanged behavior of a RENAMED requirement against its baseline', (label, body) => {
    const renamed = section(body, '- 对每条 RENAMED 条目', '6. **验证正确性**', label);

    expect(renamed, label).toContain('因此检查 TO 需求所保留的该行为');
    expect(renamed, label).toContain('`<planningHome.root>/openspec/specs/<capability-path>/spec.md`');
    expect(renamed, label).toContain('仅当 FROM 名称不存在（主 spec 已同步）时取 TO 名称');
    expect(renamed, label).toContain('其正文和场景就是 TO 需求所保留行为的证据。');
    expect(renamed, label).toContain('在代码库中搜索该行为并评估是否仍有实现。');
    expect(renamed, label).toContain('添加 CRITICAL 问题："未找到重命名需求：<TO 名称>"');
    expect(body, label).toContain('- 行为不再实现的重命名需求');
    expect(renamed, label).toContain('若 TO 名称也出现在 MODIFIED 下，其行为在彼处对照 MODIFIED 文本检查');
  });

  it.each(bodies)('%s: never counts an unchecked rename as passing', (label, body) => {
    const renamed = section(body, '- 对每条 RENAMED 条目', '6. **验证正确性**', label);

    expect(renamed, label).toContain('若找不到或无法读取基线需求，将该条目的 **Spec 覆盖**标记为未验证');
    expect(renamed, label).toContain('绝不把未检查的重命名计为通过。');
    expect(body, label).toContain('每条有可用基线的 REMOVED 和 RENAMED 条目在那里对照其基线行为检查');
  });

  it.each(bodies)('%s: maps implementation and scenarios only for ADDED or MODIFIED requirements', (label, body) => {
    const correctness = section(body, '6. **验证正确性**', '7. **验证连贯性**', label);

    expect(correctness, label).toContain('- 对 delta specs 中的每条 ADDED 或 MODIFIED 需求');
    expect(correctness, label).toContain('- 对 delta specs 中 ADDED 或 MODIFIED 需求下的每个场景');
    expect(correctness, label).toContain('跳过 REMOVED 需求下的场景');
    expect(correctness, label).not.toContain('- 对 delta specs 中的每条需求：');
    expect(correctness, label).not.toContain('- 对 delta specs 中的每个场景');
  });
  // With #1732's "Not verified" rule, a change with nothing to add or modify
  // left both correctness checks empty, which read as unverified and withheld
  // readiness. That is the exact case #1959 reports.
  it.each(bodies)('%s: treats the correctness checks of a removal-only change as not applicable', (label, body) => {
    const correctness = section(body, '6. **验证正确性**', '**需求实现映射**：', label);

    expect(correctness, label).toContain('若 delta specs 可读且至少包含一条 REMOVED 或 RENAMED 需求、但没有 ADDED 或 MODIFIED 需求');
    // An empty or unparseable delta must not pass as a removal-only change.
    expect(correctness, label).toContain('完全没有可解析需求的 delta spec 属于不可用证据，而非仅移除的变更：将这些检查标记为未验证。');
    expect(correctness, label).toContain('将**需求实现映射**和**场景覆盖**报告为**不适用**');
    expect(correctness, label).toContain('不要把这两项检查标记为未验证');
    expect(body, label).toContain('当变更中可读的 delta specs 只包含 REMOVED 或 RENAMED 需求而没有 ADDED 或 MODIFIED 需求时，其正确性检查同样**不适用**（见步骤 6）。');
  });

  it.each(bodies)('%s: does not treat artifacts or replacement code as the removed behavior', (label, body) => {
    const removed = section(body, '- 对每条 REMOVED 需求', '- 对每条 RENAMED 条目', label);

    expect(removed, label).toContain('`openspec/` 产出物或文档中的匹配，或仅服务于 Migration 说明或某条 ADDED 需求的代码，本身不构成证据。');
    expect(removed, label).toContain('报告任何仍在提供被移除行为的代码路径，包括与 ADDED 需求共享的路径。');
  });

  // #2067：REMOVED 分支原来只说"在代码库中搜索被移除的行为"。REMOVED 块只携带
  // 需求名称加 Reason 和 Migration 说明，搜索从标题 alone 开始——而这里"无匹配"
  // 恰恰是通过结果，于是用不同词汇写的实现会被读成干净的移除。旁边的 RENAMED
  // 分支已经先从主 spec 读取基线。
  it.each(bodies)('%s: 在搜索之前读取被移除需求的基线', (label, body) => {
    const removed = section(body, '- 对每条 REMOVED 需求', '- 对每条 RENAMED 条目', label);

    expect(removed, label).toContain('REMOVED 块只携带需求名称以及可选的 `**Reason**`/`**Migration**` 说明');
    expect(removed, label).toContain('`<planningHome.root>/openspec/specs/<capability-path>/spec.md`');
    expect(removed, label).toContain('其正文和场景就是必须消失的行为的证据');
    expect(removed, label).toContain('绝不仅凭需求名称去搜索');
    // 字面标题查找会漏掉措辞不同的基线，并被误读为"同步已将其移除"。
    expect(removed, label).toContain('按规范化名称匹配');
  });

  // 基线读取、历史回退与搜索必须保持这个顺序。每个索引都先检查存在：
  // 不加保护的 indexOf 返回 -1，而 -1 小于一切，改写后的句子会满足
  // 裸顺序比较，悄悄让这道防线退役。
  it.each(bodies)('%s: 依序执行基线读取、回退与搜索', (label, body) => {
    const removed = section(body, '- 对每条 REMOVED 需求', '- 对每条 RENAMED 条目', label);

    const baselineAt = removed.indexOf('搜索之前，先读取主 spec 中');
    const fallbackAt = removed.indexOf('则从同一文件的历史恢复基线');
    const bailOutAt = removed.indexOf('将该条目的 **Spec 覆盖**标记为未验证并写明原因，就此打住');
    const searchAt = removed.indexOf('在代码库中搜索该行为。');

    expect(baselineAt, `${label}: 缺少基线读取句`).toBeGreaterThanOrEqual(0);
    expect(fallbackAt, `${label}: 缺少历史回退`).toBeGreaterThanOrEqual(0);
    expect(bailOutAt, `${label}: 缺少未验证兜底`).toBeGreaterThanOrEqual(0);
    expect(searchAt, `${label}: 缺少搜索步骤`).toBeGreaterThanOrEqual(0);

    // 主 spec 是首要来源；历史只是它的回退。
    expect(baselineAt, `${label}: 回退必须跟在首要读取之后`).toBeLessThan(fallbackAt);
    // 兜底必须在搜索之前可达，而不是在"找不到是预期结果"规则后面两个要点。
    expect(bailOutAt, `${label}: 兜底必须先于搜索`).toBeLessThan(searchAt);
  });

  // git 示例是回退中代理会原样执行的那部分。`git log` 把未匹配的 pathspec
  // 当作成功且不打印任何东西，因此缺少 `openspec/specs/` 前缀的路径会被读成
  // "历史中没有基线"，把每个同步后的移除都送进未验证分支。
  it.each(bodies)('%s: 给出可运行的、感知 store 的历史命令', (label, body) => {
    const removed = section(body, '- 对每条 REMOVED 需求', '- 对每条 RENAMED 条目', label);

    expect(removed, label).toContain('git -C "<planningHome.root>" log -p -- openspec/specs/<capability-path>/spec.md');
    // `rev:path` 从仓库根解析，而不是从 `-C`；`./` 使其相对于作为子目录
    // （monorepo）的规划根保持相对。
    expect(removed, label).toContain('git -C "<planningHome.root>" show <commit>^:./openspec/specs/<capability-path>/spec.md');
    expect(removed, label).not.toMatch(/show <commit>\^:openspec\//);
    // 未加引号的规划根会在空格处拆分，在错误的位置运行 git。
    expect(removed, label).not.toMatch(/git -C <planningHome\.root>/);
    expect(removed, label).toContain('输出为空意味着 pathspec 未匹配到任何东西');
    // 裸的 `<capability-path>/spec.md` pathspec 匹配不到任何东西：占位符是相对
    // `specs/` 定义的。
    expect(removed, label).not.toMatch(/git[^`\n]*log[^`\n]*--\s+<capability-path>/);
    // 历史必须从规划根（planning home）读取，它可能是 store 仓库而非当前
    // 检出（#1702）。
    expect(removed, label).not.toMatch(/\bgit log -p -- openspec/);
  });

  it.each(bodies)('%s: 绝不把未搜索的移除计为通过', (label, body) => {
    const removed = section(body, '- 对每条 REMOVED 需求', '- 对每条 RENAMED 条目', label);

    expect(removed, label).toContain('将该条目的 **Spec 覆盖**标记为未验证并写明原因，就此打住');
    expect(removed, label).toContain('不要搜索，也绝不把未搜索的移除计为通过');
    // 只复述标题的基线给出的词汇不会比标题多，这正是 #2067 失败模式的缩影。
    expect(removed, label).toContain('只在标题上做文章的基线');
    expect(removed, label).toContain('与缺失基线一样不可用');
    // 改写后的重新引入也必须失败，而不只是精确的旧句子：bug 是从名称搜索，
    // 无论它如何表述。
    expect(removed, label).not.toMatch(/搜索[^。\n]*被移除的行为/);
    expect(removed, label).not.toMatch(/找不到实现是预期结果[。；]/);
  });

  // 第 6 步断言 Spec 覆盖承载仅移除变更的证据。该说法必须为上面分支标记为
  // 未验证的条目留出空间，否则它读起来像是允许丢掉标记。
  it.each(bodies)('%s: 不声称可能未发生的基线检查', (label, body) => {
    expect(body, label).toContain('每条有可用基线的 REMOVED 和 RENAMED 条目在那里对照其基线行为检查');
    expect(body, label).toContain('且在那里已标记为未验证的条目保持未验证');
    // 评分卡必须建模未验证的措辞，而不只是确认的那种。
    expect(body, label).toContain('"1 项移除未验证（基线不可用）"');
  });

  it.each(bodies)('%s: counts removals separately from covered requirements', (label, body) => {
    expect(body, label).toContain('N 只统计 ADDED 和 MODIFIED 需求，REMOVED 和 RENAMED 需求单独报告');
    expect(body, label).toContain('正确性格写 `不适用（无 ADDED 或 MODIFIED 需求）`');
  });
});
