/**
 * 预处理模块导出
 * 提供统一的预处理入口和格式解析器
 */

// 新的统一预处理器
export { 
  UnifiedPreprocessor, 
  getUnifiedPreprocessor, 
  resetUnifiedPreprocessor,
  PreprocessingResult,
  UnifiedPreprocessorConfig
} from './unified-preprocessor';

// Gemini专用预处理器
export {
  GeminiPatchPreprocessor,
  createGeminiPreprocessor,
  preprocessGeminiRequest
} from './gemini-patch-preprocessor';

// 格式解析器
export * from './parsers';

// 向后兼容：保留旧的预处理器导出
export { 
  getUnifiedPatchPreprocessor,
  createUnifiedPatchPreprocessor,
  resetUnifiedPatchPreprocessor
} from './unified-patch-preprocessor';