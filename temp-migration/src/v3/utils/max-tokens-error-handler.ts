/**
 * V3.0 Max Tokens Error Handler
 */

export function handleMaxTokensError(error: Error, request: any) {
  console.warn('⚠️ V3 Max Tokens Error:', error.message);
  return { maxTokens: true, error: error.message, requestModel: request?.model };
}

export class MaxTokensErrorHandler {
  static formatErrorResponse(error: any) {
    return {
      error: {
        type: 'max_tokens_exceeded',
        message: error.message || 'Maximum token limit exceeded'
      }
    };
  }
}