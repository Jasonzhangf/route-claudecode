/**
 * 核心路由器 - 纯粹的路由决策器
 *
 * ⚠️ SINGLE RESPONSIBILITY: 此路由器只做路由决策，不做协议转换、负载均衡或健康检查
 * ⚠️ ZERO FALLBACK POLICY: 遵循零fallback策略，失败时立即返回错误
 *
 * 职责说明：
 * ✅ 路由决策：根据请求信息选择目标Provider和Model
 * ✅ 规则匹配：根据配置的路由规则进行匹配
 * ✅ 状态查询：提供当前路由状态信息
 * ❌ 不包含：协议转换（由Transformer负责）
 * ❌ 不包含：负载均衡（由LoadBalancer负责）
 * ❌ 不包含：健康检查（由HealthChecker负责）
 * ❌ 不包含：API调用（由Provider负责）
 * ❌ 不包含：配置加载（由ConfigManager负责）
 *
 * @see .claude/rules/zero-fallback-policy.md
 * @see docs/router-architecture-design.md
 *
 * @author RCC4 Core Router Team
 * @version 4.0.0-beta.1
 */

import { secureLogger } from '../../utils/secure-logger';
import { ValidateInput, ValidateOutput, DataValidator, ValidationSchema } from '../../middleware/data-validator';
import {
  ZeroFallbackErrorFactory,
  ProviderUnavailableError,
  ModelUnavailableError,
  RoutingRuleNotFoundError,
} from '../../interfaces/core/zero-fallback-errors';

// 重新导入接口，使用统一的核心路由器接口
import {
  CoreRouter as ICoreRouter,
  RoutingRequest,
  RoutingDecision,
  RoutingRules,
  RoutingRule,
  RouteInfo,
  RouterConfig,
  ValidationResult,
  RequestPriority,
  MatchCondition,
  MatchedRule,
} from '../../interfaces/router/core-router-interfaces';

// ========================= 验证模式定义 =========================

const ROUTING_REQUEST_SCHEMA: { [key: string]: ValidationSchema } = {
  id: { type: 'string', required: true },
  model: { type: 'string', required: true },
  category: { type: 'string' },
  priority: { type: 'string', required: true, enum: ['high', 'normal', 'low'] },
  metadata: { type: 'object', required: true },
  constraints: { type: 'object' },
  timestamp: { type: 'object', required: true },
};

const ROUTING_DECISION_SCHEMA: { [key: string]: ValidationSchema } = {
  requestId: { type: 'string', required: true },
  selectedProvider: { type: 'string', required: true },
  selectedModel: { type: 'string', required: true },
  selectedRoute: { type: 'object', required: true },
  reasoning: { type: 'string', required: true },
  confidence: { type: 'number', required: true },
  estimatedLatency: { type: 'number', required: true },
  decisionTime: { type: 'object', required: true },
  processingTime: { type: 'number', required: true },
};

const ROUTE_INFO_SCHEMA: { [key: string]: ValidationSchema } = {
  id: { type: 'string', required: true },
  providerId: { type: 'string', required: true },
  providerType: { type: 'string', required: true },
  supportedModels: { type: 'array', required: true, properties: { type: 'string' } },
  weight: { type: 'number', required: true },
  available: { type: 'boolean', required: true },
  healthStatus: { type: 'string', required: true, enum: ['healthy', 'degraded', 'unhealthy'] },
  tags: { type: 'array', required: true, properties: { type: 'string' } },
  metadata: { type: 'object', required: true },
};

// ========================= 核心路由器实现 =========================

/**
 * 核心路由器实现类
 *
 * 实现纯粹的路由决策逻辑，严格遵循单一职责原则
 */
export class CoreRouter implements ICoreRouter {
  private routingRules: RoutingRules;
  private availableRoutes: Map<string, RouteInfo> = new Map();
  private decisionHistory: RoutingDecision[] = [];
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    // 验证输入配置
    const configValidation = DataValidator.validate(config, {
      id: { type: 'string', required: true },
      name: { type: 'string', required: true },
      routingRules: { type: 'object', required: true },
      defaults: { type: 'object', required: true },
      performance: { type: 'object', required: true },
      zeroFallbackPolicy: {
        type: 'object',
        required: true,
        properties: {
          enabled: { type: 'boolean', required: true },
          strictMode: { type: 'boolean', required: true },
          errorOnFailure: { type: 'boolean', required: true },
          maxRetries: { type: 'number', required: true },
        },
      },
    });

    if (!configValidation.isValid) {
      throw new Error(`路由器配置验证失败: ${configValidation.errors.join(', ')}`);
    }

    // 验证零Fallback策略必须启用
    if (!config.zeroFallbackPolicy.enabled) {
      throw new Error('零Fallback策略必须启用，zeroFallbackPolicy.enabled必须为true');
    }

    this.config = config;
    this.routingRules = config.routingRules;

    secureLogger.info('🎯 核心路由器已初始化', {
      routerId: config.id,
      rulesVersion: this.routingRules.version,
      zeroFallbackEnabled: config.zeroFallbackPolicy.enabled,
      strictMode: config.zeroFallbackPolicy.strictMode,
    });
  }

  /**
   * 执行路由决策
   *
   * 根据请求信息和路由规则选择最合适的Provider和Model
   * 遵循零Fallback策略，失败时立即抛出错误
   */
  @ValidateInput(ROUTING_REQUEST_SCHEMA)
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const startTime = Date.now();
    secureLogger.debug('🎯 开始路由决策', {
      requestId: request.id,
      model: request.model,
      category: request.category,
      priority: request.priority,
    });

    try {
      // 1. 匹配路由规则
      const matchedRules = this.matchRoutingRules(request);
      if (matchedRules.length === 0) {
        throw ZeroFallbackErrorFactory.createRoutingRuleNotFound(
          request.model,
          request.category || 'default',
          'No routing rules match the request criteria',
          { requestId: request.id, priority: request.priority }
        );
      }

      // 2. 选择最佳匹配规则
      const bestRule = this.selectBestRule(matchedRules, request);
      secureLogger.debug('📋 已选择路由规则', {
        requestId: request.id,
        ruleId: bestRule.rule.id,
        ruleName: bestRule.rule.name,
        score: bestRule.score,
      });

      // 3. 根据规则选择目标Provider
      const selectedRoute = await this.selectTargetRoute(bestRule.rule, request);
      if (!selectedRoute) {
        throw ZeroFallbackErrorFactory.createProviderUnavailable(
          bestRule.rule.targetProviders.join(','),
          request.model,
          'No available providers found for the selected routing rule',
          { requestId: request.id, ruleId: bestRule.rule.id }
        );
      }

      // 4. 验证模型支持
      if (!this.isModelSupported(selectedRoute, request.model)) {
        throw ZeroFallbackErrorFactory.createModelUnavailable(
          selectedRoute.providerId,
          request.model,
          `Model ${request.model} is not supported by provider ${selectedRoute.providerId}`,
          { requestId: request.id, supportedModels: selectedRoute.supportedModels }
        );
      }

      // 5. 构建路由决策
      const processingTime = Date.now() - startTime;
      const decision: RoutingDecision = {
        requestId: request.id,
        selectedProvider: selectedRoute.providerId,
        selectedModel: request.model, // 保持原始请求的模型
        selectedRoute: selectedRoute,
        reasoning: this.generateDecisionReasoning(bestRule, selectedRoute, request),
        confidence: this.calculateConfidence(bestRule, selectedRoute),
        estimatedLatency: this.estimateLatency(selectedRoute),
        decisionTime: new Date(),
        processingTime,
      };

      // 6. 验证决策结果
      const decisionValidation = DataValidator.validate(decision, ROUTING_DECISION_SCHEMA);
      if (!decisionValidation.isValid) {
        throw new Error(`路由决策验证失败: ${decisionValidation.errors.join(', ')}`);
      }

      // 7. 记录决策历史
      this.recordDecision(decision);

      secureLogger.info('✅ 路由决策完成', {
        requestId: request.id,
        selectedProvider: decision.selectedProvider,
        selectedModel: decision.selectedModel,
        confidence: decision.confidence,
        processingTimeMs: processingTime,
        zeroFallbackPolicy: true,
      });

      return decision;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      secureLogger.error('❌ 路由决策失败', {
        requestId: request.id,
        error: (error as Error).message,
        processingTimeMs: processingTime,
        zeroFallbackPolicy: true,
      });
      throw error;
    }
  }

  /**
   * 更新路由规则
   */
  updateRoutingRules(rules: RoutingRules): void {
    // 验证路由规则
    const rulesValidation = DataValidator.validate(rules, {
      version: { type: 'string', required: true },
      defaultRule: { type: 'object', required: true },
      categoryRules: { type: 'object', required: true },
      modelRules: { type: 'object', required: true },
      customRules: { type: 'array', required: true },
      rulePriority: { type: 'array', required: true, properties: { type: 'string' } },
    });

    if (!rulesValidation.isValid) {
      throw new Error(`路由规则验证失败: ${rulesValidation.errors.join(', ')}`);
    }

    this.routingRules = rules;
    secureLogger.info('📋 路由规则已更新', {
      version: rules.version,
      categoryRulesCount: Object.keys(rules.categoryRules).length,
      modelRulesCount: Object.keys(rules.modelRules).length,
      customRulesCount: rules.customRules.length,
    });
  }

  /**
   * 获取可用路由信息
   */
  getAvailableRoutes(): RouteInfo[] {
    return Array.from(this.availableRoutes.values()).filter(route => route.available);
  }

  /**
   * 验证路由配置
   */
  validateConfig(config: RouterConfig): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    // 验证零Fallback策略配置
    if (!config.zeroFallbackPolicy.enabled) {
      errors.push({
        code: 'ZERO_FALLBACK_DISABLED',
        message: 'Zero Fallback Policy must be enabled',
        path: 'zeroFallbackPolicy.enabled',
        severity: 'error',
      });
    }

    // 验证路由规则完整性
    if (!config.routingRules.defaultRule) {
      errors.push({
        code: 'MISSING_DEFAULT_RULE',
        message: 'Default routing rule is required',
        path: 'routingRules.defaultRule',
        severity: 'error',
      });
    }

    // 验证性能配置
    if (config.performance.maxConcurrentDecisions <= 0) {
      warnings.push({
        code: 'INVALID_CONCURRENT_LIMIT',
        message: 'maxConcurrentDecisions should be greater than 0',
        path: 'performance.maxConcurrentDecisions',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedAt: new Date(),
    };
  }

  /**
   * 更新可用路由信息
   */
  updateAvailableRoutes(routes: RouteInfo[]): void {
    // 验证每个路由信息
    for (const route of routes) {
      const validation = DataValidator.validate(route, ROUTE_INFO_SCHEMA);
      if (!validation.isValid) {
        secureLogger.warn('路由信息验证失败', {
          routeId: route.id,
          errors: validation.errors,
        });
        continue;
      }
      this.availableRoutes.set(route.id, route);
    }

    secureLogger.debug('🛣️ 可用路由已更新', {
      totalRoutes: this.availableRoutes.size,
      healthyRoutes: Array.from(this.availableRoutes.values()).filter(r => r.healthStatus === 'healthy').length,
    });
  }

  /**
   * 获取路由器状态
   */
  getRouterStatus(): {
    routerId: string;
    rulesVersion: string;
    availableRoutes: number;
    healthyRoutes: number;
    decisionHistory: number;
    lastDecision?: Date;
    zeroFallbackEnabled: boolean;
  } {
    const healthyRoutes = Array.from(this.availableRoutes.values()).filter(
      route => route.healthStatus === 'healthy'
    ).length;

    const lastDecision =
      this.decisionHistory.length > 0 ? this.decisionHistory[this.decisionHistory.length - 1].decisionTime : undefined;

    return {
      routerId: this.config.id,
      rulesVersion: this.routingRules.version,
      availableRoutes: this.availableRoutes.size,
      healthyRoutes,
      decisionHistory: this.decisionHistory.length,
      lastDecision,
      zeroFallbackEnabled: this.config.zeroFallbackPolicy.enabled,
    };
  }

  // ========================= 私有方法 =========================

  /**
   * 匹配路由规则
   */
  private matchRoutingRules(request: RoutingRequest): MatchedRule[] {
    const matchedRules: MatchedRule[] = [];

    // 1. 尝试匹配模型特定规则
    const modelRule = this.routingRules.modelRules[request.model];
    if (modelRule && modelRule.enabled) {
      const score = this.evaluateRuleMatch(modelRule, request);
      if (score > 0) {
        matchedRules.push({
          rule: modelRule,
          score: score + 20, // 模型特定规则优先级更高
          matchedConditions: [],
        });
      }
    }

    // 2. 尝试匹配分类规则
    if (request.category) {
      const categoryRule = this.routingRules.categoryRules[request.category];
      if (categoryRule && categoryRule.enabled) {
        const score = this.evaluateRuleMatch(categoryRule, request);
        if (score > 0) {
          matchedRules.push({
            rule: categoryRule,
            score: score + 10, // 分类规则中等优先级
            matchedConditions: [],
          });
        }
      }
    }

    // 3. 尝试匹配自定义规则
    for (const customRule of this.routingRules.customRules) {
      if (customRule.enabled) {
        const score = this.evaluateRuleMatch(customRule, request);
        if (score > 0) {
          matchedRules.push({
            rule: customRule,
            score,
            matchedConditions: [],
          });
        }
      }
    }

    // 4. 如果没有匹配的规则，使用默认规则
    if (matchedRules.length === 0 && this.routingRules.defaultRule.enabled) {
      matchedRules.push({
        rule: this.routingRules.defaultRule,
        score: 1, // 默认规则最低优先级
        matchedConditions: [],
      });
    }

    return matchedRules.sort((a, b) => b.score - a.score);
  }

  /**
   * 评估规则匹配度
   */
  private evaluateRuleMatch(rule: RoutingRule, request: RoutingRequest): number {
    let score = 50; // 基础分数

    // 根据优先级调整分数
    switch (request.priority) {
      case 'high':
        score += 20;
        break;
      case 'normal':
        score += 10;
        break;
      case 'low':
        score += 5;
        break;
    }

    // 检查规则条件
    for (const condition of rule.conditions) {
      if (this.evaluateCondition(condition, request)) {
        score += 15;
      } else {
        score -= 10;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 评估单个条件
   */
  private evaluateCondition(condition: MatchCondition, request: RoutingRequest): boolean {
    const fieldValue = this.getFieldValue(condition.field, request);
    const targetValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return fieldValue === targetValue;
      case 'notEquals':
        return fieldValue !== targetValue;
      case 'contains':
        return String(fieldValue).includes(String(targetValue));
      case 'notContains':
        return !String(fieldValue).includes(String(targetValue));
      case 'startsWith':
        return String(fieldValue).startsWith(String(targetValue));
      case 'endsWith':
        return String(fieldValue).endsWith(String(targetValue));
      case 'in':
        return Array.isArray(targetValue) && targetValue.includes(fieldValue);
      case 'notIn':
        return Array.isArray(targetValue) && !targetValue.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * 获取字段值
   */
  private getFieldValue(field: string, request: RoutingRequest): any {
    switch (field) {
      case 'model':
        return request.model;
      case 'category':
        return request.category;
      case 'priority':
        return request.priority;
      case 'userId':
        return request.metadata.userId;
      default:
        return request.metadata.customAttributes?.[field];
    }
  }

  /**
   * 选择最佳规则
   */
  private selectBestRule(matchedRules: MatchedRule[], request: RoutingRequest): MatchedRule {
    return matchedRules[0]; // 已经按分数排序，选择第一个
  }

  /**
   * 选择目标路由
   */
  private async selectTargetRoute(rule: RoutingRule, request: RoutingRequest): Promise<RouteInfo | null> {
    const candidateRoutes = rule.targetProviders
      .map(providerId => Array.from(this.availableRoutes.values()).find(route => route.providerId === providerId))
      .filter((route): route is RouteInfo => route !== undefined && route.available);

    if (candidateRoutes.length === 0) {
      return null;
    }

    // 根据权重和健康状态选择最佳路由
    return candidateRoutes.sort((a, b) => {
      const scoreA = this.calculateRouteScore(a, rule);
      const scoreB = this.calculateRouteScore(b, rule);
      return scoreB - scoreA;
    })[0];
  }

  /**
   * 计算路由评分
   */
  private calculateRouteScore(route: RouteInfo, rule: RoutingRule): number {
    let score = route.weight * 100;

    // 健康状态权重
    switch (route.healthStatus) {
      case 'healthy':
        score += 50;
        break;
      case 'degraded':
        score += 20;
        break;
      case 'unhealthy':
        score -= 30;
        break;
    }

    // 规则权重
    const ruleWeight = rule.weights?.[route.providerId] || 1;
    score *= ruleWeight;

    return score;
  }

  /**
   * 检查模型支持
   */
  private isModelSupported(route: RouteInfo, model: string): boolean {
    return route.supportedModels.includes(model) || route.supportedModels.includes('*');
  }

  /**
   * 生成决策推理说明
   */
  private generateDecisionReasoning(matchedRule: MatchedRule, route: RouteInfo, request: RoutingRequest): string {
    return `Rule "${matchedRule.rule.name}" (score: ${matchedRule.score}) selected provider "${route.providerId}" for model "${request.model}" with priority "${request.priority}"`;
  }

  /**
   * 计算决策置信度
   */
  private calculateConfidence(matchedRule: MatchedRule, route: RouteInfo): number {
    let confidence = matchedRule.score;

    // 根据健康状态调整置信度
    switch (route.healthStatus) {
      case 'healthy':
        confidence *= 1.2;
        break;
      case 'degraded':
        confidence *= 0.8;
        break;
      case 'unhealthy':
        confidence *= 0.5;
        break;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * 估算延迟
   */
  private estimateLatency(route: RouteInfo): number {
    // 基于健康状态估算延迟
    switch (route.healthStatus) {
      case 'healthy':
        return 50; // 50ms
      case 'degraded':
        return 150; // 150ms
      case 'unhealthy':
        return 500; // 500ms
      default:
        return 100; // 默认100ms
    }
  }

  /**
   * 记录决策历史
   */
  private recordDecision(decision: RoutingDecision): void {
    this.decisionHistory.push(decision);

    // 保持历史记录数量限制
    const maxHistory = this.config.performance.historyRetention;
    if (this.decisionHistory.length > maxHistory) {
      this.decisionHistory = this.decisionHistory.slice(-maxHistory);
    }
  }
}
