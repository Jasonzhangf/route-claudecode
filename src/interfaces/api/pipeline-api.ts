/**
 * Pipeline API接口定义
 * 
 * 定义所有流水线相关的API接口类型
 * 用于API化重构中的类型安全
 * 
 * @author RCC v4.0 API Refactoring
 */

import { APIResponse } from '../../api/types/api-response';

/**
 * 流水线处理上下文
 */
export interface PipelineProcessContext {
  /** 请求ID */
  requestId: string;
  /** 开始时间 */
  startTime: Date;
  /** 各层处理时间统计 */
  layerTimings: Record<string, number>;
  /** 路由决策信息 */
  routingDecision?: any;
  /** 转换历史记录 */
  transformations: any[];
  /** 错误记录 */
  errors: any[];
  /** 元数据信息 */
  metadata: any;
}

/**
 * Router层处理请求
 */
export interface RouterProcessRequest {
  /** 输入请求数据 */
  input: any;
  /** 处理上下文 */
  context: PipelineProcessContext;
}

/**
 * Router层处理响应
 */
export interface RouterProcessResponse {
  /** 原始模型名 */
  originalModel: string;
  /** 映射的模型名 */
  mappedModel: string;
  /** 可用流水线列表 */
  availablePipelines: string[];
  /** 选中的流水线 */
  selectedPipeline?: string;
  /** 路由决策原因 */
  reasoning: string;
}

/**
 * Transformer层处理请求
 */
export interface TransformerProcessRequest {
  /** 输入数据 */
  input: any;
  /** 路由决策 */
  routingDecision: any;
  /** 处理上下文 */
  context: PipelineProcessContext;
}

/**
 * Transformer层处理响应
 */
export interface TransformerProcessResponse {
  /** 转换后的请求数据 */
  transformedRequest: any;
  /** 转换方向 */
  direction: 'passthrough' | 'anthropic-to-openai' | 'openai-to-anthropic';
  /** 转换元数据 */
  metadata?: any;
}

/**
 * Protocol层处理请求
 */
export interface ProtocolProcessRequest {
  /** 请求数据 */
  request: any;
  /** 路由决策 */
  routingDecision: any;
  /** 处理上下文 */
  context: PipelineProcessContext;
}

/**
 * Protocol层处理响应
 */
export interface ProtocolProcessResponse {
  /** 协议处理后的请求 */
  protocolRequest: any;
  /** 协议配置信息 */
  protocolConfig: {
    endpoint: string;
    apiKey: string;
    protocol?: string;
    timeout: number;
    maxRetries: number;
    originalModel: string;
    actualModel: string;
    providerType: string;
    serverCompatibility: string;
  };
}

/**
 * Server层处理请求
 */
export interface ServerProcessRequest {
  /** 请求数据 */
  request: any;
  /** 路由决策 */
  routingDecision: any;
  /** 处理上下文 */
  context: PipelineProcessContext;
}

/**
 * Server层处理响应
 */
export interface ServerProcessResponse {
  /** API响应数据 */
  choices?: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: any[];
    };
    finish_reason: string;
  }>;
  /** 使用的模型 */
  model: string;
  /** 使用统计 */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
  };
}

/**
 * 流水线健康状态
 */
export interface PipelineHealth {
  /** 流水线ID */
  pipelineId: string;
  /** 健康状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 最后检查时间 */
  lastCheck: Date;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 流水线执行统计
 */
export interface PipelineStats {
  /** 流水线ID */
  pipelineId: string;
  /** 总处理数量 */
  totalProcessed: number;
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failureCount: number;
  /** 平均处理时间 */
  averageProcessingTime: number;
  /** 最后活动时间 */
  lastActivity: Date;
}

/**
 * Pipeline API服务接口
 */
export interface PipelineAPIService {
  /**
   * Router层处理
   */
  processRouterLayer(request: RouterProcessRequest): Promise<APIResponse<RouterProcessResponse>>;

  /**
   * Transformer层处理
   */
  processTransformerLayer(request: TransformerProcessRequest): Promise<APIResponse<TransformerProcessResponse>>;

  /**
   * Protocol层处理
   */
  processProtocolLayer(request: ProtocolProcessRequest): Promise<APIResponse<ProtocolProcessResponse>>;

  /**
   * Server层处理
   */
  processServerLayer(request: ServerProcessRequest): Promise<APIResponse<ServerProcessResponse>>;

  /**
   * 获取流水线健康状态
   */
  getPipelineHealth(pipelineId: string): Promise<APIResponse<PipelineHealth>>;

  /**
   * 获取流水线统计信息
   */
  getPipelineStats(pipelineId: string): Promise<APIResponse<PipelineStats>>;

  /**
   * 获取所有流水线状态
   */
  getAllPipelinesStatus(): Promise<APIResponse<Record<string, PipelineHealth>>>;

  /**
   * 刷新流水线配置
   */
  refreshPipelineConfig(pipelineId: string): Promise<APIResponse<void>>;
}

/**
 * Pipeline API路由端点常量
 */
export const PIPELINE_API_ENDPOINTS = {
  /** 基础路径 */
  BASE: '/api/v1/pipeline',
  
  /** Router层处理 */
  ROUTER_PROCESS: '/api/v1/pipeline/router/process',
  
  /** Transformer层处理 */
  TRANSFORMER_PROCESS: '/api/v1/pipeline/transformer/process',
  
  /** Protocol层处理 */
  PROTOCOL_PROCESS: '/api/v1/pipeline/protocol/process',
  
  /** Server层处理 */
  SERVER_PROCESS: '/api/v1/pipeline/server/process',
  
  /** 获取流水线健康状态 */
  HEALTH: '/api/v1/pipeline/:id/health',
  
  /** 获取流水线统计 */
  STATS: '/api/v1/pipeline/:id/stats',
  
  /** 获取所有流水线状态 */
  STATUS_ALL: '/api/v1/pipeline/status',
  
  /** 刷新配置 */
  REFRESH_CONFIG: '/api/v1/pipeline/:id/refresh'
} as const;

/**
 * API错误类型
 */
export interface PipelineAPIError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 流水线ID */
  pipelineId?: string;
  /** 层级信息 */
  layer?: 'router' | 'transformer' | 'protocol' | 'server';
  /** 详细信息 */
  details?: any;
}

/**
 * 批处理请求
 */
export interface BatchProcessRequest {
  /** 请求列表 */
  requests: Array<{
    id: string;
    layer: 'router' | 'transformer' | 'protocol' | 'server';
    data: any;
  }>;
  /** 批处理选项 */
  options?: {
    /** 并发限制 */
    concurrency?: number;
    /** 超时时间 */
    timeout?: number;
    /** 失败策略 */
    failureStrategy?: 'fail-fast' | 'continue-on-error';
  };
}

/**
 * 批处理响应
 */
export interface BatchProcessResponse {
  /** 处理结果 */
  results: Array<{
    id: string;
    success: boolean;
    data?: any;
    error?: PipelineAPIError;
    processingTime: number;
  }>;
  /** 批处理统计 */
  summary: {
    total: number;
    successful: number;
    failed: number;
    totalProcessingTime: number;
  };
}

/**
 * 流水线监控数据
 */
export interface PipelineMonitoringData {
  /** 流水线ID */
  pipelineId: string;
  /** 监控时间戳 */
  timestamp: Date;
  /** 性能指标 */
  metrics: {
    /** CPU使用率 */
    cpuUsage: number;
    /** 内存使用率 */
    memoryUsage: number;
    /** 请求队列长度 */
    queueLength: number;
    /** 活跃请求数 */
    activeRequests: number;
  };
  /** 健康指标 */
  health: {
    /** 状态 */
    status: 'healthy' | 'degraded' | 'unhealthy';
    /** 可用性百分比 */
    availability: number;
    /** 错误率 */
    errorRate: number;
  };
}