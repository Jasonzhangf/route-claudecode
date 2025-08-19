/**
 * 路由接口定义 - 用于集成测试和CoreRouter实现
 *
 * 这个文件定义了路由请求和路由决策的标准接口
 * 专门为集成测试提供类型定义
 */

// ========================= 路由请求接口 =========================

/**
 * 路由请求接口
 * 包含路由决策所需的所有信息
 */
export interface RoutingRequest {
  /** 请求唯一标识符 */
  requestId: string;

  /** 请求时间戳 */
  timestamp: Date;

  /** 协议类型 */
  protocol: 'anthropic' | 'openai';

  /** 模型名称 */
  model: string;

  /** API端点 */
  endpoint: string;

  /** HTTP方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';

  /** 请求头 */
  headers: Record<string, string>;

  /** 请求体 */
  body: any;

  /** 附加元数据 */
  metadata: Record<string, any>;
}

// ========================= 路由决策接口 =========================

/**
 * 路由决策结果接口
 * 包含路由器的决策输出
 */
export interface RoutingDecision {
  /** 目标Provider */
  targetProvider: string;

  /** 目标端点 */
  targetEndpoint: string;

  /** 决策时间戳 */
  timestamp: Date;

  /** 路由元数据 */
  routingMetadata: RoutingMetadata;

  /** 路由器添加的headers */
  headers: Record<string, string>;

  /** 原始请求（不变） */
  originalRequest: RoutingRequest;

  /** 协议转换数据（路由器不应该有此字段，由Transformer处理） */
  protocolTransformed?: undefined;
}

/**
 * 路由元数据接口
 * 记录路由决策的详细信息
 */
export interface RoutingMetadata {
  /** 匹配的路由规则ID */
  ruleId: string;

  /** 匹配的路由规则名称 */
  ruleName: string;

  /** 匹配的条件 */
  matchedConditions: Record<string, boolean>;

  /** 选择方法 */
  selectionMethod: string;

  /** 处理时间（毫秒） */
  processingTime: number;

  /** 请求类型（可选） */
  requestType?: 'streaming' | 'regular';
}

// ========================= 路由规则接口 =========================

/**
 * 路由规则集合接口
 */
export interface RoutingRules {
  /** 规则列表 */
  rules: RoutingRule[];

  /** 版本号 */
  version: string;
}

/**
 * 单个路由规则接口
 */
export interface RoutingRule {
  /** 规则ID */
  id: string;

  /** 规则名称 */
  name: string;

  /** 匹配条件 */
  conditions: RoutingConditions;

  /** 目标Provider列表 */
  targets: RoutingTarget[];

  /** 优先级（数字越小优先级越高） */
  priority: number;
}

/**
 * 路由条件接口
 */
export interface RoutingConditions {
  /** 模型匹配条件（可选） */
  model?: {
    patterns: string[];
    operator: 'matches' | 'equals' | 'contains';
  };

  /** 协议匹配条件（可选） */
  protocol?: string[];

  /** 其他条件可扩展 */
  [key: string]: any;
}

/**
 * 路由目标接口
 */
export interface RoutingTarget {
  /** Provider ID */
  provider: string;

  /** 权重（用于负载均衡，但路由器只用于选择） */
  weight: number;

  /** 是否为fallback（必须为false，遵循零fallback策略） */
  fallback: false;
}
