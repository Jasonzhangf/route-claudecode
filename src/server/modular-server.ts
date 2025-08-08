/**
 * Modular Router Server
 * 
 * 按照细菌式编程原则重构的服务器主入口
 * - 小巧：每个模块不超过500行
 * - 模块化：功能组织成可插拔的独立单元
 * - 自包含：每个模块都可以独立使用和测试
 */

import Fastify, { FastifyInstance } from 'fastify';
import { RouterConfig, RoutingCategory, CategoryRouting } from '@/types';
import { UnifiedInputProcessor } from '@/input/unified-processor';
import { RoutingEngine } from '@/routing';
import { AnthropicOutputProcessor } from '@/output/anthropic';
import { getLogger, setDefaultPort, createRequestTracker, createErrorTracker } from '@/logging';
import { sessionManager } from '@/session/manager';
import { ProviderExpander } from '@/routing/provider-expander';
import { createPatchManager } from '@/patches';
// // import { ResponsePipeline } from '@/pipeline/response-pipeline';
import { transformationManager } from '@/transformers/manager';
import { getUnifiedPatchPreprocessor } from '@/preprocessing/unified-patch-preprocessor';

// 导入模块化组件
import { ProviderManager, createProviderManager } from './core/provider-manager';
import { HealthHandler, createHealthHandler } from './handlers/health-handler';
import { AdminHandler, createAdminHandler } from './handlers/admin-handler';
import { MessagesHandler, createMessagesHandler } from './handlers/messages-handler';
import { StreamingHandler, createStreamingHandler } from './handlers/streaming-handler';
import { RouteSetup, createRouteSetup } from './core/route-setup';

/**
 * 模块化路由服务器
 * 
 * 采用依赖注入和组合模式，将复杂的服务器逻辑分解为小的、
 * 可测试的模块
 */
export class ModularRouterServer {
  private fastify: FastifyInstance;
  private config: RouterConfig;
  
  // 核心组件
  private logger: any;
  private requestTracker: any;
  private errorTracker: any;
  
  // 业务组件
  private inputProcessor!: UnifiedInputProcessor;
  private routingEngine!: RoutingEngine;
  private outputProcessor!: AnthropicOutputProcessor;
  private patchManager!: ReturnType<typeof createPatchManager>;
// //   private responsePipeline!: ResponsePipeline;
  private unifiedPreprocessor!: ReturnType<typeof getUnifiedPatchPreprocessor>;
  
  // 模块化组件
  private providerManager!: ProviderManager;
  private healthHandler!: HealthHandler;
  private adminHandler!: AdminHandler;
  private messagesHandler!: MessagesHandler;
  private streamingHandler!: StreamingHandler;
  private routeSetup!: RouteSetup;

  constructor(config: RouterConfig, serverType: string = 'modular') {
    this.config = config;
    this.fastify = Fastify({ 
      logger: false,
      bodyLimit: 10 * 1024 * 1024 // 10MB
    });
    
    this.initializeCore();
    this.initializeBusinessComponents();
    this.initializeModularComponents();
    
    this.logger.info('Modular Router Server initialized', {
      type: serverType,
      port: config.server.port,
      providers: Object.keys(config.providers || {}).length
    });
  }

  /**
   * 初始化核心组件
   */
  private initializeCore(): void {
    // 设置日志系统
    setDefaultPort(this.config.server.port);
    this.logger = getLogger(this.config.server.port);
    this.requestTracker = createRequestTracker(this.config.server.port);
    this.errorTracker = createErrorTracker(this.config.server.port);

    this.logger.info('Core components initialized');
  }

  /**
   * 初始化业务组件
   */
  private initializeBusinessComponents(): void {
    // 输入/输出处理器
    this.inputProcessor = new UnifiedInputProcessor();
    this.outputProcessor = new AnthropicOutputProcessor(this.config.server.port);
    
    // 路由引擎
    this.routingEngine = new RoutingEngine(this.config.routing as Record<RoutingCategory, CategoryRouting> || {} as Record<RoutingCategory, CategoryRouting>);
    
    // 补丁和流水线系统
    this.patchManager = createPatchManager(this.config.server.port);
// //     this.responsePipeline = new ResponsePipeline(this.patchManager, transformationManager, this.config.server.port);
    this.unifiedPreprocessor = getUnifiedPatchPreprocessor(this.config.server.port);
    
    // 初始化变换管理器
    if ('initialize' in transformationManager && typeof transformationManager.initialize === 'function') {
      transformationManager.initialize(this.config.server.port);
    }

    this.logger.info('Business components initialized');
  }

  /**
   * 初始化模块化组件
   */
  private initializeModularComponents(): void {
    // Provider管理器
    this.providerManager = createProviderManager({
      config: this.config,
      logger: this.logger
    });
    this.providerManager.initializeProviders();
    
    // 处理器模块
    this.healthHandler = createHealthHandler({
      providers: this.providerManager.getAllProviders(),
      logger: this.logger,
      errorTracker: this.errorTracker,
      requestTracker: this.requestTracker
    });
    
    this.adminHandler = createAdminHandler({
      providers: this.providerManager.getAllProviders(),
      logger: this.logger,
      errorTracker: this.errorTracker,
      requestTracker: this.requestTracker,
      config: this.config
    });
    
    this.streamingHandler = createStreamingHandler({
      logger: this.logger,
//       responsePipeline: this.responsePipeline,
      unifiedPreprocessor: this.unifiedPreprocessor,
      config: this.config
    });
    
    this.messagesHandler = createMessagesHandler({
      inputProcessor: this.inputProcessor,
      routingEngine: this.routingEngine,
      outputProcessor: this.outputProcessor,
      streamingHandler: this.streamingHandler,
      providers: this.providerManager.getAllProviders(),
      logger: this.logger,
      config: this.config
    });
    
    // 路由设置
    this.routeSetup = createRouteSetup({
      fastify: this.fastify,
      healthHandler: this.healthHandler,
      adminHandler: this.adminHandler,
      messagesHandler: this.messagesHandler,
      logger: this.logger,
      config: this.config
    });

    this.logger.info('Modular components initialized');
  }

  /**
   * 设置路由和中间件
   */
  private setup(): void {
    // 设置路由
    this.routeSetup.setupRoutes();
    
    // 设置钩子
    this.routeSetup.setupHooks();
    
    // 处理Provider扩展
    this.handleProviderExpansion();

    this.logger.info('Server setup completed');
  }

  /**
   * 处理Provider扩展
   */
  private async handleProviderExpansion(): Promise<void> {
    try {
      if (this.config.providers && Object.keys(this.config.providers).length > 0) {
        this.logger.info('Processing provider expansion...');
        
        const expansion = ProviderExpander.expandProviders(this.config.providers);
        
        this.logger.info('Provider expansion completed', {
          originalCount: Object.keys(this.config.providers).length,
          expandedCount: expansion.expandedProviders.size,
          originalProviders: expansion.originalProviders.size
        });
      }
    } catch (error) {
      this.logger.warn('Provider expansion failed, continuing with original config', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    try {
      this.setup();
      
      await this.fastify.listen({ 
        port: this.config.server.port, 
        host: this.config.server.host || '0.0.0.0' 
      });
      
      const healthyProviders = await this.providerManager.getHealthyProviders();
      
      console.log('\n🚀 Modular Router Server Started');
      console.log('================================');
      console.log(`📡 Server URL: http://${this.config.server.host || 'localhost'}:${this.config.server.port}`);
      console.log(`🔧 Total Providers: ${this.providerManager.getProviderCount()}`);
      console.log(`✅ Healthy Providers: ${healthyProviders.length}`);
      console.log(`📋 Available Endpoints:`);
      console.log(`   • Health: GET /health`);
      console.log(`   • Status: GET /status`);
      console.log(`   • Messages: POST /v1/messages`);
      console.log(`   • OpenAI Compat: POST /v1/chat/completions`);
      console.log(`   • Admin: GET /api/stats`);
      
      this.logger.info('Modular Router Server started successfully', {
        port: this.config.server.port,
        host: this.config.server.host,
        totalProviders: this.providerManager.getProviderCount(),
        healthyProviders: healthyProviders.length,
        providers: healthyProviders
      });

    } catch (error) {
      this.logger.error('Failed to start server', {
        error: error instanceof Error ? error.message : String(error),
        port: this.config.server.port
      });
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Shutting down Modular Router Server...');
      
      // 关闭Provider
      await this.providerManager.shutdown();
      
      // 清理会话管理器（没有shutdown方法）
      // sessionManager is a singleton and will persist
      
      // 关闭服务器
      await this.fastify.close();
      
      console.log('\n📴 Modular Router Server Stopped');
      this.logger.info('Modular Router Server stopped successfully');
      
    } catch (error) {
      this.logger.error('Error during server shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * 获取服务器统计信息
   */
  async getStats(): Promise<any> {
    const healthyProviders = await this.providerManager.getHealthyProviders();
    const providerStats = await this.providerManager.getProviderStats();
    
    return {
      timestamp: new Date().toISOString(),
      server: {
        port: this.config.server.port,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      providers: {
        total: this.providerManager.getProviderCount(),
        healthy: healthyProviders.length,
        stats: providerStats
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform
      }
    };
  }

  /**
   * 获取Provider管理器（用于测试）
   */
  getProviderManager(): ProviderManager {
    return this.providerManager;
  }

  /**
   * 获取Fastify实例（用于测试）
   */
  getFastify(): FastifyInstance {
    return this.fastify;
  }
}

/**
 * 创建模块化服务器实例的工厂函数
 */
export function createModularRouterServer(
  config: RouterConfig, 
  serverType?: string
): ModularRouterServer {
  return new ModularRouterServer(config, serverType);
}

/**
 * 默认导出
 */
export default ModularRouterServer;