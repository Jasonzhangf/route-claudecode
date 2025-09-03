/**
 * 服务器工厂
 *
 * 负责创建各种服务器实例，注入必要的依赖
 * 确保模块间通过接口通信
 *
 * @author Jason Zhang
 */

import { PipelineServerManager } from '../pipeline/pipeline-server-manager';
import { HTTPServer, ServerConfig } from './http-server';
import { IMiddlewareManager } from '../interfaces/core';

/**
 * 服务器工厂类
 */
export class ServerFactory {
  private middlewareManager: IMiddlewareManager;

  constructor(middlewareManager?: IMiddlewareManager) {
    if (!middlewareManager) {
      throw new Error('MiddlewareManager is required. Please provide an instance.');
    }
    this.middlewareManager = middlewareManager;
  }

  /**
   * 创建HTTP服务器
   * @param config 服务器配置
   * @returns HTTPServer HTTP服务器实例
   */
  createHTTPServer(config: ServerConfig): HTTPServer {
    return new HTTPServer(config);
  }

  /**
   * 创建Pipeline服务器管理器
   * @param config Pipeline服务器配置
   * @returns PipelineServerManager Pipeline服务器管理器实例
   */
  createPipelineServerManager(config: any): PipelineServerManager {
    return new PipelineServerManager(config);
  }

  /**
   * 设置中间件管理器
   * @param manager 中间件管理器
   */
  setMiddlewareManager(manager: IMiddlewareManager): void {
    this.middlewareManager = manager;
  }

  /**
   * 获取中间件管理器
   * @returns IMiddlewareManager 中间件管理器
   */
  getMiddlewareManager(): IMiddlewareManager {
    return this.middlewareManager;
  }
}

// Note: DefaultServerFactory should be created elsewhere with proper middleware manager injection
