/**
 * Error Handler Module - RCC v4.0
 * 统一的错误处理和分类系统
 */
export * from './enhanced-error-handler';
export * from './error-classifier';
export * from './error-log-cli';
export * from './error-log-manager';
export * from './error-logger';
export * from './error-coordination-center-factory';
// 注释掉缺失的模块导出
// export * from './unified-error-response-normalizer';
// export * from './server-compatibility-error-adapter';
// export * from './unified-error-coordinator';
// export * from './unified-error-processing-flow';

// 新增的统一错误处理和日志接口
export * from './unified-error-handler-interface';
export * from './unified-logger-interface';
export * from './unified-error-handler-impl';
export * from './unified-logger-impl';