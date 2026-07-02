import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// The store rename (slice 1.4) retired the pre-rename vocabulary. This
// sweep keeps it retired: no live surface may reintroduce the old tokens.
// The openspec/ planning-history tree is outside the sweep roots by
// design; the committed format literals (.openspec-store, store.yaml) do
// not match these patterns at all. The forbidden tokens are built by
// concatenation so this file stays clean under its own sweep.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .codex/ is git-ignored local skill guidance (roadmap L8); swept when
// present, skipped when a checkout does not carry it.
const SWEEP_ROOTS = ['src', 'test', 'docs', 'scripts', '.codex'];

// The 1.5.0 merge restored workspace, initiative, and context-store as
// first-class concepts. Their identifiers (context_store, workspace_*,
// initiative_*) are expected in src/ — they are not regressions of the
// retired store vocabulary.
// This sweep now only checks for truly retired terms that must not
// reappear. Add new retired terms here as older features are removed.
const RETIRED_PATTERNS: { name: string; pattern: RegExp; roots: string[] }[] = [
  // Example: { name: 'old_feature', pattern: /old_feature_[a-z_]+/, roots: ['src'] },
];

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.sh',
  '.txt',
]);

function* walkFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      yield* walkFiles(fullPath);
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      yield fullPath;
    }
  }
}

describe('vocabulary sweep', () => {
  it('keeps retired vocabulary out of live surfaces', () => {
    for (const { name, pattern, roots } of RETIRED_PATTERNS) {
      const offenders: string[] = [];

      for (const root of roots) {
        const rootPath = path.join(REPO_ROOT, root);
        if (!fs.existsSync(rootPath)) {
          continue;
        }

        for (const filePath of walkFiles(rootPath)) {
          const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              offenders.push(
                `${path.relative(REPO_ROOT, filePath)}:${index + 1}: ${line.trim()}`
              );
            }
          });
        }
      }

      expect(offenders, `retired vocabulary '${name}' found:\n${offenders.join('\n')}`).toEqual([]);
    }
  });
});
