/**
 * Constants Module
 */
export const CONSTANTS_MODULE_VERSION = '4.0.0-zero-interface';

// Re-export all constant files
export * from './bootstrap-constants';
export * from './error-messages';
export * from './test-constants';

export interface ConstantsModuleInterface {
  version: string;
}

export class ConstantsModule {
  // Constants模块主要是常量定义，不需要实际的实现
}

export function createConstantsModule(): ConstantsModule {
  return new ConstantsModule();
}