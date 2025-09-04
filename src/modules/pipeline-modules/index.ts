/**
 * Pipeline Modules Index
 *
 * 四层架构模块的统一导出入口
 *
 * @author Jason Zhang
 */

// Transformer层 - 使用安全的transformer实现
// export { AnthropicToOpenAITransformer } from './transformer/anthropic-to-openai'; // DEPRECATED - 已删除

// Protocol层
export { OpenAIProtocolModule } from './protocol/openai-protocol';

// Server-Compatibility层
export { LMStudioCompatibilityModule } from './server-compatibility/lmstudio-compatibility';
export { OllamaCompatibilityModule } from './server-compatibility/ollama-compatibility';
export { VLLMCompatibilityModule } from './server-compatibility/vllm-compatibility';
export { IFlowCompatibilityModule } from './server-compatibility/iflow-compatibility';

// Server层
export { OpenAIServerModule } from './server/openai-server';

// 完整流水线
// export { LMStudioPipeline } from './lmstudio-pipeline'; // REMOVED - 违背模块化架构设计

// 类型定义
// export type {
//   // Transformer类型 - DEPRECATED - 已删除
//   AnthropicRequest,
//   OpenAIRequest,
//   AnthropicResponse,
//   OpenAIResponse,
// } from './transformer/anthropic-to-openai';

export type {
  // Protocol类型
  StreamRequest,
  NonStreamRequest,
  StreamChunk,
  NonStreamResponse,
  StreamResponse,
} from './protocol/openai-protocol';

export type {
  // Server-Compatibility类型
  StandardRequest,
  LMStudioRequest,
  StandardResponse,
  LMStudioResponse,
  LMStudioCompatibilityConfig,
} from './server-compatibility/lmstudio-compatibility';

export type {
  // Server类型
  ServerRequest,
  ServerResponse,
  OpenAIServerConfig,
} from './server/openai-server';

// export type {
//   // Pipeline类型
//   LMStudioPipelineConfig,
//   PipelineExecutionResult,
// } from './lmstudio-pipeline'; // REMOVED - 违背模块化架构设计
