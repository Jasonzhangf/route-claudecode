/**
 * Mock CoreRouter implementation for integration testing
 *
 * This mock implements the essential routing logic needed for testing
 * without complex dependencies on external systems
 */

import {
  RoutingRequest,
  RoutingDecision,
  RoutingRules,
  RoutingRule,
} from '../../../interfaces/routing/routing-interfaces';
import { ZeroFallbackErrorFactory, ZeroFallbackErrorType } from '../../../interfaces/core/zero-fallback-errors';

export class MockCoreRouter {
  private routingRules: RoutingRules = { rules: [], version: '1.0.0' };

  constructor() {}

  /**
   * Update routing rules
   */
  updateRoutingRules(rules: RoutingRules): void {
    this.routingRules = rules;
  }

  /**
   * Main routing decision method
   * 实现核心路由逻辑：规则匹配 -> Provider选择 -> 决策生成
   */
  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const startTime = process.hrtime.bigint();

    try {
      // Step 1: 匹配路由规则
      const matchedRules = this.matchRoutingRules(request);

      if (matchedRules.length === 0) {
        throw ZeroFallbackErrorFactory.createRoutingRuleNotFound(
          request.model,
          'routing-rule-match',
          `No routing rule found for model: ${request.model}`,
          {
            model: request.model,
            protocol: request.protocol,
            requestId: request.requestId,
          }
        );
      }

      // Step 2: 选择最高优先级的规则
      const bestRule = matchedRules.sort((a, b) => a.rule.priority - b.rule.priority)[0];

      // Step 3: 选择目标Provider (简单权重选择)
      const selectedTarget = this.selectTargetProvider(bestRule.rule);

      // Step 4: 生成路由决策
      const processingTime = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      const decision: RoutingDecision = {
        targetProvider: selectedTarget.provider,
        targetEndpoint: `/v1/${request.endpoint.split('/').slice(2).join('/')}`, // 简化端点转换
        timestamp: new Date(),
        routingMetadata: {
          ruleId: bestRule.rule.id,
          ruleName: bestRule.rule.name,
          matchedConditions: bestRule.matchedConditions,
          selectionMethod: 'weighted-random',
          processingTime,
          requestType: request.metadata?.streaming ? 'streaming' : 'regular',
        },
        headers: {
          'X-RCC-Router-Version': '4.0.0-mock',
          'X-RCC-Route-Decision-Time': new Date().toISOString(),
          'X-RCC-Target-Provider': selectedTarget.provider,
          'X-RCC-Stream-Support': request.metadata?.streaming ? 'true' : 'false',
        },
        originalRequest: request,
      };

      return decision;
    } catch (error) {
      const processingTime = Number(process.hrtime.bigint() - startTime) / 1_000_000;

      if (error.type && error.type.includes('ZERO_FALLBACK')) {
        // 重新抛出零Fallback错误，添加处理时间
        error.context = { ...error.context, processingTime };
        throw error;
      }

      // 包装意外错误为零Fallback错误
      throw ZeroFallbackErrorFactory.createRoutingRuleNotFound(
        request.model,
        'unexpected-error',
        `Unexpected routing error: ${error.message}`,
        {
          originalError: error.message,
          requestId: request.requestId,
          processingTime,
        }
      );
    }
  }

  /**
   * Match routing rules against request
   */
  private matchRoutingRules(
    request: RoutingRequest
  ): Array<{ rule: RoutingRule; matchedConditions: Record<string, boolean> }> {
    const matchedRules = [];

    for (const rule of this.routingRules.rules) {
      const matchResult = this.matchRule(rule, request);
      if (matchResult.isMatch) {
        matchedRules.push({
          rule,
          matchedConditions: matchResult.matchedConditions,
        });
      }
    }

    return matchedRules;
  }

  /**
   * Check if a rule matches the request
   */
  private matchRule(
    rule: RoutingRule,
    request: RoutingRequest
  ): { isMatch: boolean; matchedConditions: Record<string, boolean> } {
    const matchedConditions: Record<string, boolean> = {};

    // If no conditions, it's a default rule that matches everything
    if (Object.keys(rule.conditions).length === 0) {
      return { isMatch: true, matchedConditions: { default: true } };
    }

    // Check model conditions
    if (rule.conditions.model) {
      const modelCondition = rule.conditions.model;
      let modelMatches = false;

      for (const pattern of modelCondition.patterns) {
        if (modelCondition.operator === 'matches') {
          // Simple wildcard matching for claude-*
          const regexPattern = pattern.replace(/\*/g, '.*');
          const regex = new RegExp(`^${regexPattern}$`);
          if (regex.test(request.model)) {
            modelMatches = true;
            break;
          }
        } else if (modelCondition.operator === 'equals') {
          if (request.model === pattern) {
            modelMatches = true;
            break;
          }
        } else if (modelCondition.operator === 'contains') {
          if (request.model.includes(pattern)) {
            modelMatches = true;
            break;
          }
        }
      }

      matchedConditions.model = modelMatches;
      if (!modelMatches) {
        return { isMatch: false, matchedConditions };
      }
    }

    // Check protocol conditions (if any)
    if (rule.conditions.protocol) {
      const protocolMatches = rule.conditions.protocol.includes(request.protocol);
      matchedConditions.protocol = protocolMatches;
      if (!protocolMatches) {
        return { isMatch: false, matchedConditions };
      }
    }

    return { isMatch: true, matchedConditions };
  }

  /**
   * Select target provider from rule targets
   */
  private selectTargetProvider(rule: RoutingRule) {
    if (rule.targets.length === 0) {
      throw new Error('No targets available in routing rule');
    }

    // Simple weighted random selection
    const totalWeight = rule.targets.reduce((sum, target) => sum + target.weight, 0);
    const random = Math.random() * totalWeight;

    let weightSum = 0;
    for (const target of rule.targets) {
      weightSum += target.weight;
      if (random <= weightSum) {
        return target;
      }
    }

    // Fallback to first target
    return rule.targets[0];
  }

  /**
   * Get available routes info
   */
  getAvailableRoutes(): Array<{ provider: string; models: string[] }> {
    const routes = [];

    for (const rule of this.routingRules.rules) {
      for (const target of rule.targets) {
        const models = rule.conditions.model ? rule.conditions.model.patterns : ['*'];
        routes.push({
          provider: target.provider,
          models,
        });
      }
    }

    return routes;
  }
}
