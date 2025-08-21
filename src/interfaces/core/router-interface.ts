/**
 * 路由器模块接口定义
 *
 * 定义路由器模块的标准接口，包括请求路由、配置管理、流水线管理等功能
 * 严格遵循模块边界，通过接口与其他模块通信
 *
 * @author Jason Zhang
 */

import { ModuleInterface, ModuleConfig } from '../module/base-module';

/**
 * 路由策略枚举
 */
export enum RoutingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  FASTEST_RESPONSE = 'fastest_response',
  WEIGHTED = 'weighted',
  RANDOM = 'random',
}

/**
 * 路由请求信息
 */
export interface RouteRequest {
  readonly id: string;
  readonly timestamp: Date;
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string | string[]>;
  readonly body: any;
  readonly clientId?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * 路由响应信息
 */
export interface RouteResponse {
  readonly requestId: string;
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: any;
  readonly processingTime: number;
  readonly pipelineId?: string;
  readonly error?: Error;
}

/**
 * 路由规则
 */
export interface RoutingRule {
  readonly id: string;
  readonly name: string;
  readonly pattern: string | RegExp;
  readonly method?: string[];
  readonly targetPipelines: string[];
  readonly strategy: RoutingStrategy;
  readonly priority: number;
  readonly enabled: boolean;
  readonly metadata?: Record<string, any>;
}

/**
 * Provider配置
 */
export interface ProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly type: 'openai' | 'anthropic' | 'gemini' | 'lmstudio' | 'custom';
  readonly endpoint: string;
  readonly apiKey?: string;
  readonly models: string[];
  readonly enabled: boolean;
  readonly maxConcurrency: number;
  readonly timeout: number;
  readonly retryCount: number;
  readonly healthCheckInterval: number;
  readonly metadata?: Record<string, any>;
}

/**
 * 路由配置
 */
export interface RouterConfig extends ModuleConfig {
  readonly providers: ProviderConfig[];
  readonly routingRules: RoutingRule[];
  readonly defaultStrategy: RoutingStrategy;
  readonly enableLoadBalancing: boolean;
  readonly enableHealthCheck: boolean;
  readonly healthCheckInterval: number;
  readonly maxRetries: number;
  readonly retryDelay: number;
}

/**
 * 流水线状态
 */
export interface PipelineStatus {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly model: string;
  readonly status: 'idle' | 'running' | 'busy' | 'error' | 'stopped';
  readonly activeConnections: number;
  readonly totalRequests: number;
  readonly successRequests: number;
  readonly errorRequests: number;
  readonly averageResponseTime: number;
  readonly lastActivity: Date;
  readonly health: 'healthy' | 'degraded' | 'unhealthy';
}

/**
 * 请求路由器接口
 */
export interface IRequestRouter {
  /**
   * 路由请求到合适的流水线
   * @param request 路由请求
   * @returns Promise<RouteResponse> 路由响应
   */
  routeRequest(request: RouteRequest): Promise<RouteResponse>;

  /**
   * 根据规则匹配请求
   * @param request 路由请求
   * @returns RoutingRule[] 匹配的路由规则
   */
  matchRules(request: RouteRequest): RoutingRule[];

  /**
   * 选择最佳流水线
   * @param candidatePipelines 候选流水线ID列表
   * @param strategy 路由策略
   * @returns string | null 选中的流水线ID
   */
  selectPipeline(candidatePipelines: string[], strategy: RoutingStrategy): string | null;

  /**
   * 添加路由规则
   * @param rule 路由规则
   */
  addRoutingRule(rule: RoutingRule): void;

  /**
   * 移除路由规则
   * @param ruleId 路由规则ID
   */
  removeRoutingRule(ruleId: string): void;

  /**
   * 更新路由规则
   * @param ruleId 路由规则ID
   * @param updates 更新内容
   */
  updateRoutingRule(ruleId: string, updates: Partial<RoutingRule>): void;
}

/**
 * 配置管理器接口
 */
export interface IConfigManager {
  /**
   * 加载配置
   * @param configPath 配置文件路径
   * @returns Promise<RouterConfig> 路由器配置
   */
  loadConfig(configPath?: string): Promise<RouterConfig>;

  /**
   * 保存配置
   * @param config 路由器配置
   * @param configPath 配置文件路径
   * @returns Promise<void>
   */
  saveConfig(config: RouterConfig, configPath?: string): Promise<void>;

  /**
   * 验证配置
   * @param config 路由器配置
   * @returns boolean 配置是否有效
   */
  validateConfig(config: RouterConfig): boolean;

  /**
   * 获取Provider配置
   * @param providerId Provider ID
   * @returns ProviderConfig | null Provider配置
   */
  getProviderConfig(providerId: string): ProviderConfig | null;

  /**
   * 添加Provider配置
   * @param providerConfig Provider配置
   */
  addProviderConfig(providerConfig: ProviderConfig): void;

  /**
   * 移除Provider配置
   * @param providerId Provider ID
   */
  removeProviderConfig(providerId: string): void;

  /**
   * 更新Provider配置
   * @param providerId Provider ID
   * @param updates 更新内容
   */
  updateProviderConfig(providerId: string, updates: Partial<ProviderConfig>): void;

  /**
   * 监听配置变化
   * @param handler 变化处理函数
   */
  onConfigChanged(handler: (config: RouterConfig) => void): void;
}

/**
 * 流水线管理器接口
 */
export interface IPipelineManager {
  /**
   * 创建流水线实例
   * @param pipelineConfig 流水线配置
   * @returns Promise<string> 流水线ID
   */
  createPipeline(pipelineConfig: any): Promise<string>;

  /**
   * 销毁流水线实例
   * @param pipelineId 流水线ID
   * @returns Promise<void>
   */
  destroyPipeline(pipelineId: string): Promise<void>;

  /**
   * 启动流水线
   * @param pipelineId 流水线ID
   * @returns Promise<void>
   */
  startPipeline(pipelineId: string): Promise<void>;

  /**
   * 停止流水线
   * @param pipelineId 流水线ID
   * @returns Promise<void>
   */
  stopPipeline(pipelineId: string): Promise<void>;

  /**
   * 获取流水线状态
   * @param pipelineId 流水线ID
   * @returns PipelineStatus | null 流水线状态
   */
  getPipelineStatus(pipelineId: string): PipelineStatus | null;

  /**
   * 获取所有流水线状态
   * @returns Map<string, PipelineStatus> 流水线状态映射
   */
  getAllPipelineStatus(): Map<string, PipelineStatus>;

  /**
   * 健康检查流水线
   * @param pipelineId 流水线ID
   * @returns Promise<boolean> 是否健康
   */
  healthCheckPipeline(pipelineId: string): Promise<boolean>;

  /**
   * 获取可用的流水线
   * @param provider Provider类型
   * @param model 模型名称
   * @returns string[] 可用流水线ID列表
   */
  getAvailablePipelines(provider?: string, model?: string): string[];
}

/**
 * 会话流控制器接口
 */
export interface ISessionFlowController {
  /**
   * 创建会话流
   * @param sessionId 会话ID
   * @param initialRequest 初始请求
   * @returns Promise<void>
   */
  createSessionFlow(sessionId: string, initialRequest: RouteRequest): Promise<void>;

  /**
   * 处理会话流请求
   * @param sessionId 会话ID
   * @param request 请求
   * @returns Promise<RouteResponse> 响应
   */
  handleSessionRequest(sessionId: string, request: RouteRequest): Promise<RouteResponse>;

  /**
   * 关闭会话流
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  closeSessionFlow(sessionId: string): Promise<void>;

  /**
   * 获取会话流状态
   * @param sessionId 会话ID
   * @returns any | null 会话流状态
   */
  getSessionFlowStatus(sessionId: string): any | null;

  /**
   * 获取所有活跃会话流
   * @returns Map<string, any> 活跃会话流映射
   */
  getActiveSessionFlows(): Map<string, any>;
}

/**
 * 路由器模块接口
 * 继承标准模块接口，提供路由器特有的功能
 */
export interface IRouterModule extends ModuleInterface {
  readonly config: RouterConfig;
  readonly requestRouter: IRequestRouter;
  readonly configManager: IConfigManager;
  readonly pipelineManager: IPipelineManager;
  readonly sessionFlowController: ISessionFlowController;

  /**
   * 处理HTTP请求
   * @param request 路由请求
   * @returns Promise<RouteResponse> 路由响应
   */
  handleRequest(request: RouteRequest): Promise<RouteResponse>;

  /**
   * 重新加载配置
   * @returns Promise<void>
   */
  reloadConfig(): Promise<void>;

  /**
   * 获取路由统计信息
   * @returns Promise<any> 统计信息
   */
  getRoutingStats(): Promise<any>;

  /**
   * 健康检查所有流水线
   * @returns Promise<Map<string, boolean>> 健康检查结果
   */
  healthCheckAll(): Promise<Map<string, boolean>>;
}

/**
 * 路由器事件类型
 */
export interface RouterEvents {
  'request-routed': (request: RouteRequest, response: RouteResponse) => void;
  'pipeline-status-changed': (pipelineId: string, oldStatus: string, newStatus: string) => void;
  'routing-rule-added': (rule: RoutingRule) => void;
  'routing-rule-removed': (ruleId: string) => void;
  'provider-config-changed': (providerId: string, config: ProviderConfig) => void;
  'session-flow-created': (sessionId: string) => void;
  'session-flow-closed': (sessionId: string) => void;
  'health-check-failed': (pipelineId: string, error: Error) => void;
}
