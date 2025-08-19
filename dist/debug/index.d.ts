/**
 * Debug系统模块入口文件
 *
 * @author Jason Zhang
 */
export declare const DEBUG_MODULE_VERSION = "4.0.0-alpha.2";
export interface DebugModuleInterface {
    version: string;
    initialize(): Promise<void>;
    startRecording(): void;
    stopRecording(): void;
}
export { DebugManagerImpl } from './debug-manager';
export { DebugRecorder } from './debug-recorder';
export { DebugRecord } from './types/debug-types';
export { DebugFilter } from './debug-filter';
export { DebugSerializer } from './debug-serializer';
export { DebugStorage } from './debug-storage';
export { DebugAnalyzer } from './debug-analyzer';
export { DebugCollector } from './debug-collector';
export { ReplaySystem } from './replay-system';
//# sourceMappingURL=index.d.ts.map