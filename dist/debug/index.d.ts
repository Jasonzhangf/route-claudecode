/**
 * Debug系统模块入口文件
 *
 * @author Jason Zhang
 * @author RCC v4.0
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
export { PipelineDebugSystem } from './pipeline-debug-system';
export { RequestTestSystem } from './request-test-system';
export type { PipelineDebugInfo, ExpectedPipeline, ValidationResult, RoutingTestResult, ExecutionTestResult } from './pipeline-debug-system';
export type { TestRequestConfig, ResponseValidationResult, DiagnosisResult } from './request-test-system';
/**
 * Pipeline调试系统工厂
 *
 * 简化Pipeline调试系统的创建和配置
 */
export declare class PipelineDebugSystemFactory {
    /**
     * 创建完整的Pipeline调试系统
     */
    static createDebugSystem(pipelineManager: any, pipelineRouter?: any, loadBalancer?: any): {
        pipelineDebug: PipelineDebugSystem;
        requestTest: RequestTestSystem;
    };
    /**
     * 创建基础Pipeline调试系统
     */
    static createPipelineDebugSystem(pipelineManager: any): PipelineDebugSystem;
    /**
     * 创建请求测试系统
     */
    static createRequestTestSystem(pipelineManager: any, pipelineRouter?: any, loadBalancer?: any): RequestTestSystem;
}
/**
 * Pipeline调试系统配置
 */
export interface PipelineDebugConfig {
    enableInitializationCheck: boolean;
    enableRequestTesting: boolean;
    enableLayerDiagnostics: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    testRequestInterval?: number;
}
/**
 * 默认Pipeline调试配置
 */
export declare const DEFAULT_PIPELINE_DEBUG_CONFIG: PipelineDebugConfig;
//# sourceMappingURL=index.d.ts.map