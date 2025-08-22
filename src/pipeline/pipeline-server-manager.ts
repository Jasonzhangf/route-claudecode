/**
 * Pipeline服务器管理器 - 管理服务器初始化和生命周期
 *
 * 职责：
 * 1. 管理Pipeline服务器的初始化和启动
 * 2. 处理服务器生命周期管理
 * 3. 管理路由器和流水线的集成
 *
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { secureLogger } from '../utils/secure-logger';
import { MergedConfig } from '../config/config-reader';
import { PipelineRouter, RoutingTable as RouterRoutingTable } from '../router/pipeline-router';
import { PipelineTableManager, RoutingTable as TableRoutingTable } from './pipeline-table-manager';
import { HTTPServer } from '../server/http-server';
import { 
  DEFAULT_TIMEOUTS,
  DEFAULT_RETRY_CONFIG,
  PROVIDER_NAMES,
  LAYER_NAMES
} from '../constants/compatibility-constants';
import {
  DEFAULT_SERVER_CONFIG,
  SERVER_STATUS,
  HEALTH_CHECK_CONFIG,
  METRICS_CONFIG,
  CACHE_CONFIG,
  SERVER_LIFECYCLE_DELAYS,
  HTTP_STATUS_CODES,
  ERROR_MESSAGES,
  LOG_MESSAGES,
  STEP_DESCRIPTIONS,
  SERVER_METHODS,
  MIDDLEWARE_TYPES,
  RESPONSE_FIELDS
} from '../constants/server-constants';

export interface ServerInitializationResult {
  success: boolean;
  server: any;
  router: PipelineRouter;
  routingTable: TableRoutingTable;
  initializationTime: number;
  error?: string;
}

export interface ServerHealthStatus {
  healthy: boolean;
  serverRunning: boolean;
  routerInitialized: boolean;
  routingTableLoaded: boolean;
  totalPipelines: number;
  lastHealthCheck: string;
  errors: string[];
}

export interface ServerMetrics {
  uptime: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  routerStats: any;
  memoryUsage: number;
}

/**
 * Pipeline服务器管理器
 * 负责服务器的完整生命周期管理
 */
export class PipelineServerManager extends EventEmitter {
  private config: MergedConfig;
  private tableManager: PipelineTableManager;
  private server: HTTPServer | null = null;
  private router: PipelineRouter | null = null;
  private routingTable: TableRoutingTable | null = null;
  private isInitialized: boolean = false;
  private isRunning: boolean = false;
  private startTime: number = 0;
  private metrics: ServerMetrics;

  constructor(config: MergedConfig) {
    super();
    this.config = config;
    this.tableManager = new PipelineTableManager(config);
    
    this.metrics = {
      uptime: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      routerStats: {},
      memoryUsage: 0,
    };
  }

  /**
   * 初始化Pipeline服务器
   */
  async initializeServer(): Promise<ServerInitializationResult> {
    const startTime = Date.now();
    
    secureLogger.info(LOG_MESSAGES.SERVER_INIT_START, {
      configName: 'runtime-config',
      hasProviders: !!(this.config.providers && this.config.providers.length > 0),
    });

    try {
      // Step 1: 生成或加载路由表
      secureLogger.debug(STEP_DESCRIPTIONS.GENERATE_ROUTING_TABLE);
      this.routingTable = await this.tableManager.getOrGenerateRoutingTable();
      
      if (!this.tableManager.validateRoutingTable(this.routingTable)) {
        throw new Error(ERROR_MESSAGES.INVALID_ROUTING_TABLE);
      }

      // Step 2: 初始化Pipeline路由器
      secureLogger.debug(STEP_DESCRIPTIONS.INITIALIZE_ROUTER);
      const routerTable = this.convertToRouterTable(this.routingTable);
      this.router = PipelineRouter.fromRoutingTable(routerTable);
      
      if (!this.router) {
        throw new Error(ERROR_MESSAGES.ROUTER_CREATION_FAILED);
      }

      // Step 3: 创建服务器实例
      secureLogger.debug(STEP_DESCRIPTIONS.CREATE_SERVER_INSTANCE);
      this.server = await this.createServerInstance();

      // Step 4: 配置服务器与路由器的集成
      secureLogger.debug(STEP_DESCRIPTIONS.CONFIGURE_INTEGRATION);
      await this.configureServerRouterIntegration();

      // 标记初始化完成
      this.isInitialized = true;
      this.startTime = Date.now();
      
      const initializationTime = Date.now() - startTime;
      
      secureLogger.info(LOG_MESSAGES.SERVER_INIT_SUCCESS, {
        initializationTime,
        totalPipelines: this.routingTable.totalPipelines,
        virtualModels: Object.keys(this.routingTable.pipelinesGroupedByVirtualModel),
        routerInitialized: !!this.router,
        serverCreated: !!this.server,
      });

      return {
        success: true,
        server: this.server,
        router: this.router,
        routingTable: this.routingTable,
        initializationTime,
      };

    } catch (error) {
      const initializationTime = Date.now() - startTime;
      
      secureLogger.error(LOG_MESSAGES.SERVER_INIT_FAILED, {
        error: error.message,
        stack: error.stack,
        initializationTime,
      });

      // 清理部分初始化的资源
      await this.cleanup();

      return {
        success: false,
        server: null,
        router: null,
        routingTable: null,
        initializationTime,
        error: error.message,
      };
    }
  }

  /**
   * 启动Pipeline服务器
   */
  async startServer(port?: number): Promise<boolean> {
    if (!this.isInitialized) {
      secureLogger.error(ERROR_MESSAGES.SERVER_NOT_INITIALIZED);
      return false;
    }

    if (this.isRunning) {
      secureLogger.warn(ERROR_MESSAGES.SERVER_ALREADY_RUNNING);
      return true;
    }

    try {
      const serverPort = port || this.config.server?.port || DEFAULT_SERVER_CONFIG.PORT;
      
      secureLogger.info('启动Pipeline服务器', {
        port: serverPort,
        totalPipelines: this.routingTable?.totalPipelines || 0,
      });

      // 启动服务器实例
      await this.server.start();
      
      this.isRunning = true;
      this.startTime = Date.now();
      
      secureLogger.info(LOG_MESSAGES.SERVER_START_SUCCESS, {
        port: serverPort,
        uptime: 0,
      });

      return true;

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.SERVER_START_FAILED, {
        error: error.message,
        stack: error.stack,
      });
      
      return false;
    }
  }

  /**
   * 停止Pipeline服务器
   */
  async stopServer(): Promise<boolean> {
    if (!this.isRunning) {
      secureLogger.warn(ERROR_MESSAGES.SERVER_NOT_RUNNING);
      return true;
    }

    try {
      secureLogger.info('停止Pipeline服务器');

      // 停止服务器实例
      if (this.server) {
        await this.server.stop();
      }

      this.isRunning = false;
      
      secureLogger.info(LOG_MESSAGES.SERVER_STOP_SUCCESS);
      return true;

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.SERVER_STOP_FAILED, {
        error: error.message,
        stack: error.stack,
      });
      
      return false;
    }
  }

  /**
   * 重启Pipeline服务器
   */
  async restartServer(port?: number): Promise<boolean> {
    secureLogger.info('重启Pipeline服务器');
    
    const stopSuccess = await this.stopServer();
    if (!stopSuccess) {
      secureLogger.error(LOG_MESSAGES.SERVER_RESTART_FAILED);
      return false;
    }

    // 等待一段时间确保资源释放
    await new Promise(resolve => setTimeout(resolve, SERVER_LIFECYCLE_DELAYS.RESTART_DELAY_MS));

    const startSuccess = await this.startServer(port);
    if (!startSuccess) {
      secureLogger.error(LOG_MESSAGES.SERVER_RESTART_FAILED);
      return false;
    }

    secureLogger.info(LOG_MESSAGES.SERVER_RESTART_SUCCESS);
    return true;
  }

  /**
   * 获取服务器健康状态
   */
  async getHealthStatus(): Promise<ServerHealthStatus> {
    const errors: string[] = [];
    
    // 检查服务器运行状态
    const serverRunning = this.isRunning && !!this.server;
    
    // 检查路由器初始化状态
    const routerInitialized = !!this.router;
    
    // 检查路由表加载状态
    const routingTableLoaded = !!this.routingTable && this.routingTable.totalPipelines > 0;
    
    // 检查总体健康状态
    let healthy = serverRunning && routerInitialized && routingTableLoaded;
    
    // 收集错误信息
    if (!serverRunning) {
      errors.push(ERROR_MESSAGES.SERVER_NOT_RUNNING);
    }
    if (!routerInitialized) {
      errors.push(ERROR_MESSAGES.ROUTER_NOT_INITIALIZED);
    }
    if (!routingTableLoaded) {
      errors.push(ERROR_MESSAGES.ROUTING_TABLE_EMPTY);
    }

    // 如果服务器运行中，进行额外的健康检查
    if (serverRunning && this.server && typeof this.server[SERVER_METHODS.HEALTH_CHECK] === 'function') {
      try {
        const serverHealth = await this.server[SERVER_METHODS.HEALTH_CHECK]();
        if (!serverHealth.healthy) {
          healthy = false;
          errors.push(`${ERROR_MESSAGES.SERVER_HEALTH_CHECK_FAILED}: ${serverHealth.error || 'unknown error'}`);
        }
      } catch (error) {
        healthy = false;
        errors.push(`${ERROR_MESSAGES.SERVER_HEALTH_CHECK_FAILED}: ${error.message}`);
      }
    }

    return {
      healthy,
      serverRunning,
      routerInitialized,
      routingTableLoaded,
      totalPipelines: this.routingTable?.totalPipelines || 0,
      lastHealthCheck: new Date().toISOString(),
      errors,
    };
  }

  /**
   * 获取服务器指标
   */
  getServerMetrics(): ServerMetrics {
    const uptime = this.startTime ? Date.now() - this.startTime : 0;
    
    // 更新内存使用情况
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage = memUsage.heapUsed / METRICS_CONFIG.MEMORY_UNIT_MB; // MB
    }

    // 更新路由器统计
    if (this.router && typeof this.router[SERVER_METHODS.GET_STATS] === 'function') {
      this.metrics.routerStats = this.router[SERVER_METHODS.GET_STATS]();
    }

    return {
      ...this.metrics,
      uptime,
    };
  }

  /**
   * 更新请求指标
   */
  updateRequestMetrics(responseTime: number, success: boolean): void {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // 更新平均响应时间（简单移动平均）
    const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime;
    this.metrics.averageResponseTime = totalResponseTime / this.metrics.totalRequests;
  }

  /**
   * 重新加载路由表
   */
  async reloadRoutingTable(): Promise<boolean> {
    try {
      secureLogger.info('重新加载路由表');

      // 清除缓存并重新生成路由表
      this.tableManager.clearCache();
      const newRoutingTable = await this.tableManager.getOrGenerateRoutingTable();
      
      if (!this.tableManager.validateRoutingTable(newRoutingTable)) {
        throw new Error(ERROR_MESSAGES.INVALID_ROUTING_TABLE);
      }

      // 更新路由器
      const routerTable = this.convertToRouterTable(newRoutingTable);
      const newRouter = PipelineRouter.fromRoutingTable(routerTable);
      if (!newRouter) {
        throw new Error(ERROR_MESSAGES.ROUTER_CREATION_FAILED);
      }

      // 原子性更新
      this.routingTable = newRoutingTable;
      this.router = newRouter;

      // 重新配置服务器路由器集成
      if (this.server) {
        await this.configureServerRouterIntegration();
      }

      secureLogger.info(LOG_MESSAGES.ROUTING_TABLE_RELOAD_SUCCESS, {
        totalPipelines: newRoutingTable.totalPipelines,
        virtualModels: Object.keys(newRoutingTable.pipelinesGroupedByVirtualModel),
      });

      return true;

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.ROUTING_TABLE_RELOAD_FAILED, {
        error: error.message,
        stack: error.stack,
      });
      
      return false;
    }
  }

  /**
   * 创建服务器实例
   */
  private async createServerInstance(): Promise<HTTPServer> {
    const serverConfig = {
      port: this.config.server?.port || DEFAULT_SERVER_CONFIG.PORT,
      host: this.config.server?.host || DEFAULT_SERVER_CONFIG.HOST,
      debug: true,
    };

    const httpServer = new HTTPServer(serverConfig);

    // 添加主要的API路由
    httpServer.addRoute('POST', '/v1/chat/completions', async (req, res) => {
      await this.handleChatCompletions(req, res);
    });

    httpServer.addRoute('POST', '/v1/messages', async (req, res) => {
      await this.handleAnthropicMessages(req, res);
    });

    // 添加模型端点 - Claude Code 需要这些端点
    httpServer.addRoute('GET', '/v1/models', async (req, res) => {
      await this.handleGetModels(req, res);
    });


    secureLogger.info('HTTP服务器实例创建成功', {
      port: serverConfig.port,
      host: serverConfig.host,
    });

    return httpServer;
  }

  /**
   * 处理OpenAI格式的chat/completions请求
   */
  private async handleChatCompletions(req: any, res: any): Promise<void> {
    const startTime = Date.now();
    try {
      secureLogger.info('接收到chat/completions请求', {
        method: req.method,
        url: req.url,
        hasBody: !!req.body,
      });

      // 使用Pipeline请求处理器处理请求
      const result = await this.processRequestThroughPipeline('openai', req.body);
      
      const responseTime = Date.now() - startTime;
      this.updateRequestMetrics(responseTime, true);

      res.statusCode = 200;
      res.headers['Content-Type'] = 'application/json';
      res.body = result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateRequestMetrics(responseTime, false);
      
      secureLogger.error('chat/completions请求处理失败', {
        error: error.message,
        stack: error.stack,
      });

      res.statusCode = 500;
      res.headers['Content-Type'] = 'application/json';
      res.body = {
        error: 'Internal server error',
        message: error.message,
      };
    }
  }

  /**
   * 处理模型列表请求 - Claude Code 需要的端点
   */
  private async handleGetModels(req: any, res: any): Promise<void> {
    try {
      secureLogger.info('接收到models请求', {
        method: req.method,
        url: req.url,
      });

      // 从路由表中获取可用的虚拟模型
      const availableModels: any[] = [];
      
      if (this.routingTable) {
        for (const [virtualModel, pipelines] of Object.entries(this.routingTable.pipelinesGroupedByVirtualModel)) {
          // 为每个虚拟模型创建模型条目
          availableModels.push({
            id: virtualModel,
            object: 'model',
            created: Date.now(),
            owned_by: 'rcc4-router',
            permission: [],
            root: virtualModel,
            parent: null,
          });
          
          // 也添加实际的provider模型
          for (const pipeline of pipelines) {
            if (pipeline.status === 'runtime') {
              availableModels.push({
                id: `${pipeline.provider}-${pipeline.virtualModel}`,
                object: 'model',
                created: Date.now(),
                owned_by: `rcc4-${pipeline.provider}`,
                permission: [],
                root: pipeline.virtualModel,
                parent: pipeline.provider,
              });
            }
          }
        }
      }

      // 如果没有模型，提供默认模型
      if (availableModels.length === 0) {
        availableModels.push({
          id: 'rcc4-default',
          object: 'model',
          created: Date.now(),
          owned_by: 'rcc4-router',
          permission: [],
          root: 'rcc4-default',
          parent: null,
        });
      }

      const response = {
        object: 'list',
        data: availableModels,
      };

      res.statusCode = 200;
      res.headers['Content-Type'] = 'application/json';
      res.body = response;

      secureLogger.info('models请求处理成功', {
        modelsCount: availableModels.length,
        models: availableModels.map(m => m.id),
      });

    } catch (error) {
      secureLogger.error('models请求处理失败', {
        error: error.message,
        stack: error.stack,
      });

      res.statusCode = 500;
      res.headers['Content-Type'] = 'application/json';
      res.body = {
        error: 'Internal server error',
        message: error.message,
      };
    }
  }

  /**
   * 处理Anthropic格式的messages请求
   */
  private async handleAnthropicMessages(req: any, res: any): Promise<void> {
    const startTime = Date.now();
    try {
      secureLogger.info('接收到messages请求', {
        method: req.method,
        url: req.url,
        hasBody: !!req.body,
      });

      const INPUT_PROTOCOL = 'anthropic'; // Claude Code输入协议固定为anthropic
      secureLogger.info('通过流水线处理请求', {
        protocol: INPUT_PROTOCOL,
        hasInput: !!req.body,
        router: true,
      });

      // 使用Pipeline请求处理器处理请求
      const result = await this.processRequestThroughPipeline(INPUT_PROTOCOL, req.body);
      
      const responseTime = Date.now() - startTime;
      this.updateRequestMetrics(responseTime, true);

      res.statusCode = 200;
      res.headers['Content-Type'] = 'application/json';
      res.body = result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateRequestMetrics(responseTime, false);
      
      secureLogger.error('messages请求处理失败', {
        error: error.message,
        stack: error.stack,
      });

      res.statusCode = 500;
      res.headers['Content-Type'] = 'application/json';
      res.body = {
        error: 'Internal server error',
        message: error.message,
      };
    }
  }

  /**
   * 通过流水线处理请求
   */
  private async processRequestThroughPipeline(protocol: string, input: any): Promise<any> {
    // 现在我们需要调用真正的PipelineRequestProcessor来处理完整的6层流水线
    
    secureLogger.info('通过流水线处理请求', {
      protocol,
      hasInput: !!input,
      router: !!this.router,
    });

    try {
      // 创建PipelineRequestProcessor实例
      const { PipelineRequestProcessor } = require('./pipeline-request-processor');
      const processor = new PipelineRequestProcessor(this.config, true); // Enable debug mode
      
      // 创建执行上下文
      const executionContext = {
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        priority: 'normal',
        debug: false, // 简化处理，后续可以从配置中读取
        metadata: {
          protocol,
          entryPoint: 'server-manager'
        }
      };

      // 处理完整的6层流水线请求
      const result = await processor.processRequest(protocol, input, executionContext);
      
      secureLogger.info('流水线处理完成', {
        requestId: executionContext.requestId,
        executionId: result.executionId,
        totalTime: result.performance.totalTime,
        success: !result.error
      });

      return result.result;
      
    } catch (error) {
      secureLogger.error('流水线处理失败', {
        protocol,
        error: error.message,
        stack: error.stack
      });

      // 返回简单的错误响应
      return {
        id: `req_${Date.now()}`,
        object: 'error',
        error: {
          type: 'pipeline_error',
          message: '流水线处理失败，使用简化响应模式',
        },
      };
    }
  }

  /**
   * 配置服务器与路由器的集成
   */
  private async configureServerRouterIntegration(): Promise<void> {
    if (!this.server || !this.router) {
      throw new Error(ERROR_MESSAGES.INTEGRATION_FAILED);
    }

    secureLogger.debug('配置服务器路由器集成');
    
    // 现在路由器已经通过handleChatCompletions和handleAnthropicMessages方法集成
    // 这些方法在创建服务器时已经添加到路由中
    
    secureLogger.debug('服务器路由器集成配置完成');
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    secureLogger.info(LOG_MESSAGES.RESOURCE_CLEANUP_START);

    try {
      // 停止服务器
      if (this.isRunning) {
        await this.stopServer();
      }

      // 清理路由器
      if (this.router && typeof this.router[SERVER_METHODS.CLEANUP] === 'function') {
        await this.router[SERVER_METHODS.CLEANUP]();
      }

      // 清理路由表缓存
      if (this.tableManager) {
        this.tableManager.clearCache();
      }

      // 重置状态
      this.server = null;
      this.router = null;
      this.routingTable = null;
      this.isInitialized = false;
      this.isRunning = false;
      this.startTime = 0;

      secureLogger.info(LOG_MESSAGES.RESOURCE_CLEANUP_SUCCESS);

    } catch (error) {
      secureLogger.error(LOG_MESSAGES.RESOURCE_CLEANUP_ERROR, {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * 获取服务器状态信息
   */
  getServerInfo(): {
    initialized: boolean;
    running: boolean;
    uptime: number;
    routingTable: TableRoutingTable | null;
    routerStatus: any;
  } {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      routingTable: this.routingTable,
      routerStatus: this.router ? {
        type: 'PipelineRouter',
        initialized: true,
      } : null,
    };
  }

  /**
   * 将Pipeline表的RoutingTable转换为Router的RoutingTable格式
   */
  private convertToRouterTable(tableRoutingTable: TableRoutingTable): RouterRoutingTable {
    const routes: Record<string, any[]> = {};
    
    // 转换每个虚拟模型的流水线定义为路由定义
    for (const [virtualModel, pipelines] of Object.entries(tableRoutingTable.pipelinesGroupedByVirtualModel)) {
      routes[virtualModel] = pipelines.map(pipeline => ({
        routeId: `${pipeline.pipelineId}-route`,
        routeName: pipeline.pipelineId,
        virtualModel: pipeline.virtualModel,
        provider: pipeline.provider,
        apiKeyIndex: pipeline.apiKeyIndex,
        pipelineId: pipeline.pipelineId,
        isActive: pipeline.status === 'runtime',
        health: 'healthy' as const,
      }));
    }

    // 选择默认路由（使用第一个可用的虚拟模型）
    const defaultRoute = Object.keys(routes)[0] || 'default';

    return {
      routes,
      defaultRoute,
    };
  }
}