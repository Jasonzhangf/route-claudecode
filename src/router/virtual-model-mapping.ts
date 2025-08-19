/**
 * 虚拟模型映射规则
 *
 * 参考demo1设计，定义输入模型到虚拟模型的映射规则
 * 虚拟模型包括：default, premium, coding, reasoning, longContext, webSearch
 *
 * @author RCC v4.0
 */

import { secureLogger } from '../utils/secure-logger';

export interface VirtualModelMappingRule {
  inputModel: string;
  conditions?: {
    tokenCount?: { min?: number; max?: number };
    hasTools?: boolean;
    toolTypes?: string[];
    hasThinking?: boolean;
    isStreaming?: boolean;
    customCondition?: (request: any) => boolean;
  };
  virtualModel: VirtualModelType;
  priority: number; // 数字越小优先级越高
}

export enum VirtualModelType {
  DEFAULT = 'default',
  PREMIUM = 'premium',
  CODING = 'coding',
  REASONING = 'reasoning',
  LONG_CONTEXT = 'longContext',
  WEB_SEARCH = 'webSearch',
  BACKGROUND = 'background',
}

/**
 * 虚拟模型映射规则配置
 * 按照优先级顺序排列，第一个匹配的规则生效
 */
export const VIRTUAL_MODEL_MAPPING_RULES: VirtualModelMappingRule[] = [
  // 长上下文检测 (>60K tokens)
  {
    inputModel: '*', // 通配符，匹配所有模型
    conditions: {
      tokenCount: { min: 60000 },
    },
    virtualModel: VirtualModelType.LONG_CONTEXT,
    priority: 1,
  },

  // Web搜索工具检测
  {
    inputModel: '*',
    conditions: {
      hasTools: true,
      toolTypes: ['web_search', 'browser', 'search'],
    },
    virtualModel: VirtualModelType.WEB_SEARCH,
    priority: 2,
  },

  // 推理模型检测 (包含thinking参数)
  {
    inputModel: '*',
    conditions: {
      hasThinking: true,
    },
    virtualModel: VirtualModelType.REASONING,
    priority: 3,
  },

  // Claude 3.5 Haiku → 背景任务
  {
    inputModel: 'claude-3-5-haiku*', // 支持通配符
    conditions: {},
    virtualModel: VirtualModelType.BACKGROUND,
    priority: 4,
  },

  // 编程相关模型
  {
    inputModel: 'claude-3-5-sonnet',
    conditions: {
      hasTools: true, // 有工具调用通常是编程任务
    },
    virtualModel: VirtualModelType.CODING,
    priority: 5,
  },

  // GPT-4系列 → Premium
  {
    inputModel: 'gpt-4*',
    conditions: {},
    virtualModel: VirtualModelType.PREMIUM,
    priority: 6,
  },

  // Claude Sonnet 4 → Premium
  {
    inputModel: 'claude-sonnet-4',
    conditions: {},
    virtualModel: VirtualModelType.PREMIUM,
    priority: 7,
  },

  // Claude 3.5 Sonnet → Premium
  {
    inputModel: 'claude-3-5-sonnet',
    conditions: {},
    virtualModel: VirtualModelType.PREMIUM,
    priority: 8,
  },

  // 默认规则 (必须放在最后)
  {
    inputModel: '*',
    conditions: {},
    virtualModel: VirtualModelType.DEFAULT,
    priority: 99,
  },
];

/**
 * 虚拟模型映射引擎
 */
export class VirtualModelMapper {
  /**
   * 将输入模型映射到虚拟模型
   * @param inputModel 输入的模型名称
   * @param request 完整的请求对象 (用于条件判断)
   * @returns 虚拟模型类型
   */
  static mapToVirtual(inputModel: string, request: any): VirtualModelType {
    // 计算token数量 (简化版，实际应该使用tiktoken)
    const tokenCount = this.estimateTokenCount(request);

    // 按优先级顺序检查规则
    for (const rule of VIRTUAL_MODEL_MAPPING_RULES) {
      if (this.matchesRule(inputModel, request, tokenCount, rule)) {
        secureLogger.info('Virtual model mapping completed', {
          inputModel,
          virtualModel: rule.virtualModel,
          priority: rule.priority,
          tokenCount,
        });
        return rule.virtualModel;
      }
    }

    // 理论上不会到达这里，因为有默认规则
    secureLogger.warn('No virtual model rule matched, using default', { inputModel });
    return VirtualModelType.DEFAULT;
  }

  /**
   * 检查模型和条件是否匹配规则
   */
  private static matchesRule(
    inputModel: string,
    request: any,
    tokenCount: number,
    rule: VirtualModelMappingRule
  ): boolean {
    // 检查模型名称匹配 (支持通配符)
    if (!this.matchesModelPattern(inputModel, rule.inputModel)) {
      return false;
    }

    // 如果没有条件，直接匹配
    if (!rule.conditions) {
      return true;
    }

    const conditions = rule.conditions;

    // 检查token数量条件
    if (conditions.tokenCount) {
      const { min, max } = conditions.tokenCount;
      if (min && tokenCount < min) return false;
      if (max && tokenCount > max) return false;
    }

    // 检查工具条件
    if (conditions.hasTools !== undefined) {
      const hasTools = Array.isArray(request.tools) && request.tools.length > 0;
      if (conditions.hasTools !== hasTools) return false;
    }

    // 检查特定工具类型
    if (conditions.toolTypes && conditions.toolTypes.length > 0) {
      const hasRequiredTools = conditions.toolTypes.some(toolType =>
        request.tools?.some((tool: any) => tool.type?.includes(toolType) || tool.name?.includes(toolType))
      );
      if (!hasRequiredTools) return false;
    }

    // 检查thinking参数
    if (conditions.hasThinking !== undefined) {
      const hasThinking = !!request.thinking;
      if (conditions.hasThinking !== hasThinking) return false;
    }

    // 检查流式请求
    if (conditions.isStreaming !== undefined) {
      const isStreaming = !!request.stream;
      if (conditions.isStreaming !== isStreaming) return false;
    }

    // 检查自定义条件
    if (conditions.customCondition) {
      if (!conditions.customCondition(request)) return false;
    }

    return true;
  }

  /**
   * 模型名称模式匹配 (支持通配符)
   */
  private static matchesModelPattern(inputModel: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern === inputModel) return true;

    // 支持通配符匹配
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(inputModel);
    }

    return false;
  }

  /**
   * 估算token数量 (简化版实现)
   */
  private static estimateTokenCount(request: any): number {
    let tokenCount = 0;

    // 计算消息token
    if (Array.isArray(request.messages)) {
      for (const message of request.messages) {
        if (typeof message.content === 'string') {
          tokenCount += Math.ceil(message.content.length / 4); // 粗略估算
        }
      }
    }

    // 计算系统消息token
    if (typeof request.system === 'string') {
      tokenCount += Math.ceil(request.system.length / 4);
    }

    // 计算工具定义token
    if (Array.isArray(request.tools)) {
      for (const tool of request.tools) {
        const toolStr = JSON.stringify(tool);
        tokenCount += Math.ceil(toolStr.length / 4);
      }
    }

    return tokenCount;
  }
}
