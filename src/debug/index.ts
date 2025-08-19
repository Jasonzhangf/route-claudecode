/**
 * Debug系统模块入口文件
 *
 * @author Jason Zhang
 */

// 模块版本信息
export const DEBUG_MODULE_VERSION = '4.0.0-alpha.2';

// 模块接口
export interface DebugModuleInterface {
  version: string;
  initialize(): Promise<void>;
  startRecording(): void;
  stopRecording(): void;
}

// 选择性导出避免名称冲突
export { DebugManagerImpl } from './debug-manager';
export { DebugRecorder } from './debug-recorder';
export { DebugRecord } from './types/debug-types';
export { DebugFilter } from './debug-filter';
export { DebugSerializer } from './debug-serializer';
export { DebugStorage } from './debug-storage';
export { DebugAnalyzer } from './debug-analyzer';
export { DebugCollector } from './debug-collector';
export { ReplaySystem } from './replay-system';
