/**
 * CodeWhisperer Client 统一接口
 * 定义缓冲式和实时流式实现的公共接口
 * 项目所有者: Jason Zhang
 */

import { AnthropicRequest, CodeWhispererRequest, CodeWhispererConfig } from './types';

export interface ICodeWhispererClient {
  /**
   * 处理流式请求
   * @param anthropicReq Anthropic格式请求
   * @param writeSSE SSE事件写入函数
   * @param onError 错误处理函数
   */
  handleStreamRequest(
    anthropicReq: AnthropicRequest,
    writeSSE: (event: string, data: any) => void,
    onError: (message: string, error: Error) => void
  ): Promise<void>;

  /**
   * 处理非流式请求
   * @param anthropicReq Anthropic格式请求
   */
  handleNonStreamRequest(anthropicReq: AnthropicRequest): Promise<any>;

  /**
   * 获取客户端类型
   */
  getClientType(): 'buffered' | 'realtime';

  /**
   * 健康检查
   */
  healthCheck(): Promise<{
    healthy: boolean;
    type: string;
    message?: string;
  }>;
}

export interface PerformanceReport {
  requestId: string;
  durationMs: number;
  memoryDelta: {
    rss: number;
    heapUsed: number;
  };
  eventsCount: number;
  avgLatency: number;
  maxLatency: number;
  minLatency: number;
}

export interface SSEEvent {
  event: string;
  data: any;
  timestamp?: number;
}

// 导出类型供其他模块使用
export type { AnthropicRequest, CodeWhispererRequest, CodeWhispererConfig } from './types';

export interface TestResult {
  success: boolean;
  duration: number;
  events: SSEEvent[];
  performance?: PerformanceReport | null;
  implementation: 'buffered' | 'realtime';
  error?: string;
}

export interface ComparisonResult {
  testCase: TestCase;
  bufferedResult: TestResult;
  realtimeResult: TestResult;
  comparison: {
    latencyImprovement: number; // 百分比
    memoryReduction: number;   // 百分比
    eventsMatch: boolean;
    performanceScore: number;
  };
}

export interface ComparisonReport {
  totalTests: number;
  results: ComparisonResult[];
  summary: {
    avgLatencyImprovement: number;
    avgMemoryReduction: number;
    realtimeSuccessRate: number;
    bufferedSuccessRate: number;
    recommendation: 'use_realtime' | 'use_buffered' | 'mixed';
  };
}

export interface TestCase {
  id: string;
  name: string;
  request: AnthropicRequest;
  expectedEvents?: string[];
  timeoutMs?: number;
}
