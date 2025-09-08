/**
 * HTTP服务器核心接口和类型定义
 * 
 * 定义HTTP服务器相关的公共接口和类型
 * 
 * @author RCC v4.0
 */

import { RCCError, RCCErrorCode } from '../../types/src/index';

// 定义纯净的AssembledPipeline接口
export interface AssembledPipeline {
  id: string;
  provider: string;
  model: string;
  layers: any[];
  execute(request: any): Promise<{statusCode?: number; contentType?: string; responseBody: any}>;
}

// 服务器状态接口
export interface ServerStatus {
  isRunning: boolean;
  port: number;
  host: string;
  startTime?: Date;
  version: string;
  activePipelines: number;
  totalRequests: number;
  uptime: string;
  health: {
    status: string;
    checks: Array<{ name: string; status: 'pass' | 'warn' | 'fail'; responseTime: number }>;
  };
}

// HTTP方法类型
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

/**
 * HTTP请求上下文
 */
export interface RequestContext {
  id: string;
  startTime: Date;
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  query: Record<string, string>;
  params: Record<string, string>;
  body?: any;
  metadata: Record<string, any>;
}

/**
 * HTTP响应上下文
 */
export interface ResponseContext {
  req: RequestContext;
  statusCode: number;
  headers: Record<string, any>;
  body?: any;
  sent: boolean;
  _originalResponse?: any;
}

/**
 * 路由处理函数类型
 */
export type RouteHandler = (req: RequestContext, res: ResponseContext) => void | Promise<void>;

/**
 * 路由定义
 */
export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  port: number;
  host: string;
  maxRequestSize?: number;
  timeout?: number;
  keepAliveTimeout?: number;
  debug?: boolean;
}

/**
 * 流水线输入接口
 */
export interface PipelineInput {
  endpoint: string;
  method: string;
  headers: Record<string, string | string[]>;
  body: any;
  requestId: string;
  isAnthropicFormat?: boolean;
}

/**
 * HTTP服务器核心接口
 */
export interface HTTPServerCore {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ServerStatus;
  addRoute(method: string, path: string, handler: RouteHandler): void;
}

/**
 * 路由系统接口
 */
export interface HTTPRoutingSystem {
  addRoute(method: string, path: string, handler: RouteHandler): void;
  executeRoute(req: RequestContext, res: ResponseContext): Promise<void>;
}

/**
 * 请求处理器接口
 */
export interface HTTPRequestHandlers {
  handleHealthCheck(req: RequestContext, res: ResponseContext): Promise<void>;
  handleStatus(req: RequestContext, res: ResponseContext): Promise<void>;
  handleVersion(req: RequestContext, res: ResponseContext): Promise<void>;
}

/**
 * Anthropic消息处理器接口
 */
export interface AnthropicMessageHandler {
  handleAnthropicMessages(req: RequestContext, res: ResponseContext): Promise<void>;
}

/**
 * 错误处理接口
 */
export interface HTTPErrorHandler {
  handleError(error: unknown, req: any, res: any): Promise<void>;
  sendErrorResponse(res: any, errorResponse: any): Promise<void>;
}