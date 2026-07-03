import type { FlagDefinition } from './types.js';

/**
 * Common flags used across multiple commands.
 */
export const COMMON_FLAGS = {
  json: {
    name: 'json',
    description: '以 JSON 格式输出',
  } as FlagDefinition,
  jsonValidation: {
    name: 'json',
    description: '以 JSON 格式输出验证结果',
  } as FlagDefinition,
  strict: {
    name: 'strict',
    description: '启用严格验证模式',
  } as FlagDefinition,
  noInteractive: {
    name: 'no-interactive',
    description: '禁用交互式提示',
  } as FlagDefinition,
  type: {
    name: 'type',
    description: '当项目类型不明确时指定类型',
    takesValue: true,
    values: ['change', 'spec'],
  } as FlagDefinition,
  store: {
    name: 'store',
    description:
      '用作 OpenSpec 根目录的 store id（store 是您在本机上注册的独立 OpenSpec 仓库）',
    takesValue: true,
  } as FlagDefinition,
} as const;
