/**
 * CodeWhisperer Provider Types
 * 重构优化版本 - 基于demo2兼容性设计
 * 项目所有者: Jason Zhang
 */

// ============================================================================
// Core Configuration Types
// ============================================================================

/**
 * CodeWhisperer服务端点配置
 */
export interface CodeWhispererConfig {
  readonly endpoint: string;
  readonly profileArn: string;
  readonly origin: string;
  readonly chatTriggerType: string;
}

// ============================================================================
// Token Management Types (基于demo2的TokenData)
// ============================================================================

export interface TokenData {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt?: string;
  readonly profileArn?: string;
}

export interface RefreshRequest {
  readonly refreshToken: string;
}

export interface RefreshResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt?: string;
}

// ============================================================================
// Anthropic API Types - 优化版本
// ============================================================================

export interface AnthropicTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, any>;
}

export interface AnthropicSystemMessage {
  readonly type: string;
  readonly text: string;
}

export interface AnthropicRequestMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string | ContentBlock[];
}

export interface ContentBlock {
  readonly type: 'text' | 'tool_result' | 'tool_use';
  readonly text?: string;
  readonly tool_use_id?: string;
  readonly content?: string;
  readonly name?: string;
  readonly input?: any;
}

export interface AnthropicRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly messages: AnthropicRequestMessage[];
  readonly system?: AnthropicSystemMessage[];
  readonly tools?: AnthropicTool[];
  readonly stream?: boolean;
  readonly temperature?: number;
  readonly metadata?: Record<string, any>;
}

// ============================================================================
// CodeWhisperer API Types - 重构优化版本
// ============================================================================

export interface ToolInputSchema {
  readonly json: Record<string, any>;
}

export interface CodeWhispererToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
}

export interface CodeWhispererTool {
  readonly toolSpecification: CodeWhispererToolSpec;
}

export interface UserInputMessage {
  readonly content: string;
  readonly modelId: string;
  readonly origin: string;
}

export interface UserInputMessageContext {
  // 🔑 关键：保持与demo2完全兼容的空对象结构
  // 工具相关字段已被移除以确保100%兼容性
}

export interface CurrentMessage {
  readonly userInputMessage: {
    readonly content: string;
    readonly modelId: string;
    readonly origin: string;
    readonly userInputMessageContext: UserInputMessageContext;
  };
}

export interface HistoryUserMessage {
  readonly userInputMessage: UserInputMessage;
}

export interface HistoryAssistantMessage {
  readonly assistantResponseMessage: {
    readonly content: string;
    readonly toolUses: readonly any[];
  };
}

export interface ConversationState {
  readonly chatTriggerType: string;
  readonly conversationId: string;
  readonly currentMessage: CurrentMessage;
  readonly history: readonly (HistoryUserMessage | HistoryAssistantMessage)[];
}

export interface CodeWhispererRequest {
  readonly conversationState: ConversationState;
  readonly profileArn: string;
}

// ============================================================================
// Response Processing Types - 优化版本
// ============================================================================

export interface AssistantResponseEvent {
  readonly content?: string;
  readonly input?: string;
  readonly name?: string;
  readonly toolUseId?: string;
  readonly stop?: boolean;
}

export interface SSEEvent {
  readonly event: string;
  readonly data: any;
}

export interface ParsedToolCall {
  readonly name: string;
  readonly input: Record<string, any>;
  readonly id: string;
}

export interface ProcessingResult {
  readonly success: boolean;
  readonly events: readonly SSEEvent[];
  readonly toolCalls: readonly ParsedToolCall[];
  readonly textContent: string;
  readonly tokenCount: number;
}

// ============================================================================
// Model Mapping - 消除硬编码
// ============================================================================

/**
 * 模型映射接口 - 支持动态配置
 */
export interface ModelMapping {
  readonly [sourceModel: string]: string;
}

/**
 * 获取默认模型映射（仅作为fallback，实际使用路由引擎的映射）
 */
export function getDefaultModelMapping(): ModelMapping {
  return {
    'claude-sonnet-4-20250514': 'CLAUDE_SONNET_4_20250514_V1_0',
    'claude-3-5-haiku-20241022': 'CLAUDE_3_7_SONNET_20250219_V1_0',
  };
}

// ============================================================================
// Configuration Constants - 重构版本
// ============================================================================

/**
 * CodeWhisperer服务默认配置
 */
export function createCodeWhispererConfig(): CodeWhispererConfig {
  return {
    endpoint: 'https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse',
    profileArn: 'arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK',
    origin: 'AI_EDITOR',
    chatTriggerType: 'MANUAL',
  };
}

/**
 * 验证配置完整性
 */
export function validateConfig(config: CodeWhispererConfig): boolean {
  return !!(config.endpoint && config.profileArn && config.origin && config.chatTriggerType);
}

// ============================================================================
// Utility Types
// ============================================================================

export interface RequestValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}