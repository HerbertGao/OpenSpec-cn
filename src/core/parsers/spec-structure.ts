// Bilingual detection: this main-spec structure guard must understand the same
// English + Chinese markers the rest of the parser accepts (issue #31), or it
// (a) false-flags a `## 需求` section with an English `### Requirement:` header
// and (b) silently drops a misplaced Chinese `### 需求：` requirement (the #498
// truncation-safety diagnostic never fires for Chinese authors).
// ponytail: the `(?:Requirement|需求)[:：]` shape is also declared in
// requirement-blocks.ts; a future cleanup could export one shared constant.
const REQUIREMENTS_SECTION_HEADER = /^##\s+(?:Requirements|需求)\s*$/i;
const TOP_LEVEL_SECTION_HEADER = /^##\s+/;
const DELTA_HEADER = /^##\s+(?:(?:ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements|(?:新增|修改|移除|重命名)需求)\s*$/i;
const REQUIREMENT_HEADER = /^###\s*(?:Requirement|需求)[:：]\s*(.+)\s*$/i;

export interface MainSpecStructureIssue {
  kind: 'delta-header' | 'requirement-outside-requirements';
  line: number;
  header: string;
  message: string;
}

export function findMainSpecStructureIssues(content: string): MainSpecStructureIssue[] {
  const normalized = content.replace(/\r\n?/g, '\n');
  const stripped = stripFencedCodeBlocksPreservingLines(normalized);
  const lines = stripped.split('\n');
  const issues: MainSpecStructureIssue[] = [];

  const requirementsHeaderIndex = lines.findIndex(line => REQUIREMENTS_SECTION_HEADER.test(line));
  let requirementsEndIndex = lines.length;

  if (requirementsHeaderIndex !== -1) {
    for (let i = requirementsHeaderIndex + 1; i < lines.length; i++) {
      if (TOP_LEVEL_SECTION_HEADER.test(lines[i])) {
        requirementsEndIndex = i;
        break;
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (DELTA_HEADER.test(line)) {
      issues.push({
        kind: 'delta-header',
        line: i + 1,
        header: trimmed,
        message:
          `主 spec 包含 delta 标题 "${trimmed}"。` +
          'Delta 标题仅在 openspec/changes/<name>/specs/<capability>/spec.md 内有效，' +
          '并会截断已解析的 ## Requirements 章节。',
      });
      continue;
    }

    const requirementMatch = line.match(REQUIREMENT_HEADER);
    if (!requirementMatch) {
      continue;
    }

    const insideRequirements =
      requirementsHeaderIndex !== -1 &&
      i > requirementsHeaderIndex &&
      i < requirementsEndIndex;

    if (!insideRequirements) {
      issues.push({
        kind: 'requirement-outside-requirements',
        line: i + 1,
        header: trimmed,
        message:
          `需求标题 "${trimmed}" 出现在主 ## Requirements 章节之外。` +
          '主 spec 仅解析该章节内的需求，因此该需求目前对 validate、list 和 archive 不可见。',
      });
    }
  }

  return issues;
}

export function stripFencedCodeBlocksPreservingLines(content: string): string {
  const lines = content.split('\n');
  const output: string[] = [];
  let activeFence: { marker: '`' | '~'; length: number } | null = null;

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(.*)$/);

    if (!activeFence) {
      if (fenceMatch) {
        activeFence = {
          marker: fenceMatch[1][0] as '`' | '~',
          length: fenceMatch[1].length,
        };
        output.push('');
      } else {
        output.push(line);
      }
      continue;
    }

    output.push('');

    if (isClosingFence(line, activeFence)) {
      activeFence = null;
    }
  }

  return output.join('\n');
}

function isClosingFence(
  line: string,
  activeFence: { marker: '`' | '~'; length: number }
): boolean {
  const fenceMatch = line.match(/^\s*(`{3,}|~{3,})\s*$/);
  return Boolean(
    fenceMatch &&
    fenceMatch[1][0] === activeFence.marker &&
    fenceMatch[1].length >= activeFence.length
  );
}
