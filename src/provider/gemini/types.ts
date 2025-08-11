/**
 * MOCKUP IMPLEMENTATION - Gemini Types
 * This is a placeholder implementation for Gemini-specific types
 * All functionality is mocked and should be replaced with real implementations
 */

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
}

export interface GeminiRequest {
  contents: GeminiContent[];
  tools?: GeminiTool[];
  toolConfig?: {
    functionCallingConfig: {
      mode: 'AUTO' | 'ANY' | 'NONE';
      allowedFunctionNames?: string[];
    };
  };
  safetySettings?: GeminiSafetySetting[];
  generationConfig?: {
    stopSequences?: string[];
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
  mockup_indicator?: string;
}

export interface GeminiResponse {
  candidates: GeminiCandidate[];
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: GeminiSafetyRating[];
  };
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER';
  index: number;
  safetyRatings?: GeminiSafetyRating[];
}

export interface GeminiTool {
  functionDeclarations: GeminiFunctionDeclaration[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface GeminiSafetySetting {
  category: 'HARM_CATEGORY_HARASSMENT' | 'HARM_CATEGORY_HATE_SPEECH' | 'HARM_CATEGORY_SEXUALLY_EXPLICIT' | 'HARM_CATEGORY_DANGEROUS_CONTENT';
  threshold: 'BLOCK_NONE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_LOW_AND_ABOVE';
}

export interface GeminiSafetyRating {
  category: string;
  probability: 'NEGLIGIBLE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface GeminiConfig {
  apiKey: string;
  baseURL?: string;
  defaultModel?: string;
  temperature?: number;
  maxOutputTokens?: number;
  mockup_indicator?: string;
}

// MOCKUP INDICATOR
console.log('🔧 MOCKUP: Gemini types loaded - placeholder implementation');