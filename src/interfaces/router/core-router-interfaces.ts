/**
 * 核心路由器接口定义
 *
 * 定义纯粹的路由决策接口，遵循单一职责原则
 * 路由器只负责路由决策，不包含转换、负载均衡、健康检查等功能
 *
 * @author RCC4 Architecture Team
 * @version 4.0.0-beta.1
 */

import { ZeroFallbackError } from '../core/zero-fallback-errors';

// ========================= 核心路由器接口 =========================

/**
 * 核心路由器接口
 *
 * 职责：纯粹的路由决策逻辑
 * - 根据请求信息和路由规则选择目标Provider
 * - 不包含负载均衡、健康检查、协议转换等功能
 * - 遵循零Fallback策略，失败时立即抛出错误
 */
export interface CoreRouter {
  /**
   * 执行路由决策
   *
   * @param request 路由请求信息
   * @returns 路由决策结果
   * @throws {ZeroFallbackError} 当没有可用路由时
   */
  route(request: RoutingRequest): Promise<RoutingDecision>;

  /**
   * 更新路由规则
   *
   * @param rules 新的路由规则集合
   */
  updateRoutingRules(rules: RoutingRules): void;

  /**
   * 获取可用路由信息
   *
   * @returns 当前可用的路由信息列表
   */
  getAvailableRoutes(): RouteInfo[];

  /**
   * 验证路由配置
   *
   * @param config 路由配置
   * @returns 验证结果
   */
  validateConfig(config: RouterConfig): ValidationResult;
}

/**
 * 路由决策引擎接口
 *
 * 职责：实现具体的路由决策算法
 */
export interface RoutingDecisionEngine {
  /**
   * 做出路由决策
   *
   * @param request 路由请求
   * @param availableRoutes 可用路由列表
   * @param context 决策上下文
   * @returns 路由决策结果
   */
  makeDecision(
    request: RoutingRequest,
    availableRoutes: RouteInfo[],
    context: DecisionContext
  ): Promise<RoutingDecision>;

  /**
   * 评估路由适配度
   *
   * @param route 路由信息
   * @param request 请求信息
   * @returns 适配度分数 (0-100)
   */
  evaluateRoute(route: RouteInfo, request: RoutingRequest): Promise<number>;

  /**
   * 获取决策历史
   *
   * @param limit 返回记录数限制
   * @returns 最近的决策历史
   */
  getDecisionHistory(limit?: number): RoutingDecision[];
}

/**
 * 路由规则匹配器接口
 *
 * 职责：根据规则匹配合适的路由
 */
export interface RouteMatcher {
  /**
   * 匹配路由规则
   *
   * @param request 路由请求
   * @param rules 路由规则集合
   * @returns 匹配的路由规则列表
   */
  matchRules(request: RoutingRequest, rules: RoutingRules): MatchedRule[];

  /**
   * 添加自定义匹配器
   *
   * @param name 匹配器名称
   * @param matcher 匹配器函数
   */
  addCustomMatcher(name: string, matcher: CustomMatcher): void;

  /**
   * 移除自定义匹配器
   *
   * @param name 匹配器名称
   */
  removeCustomMatcher(name: string): void;
}

// ========================= 数据结构定义 =========================

/**
 * 路由请求信息
 */
export interface RoutingRequest {
  /** 请求唯一标识 */
  readonly id: string;

  /** 目标模型名称 */
  readonly model: string;

  /** 请求类别 */
  readonly category?: string;

  /** 请求优先级 */
  readonly priority: RequestPriority;

  /** 请求元数据 */
  readonly metadata: RequestMetadata;

  /** 路由约束条件 */
  readonly constraints?: RoutingConstraints;

  /** 请求时间戳 */
  readonly timestamp: Date;
}

/**
 * 路由决策结果
 */
export interface RoutingDecision {
  /** 请求ID */
  readonly requestId: string;

  /** 选中的Provider ID */
  readonly selectedProvider: string;

  /** 选中的模型名称 */
  readonly selectedModel: string;

  /** 选中的路由规则 */
  readonly selectedRoute: RouteInfo;

  /** 决策原因说明 */
  readonly reasoning: string;

  /** 决策置信度 (0-100) */
  readonly confidence: number;

  /** 预估延迟 (毫秒) */
  readonly estimatedLatency: number;

  /** 决策时间 */
  readonly decisionTime: Date;

  /** 决策耗时 (毫秒) */
  readonly processingTime: number;
}

/**
 * 路由规则集合
 */
export interface RoutingRules {
  /** 规则版本 */
  readonly version: string;

  /** 默认路由规则 */
  readonly defaultRule: RoutingRule;

  /** 分类路由规则 */
  readonly categoryRules: Record<string, RoutingRule>;

  /** 模型特定规则 */
  readonly modelRules: Record<string, RoutingRule>;

  /** 自定义规则 */
  readonly customRules: CustomRoutingRule[];

  /** 规则优先级 */
  readonly rulePriority: string[];
}

/**
 * 单个路由规则
 */
export interface RoutingRule {
  /** 规则ID */
  readonly id: string;

  /** 规则名称 */
  readonly name: string;

  /** 匹配条件 */
  readonly conditions: MatchCondition[];

  /** 目标Provider列表 */
  readonly targetProviders: string[];

  /** 权重分配 */
  readonly weights?: Record<string, number>;

  /** 规则是否启用 */
  readonly enabled: boolean;

  /** 规则描述 */
  readonly description?: string;
}

/**
 * 路由信息
 */
export interface RouteInfo {
  /** 路由ID */
  readonly id: string;

  /** Provider ID */
  readonly providerId: string;

  /** Provider类型 */
  readonly providerType: string;

  /** 支持的模型列表 */
  readonly supportedModels: string[];

  /** 路由权重 */
  readonly weight: number;

  /** 是否可用 */
  readonly available: boolean;

  /** 健康状态 */
  readonly healthStatus: 'healthy' | 'degraded' | 'unhealthy';

  /** 路由标签 */
  readonly tags: string[];

  /** 路由元数据 */
  readonly metadata: Record<string, any>;
}

/**
 * 匹配条件
 */
export interface MatchCondition {
  /** 匹配字段 */
  readonly field: MatchField;

  /** 匹配操作符 */
  readonly operator: MatchOperator;

  /** 匹配值 */
  readonly value: any;

  /** 是否大小写敏感 */
  readonly caseSensitive?: boolean;
}

/**
 * 匹配的规则结果
 */
export interface MatchedRule {
  /** 匹配的规则 */
  readonly rule: RoutingRule;

  /** 匹配分数 */
  readonly score: number;

  /** 匹配的条件 */
  readonly matchedConditions: MatchCondition[];
}

/**
 * 决策上下文
 */
export interface DecisionContext {
  /** 可用的路由信息 */
  readonly availableRoutes: RouteInfo[];

  /** 负载均衡状态 */
  readonly loadBalanceState?: Record<string, any>;

  /** 健康状态信息 */
  readonly healthState?: Record<string, any>;

  /** Key管理状态 */
  readonly keyState?: Record<string, any>;

  /** 历史决策信息 */
  readonly historyContext?: DecisionHistory[];
}

/**
 * 请求元数据
 */
export interface RequestMetadata {
  /** 原始格式 */
  readonly originalFormat: ProtocolFormat;

  /** 目标格式 */
  readonly targetFormat: ProtocolFormat;

  /** 会话ID */
  readonly sessionId?: string;

  /** 对话ID */
  readonly conversationId?: string;

  /** 用户ID */
  readonly userId?: string;

  /** 调试信息 */
  readonly debugInfo?: DebugInfo;

  /** 自定义属性 */
  readonly customAttributes?: Record<string, any>;
}

/**
 * 路由约束条件
 */
export interface RoutingConstraints {
  /** 首选Provider */
  readonly preferredProviders?: string[];

  /** 排除的Provider */
  readonly excludedProviders?: string[];

  /** 需要的功能特性 */
  readonly requiredFeatures?: string[];

  /** 最大延迟要求 (毫秒) */
  readonly maxLatency?: number;

  /** 成本偏好 */
  readonly costPreference?: CostPreference;

  /** 地理位置要求 */
  readonly geoRequirements?: GeoRequirement[];
}

/**
 * 自定义路由规则
 */
export interface CustomRoutingRule extends RoutingRule {
  /** 自定义匹配器名称 */
  readonly customMatcher: string;

  /** 自定义匹配参数 */
  readonly matcherParams?: Record<string, any>;
}

/**
 * 决策历史记录
 */
export interface DecisionHistory {
  /** 历史决策 */
  readonly decision: RoutingDecision;

  /** 执行结果 */
  readonly executionResult?: ExecutionResult;

  /** 性能指标 */
  readonly metrics?: PerformanceMetrics;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  readonly isValid: boolean;

  /** 错误信息 */
  readonly errors: ValidationError[];

  /** 警告信息 */
  readonly warnings: ValidationWarning[];

  /** 验证时间 */
  readonly validatedAt: Date;
}

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误代码 */
  readonly code: string;

  /** 错误消息 */
  readonly message: string;

  /** 错误路径 */
  readonly path: string;

  /** 错误严重级别 */
  readonly severity: 'error' | 'warning';
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  /** 警告代码 */
  readonly code: string;

  /** 警告消息 */
  readonly message: string;

  /** 警告路径 */
  readonly path: string;
}

// ========================= 枚举和类型定义 =========================

/**
 * 请求优先级
 */
export type RequestPriority = 'high' | 'normal' | 'low';

/**
 * 协议格式
 */
export type ProtocolFormat = 'anthropic' | 'openai' | 'gemini' | 'standard';

/**
 * 成本偏好
 */
export type CostPreference = 'low' | 'medium' | 'high' | 'optimal';

/**
 * 匹配字段
 */
export type MatchField = 'model' | 'category' | 'priority' | 'provider' | 'feature' | 'userId' | 'customAttribute';

/**
 * 匹配操作符
 */
export type MatchOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'regex'
  | 'in'
  | 'notIn';

/**
 * 地理位置要求
 */
export interface GeoRequirement {
  /** 地区代码 */
  readonly region: string;

  /** 是否必需 */
  readonly required: boolean;

  /** 优先级 */
  readonly priority: number;
}

/**
 * 调试信息
 */
export interface DebugInfo {
  /** 是否启用调试 */
  readonly enabled: boolean;

  /** 调试级别 */
  readonly level: 'basic' | 'detailed' | 'full';

  /** 调试标签 */
  readonly tags: string[];

  /** 跟踪ID */
  readonly traceId?: string;
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  /** 是否成功 */
  readonly success: boolean;

  /** 实际延迟 */
  readonly actualLatency: number;

  /** 错误信息 */
  readonly error?: Error;

  /** 响应状态码 */
  readonly statusCode?: number;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 决策时间 */
  readonly decisionTime: number;

  /** 执行时间 */
  readonly executionTime: number;

  /** 总耗时 */
  readonly totalTime: number;

  /** 内存使用 */
  readonly memoryUsage?: number;
}

/**
 * 自定义匹配器函数类型
 */
export type CustomMatcher = (
  request: RoutingRequest,
  rule: CustomRoutingRule,
  context: DecisionContext
) => Promise<boolean>;

// ========================= 路由器配置 =========================

/**
 * 路由器配置
 */
export interface RouterConfig {
  /** 路由器ID */
  readonly id: string;

  /** 路由器名称 */
  readonly name: string;

  /** 路由规则 */
  readonly routingRules: RoutingRules;

  /** 默认设置 */
  readonly defaults: RouterDefaults;

  /** 性能配置 */
  readonly performance: PerformanceConfig;

  /** 零Fallback策略配置 */
  readonly zeroFallbackPolicy: ZeroFallbackConfig;

  /** 调试配置 */
  readonly debug?: DebugConfig;
}

/**
 * 路由器默认设置
 */
export interface RouterDefaults {
  /** 默认优先级 */
  readonly defaultPriority: RequestPriority;

  /** 默认超时时间 */
  readonly defaultTimeout: number;

  /** 默认重试次数 */
  readonly defaultRetries: number;

  /** 默认置信度阈值 */
  readonly confidenceThreshold: number;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  /** 最大并发决策数 */
  readonly maxConcurrentDecisions: number;

  /** 决策缓存大小 */
  readonly decisionCacheSize: number;

  /** 决策超时时间 */
  readonly decisionTimeout: number;

  /** 历史记录保留数量 */
  readonly historyRetention: number;
}

/**
 * 零Fallback策略配置
 */
export interface ZeroFallbackConfig {
  /** 是否启用零Fallback策略 */
  readonly enabled: true; // 强制启用

  /** 严格模式 */
  readonly strictMode: boolean;

  /** 失败时是否立即抛出错误 */
  readonly errorOnFailure: boolean;

  /** 错误重试次数 (限制在同一Provider内) */
  readonly maxRetries: number;
}

/**
 * 调试配置
 */
export interface DebugConfig {
  /** 是否启用调试 */
  readonly enabled: boolean;

  /** 调试级别 */
  readonly level: 'basic' | 'detailed' | 'full';

  /** 日志输出目标 */
  readonly logTarget: 'console' | 'file' | 'both';

  /** 性能监控 */
  readonly performanceMonitoring: boolean;
}
