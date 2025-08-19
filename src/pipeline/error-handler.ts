/**
 * 流水线错误处理
 *
 * @author Jason Zhang
 */

export interface PipelineError {
  id: string;
  message: string;
  stack?: string;
  timestamp: Date;
  context?: any;
}

export class PipelineErrorHandler {
  private errors: PipelineError[] = [];

  handleError(error: Error, context?: any): PipelineError {
    const pipelineError: PipelineError = {
      id: `error-${Date.now()}`,
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      context,
    };

    this.errors.push(pipelineError);
    return pipelineError;
  }

  getErrors(): PipelineError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
  }
}
