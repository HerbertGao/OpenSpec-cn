import { promises as fs } from 'fs';
import path from 'path';
import { getTaskProgressForChange, formatTaskStatus } from '../utils/task-progress.js';
import { Validator } from './validation/validator.js';
import chalk from 'chalk';
import {
  emitStoreRootBanner,
  isRootSelectionError,
  resolveOpenSpecRoot,
  toRootOutput,
  withStoreFlag,
  type ResolvedOpenSpecRoot,
  isStoreSelectedRoot,
} from './root-selection.js';
import {
  findSpecUpdates,
  buildUpdatedSpec,
  writeUpdatedSpec,
  type SpecUpdate,
} from './specs-apply.js';

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

async function listActiveChangeNames(changesDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(changesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== 'archive')
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    return [];
  }
}

export interface ArchiveOptions {
  yes?: boolean;
  skipSpecs?: boolean;
  noValidate?: boolean;
  validate?: boolean;
  json?: boolean;
  store?: string;
  storePath?: string;
}

interface ArchiveDiagnostic {
  severity: 'error';
  code: string;
  message: string;
  fix?: string;
}

interface ArchiveResult {
  change: string;
  archivedAs: string;
  path: string;
  specsUpdated: boolean;
  totals?: { added: number; modified: number; removed: number; renamed: number };
}

/**
 * JSON mode is non-interactive: any point where the human flow would prompt or
 * print prose instead throws this error, which becomes a machine-readable
 * status entry with a non-zero exit code.
 */
class ArchiveBlockedError extends Error {
  readonly diagnostic: ArchiveDiagnostic;

  constructor(code: string, message: string, fix?: string) {
    super(message);
    this.name = 'ArchiveBlockedError';
    this.diagnostic = {
      severity: 'error',
      code,
      message,
      ...(fix ? { fix } : {}),
    };
  }
}

function toArchiveDiagnostic(error: unknown): ArchiveDiagnostic {
  if (error instanceof ArchiveBlockedError) {
    return error.diagnostic;
  }
  if (isRootSelectionError(error)) {
    return error.diagnostic;
  }
  return {
    severity: 'error',
    code: 'archive_error',
    message: error instanceof Error ? error.message : String(error),
  };
}

/**
 * Recursively copy a directory. Used when fs.rename fails (e.g. EPERM on Windows).
 */
async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Move a directory from src to dest. On Windows, fs.rename() often fails with
 * EPERM when the directory is non-empty or another process has it open (IDE,
 * file watcher, antivirus). Fall back to copy-then-remove when rename fails
 * with EPERM or EXDEV.
 */
async function moveDirectory(src: string, dest: string): Promise<void> {
  try {
    await fs.rename(src, dest);
  } catch (err: any) {
    const code = err?.code;
    if (code === 'EPERM' || code === 'EXDEV') {
      await copyDirRecursive(src, dest);
      await fs.rm(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

export class ArchiveCommand {
  async execute(changeName?: string, options: ArchiveOptions = {}): Promise<void> {
    const json = !!options.json;

    let root: ResolvedOpenSpecRoot;
    try {
      root = await resolveOpenSpecRoot({
        ...(options.store !== undefined ? { store: options.store } : {}),
        ...(options.storePath !== undefined ? { storePath: options.storePath } : {}),
      });
    } catch (error) {
      if (json && isRootSelectionError(error)) {
        this.printJsonFailure(undefined, toArchiveDiagnostic(error));
        return;
      }
      throw error;
    }

    if (json) {
      try {
        const result = await this.run(changeName, options, root, true);
        if (!result) {
          return;
        }
        console.log(JSON.stringify({ archive: result, root: toRootOutput(root) }, null, 2));
      } catch (error) {
        this.printJsonFailure(root, toArchiveDiagnostic(error));
      }
      return;
    }

    emitStoreRootBanner(root);
    await this.run(changeName, options, root, false);
  }

  private printJsonFailure(root: ResolvedOpenSpecRoot | undefined, diagnostic: ArchiveDiagnostic): void {
    console.log(
      JSON.stringify(
        {
          archive: null,
          ...(root ? { root: toRootOutput(root) } : {}),
          status: [diagnostic],
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  }

  /**
   * Shared archive flow. In human mode (json=false) prompts and prose match
   * the historical behavior and cancellations return null. In JSON mode no
   * prose reaches stdout and every blocked path throws.
   */
  private async run(
    changeName: string | undefined,
    options: ArchiveOptions,
    root: ResolvedOpenSpecRoot,
    json: boolean
  ): Promise<ArchiveResult | null> {
    const changesDir = root.changesDir;
    const archiveDir = root.archiveDir;
    const mainSpecsDir = root.specsDir;

    // Get change name interactively if not provided
    if (!changeName) {
      if (json) {
        throw new ArchiveBlockedError(
          'archive_change_name_required',
          'archive --json 为非交互模式，必须提供变更名称。',
          withStoreFlag(root, 'openspec archive <change-name> --json')
        );
      }
      const selectedChange = await this.selectChange(changesDir);
      if (!selectedChange) {
        console.log('未选择变更。已中止。');
        return null;
      }
      changeName = selectedChange;
    }

    const changeDir = path.join(changesDir, changeName);

    // Verify change exists
    try {
      const stat = await fs.stat(changeDir);
      if (!stat.isDirectory()) {
        throw new Error(`未找到变更 '${changeName}'。`);
      }
    } catch {
      const available = await listActiveChangeNames(changesDir);
      throw new ArchiveBlockedError(
        'archive_change_not_found',
        available.length > 0
          ? `未找到变更 '${changeName}'。可用变更：${available.join(', ')}`
          : `未找到变更 '${changeName}'。此根目录下不存在活跃的变更。`
      );
    }

    const skipValidation = options.validate === false || options.noValidate === true;

    // Validate specs and change before archiving
    if (!skipValidation) {
      const validator = new Validator();
      let hasValidationErrors = false;

      // Validate proposal.md (informative only; human mode prints warnings)
      if (!json) {
        const changeFile = path.join(changeDir, 'proposal.md');
        try {
          await fs.access(changeFile);
          const changeReport = await validator.validateChange(changeFile);
          // Proposal validation is informative only (do not block archive)
          if (!changeReport.valid) {
            console.log(chalk.yellow(`\nproposal.md 中的提案警告（非阻塞）：`));
            for (const issue of changeReport.issues) {
              const symbol = issue.level === 'ERROR' ? '⚠' : (issue.level === 'WARNING' ? '⚠' : 'ℹ');
              console.log(chalk.yellow(`  ${symbol} ${issue.message}`));
            }
          }
        } catch {
          // Change file doesn't exist, skip validation
        }
      }

      // Validate delta-formatted spec files under the change directory if present
      const changeSpecsDir = path.join(changeDir, 'specs');
      let hasDeltaSpecs = false;
      try {
        const candidates = await fs.readdir(changeSpecsDir, { withFileTypes: true });
        for (const c of candidates) {
          if (c.isDirectory()) {
            try {
              const candidatePath = path.join(changeSpecsDir, c.name, 'spec.md');
              await fs.access(candidatePath);
              const content = await fs.readFile(candidatePath, 'utf-8');
              if (/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/m.test(content)) {
                hasDeltaSpecs = true;
                break;
              }
            } catch {}
          }
        }
      } catch {}
      if (hasDeltaSpecs) {
        const deltaReport = await validator.validateChangeDeltaSpecs(changeDir);
        if (!deltaReport.valid) {
          hasValidationErrors = true;
          if (!json) {
            console.log(chalk.red(`\n变更 delta specs 中的验证错误：`));
            for (const issue of deltaReport.issues) {
              if (issue.level === 'ERROR') {
                console.log(chalk.red(`  ✗ ${issue.message}`));
              } else if (issue.level === 'WARNING') {
                console.log(chalk.yellow(`  ⚠ ${issue.message}`));
              }
            }
          }
        }
      }

      if (hasValidationErrors) {
        if (json) {
          throw new ArchiveBlockedError(
            'archive_validation_failed',
            `变更 '${changeName}' 验证失败。`,
            `Run ${withStoreFlag(root, `openspec validate ${changeName}`)} 查看详情、修复错误，或使用 --no-validate 重新运行。`
          );
        }
        console.log(chalk.red('\n验证失败。归档前请修复错误。'));
        console.log(chalk.yellow('如需跳过验证（不推荐），使用 --no-validate 标志。'));
        process.exitCode = 1;
        return null;
      }
    } else if (json) {
      if (!options.yes) {
        throw new ArchiveBlockedError(
          'archive_confirmation_required',
          '跳过验证需要确认：请使用 --yes 重新运行。',
          withStoreFlag(root, 'openspec archive <change-name> --json --no-validate --yes')
        );
      }
    } else {
      // Log warning when validation is skipped
      const timestamp = new Date().toISOString();

      if (!options.yes) {
        const { confirm } = await import('@inquirer/prompts');
        const proceed = await confirm({
          message: chalk.yellow('⚠️  警告：跳过验证可能归档无效的 specs。是否继续？(y/N)'),
          default: false
        });
        if (!proceed) {
          console.log('归档已取消。');
          return null;
        }
      } else {
        console.log(chalk.yellow(`\n⚠️  警告：跳过验证可能归档无效的 specs。`));
      }

      console.log(chalk.yellow(`[${timestamp}] 已跳过变更的验证：${changeName}`));
      console.log(chalk.yellow(`受影响的文件：${changeDir}`));
    }

    // Show progress and check for incomplete tasks
    const progress = await getTaskProgressForChange(changesDir, changeName, path.resolve(changesDir, '..', '..'));
    if (!json) {
      const status = formatTaskStatus(progress);
      console.log(`任务状态：${status}`);
    }

    const incompleteTasks = Math.max(progress.total - progress.completed, 0);
    if (incompleteTasks > 0) {
      if (json) {
        if (!options.yes) {
          throw new ArchiveBlockedError(
            'archive_tasks_incomplete',
            `变更 '${changeName}' 存在 ${incompleteTasks} 个未完成的任务。`,
            '请完成任务，或使用 --yes 重新运行。'
          );
        }
      } else if (!options.yes) {
        const { confirm } = await import('@inquirer/prompts');
        const proceed = await confirm({
          message: `警告：发现 ${incompleteTasks} 个未完成的任务。是否继续？`,
          default: false
        });
        if (!proceed) {
          console.log('归档已取消。');
          return null;
        }
      } else {
        console.log(`警告：发现 ${incompleteTasks} 个未完成的任务。因 --yes 标志继续。`);
      }
    }

    // Handle spec updates unless skipSpecs flag is set
    let specsUpdated = false;
    let totals: ArchiveResult['totals'];
    if (options.skipSpecs) {
      if (!json) {
        console.log('跳过 spec 更新（已提供 --skip-specs 标志）。');
      }
    } else {
      // Find specs to update
      const specUpdates = await findSpecUpdates(changeDir, mainSpecsDir);

      if (specUpdates.length > 0) {
        if (!json) {
          console.log('\n待更新的 specs：');
          for (const update of specUpdates) {
            const status = update.exists ? 'update' : 'create';
            const capability = path.basename(path.dirname(update.target));
            console.log(`  ${capability}: ${status}`);
          }
        }

        let shouldUpdateSpecs = true;
        if (!options.yes) {
          if (json) {
            throw new ArchiveBlockedError(
              'archive_confirmation_required',
              `更新 ${specUpdates.length} 个 spec 需要确认：请使用 --yes 重新运行。`,
              withStoreFlag(root, 'openspec archive <change-name> --json --yes')
            );
          }
          const { confirm } = await import('@inquirer/prompts');
          shouldUpdateSpecs = await confirm({
            message: '是否继续更新 specs？',
            default: true
          });
          if (!shouldUpdateSpecs) {
            console.log('跳过 spec 更新。继续归档。');
          }
        }

        if (shouldUpdateSpecs) {
          // Prepare all updates first (validation pass, no writes)
          const prepared: Array<{ update: SpecUpdate; rebuilt: string; counts: { added: number; modified: number; removed: number; renamed: number } }> = [];
          try {
            for (const update of specUpdates) {
              const built = await buildUpdatedSpec(update, changeName!, { silent: json });
              prepared.push({ update, rebuilt: built.rebuilt, counts: built.counts });
            }
          } catch (err: any) {
            if (json) {
              throw new ArchiveBlockedError(
                'archive_spec_update_failed',
                String(err.message || err),
                '请修复变更 delta specs 后重新运行。未更改任何文件。'
              );
            }
            console.log(String(err.message || err));
            console.log('已中止。未更改任何文件。');
            process.exitCode = 1;
            return null;
          }

          // Validate every rebuilt spec before writing any of them, so a
          // late validation failure really does leave all targets unchanged.
          if (!skipValidation) {
            for (const p of prepared) {
              const specName = path.basename(path.dirname(p.update.target));
              const report = await new Validator().validateSpecContent(specName, p.rebuilt);
              if (!report.valid) {
                if (json) {
                  throw new ArchiveBlockedError(
                    'archive_spec_validation_failed',
                    `为 '${specName}' 重建的 spec 验证失败。未更改任何文件。`,
                    `Run ${withStoreFlag(root, `openspec validate ${specName}`)} 修复变更 delta 后运行。`
                  );
                }
                console.log(chalk.red(`\n为 ${specName} 重建的 spec 存在验证错误（不会写入更改）：`));
                for (const issue of report.issues) {
                  if (issue.level === 'ERROR') console.log(chalk.red(`  ✗ ${issue.message}`));
                  else if (issue.level === 'WARNING') console.log(chalk.yellow(`  ⚠ ${issue.message}`));
                }
                console.log('已中止。未更改任何文件。');
                process.exitCode = 1;
                return null;
              }
            }
          }

          // All validations passed; write files and display counts
          const writeTotals = { added: 0, modified: 0, removed: 0, renamed: 0 };
          for (const p of prepared) {
            await writeUpdatedSpec(p.update, p.rebuilt, p.counts, {
              silent: json,
              // Cross-root paths must be absolute when a store is selected.
              ...(isStoreSelectedRoot(root) ? { displayPath: p.update.target } : {}),
            });
            writeTotals.added += p.counts.added;
            writeTotals.modified += p.counts.modified;
            writeTotals.removed += p.counts.removed;
            writeTotals.renamed += p.counts.renamed;
          }
          specsUpdated = true;
          totals = writeTotals;
          if (!json) {
            console.log(
              `合计：+ ${writeTotals.added}, ~ ${writeTotals.modified}, - ${writeTotals.removed}, → ${writeTotals.renamed}`
            );
            console.log('Specs 更新成功。');
          }
        }
      }
    }

    // Create archive directory with date prefix
    const archiveName = `${this.getArchiveDate()}-${changeName}`;
    const archivePath = path.join(archiveDir, archiveName);

    // Check if archive already exists
    let archiveExists = false;
    try {
      await fs.access(archivePath);
      archiveExists = true;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
    if (archiveExists) {
      throw new ArchiveBlockedError('archive_target_exists', `归档 '${archiveName}' 已存在。`);
    }

    // Create archive directory if needed
    await fs.mkdir(archiveDir, { recursive: true });

    // Move change to archive (uses copy+remove on EPERM/EXDEV, e.g. Windows)
    await moveDirectory(changeDir, archivePath);

    if (!json) {
      console.log(`变更 '${changeName}' 已归档为 '${archiveName}'。`);
    }

    return {
      change: changeName,
      archivedAs: archiveName,
      path: archivePath,
      specsUpdated,
      ...(totals ? { totals } : {}),
    };
  }

  private async selectChange(changesDir: string): Promise<string | null> {
    const { select } = await import('@inquirer/prompts');
    const changeDirs = await listActiveChangeNames(changesDir);

    if (changeDirs.length === 0) {
      console.log('未找到活跃的变更。');
      return null;
    }

    // Build choices with progress inline to avoid duplicate lists
    let choices: Array<{ name: string; value: string }> = changeDirs.map(name => ({ name, value: name }));
    try {
      const progressList: Array<{ id: string; status: string }> = [];
      for (const id of changeDirs) {
        const progress = await getTaskProgressForChange(changesDir, id, path.resolve(changesDir, '..', '..'));
        const status = formatTaskStatus(progress);
        progressList.push({ id, status });
      }
      const nameWidth = Math.max(...progressList.map(p => p.id.length));
      choices = progressList.map(p => ({
        name: `${p.id.padEnd(nameWidth)}     ${p.status}`,
        value: p.id
      }));
    } catch {
      // If anything fails, fall back to simple names
      choices = changeDirs.map(name => ({ name, value: name }));
    }

    try {
      const answer = await select({
        message: '选择要归档的变更',
        choices
      });
      return answer;
    } catch (error) {
      // User cancelled (Ctrl+C)
      return null;
    }
  }

  private getArchiveDate(): string {
    // Returns date in YYYY-MM-DD format
    return new Date().toISOString().split('T')[0];
  }
}
