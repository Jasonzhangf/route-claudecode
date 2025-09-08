/**
 * RCC4 Main Entry Point
 * Claude Code Router v4.0 - Multi-AI Provider Routing System
 *
 * Unified entry point with startup service integration
 */
export { ConfigPreprocessor } from './modules/config/src';
export { RouterPreprocessor } from './modules/router/src';
export { PipelineAssembler } from './modules/pipeline/src';
export { HTTPServer } from './modules/server/src/http-server';
export { StartupService, startupService } from './modules/bootstrap/src';
export type { StartupConfig, StartupResult } from './modules/bootstrap/src';
export * from './modules/types/src/index';
export declare const RCC4_VERSION = "4.2.0";
export declare const RCC4_BUILD_DATE: string;
export interface RCC4Application {
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    getStatus(): Promise<string>;
}
export declare class RCC4ApplicationImpl implements RCC4Application {
    private startupServiceInstance;
    private isRunning;
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
    getStatus(): Promise<string>;
}
//# sourceMappingURL=index.d.ts.map