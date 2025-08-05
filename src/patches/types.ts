/**
 * 补丁系统类型定义
 * 定义补丁接口和相关类型
 */

export type PatchType = 'request' | 'response' | 'streaming' | 'error';
export type Provider = 'anthropic' | 'openai' | 'gemini' | 'codewhisperer';

export interface PatchContext {
  provider: Provider;
  model: string;
  requestId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PatchResult<T = any> {
  success: boolean;
  data: T;
  applied: boolean;
  patchName: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface PatchCondition {
  provider?: Provider | Provider[];
  model?: string | RegExp | ((model: string) => boolean);
  version?: string;
  enabled?: boolean | (() => boolean);
}

export interface BasePatch<TInput = any, TOutput = any> {
  name: string;
  description: string;
  type: PatchType;
  condition: PatchCondition;
  priority: number; // 数字越小优先级越高
  
  // 检查是否应该应用此补丁
  shouldApply(context: PatchContext, data: TInput): boolean;
  
  // 应用补丁
  apply(context: PatchContext, data: TInput): Promise<PatchResult<TOutput>>;
  
  // 可选：回滚补丁（如果支持）
  rollback?(context: PatchContext, data: TOutput): Promise<PatchResult<TInput>>;
}

export interface RequestPatch extends BasePatch<any, any> {
  type: 'request';
}

export interface ResponsePatch extends BasePatch<any, any> {
  type: 'response';
}

export interface StreamingPatch extends BasePatch<any, any> {
  type: 'streaming';
}

export interface ErrorPatch extends BasePatch<Error, any> {
  type: 'error';
}

export interface PatchStats {
  patchName: string;
  appliedCount: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  lastApplied: number;
  errorRate: number;
}

export interface PatchManagerConfig {
  enabled: boolean;
  debugMode: boolean;
  maxRetries: number;
  timeoutMs: number;
  enableStats: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}