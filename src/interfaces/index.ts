/**
 * RCC v4.0 核心接口定义 - 主导出文件
 * 
 * 定义整个系统的标准接口，确保模块间的严格契约
 * 避免名称冲突，只导出最核心的接口
 * 
 * @author Jason Zhang
 */

// 基础模块接口
export type { 
  ModuleInterface, 
  ModuleType,
  ModuleStatus,
  ModuleMetrics,
  ModuleConfig,
  ModuleFactory,
  DataInterface,
  PipelineSpec,
  PipelineConfiguration,
  PipelineMetadata
} from './module/base-module';

export type { 
  Pipeline, 
  PipelineStatus
} from './module/pipeline-module';

// 客户端接口
export type { 
  CLICommands, 
  ServerStatus,
  CLIHandler,
  ParsedCommand,
  StartOptions,
  StopOptions,
  CodeOptions,
  StatusOptions,
  ConfigOptions,
  HealthCheck
} from './client/cli-interface';

export type { 
  ServerManager,
  RouteHandler
} from './client/server-manager';

export type { 
  ErrorHandler,
  ErrorContext,
  ExtendedRCCError
} from './client/error-handler';

// 路由器接口
export type { 
  ConfigManager,
  GeneratedRoutingTable
} from './router/config-manager';

export type { 
  RequestRouter,
  RCCRequest,
  LoadBalancingStrategy
} from './router/request-router';

export type { 
  PipelineManager,
  PipelineLifecycleManager
} from './router/pipeline-manager';

// 流水线接口
export type { 
  PipelineFramework,
  PipelineExecutor,
  ExecutionResult
} from './pipeline/pipeline-framework';

// 标准化数据结构
export type { 
  StandardRequest,
  RequestMetadata,
  ToolChoice
} from './standard/request';
export { StandardRequestBuilder } from './standard/request';

export type { 
  StandardResponse,
  Choice,
  Usage
} from './standard/response';
export { StandardResponseBuilder } from './standard/response';

export type { 
  Message,
  ContentBlock,
  MessageRole
} from './standard/message';
export { MessageBuilder } from './standard/message';

export type { 
  Tool,
  FunctionDefinition,
  ToolExecutor
} from './standard/tool';
export { ToolBuilder } from './standard/tool';