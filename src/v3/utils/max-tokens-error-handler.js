/**
 * V3.0 Max Tokens Error Handler
 */
export function handleMaxTokensError(error, request) {
    console.warn('⚠️ V3 Max Tokens Error:', error.message);
    return { maxTokens: true, error: error.message, requestModel: request?.model };
}
export class MaxTokensErrorHandler {
    static formatErrorResponse(error) {
        return {
            error: {
                type: 'max_tokens_exceeded',
                message: error.message || 'Maximum token limit exceeded'
            }
        };
    }
}
