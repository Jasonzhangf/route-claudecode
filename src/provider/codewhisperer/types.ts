/**
 * MOCKUP IMPLEMENTATION - CodeWhisperer Types
 * This is a placeholder implementation for CodeWhisperer-specific types
 * All functionality is mocked and should be replaced with real implementations
 */

export interface CodeWhispererMessage {
  utteranceType: 'HUMAN' | 'AI';
  utterance: string;
  metadata?: Record<string, any>;
}

export interface CodeWhispererConversationState {
  conversationId: string;
  history: CodeWhispererMessage[];
  currentTurnId?: string;
}

export interface CodeWhispererRequest {
  conversationState: CodeWhispererConversationState;
  message: CodeWhispererMessage;
  userIntent?: string;
  programmingLanguage?: {
    languageName: string;
  };
  mockup_indicator?: string;
}

export interface CodeWhispererResponse {
  conversationId: string;
  message: CodeWhispererMessage;
  messageId: string;
  userIntent?: string;
  codeReferences?: CodeWhispererCodeReference[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface CodeWhispererCodeReference {
  licenseName?: string;
  repository?: string;
  url?: string;
  recommendationContentSpan?: {
    start: number;
    end: number;
  };
}

export interface CodeWhispererStreamChunk {
  conversationId: string;
  messageId: string;
  message?: {
    utteranceType: 'AI';
    utterance: string;
  };
  delta?: {
    text: string;
  };
  finishReason?: string;
}

export interface CodeWhispererConfig {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
  endpoint?: string;
  mockup_indicator?: string;
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: CodeWhisperer types loaded - placeholder implementation');