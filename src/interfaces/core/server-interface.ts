/**
 * 服务器模块接口定义
 *
 * 定义HTTP服务器和Pipeline服务器的标准接口
 * 严格遵循模块边界，通过接口与其他模块通信
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleConfig } from '../module/base-module';
import { EventEmitter } from 'events';

/**
 * HTTP方法枚举
 */
export enum HTTPMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}

/**
 * HTTP请求上下文
 */
export interface IRequestContext {
  readonly id: string;
  readonly startTime: Date;
  readonly method: HTTPMethod;
  readonly url: string;
  readonly headers: Record<string, string | string[]>;
  readonly query: Record<string, string>;
  readonly params: Record<string, string>;
  body?: any;
  user?: any;
  metadata?: Record<string, any>;
}

/**
 * HTTP响应上下文
 */
export interface IResponseContext {
  readonly req: IRequestContext;
  statusCode: number;
  headers: Record<string, string>;
  body?: any;
  sent: boolean;
}

/**
 * 中间件函数类型
 */
export type IMiddlewareFunction = (
  req: IRequestContext,
  res: IResponseContext,
  next: (error?: Error) => void
) => void | Promise<void>;

/**
 * 路由处理函数类型
 */
export type IRouteHandler = (req: IRequestContext, res: IResponseContext) => void | Promise<void>;

/**
 * 路由定义
 */
export interface IRoute {
  method: HTTPMethod;
  path: string;
  handler: IRouteHandler;
  middleware?: IMiddlewareFunction[];
}

/**
 * 服务器配置
 */
export interface ServerConfig extends ModuleConfig {
  readonly port: number;
  readonly host: string;
  readonly maxRequestSize?: number;
  readonly timeout?: number;
  readonly keepAliveTimeout?: number;
  readonly enableCors?: boolean;
  readonly enableCompression?: boolean;
  readonly enableRateLimit?: boolean;
  readonly rateLimitWindow?: number;
  readonly rateLimitMax?: number;
}

/**
 * 服务器状态信息
 */
export interface IServerStatus {
  readonly isRunning: boolean;
  readonly port: number;
  readonly host: string;
  readonly startTime?: Date;
  readonly version: string;
  readonly activePipelines: number;
  readonly totalRequests: number;
  readonly uptime: string;
  readonly health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      responseTime: number;
      message?: string;
    }>;
  };
}

/**
 * HTTP服务器接口
 */
export interface IHTTPServer extends ModuleInterface {
  readonly config: ServerConfig;

  /**
   * 添加全局中间件
   * @param middleware 中间件函数
   */
  use(middleware: IMiddlewareFunction): void;

  /**
   * 添加路由
   * @param method HTTP方法
   * @param path 路径
   * @param handler 处理函数
   * @param middleware 路由级中间件
   */
  addRoute(method: HTTPMethod | string, path: string, handler: IRouteHandler, middleware?: IMiddlewareFunction[]): void;

  /**
   * 移除路由
   * @param method HTTP方法
   * @param path 路径
   */
  removeRoute(method: HTTPMethod | string, path: string): void;

  /**
   * 获取服务器状态
   * @returns IServerStatus 服务器状态
   */
  getServerStatus(): IServerStatus;

  /**
   * 获取活跃连接数
   * @returns number 活跃连接数
   */
  getActiveConnections(): number;

  /**
   * 获取请求统计
   * @returns any 请求统计信息
   */
  getRequestStats(): any;
}

/**
 * Pipeline配置
 */
export interface IPipelineConfig {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly model: string;
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly enabled: boolean;
  readonly maxConcurrency: number;
  readonly timeout: number;
  readonly retryCount: number;
  readonly metadata?: Record<string, any>;
}

/**
 * Pipeline执行上下文
 */
export interface IPipelineExecutionContext {
  readonly requestId: string;
  readonly priority: 'low' | 'normal' | 'high';
  readonly debug: boolean;
  readonly metadata?: Record<string, any>;
}

/**
 * Pipeline执行结果
 */
export interface IPipelineExecutionResult {
  readonly executionId: string;
  readonly pipelineId: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly result: any;
  readonly error?: Error;
  readonly performance: {
    totalTime: number;
    networkTime: number;
    processingTime: number;
    transformTime: number;
  };
}

/**
 * Pipeline状态
 */
export interface IPipelineStatus {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly model: string;
  readonly status: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  readonly activeExecutions: number;
  readonly totalExecutions: number;
  readonly successExecutions: number;
  readonly errorExecutions: number;
  readonly averageExecutionTime: number;
  readonly lastActivity?: Date;
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
  readonly error?: Error;
}

/**
 * Pipeline服务器配置
 */
export interface PipelineServerConfig extends ServerConfig {
  readonly pipelines: IPipelineConfig[];
  readonly enableAuth?: boolean;
  readonly enableValidation?: boolean;
  readonly logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Pipeline管理器接口（服务器内部）
 */
export interface IInternalPipelineManager {
  /**
   * 创建Pipeline实例
   * @param config Pipeline配置
   * @returns Promise<string> Pipeline ID
   */
  createPipeline(config: IPipelineConfig): Promise<string>;

  /**
   * 销毁Pipeline实例
   * @param pipelineId Pipeline ID
   * @returns Promise<void>
   */
  destroyPipeline(pipelineId: string): Promise<void>;

  /**
   * 执行Pipeline
   * @param pipelineId Pipeline ID
   * @param input 输入数据
   * @param context 执行上下文
   * @returns Promise<IPipelineExecutionResult> 执行结果
   */
  executePipeline(
    pipelineId: string,
    input: any,
    context: IPipelineExecutionContext
  ): Promise<IPipelineExecutionResult>;

  /**
   * 获取Pipeline实例
   * @param pipelineId Pipeline ID
   * @returns any | null Pipeline实例
   */
  getPipeline(pipelineId: string): any | null;

  /**
   * 获取所有Pipeline
   * @returns Map<string, any> Pipeline映射表
   */
  getAllPipelines(): Map<string, any>;

  /**
   * 获取Pipeline状态
   * @param pipelineId Pipeline ID
   * @returns IPipelineStatus | null Pipeline状态
   */
  getPipelineStatus(pipelineId: string): IPipelineStatus | null;

  /**
   * 获取所有Pipeline状态
   * @returns Map<string, IPipelineStatus> 状态映射表
   */
  getAllPipelineStatus(): Map<string, IPipelineStatus>;
}

/**
 * Pipeline服务器接口
 */
export interface IPipelineServer extends IHTTPServer {
  readonly config: PipelineServerConfig;
  readonly pipelineManager: IInternalPipelineManager;

  /**
   * 获取Pipeline管理器
   * @returns IInternalPipelineManager Pipeline管理器
   */
  getPipelineManager(): IInternalPipelineManager;

  /**
   * 获取Pipeline配置列表
   * @returns IPipelineConfig[] Pipeline配置数组
   */
  getPipelineConfigs(): IPipelineConfig[];

  /**
   * 处理Anthropic格式请求
   * @param req 请求上下文
   * @param res 响应上下文
   * @returns Promise<void>
   */
  handleAnthropicRequest(req: IRequestContext, res: IResponseContext): Promise<void>;

  /**
   * 处理OpenAI格式请求
   * @param req 请求上下文
   * @param res 响应上下文
   * @returns Promise<void>
   */
  handleOpenAIRequest(req: IRequestContext, res: IResponseContext): Promise<void>;

  /**
   * 处理Gemini格式请求
   * @param req 请求上下文
   * @param res 响应上下文
   * @returns Promise<void>
   */
  handleGeminiRequest(req: IRequestContext, res: IResponseContext): Promise<void>;

  /**
   * 处理直接Pipeline请求
   * @param req 请求上下文
   * @param res 响应上下文
   * @returns Promise<void>
   */
  handlePipelineRequest(req: IRequestContext, res: IResponseContext): Promise<void>;
}

/**
 * 服务器事件类型
 */
export interface ServerEvents {
  'server-started': (info: { host: string; port: number }) => void;
  'server-stopped': () => void;
  'server-error': (error: Error) => void;
  'request-received': (req: IRequestContext) => void;
  'request-completed': (req: IRequestContext, res: IResponseContext) => void;
  'pipeline-execution-started': (data: { pipelineId: string; executionId: string }) => void;
  'pipeline-execution-completed': (result: IPipelineExecutionResult) => void;
  'pipeline-execution-failed': (data: { pipelineId: string; executionId: string; error: Error }) => void;
}
