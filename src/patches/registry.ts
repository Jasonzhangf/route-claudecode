/**
 * 补丁注册表
 * 自动注册所有可用的补丁
 */

import { PatchManager } from './manager';
import { AnthropicToolCallTextFixPatch } from './anthropic/tool-call-text-fix';
import { OpenAIToolFormatFixPatch } from './openai/tool-format-fix';
import { GeminiResponseFormatFixPatch } from './gemini/response-format-fix';

/**
 * 创建并配置补丁管理器
 */
export function createPatchManager(): PatchManager {
  const manager = new PatchManager();

  // 注册 Anthropic 补丁
  manager.registerPatch(new AnthropicToolCallTextFixPatch());

  // 注册 OpenAI-Compatible 补丁
  manager.registerPatch(new OpenAIToolFormatFixPatch());

  // 注册 Gemini 补丁
  manager.registerPatch(new GeminiResponseFormatFixPatch());

  // TODO: 注册其他提供商的补丁
  // manager.registerPatch(new CodeWhispererAuthRefreshFixPatch());

  return manager;
}

/**
 * 全局补丁管理器实例
 */
let globalPatchManager: PatchManager | null = null;

/**
 * 获取全局补丁管理器实例
 */
export function getPatchManager(): PatchManager {
  if (!globalPatchManager) {
    globalPatchManager = createPatchManager();
  }
  return globalPatchManager;
}

/**
 * 重置全局补丁管理器（主要用于测试）
 */
export function resetPatchManager(): void {
  if (globalPatchManager) {
    globalPatchManager.cleanup();
    globalPatchManager = null;
  }
}