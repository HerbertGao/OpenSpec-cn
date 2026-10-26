import fs from 'node:fs';
import path from 'node:path';

/** PATH 上的每个 `openspec-cn`，按 shell 查找顺序排列。 */
export function findCopiesOnPath(
  pathValue: string = process.env.PATH ?? '',
  platform: NodeJS.Platform = process.platform
): string[] {
  const names = platform === 'win32' ? ['openspec-cn.exe', 'openspec-cn.cmd'] : ['openspec-cn'];
  const seen = new Set<string>();
  const copies: string[] = [];
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (!fs.statSync(candidate).isFile()) continue;
        if (platform !== 'win32') fs.accessSync(candidate, fs.constants.X_OK);
        const key = platform === 'win32' ? candidate.toLowerCase() : candidate;
        if (!seen.has(key)) {
          seen.add(key);
          copies.push(candidate);
        }
      } catch {
        // Not there, or not runnable: not a copy a shell would run.
      }
    }
  }
  return copies;
}

/** Whether two paths name the same file once symlinks are resolved. */
export function samePath(a: string, b: string): boolean {
  const real = (value: string) => {
    try {
      return fs.realpathSync(value);
    } catch {
      return path.resolve(value);
    }
  };
  const [x, y] = [real(a), real(b)];
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}
