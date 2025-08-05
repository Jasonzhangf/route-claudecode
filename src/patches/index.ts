/**
 * 补丁系统入口
 * 导出所有补丁相关的公共接口
 */

export { PatchManager } from './manager';
export { getPatchManager, createPatchManager, resetPatchManager } from './registry';
export * from './types';

// 导出具体的补丁类（可选，主要用于测试和调试）
export { AnthropicToolCallTextFixPatch } from './anthropic/tool-call-text-fix';
export { OpenAIToolFormatFixPatch } from './openai/tool-format-fix';
export { GeminiResponseFormatFixPatch } from './gemini/response-format-fix';