/**
 * RCC v4.0 核心接口定义 - 主导出文件
 * 
 * 定义整个系统的标准接口，确保模块间的严格契约
 * 避免名称冲突，只导出最核心的接口
 * 
 * @author Jason Zhang
 */

// 基础模块接口
export { 
  ModuleInterface, 
  ModuleType, 
  BaseModule,
  DataInterface
} from './module/base-module';

export { 
  Pipeline, 
  PipelineStatus,
  ModuleFactory,
  ModuleRegistry
} from './module/pipeline-module';

// 客户端接口
export { 
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

export { 
  ServerManager,
  RouteHandler
} from './client/server-manager';

export { 
  ErrorHandler,
  ErrorContext,
  ExtendedRCCError
} from './client/error-handler';

// 路由器接口
export { 
  ConfigManager,
  GeneratedRoutingTable
} from './router/config-manager';

export { 
  RequestRouter,
  RCCRequest,
  LoadBalancingStrategy
} from './router/request-router';

export { 
  PipelineManager,
  PipelineLifecycleManager
} from './router/pipeline-manager';

// 流水线接口
export { 
  PipelineFramework,
  PipelineExecutor,
  ExecutionResult
} from './pipeline/pipeline-framework';

// 标准化数据结构
export { 
  StandardRequest,
  StandardRequestBuilder,
  RequestMetadata
} from './standard/request';

export { 
  StandardResponse,
  StandardResponseBuilder,
  Choice,
  Usage
} from './standard/response';

export { 
  Message,
  MessageBuilder,
  ContentBlock,
  MessageRole
} from './standard/message';

export { 
  Tool,
  ToolBuilder,
  FunctionDefinition,
  ToolExecutor
} from './standard/tool';