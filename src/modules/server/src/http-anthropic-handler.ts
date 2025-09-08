/**
 * Anthropic消息处理器
 * 
 * 专门处理Anthropic格式的messages请求
 * 
 * @author RCC v4.0
 */

import { ModuleDebugIntegration } from '../../logging/src/debug-integration';
import { getEnhancedErrorHandler, EnhancedErrorHandler } from '../../error-handler/src/enhanced-error-handler';
import { HTTPErrorCenter } from './http-error-center';
import { RCCError, RCCErrorCode } from '../../types/src/index';
import { 
  RequestContext, 
  ResponseContext, 
  AnthropicMessageHandler,
  AssembledPipeline 
} from './http-types';

/**
 * Anthropic消息处理器实现
 */
export class AnthropicMessageHandlerImpl implements AnthropicMessageHandler {
  private assembledPipelines: AssembledPipeline[];
  private initialized: boolean;
  private debugIntegration: ModuleDebugIntegration;
  private errorHandler: EnhancedErrorHandler;
  private httpErrorCenter: HTTPErrorCenter;
  private debugMode: boolean;
  private port: number;

  constructor(
    assembledPipelines: AssembledPipeline[] = [], 
    initialized: boolean = false, 
    debugMode: boolean = false,
    port: number = 5506
  ) {
    this.assembledPipelines = assembledPipelines;
    this.initialized = initialized;
    this.debugMode = debugMode;
    this.port = port;
    
    this.debugIntegration = new ModuleDebugIntegration({
      moduleId: 'anthropic-handler',
      moduleName: 'AnthropicMessageHandler',
      enabled: true,
      captureLevel: 'full'
    });
    
    this.errorHandler = getEnhancedErrorHandler();
    this.httpErrorCenter = new HTTPErrorCenter(this.errorHandler, debugMode);
  }

  /**
   * 设置端口号（供外部调用）
   */
  setPort(port: number): void {
    this.port = port;
  }

  /**
   * 处理Anthropic标准messages请求
   */
  async handleAnthropicMessages(req: RequestContext, res: ResponseContext): Promise<void> {
    const requestId = req.id;
    
    // 初始化debug系统并开始会话
    await this.debugIntegration.initialize();
    const sessionId = this.debugIntegration.startSession();
    
    // 记录输入
    this.debugIntegration.recordInput(requestId, {
      method: req.method,
      url: req.url,
      hasBody: !!req.body,
      bodyType: typeof req.body,
      endpoint: 'anthropic-messages',
      port: this.port
    });
    
    try {
      // HTTP层基础验证
      if (!req.body) {
        const error = new RCCError(
          'Request body is required',
          RCCErrorCode.VALIDATION_ERROR,
          'http-server',
          { endpoint: '/v1/messages' }
        );
        
        await this.handleRequestError(error, req, res, requestId, sessionId);
        return;
      }

      // 检查流水线系统状态
      if (!this.initialized || this.assembledPipelines.length === 0) {
        const error = new RCCError(
          'Pipeline system not initialized or no pipelines available',
          RCCErrorCode.PIPELINE_MODULE_MISSING,
          'http-server',
          { endpoint: '/v1/messages' }
        );
        
        this.debugIntegration.recordEvent('service_error', requestId, { error: 'pipeline_not_ready' });
        await this.handleRequestError(error, req, res, requestId, sessionId);
        return;
      }

      // 选择流水线
      const selectedPipeline = this.assembledPipelines[0];
      
      if (this.debugMode) {
        console.log(`🎯 Selected pipeline for messages: ${selectedPipeline.id} (${selectedPipeline.provider}_${selectedPipeline.model})`);
        console.log(`📝 Anthropic messages request received`);
      }

      // 准备流水线输入
      const pipelineInput = {
        endpoint: '/v1/messages',
        method: 'POST',
        headers: req.headers,
        body: req.body,
        requestId: requestId,
        isAnthropicFormat: true
      };

      // 通过流水线处理请求
      const startTime = Date.now();
      
      try {
        // 执行流水线处理
        const pipelineResult = await selectedPipeline.execute(pipelineInput);
        const processingTime = Date.now() - startTime;

        if (this.debugMode) {
          console.log(`⚡ Pipeline processing completed in ${processingTime}ms`);
        }

        // 设置响应头和状态码
        res.statusCode = pipelineResult.statusCode || 200;
        res.headers['Content-Type'] = pipelineResult.contentType || 'application/json';
        res.headers['X-Pipeline-ID'] = selectedPipeline.id;
        res.headers['X-Processing-Time'] = processingTime.toString();
        
        // 使用流水线返回的响应体
        res.body = pipelineResult.responseBody;
        
        // 记录成功输出
        this.debugIntegration.recordOutput(requestId, {
          success: true,
          pipelineId: selectedPipeline.id,
          processingTime,
          statusCode: res.statusCode,
          endpoint: 'anthropic-messages',
          port: this.port
        });

      } catch (pipelineError) {
        console.error('❌ Pipeline execution error:', pipelineError);
        
        const error = new RCCError(
          `Pipeline execution failed: ${pipelineError instanceof Error ? pipelineError.message : 'Unknown pipeline error'}`,
          RCCErrorCode.PIPELINE_EXECUTION_FAILED,
          'http-server',
          { 
            endpoint: '/v1/messages',
            pipelineId: selectedPipeline.id,
            details: { originalError: pipelineError }
          }
        );
        
        this.debugIntegration.recordError(requestId, pipelineError as Error);
        await this.handleRequestError(error, req, res, requestId, sessionId, selectedPipeline.id);
        return;
      }

    } catch (error) {
      console.error('❌ Anthropic messages error:', error);
      
      this.debugIntegration.recordError(requestId, error as Error);
      
      const rccError = new RCCError(
        `Internal server error during message processing: ${error instanceof Error ? error.message : 'Unknown error'}`,
        RCCErrorCode.INTERNAL_ERROR,
        'http-server',
        { details: { endpoint: '/v1/messages', originalError: error } }
      );
      
      await this.handleRequestError(rccError, req, res, requestId, sessionId);
      return;
    } finally {
      await this.debugIntegration.endSession();
    }
  }

  /**
   * 设置流水线状态
   */
  setPipelines(pipelines: AssembledPipeline[], initialized: boolean): void {
    this.assembledPipelines = pipelines;
    this.initialized = initialized;
  }

  /**
   * 设置调试模式
   */
  setDebugMode(debugMode: boolean): void {
    this.debugMode = debugMode;
    this.httpErrorCenter.setDebugMode(debugMode);
  }

  /**
   * 处理请求错误
   */
  private async handleRequestError(
    error: RCCError, 
    req: RequestContext, 
    res: ResponseContext, 
    requestId: string, 
    sessionId: string,
    pipelineId?: string
  ): Promise<void> {
    await this.debugIntegration.endSession();
    
    await this.errorHandler.handleRCCError(error, { 
      requestId, 
      endpoint: '/v1/messages',
      pipelineId,
      method: req.method
    });
    
    const httpError = await this.httpErrorCenter.handleUnprocessedError(error, {
      requestId,
      endpoint: '/v1/messages',
      method: req.method,
      pipelineId,
      originalError: error
    });
    
    await this.sendErrorResponse(res._originalResponse || res as any, httpError);
  }

  /**
   * 发送HTTP错误响应
   */
  private async sendErrorResponse(res: any, errorResponse: any): Promise<void> {
    if (res.headersSent) {
      return; // 如果响应已经发送，无法再发送错误响应
    }

    // 设置响应头
    for (const [key, value] of Object.entries(errorResponse.headers)) {
      if (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) {
        res.setHeader(key, value);
      }
    }

    // 设置状态码
    res.statusCode = errorResponse.statusCode;

    // 发送响应体
    res.end(JSON.stringify(errorResponse.body, null, 2));
  }
}