/**
 * 路由器接口定义 - 严格类型定义，禁止any类型
 */

// 具体请求类型
interface RoutingRequest {
  model: string;
  messages?: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: unknown[];
  [key: string]: unknown;
}

// 路由结果类型
interface RoutingResult {
  success: boolean;
  selectedPipeline?: string;
  virtualModel: string;
  reasoning: string;
  timestamp: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// 路由表状态类型
interface RoutingTableStatus {
  isLoaded: boolean;
  routeCount: number;
  defaultRoute: string;
  lastUpdated: string;
  health: 'healthy' | 'degraded' | 'unhealthy';
  activeRoutes: string[];
  totalPipelines: number;
}

export interface RouterInterface {
  route(inputModel: string): RoutingResult;
  mapToModelCategory(inputModel: string, request?: RoutingRequest): string;
  getRoutingTableStatus(): RoutingTableStatus;
  markPipelineUnhealthy(pipelineId: string, reason: string): void;
  markPipelineHealthy(pipelineId: string): void;
}

export type { RoutingRequest, RoutingResult, RoutingTableStatus };