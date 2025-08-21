/**
 * Router模块标准接口定义
 * 
 * 严格遵循六层架构模型，定义路由器模块的标准接口
 * 所有路由器实现必须遵循此接口规范
 * 
 * @module RouterInterface
 * @version 4.0.0-beta.1
 * @lastUpdated 2025-08-21
 * @author RCC v4.0 Team
 */

import { ROUTER_DEFAULTS } from '../../constants/router-defaults';
import { ERROR_MESSAGES } from '../../constants/error-messages';

// =============================================================================
// 核心接口定义 - 基于架构规则
// =============================================================================

/**
 * RCC标准请求接口
 */
export interface RCCRequest {
  readonly id: string;
  readonly model: string;
  readonly messages: readonly RCCMessage[];
  readonly max_tokens?: number;
  readonly temperature?: number;
  readonly stream?: boolean;
  readonly sessionId?: string;
  readonly conversationId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * RCC标准响应接口
 */
export interface RCCResponse {
  readonly id: string;
  readonly model: string;
  readonly content: readonly RCCContent[];
  readonly usage?: RCCUsage;
  readonly metadata?: Record<string, unknown>;
  readonly processingTime?: number;
  readonly pipelineId?: string;
}

/**
 * RCC消息接口
 */
export interface RCCMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

/**
 * RCC内容接口
 */
export interface RCCContent {
  readonly type: 'text' | 'image' | 'tool_use' | 'tool_result';
  readonly text?: string;
  readonly data?: unknown;
}

/**
 * RCC使用统计接口
 */
export interface RCCUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
}

/**
 * RCC错误接口
 */
export interface RCCError {
  readonly id: string;
  readonly type: string;
  readonly module: string;
  readonly message: string;
  readonly details?: unknown;
  readonly timestamp: number;
  readonly requestId?: string;
  readonly stack?: string;
}

// =============================================================================
// 模块接口标准 - 遵循架构规范
// =============================================================================

/**
 * 模块状态枚举
 */
export enum ModuleStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  ERROR = 'error',
  SHUTDOWN = 'shutdown'
}

/**
 * 标准模块接口
 * 所有RCC模块必须实现此接口
 */
export interface ModuleInterface {
  readonly name: string;
  readonly version: string;
  readonly status: ModuleStatus;
  
  initialize(config: ModuleConfig): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): ModuleStatus;
  getMetrics(): ModuleMetrics;
}

/**
 * 模块配置接口
 */
export interface ModuleConfig {
  readonly module: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly settings: Record<string, unknown>;
}

/**
 * 模块指标接口
 */
export interface ModuleMetrics {
  readonly requestCount: number;
  readonly errorCount: number;
  readonly averageResponseTime: number;
  readonly lastActivity: number;
  readonly uptime: number;
}

// =============================================================================
// 路由器专用接口 - 核心功能定义
// =============================================================================

/**
 * 路由器模块配置接口
 */
export interface RouterModuleConfig extends ModuleConfig {
  readonly module: 'router';
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly loadBalancer: LoadBalancerConfig;
  readonly routingTable: RoutingTableConfig;
  readonly sessionControl: SessionControlConfig;
}

/**
 * 负载均衡器配置接口
 */
export interface LoadBalancerConfig {
  readonly strategy: 'round-robin' | 'least-connections' | 'weighted' | 'health-based';
  readonly healthCheckInterval: number;
  readonly maxConnections: number;
  readonly connectionTimeout: number;
}

/**
 * 路由表配置接口
 */
export interface RoutingTableConfig {
  readonly updateInterval: number;
  readonly cacheTTL: number;
  readonly maxEntries: number;
  readonly validationEnabled: boolean;
}

/**
 * 会话控制配置接口
 */
export interface SessionControlConfig {
  readonly maxSessions: number;
  readonly sessionTimeout: number;
  readonly maxRequestsPerSession: number;
  readonly flowControlEnabled: boolean;
}

/**
 * 流水线工作器接口
 */
export interface PipelineWorker {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly status: 'ready' | 'busy' | 'error' | 'offline';
  
  process(request: RCCRequest): Promise<RCCResponse>;
  checkHealth(): Promise<boolean>;
  getMetrics(): PipelineMetrics;
}

/**
 * 流水线指标接口
 */
export interface PipelineMetrics {
  readonly requestCount: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly averageLatency: number;
  readonly currentLoad: number;
}

/**
 * 路由表接口
 */
export interface RoutingTable {
  readonly version: string;
  readonly routes: readonly PipelineRoute[];
  readonly lastUpdated: number;
  
  findRoute(request: RCCRequest): Promise<PipelineRoute | null>;
  updateRoutes(routes: readonly PipelineRoute[]): Promise<void>;
  validateRoutes(): Promise<boolean>;
}

/**
 * 流水线路由接口
 */
export interface PipelineRoute {
  readonly id: string;
  readonly pattern: RoutePattern;
  readonly pipelineId: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly metadata?: Record<string, unknown>;
}

/**
 * 路由模式接口
 */
export interface RoutePattern {
  readonly provider?: string;
  readonly model?: string;
  readonly capabilities?: readonly string[];
  readonly conditions?: Record<string, unknown>;
}

/**
 * 负载均衡统计接口
 */
export interface LoadBalancingStats {
  readonly totalRequests: number;
  readonly activeConnections: number;
  readonly averageResponseTime: number;
  readonly errorRate: number;
  readonly pipelineWeights: Record<string, number>;
}

// =============================================================================
// 错误处理接口 - 标准化错误边界
// =============================================================================

/**
 * 模块错误边界接口
 */
export interface ModuleErrorBoundary {
  readonly moduleName: string;
  
  executeWithErrorBoundary<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T>;
  
  handleError(error: RCCError): never;
  createModuleError(error: unknown, context: string): RCCError;
}

/**
 * 路由器错误边界接口
 */
export interface RouterErrorBoundary extends ModuleErrorBoundary {
  handleRoutingError(error: unknown, request: RCCRequest): never;
  handlePipelineError(error: unknown, pipelineId: string): never;
  handleConfigError(error: unknown): never;
}

// =============================================================================
// 路由器模块主接口 - 完整功能定义
// =============================================================================

/**
 * 路由器模块标准接口
 * 所有路由器实现必须遵循此接口
 */
export interface RouterModuleInterface extends ModuleInterface {
  readonly name: 'router';
  
  // 标准模块方法
  initialize(config: RouterModuleConfig): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): ModuleStatus;
  getMetrics(): RouterModuleMetrics;
  
  // 路由器专用方法
  routeRequest(request: RCCRequest): Promise<RCCResponse>;
  selectPipeline(request: RCCRequest): Promise<PipelineWorker>;
  updateRoutingTable(table: RoutingTable): Promise<void>;
  
  // 负载均衡方法
  balanceLoad(providers: readonly string[]): Promise<string>;
  getLoadStats(): LoadBalancingStats;
  
  // 会话控制方法
  createSession(sessionId: string): Promise<void>;
  destroySession(sessionId: string): Promise<void>;
  getSessionInfo(sessionId: string): Promise<SessionInfo>;
  
  // 健康检查方法
  checkHealth(): Promise<HealthStatus>;
  validateConfiguration(): Promise<boolean>;
}

/**
 * 路由器模块指标接口
 */
export interface RouterModuleMetrics extends ModuleMetrics {
  readonly routingStats: RoutingStats;
  readonly loadBalancingStats: LoadBalancingStats;
  readonly sessionStats: SessionStats;
  readonly pipelineStats: Record<string, PipelineMetrics>;
}

/**
 * 路由统计接口
 */
export interface RoutingStats {
  readonly totalRoutes: number;
  readonly activeRoutes: number;
  readonly routingLatency: number;
  readonly routingErrors: number;
  readonly cacheHitRate: number;
}

/**
 * 会话统计接口
 */
export interface SessionStats {
  readonly activeSessions: number;
  readonly totalSessions: number;
  readonly averageSessionDuration: number;
  readonly sessionErrors: number;
}

/**
 * 会话信息接口
 */
export interface SessionInfo {
  readonly sessionId: string;
  readonly createdAt: number;
  readonly lastActivity: number;
  readonly requestCount: number;
  readonly currentPipeline?: string;
}

/**
 * 健康状态接口
 */
export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly checks: readonly HealthCheck[];
  readonly timestamp: number;
}

/**
 * 健康检查接口
 */
export interface HealthCheck {
  readonly name: string;
  readonly status: 'pass' | 'fail' | 'warn';
  readonly message: string;
  readonly responseTime?: number;
  readonly metadata?: Record<string, unknown>;
}

// =============================================================================
// 工厂和构建器接口 - 依赖注入支持
// =============================================================================

/**
 * 路由器工厂接口
 */
export interface RouterFactory {
  createRouter(config: RouterModuleConfig): Promise<RouterModuleInterface>;
  createLoadBalancer(config: LoadBalancerConfig): Promise<LoadBalancer>;
  createRoutingTable(config: RoutingTableConfig): Promise<RoutingTable>;
}

/**
 * 负载均衡器接口
 */
export interface LoadBalancer {
  readonly strategy: string;
  
  selectPipeline(pipelines: readonly PipelineWorker[]): Promise<PipelineWorker>;
  updateWeights(weights: Record<string, number>): Promise<void>;
  getStats(): LoadBalancingStats;
  checkHealth(): Promise<boolean>;
}

/**
 * 依赖注入容器接口
 */
export interface DependencyContainer {
  register<T>(key: string, factory: () => Promise<T>): void;
  resolve<T>(key: string): Promise<T>;
  has(key: string): boolean;
}

// =============================================================================
// 路由器实现基类 - 标准实现模板
// =============================================================================

/**
 * 路由器模块基类
 * 提供标准实现模板，子类可以继承并重写特定方法
 */
export abstract class BaseRouterModule implements RouterModuleInterface {
  readonly name = 'router' as const;
  readonly version: string;
  
  protected config: RouterModuleConfig;
  protected errorBoundary: RouterErrorBoundary;
  public status: ModuleStatus = ModuleStatus.UNINITIALIZED;
  protected metrics: RouterModuleMetrics;
  
  constructor(version: string = '4.0.0') {
    this.version = version;
    this.metrics = this.initializeMetrics();
  }
  
  // 抽象方法 - 子类必须实现
  abstract routeRequest(request: RCCRequest): Promise<RCCResponse>;
  abstract selectPipeline(request: RCCRequest): Promise<PipelineWorker>;
  abstract updateRoutingTable(table: RoutingTable): Promise<void>;
  
  // 标准实现 - 子类可以重写
  async initialize(config: RouterModuleConfig): Promise<void> {
    this.status = ModuleStatus.INITIALIZING;
    this.config = this.validateConfig(config);
    this.errorBoundary = this.createErrorBoundary();
    this.status = ModuleStatus.READY;
  }
  
  async shutdown(): Promise<void> {
    this.status = ModuleStatus.SHUTDOWN;
  }
  
  getStatus(): ModuleStatus {
    return this.status;
  }
  
  getMetrics(): RouterModuleMetrics {
    return { ...this.metrics };
  }
  
  // 默认实现 - 通常不需要重写
  async balanceLoad(providers: readonly string[]): Promise<string> {
    if (providers.length === 0) {
      throw new Error(ERROR_MESSAGES.PROVIDER_NOT_CONFIGURED);
    }
    return providers[0];
  }
  
  getLoadStats(): LoadBalancingStats {
    return this.metrics.loadBalancingStats;
  }
  
  async createSession(sessionId: string): Promise<void> {
    // 默认实现
  }
  
  async destroySession(sessionId: string): Promise<void> {
    // 默认实现
  }
  
  async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    throw new Error('Session management not implemented');
  }
  
  async checkHealth(): Promise<HealthStatus> {
    return {
      status: 'healthy',
      checks: [
        {
          name: 'module',
          status: 'pass',
          message: 'Router module is operational'
        }
      ],
      timestamp: Date.now()
    };
  }
  
  async validateConfiguration(): Promise<boolean> {
    return true;
  }
  
  // 受保护的辅助方法
  protected validateConfig(config: RouterModuleConfig): RouterModuleConfig {
    if (!config.module || config.module !== 'router') {
      throw new Error(ERROR_MESSAGES.INVALID_CONFIG_FORMAT);
    }
    
    return {
      ...config,
      timeout: config.timeout || ROUTER_DEFAULTS.TIMEOUT,
      retryAttempts: config.retryAttempts || ROUTER_DEFAULTS.RETRY_ATTEMPTS
    };
  }
  
  protected createErrorBoundary(): RouterErrorBoundary {
    return {
      moduleName: this.name,
      
      async executeWithErrorBoundary<T>(
        operation: () => Promise<T>,
        context: string
      ): Promise<T> {
        try {
          return await operation();
        } catch (error) {
          const moduleError = this.createModuleError(error, context);
          this.handleError(moduleError);
          throw moduleError;
        }
      },
      
      handleError: (error: RCCError): never => {
        throw error;
      },
      
      createModuleError: (error: unknown, context: string): RCCError => ({
        id: this.generateErrorId(),
        type: 'ROUTER_ERROR',
        module: this.name,
        message: `Router error in ${context}`,
        details: error,
        timestamp: Date.now()
      }),
      
      handleRoutingError: (error: unknown, request: RCCRequest): never => {
        const moduleError = this.createModuleError(error, `routing request ${request.id}`);
        this.handleError(moduleError);
      },
      
      handlePipelineError: (error: unknown, pipelineId: string): never => {
        const moduleError = this.createModuleError(error, `pipeline ${pipelineId}`);
        this.handleError(moduleError);
      },
      
      handleConfigError: (error: unknown): never => {
        const moduleError = this.createModuleError(error, 'configuration');
        this.handleError(moduleError);
      }
    };
  }
  
  protected createModuleError(error: unknown, context: string): any {
    return {
      id: this.generateErrorId(),
      type: 'ROUTER_ERROR',
      module: 'router',
      message: `Router error in ${context}: ${error}`,
      details: error,
      timestamp: Date.now()
    };
  }
  
  protected handleError(error: any): never {
    // Update metrics (need to create new object due to readonly)
    this.metrics = {
      ...this.metrics,
      errorCount: this.metrics.errorCount + 1
    };
    console.error(`[${error.type}] ${error.message}`);
    throw error;
  }
  
  protected generateErrorId(): string {
    return `router-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private initializeMetrics(): RouterModuleMetrics {
    return {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastActivity: Date.now(),
      uptime: 0,
      routingStats: {
        totalRoutes: 0,
        activeRoutes: 0,
        routingLatency: 0,
        routingErrors: 0,
        cacheHitRate: 0
      },
      loadBalancingStats: {
        totalRequests: 0,
        activeConnections: 0,
        averageResponseTime: 0,
        errorRate: 0,
        pipelineWeights: {}
      },
      sessionStats: {
        activeSessions: 0,
        totalSessions: 0,
        averageSessionDuration: 0,
        sessionErrors: 0
      },
      pipelineStats: {}
    };
  }
}

// =============================================================================
// 导出类型别名
// =============================================================================

export type RouterModuleType = RouterModuleInterface;
export type RouterConfigType = RouterModuleConfig;
export type RouterMetricsType = RouterModuleMetrics;