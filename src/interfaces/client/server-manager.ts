/**
 * 服务器管理接口定义
 * 
 * 定义HTTP服务器的管理接口
 * 
 * @author Jason Zhang
 */

import { ServerStatus } from './cli-interface';

/**
 * 服务器管理器接口
 */
export interface ServerManager {
  /**
   * 启动服务器
   */
  startServer(options: ServerStartOptions): Promise<void>;
  
  /**
   * 停止服务器
   */
  stopServer(force?: boolean): Promise<void>;
  
  /**
   * 获取服务器状态
   */
  getServerStatus(): Promise<ServerStatus>;
  
  /**
   * 设置路由
   */
  setupRoutes(): void;
  
  /**
   * 获取服务器实例
   */
  getServerInstance(): any;
  
  /**
   * 重启服务器
   */
  restartServer(options?: ServerStartOptions): Promise<void>;
}

/**
 * 服务器启动选项
 */
export interface ServerStartOptions {
  port: number;
  host: string;
  configPath?: string;
  debugMode?: boolean;
  corsOptions?: CORSOptions;
}

/**
 * CORS配置选项
 */
export interface CORSOptions {
  enabled: boolean;
  origins: string[];
  methods?: string[];
  allowedHeaders?: string[];
}

/**
 * 路由处理器接口
 */
export interface RouteHandler {
  /**
   * 处理健康检查
   */
  handleHealthCheck(): Promise<any>;
  
  /**
   * 处理聊天请求
   */
  handleChatRequest(request: any): Promise<any>;
  
  /**
   * 处理状态查询
   */
  handleStatusRequest(): Promise<any>;
  
  /**
   * 处理配置请求
   */
  handleConfigRequest(request: any): Promise<any>;
}

/**
 * 中间件接口
 */
export interface Middleware {
  /**
   * 处理请求
   */
  handle(request: any, response: any, next: () => void): Promise<void>;
}

/**
 * 请求日志中间件
 */
export interface RequestLoggingMiddleware extends Middleware {
  /**
   * 记录请求
   */
  logRequest(request: any): void;
  
  /**
   * 记录响应
   */
  logResponse(response: any, processingTime: number): void;
}

/**
 * 认证中间件
 */
export interface AuthenticationMiddleware extends Middleware {
  /**
   * 验证API密钥
   */
  validateApiKey(apiKey: string): boolean;
  
  /**
   * 验证请求权限
   */
  validatePermissions(request: any): boolean;
}