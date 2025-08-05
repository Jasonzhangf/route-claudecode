/**
 * Max Tokens错误处理器
 * 检测max_tokens/length finish_reason并抛出相应的500错误
 * Project Owner: Jason Zhang
 */

interface MaxTokensError extends Error {
  status: number;
  code: string;
  details: {
    finishReason: string;
    provider: string;
    model: string;
    requestId: string;
    usage?: any;
  };
}

export class MaxTokensErrorHandler {
  
  /**
   * 检查finish_reason是否表示达到了token限制
   */
  static isMaxTokensReached(finishReason: string): boolean {
    const maxTokensReasons = [
      'max_tokens',    // OpenAI格式
      'length',        // OpenAI length limit
      'max_tokens',    // Anthropic格式（虽然很少用）
    ];
    
    return maxTokensReasons.includes(finishReason?.toLowerCase());
  }

  /**
   * 检查Anthropic格式的stop_reason是否表示达到了token限制
   */
  static isMaxTokensStopReason(stopReason: string): boolean {
    const maxTokensStopReasons = [
      'max_tokens',    // Anthropic max tokens
      'max_tokens',    // 其他provider的max tokens映射
    ];
    
    return maxTokensStopReasons.includes(stopReason?.toLowerCase());
  }

  /**
   * 创建max tokens错误
   */
  static createMaxTokensError(
    finishReason: string,
    provider: string,
    model: string,
    requestId: string,
    usage?: any
  ): MaxTokensError {
    const error = new Error(
      `Request exceeded maximum token limit. The response was truncated due to token constraints. ` +
      `Please reduce the input length or increase max_tokens parameter.`
    ) as MaxTokensError;
    
    error.status = 500;
    error.code = 'MAX_TOKENS_EXCEEDED';
    error.details = {
      finishReason,
      provider,
      model,
      requestId,
      usage
    };
    
    return error;
  }

  /**
   * 检查响应并在需要时抛出max tokens错误
   * @param response - API响应对象
   * @param provider - 提供商名称
   * @param model - 模型名称  
   * @param requestId - 请求ID
   */
  static checkAndThrowMaxTokensError(
    response: any,
    provider: string,
    model: string,
    requestId: string
  ): void {
    // 检查OpenAI格式的finish_reason
    if (response.choices?.[0]?.finish_reason) {
      const finishReason = response.choices[0].finish_reason;
      if (this.isMaxTokensReached(finishReason)) {
        throw this.createMaxTokensError(
          finishReason,
          provider,
          model,
          requestId,
          response.usage
        );
      }
    }

    // 检查Anthropic格式的stop_reason
    if (response.stop_reason) {
      if (this.isMaxTokensStopReason(response.stop_reason)) {
        throw this.createMaxTokensError(
          response.stop_reason,
          provider,
          model,
          requestId,
          response.usage
        );
      }
    }

    // 检查unified格式（从provider response转换后）
    if (response.finishReason) {
      if (this.isMaxTokensReached(response.finishReason)) {
        throw this.createMaxTokensError(
          response.finishReason,
          provider,
          model,
          requestId,
          response.usage
        );
      }
    }
  }

  /**
   * 将max tokens错误转换为标准HTTP错误响应
   */
  static formatErrorResponse(error: MaxTokensError): any {
    return {
      error: {
        type: 'max_tokens_exceeded',
        message: error.message,
        code: error.code,
        details: {
          finish_reason: error.details.finishReason,
          provider: error.details.provider,
          model: error.details.model,
          request_id: error.details.requestId,
          usage: error.details.usage,
          suggestion: 'Reduce input length or increase max_tokens parameter'
        }
      }
    };
  }
}

export default MaxTokensErrorHandler;