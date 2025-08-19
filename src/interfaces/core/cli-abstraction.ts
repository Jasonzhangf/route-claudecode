/**
 * CLI模块抽象接口
 * 定义CLI和服务器之间的接口边界
 */

/**
 * 服务器控制器接口
 */
export interface IServerController {
  start(config: ServerStartConfig): Promise<ServerStartResult>;
  stop(config: ServerStopConfig): Promise<ServerStopResult>;
  getStatus(config: ServerStatusConfig): Promise<ServerStatusResult>;
  isRunning(port?: number): Promise<boolean>;
}

/**
 * 配置管理器接口
 */
export interface IConfigManager {
  loadConfig(path?: string): Promise<any>;
  validateConfig(config: any): ValidationResult;
  listConfigs(): Promise<string[]>;
  resetConfig(): Promise<void>;
  getDefaultConfigPath(): string;
  getUserConfigPath(): string;
}

/**
 * 客户端代理接口
 */
export interface IClientProxy {
  start(config: ClientProxyConfig): Promise<void>;
  stop(): Promise<void>;
  isConnected(): boolean;
  getProxyStatus(): ClientProxyStatus;
}

/**
 * 服务器启动配置
 */
export interface ServerStartConfig {
  port?: number;
  host?: string;
  configPath?: string;
  debug?: boolean;
  pipelines?: any[];
}

/**
 * 服务器启动结果
 */
export interface ServerStartResult {
  success: boolean;
  port: number;
  host: string;
  pid?: number;
  startTime: Date;
  message?: string;
}

/**
 * 服务器停止配置
 */
export interface ServerStopConfig {
  port?: number;
  force?: boolean;
  timeout?: number;
}

/**
 * 服务器停止结果
 */
export interface ServerStopResult {
  success: boolean;
  message?: string;
  stopTime: Date;
}

/**
 * 服务器状态配置
 */
export interface ServerStatusConfig {
  port?: number;
  detailed?: boolean;
}

/**
 * 服务器状态结果
 */
export interface ServerStatusResult {
  running: boolean;
  port?: number;
  host?: string;
  pid?: number;
  uptime?: number;
  startTime?: Date;
  health?: HealthStatus;
  pipelines?: PipelineStatusSummary;
  memory?: MemoryUsage;
  requests?: RequestStats;
}

/**
 * 健康状态
 */
export interface HealthStatus {
  healthy: boolean;
  checks: HealthCheck[];
  lastCheck: Date;
}

/**
 * 健康检查项
 */
export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration: number;
}

/**
 * Pipeline状态摘要
 */
export interface PipelineStatusSummary {
  total: number;
  running: number;
  stopped: number;
  error: number;
  healthy: number;
}

/**
 * 内存使用情况
 */
export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}

/**
 * 请求统计
 */
export interface RequestStats {
  total: number;
  successful: number;
  failed: number;
  averageResponseTime: number;
  requestsPerSecond: number;
}

/**
 * 客户端代理配置
 */
export interface ClientProxyConfig {
  serverPort?: number;
  serverHost?: string;
  autoStart?: boolean;
  transparent?: boolean;
  exportEnv?: boolean;
}

/**
 * 客户端代理状态
 */
export interface ClientProxyStatus {
  connected: boolean;
  serverEndpoint?: string;
  proxyPort?: number;
  lastPing?: Date;
  connectionUptime?: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: string[];
}

/**
 * CLI命令执行器接口
 */
export interface ICommandExecutor {
  executeStart(config: ServerStartConfig): Promise<void>;
  executeStop(config: ServerStopConfig): Promise<void>;
  executeStatus(config: ServerStatusConfig): Promise<void>;
  executeCode(config: ClientProxyConfig): Promise<void>;
  executeConfig(action: ConfigAction, options: any): Promise<void>;
}

/**
 * 配置操作类型
 */
export type ConfigAction = 'list' | 'validate' | 'reset' | 'show' | 'edit';

/**
 * 进程管理器接口
 */
export interface IProcessManager {
  findProcess(port: number): Promise<ProcessInfo | null>;
  killProcess(pid: number, force?: boolean): Promise<boolean>;
  isPortInUse(port: number): Promise<boolean>;
  getProcessInfo(pid: number): Promise<ProcessInfo | null>;
}

/**
 * 进程信息
 */
export interface ProcessInfo {
  pid: number;
  ppid?: number;
  name?: string;
  cmd?: string;
  cpu?: number;
  memory?: number;
  startTime?: Date;
}

/**
 * 环境变量导出器接口
 */
export interface IEnvironmentExporter {
  exportProxySettings(config: ClientProxyConfig): string;
  exportServerSettings(config: ServerStartConfig): string;
  getShellCommands(shell?: 'bash' | 'zsh' | 'fish' | 'powershell'): string[];
}
