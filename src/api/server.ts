/**
 * Internal API Server - 内部API服务器
 * 
 * 为RCC4提供内部模块间通信的REST API端点
 * 支持Pipeline层间的API化通信
 * 
 * @author RCC v4.0 Phase 2 API Implementation
 */

import * as http from 'http';
import { secureLogger } from '../utils/secure-logger';
import { RouterAPIProcessor } from './modules/router-api';
import { PipelineLayersProcessor } from '../pipeline/modules/pipeline-layers';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * API服务器配置
 */
export interface APIServerConfig {
  port: number;
  host: string;
  cors: boolean;
}

/**
 * 内部API服务器类
 */
export class InternalAPIServer {
  private server: http.Server;
  private config: APIServerConfig;
  private routerProcessor?: RouterAPIProcessor;
  private pipelineProcessor?: PipelineLayersProcessor;
  private isStarted: boolean = false;

  constructor(config: APIServerConfig) {
    this.config = config;
    this.server = http.createServer(this.handleRequest.bind(this));
    
    secureLogger.info('Internal API Server created', {
      port: config.port,
      host: config.host
    });
  }

  /**
   * 设置Pipeline处理器
   */
  setPipelineProcessor(processor: PipelineLayersProcessor): void {
    this.pipelineProcessor = processor;
    this.routerProcessor = new RouterAPIProcessor(processor);
    
    secureLogger.info('Pipeline processor configured for API server');
  }

  /**
   * 启动API服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.isStarted = true;
        secureLogger.info('Internal API Server started', {
          port: this.config.port,
          host: this.config.host,
          url: `http://${this.config.host}:${this.config.port}`
        });
        resolve();
      });

      this.server.on('error', (error) => {
        secureLogger.error('API Server startup error', { error });
        reject(error);
      });
    });
  }

  /**
   * 停止API服务器
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isStarted) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.isStarted = false;
        secureLogger.info('Internal API Server stopped');
        resolve();
      });
    });
  }

  /**
   * 处理HTTP请求
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // 设置CORS头
      if (this.config.cors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
      }

      // 处理OPTIONS预检请求
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url || '';
      const method = req.method || 'GET';

      secureLogger.debug('API request received', {
        requestId,
        method,
        url
      });

      // 解析请求体
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          await this.processRequest(method, url, body, req, res, requestId, startTime);
        } catch (error) {
          await this.sendErrorResponse(res, 500, 'Internal Server Error', error, requestId, startTime);
        }
      });

    } catch (error) {
      await this.sendErrorResponse(res, 500, 'Request Processing Error', error, requestId, startTime);
    }
  }

  /**
   * 处理具体的API请求
   */
  private async processRequest(
    method: string,
    url: string,
    body: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requestId: string,
    startTime: number
  ): Promise<void> {
    
    // 健康检查端点
    if (method === 'GET' && url === '/health') {
      await this.sendSuccessResponse(res, {
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }, requestId, startTime);
      return;
    }

    // Router层处理端点
    if (method === 'POST' && url === '/api/v1/pipeline/router/process') {
      if (!this.routerProcessor) {
        await this.sendErrorResponse(res, 503, 'Router processor not configured', null, requestId, startTime);
        return;
      }

      try {
        const requestData = JQJsonHandler.parseJsonString(body);
        const result = await this.routerProcessor.processRoute(requestData.input, requestData.context);
        
        await this.sendSuccessResponse(res, result, requestId, startTime);
        return;
      } catch (parseError) {
        await this.sendErrorResponse(res, 400, 'Invalid JSON in request body', parseError, requestId, startTime);
        return;
      }
    }

    // Transformer层处理端点
    if (method === 'POST' && url === '/api/v1/pipeline/transformer/process') {
      if (!this.pipelineProcessor) {
        await this.sendErrorResponse(res, 503, 'Pipeline processor not configured', null, requestId, startTime);
        return;
      }

      try {
        const requestData = JQJsonHandler.parseJsonString(body);
        
        secureLogger.info('🔧 [API Server] Transformer请求数据', {
          requestId,
          hasInput: !!requestData.input,
          inputKeys: Object.keys(requestData.input || {}),
          inputTools: requestData.input?.tools?.length || 0,
          hasRoutingDecision: !!requestData.routingDecision,
          hasPipelineProcessor: !!this.pipelineProcessor
        });
        
        const result = await this.pipelineProcessor.processTransformerLayer(
          requestData.input,
          requestData.routingDecision,
          requestData.context
        );
        
        secureLogger.info('🔧 [API Server] Transformer处理结果', {
          requestId,
          resultType: typeof result,
          resultKeys: Object.keys(result || {}),
          resultTools: result?.tools?.length || 0,
          isNull: result === null,
          isUndefined: result === undefined,
          resultStringified: result ? JSON.stringify(result).substring(0, 200) : 'null/undefined'
        });
        
        await this.sendSuccessResponse(res, {
          output: result,
          context: requestData.context
        }, requestId, startTime);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.sendErrorResponse(res, 500, errorMessage, error, requestId, startTime);
        return;
      }
    }

    // Protocol层处理端点
    if (method === 'POST' && url === '/api/v1/pipeline/protocol/process') {
      if (!this.pipelineProcessor) {
        await this.sendErrorResponse(res, 503, 'Pipeline processor not configured', null, requestId, startTime);
        return;
      }

      try {
        const requestData = JQJsonHandler.parseJsonString(body);
        const result = await this.pipelineProcessor.processProtocolLayer(
          requestData.request,
          requestData.routingDecision,
          requestData.context
        );
        
        await this.sendSuccessResponse(res, {
          output: result,
          context: requestData.context
        }, requestId, startTime);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.sendErrorResponse(res, 500, errorMessage, error, requestId, startTime);
        return;
      }
    }

    // Server层处理端点
    if (method === 'POST' && url === '/api/v1/pipeline/server/process') {
      if (!this.pipelineProcessor) {
        await this.sendErrorResponse(res, 503, 'Pipeline processor not configured', null, requestId, startTime);
        return;
      }

      try {
        const requestData = JQJsonHandler.parseJsonString(body);
        const result = await this.pipelineProcessor.processServerLayer(
          requestData.request,
          requestData.routingDecision,
          requestData.context
        );
        
        await this.sendSuccessResponse(res, {
          output: result,
          context: requestData.context
        }, requestId, startTime);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.sendErrorResponse(res, 500, errorMessage, error, requestId, startTime);
        return;
      }
    }

    // 未找到的端点
    await this.sendErrorResponse(res, 404, 'API endpoint not found', null, requestId, startTime);
  }

  /**
   * 发送成功响应
   */
  private async sendSuccessResponse(
    res: http.ServerResponse,
    data: any,
    requestId: string,
    startTime: number
  ): Promise<void> {
    const processingTime = Date.now() - startTime;
    
    const response = {
      success: true,
      data,
      metadata: {
        requestId,
        timestamp: Date.now(),
        processingTime,
        apiVersion: '1.0.0'
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Processing-Time', processingTime.toString());
    res.writeHead(200);
    res.end(JQJsonHandler.stringifyJson(response));

    secureLogger.debug('API response sent', {
      requestId,
      processingTime,
      status: 200
    });
  }

  /**
   * 发送错误响应
   */
  private async sendErrorResponse(
    res: http.ServerResponse,
    status: number,
    message: string,
    error: any,
    requestId: string,
    startTime: number
  ): Promise<void> {
    const processingTime = Date.now() - startTime;
    
    const response = {
      success: false,
      error: {
        code: `HTTP_${status}`,
        message,
        details: error instanceof Error ? error.message : error
      },
      metadata: {
        requestId,
        timestamp: Date.now(),
        processingTime,
        apiVersion: '1.0.0'
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Processing-Time', processingTime.toString());
    res.writeHead(status);
    res.end(JQJsonHandler.stringifyJson(response));

    secureLogger.warn('API error response sent', {
      requestId,
      processingTime,
      status,
      message
    });
  }

  /**
   * 获取服务器状态
   */
  getStatus(): { running: boolean; port: number; uptime: number } {
    return {
      running: this.isStarted,
      port: this.config.port,
      uptime: this.isStarted ? process.uptime() : 0
    };
  }
}

/**
 * 创建默认API服务器实例
 */
export function createInternalAPIServer(port: number = 5506): InternalAPIServer {
  const config: APIServerConfig = {
    port,
    host: 'localhost',
    cors: true
  };

  return new InternalAPIServer(config);
}