/**
 * CLI接口定义
 *
 * 定义RCC v4.0的CLI命令接口
 *
 * @author Jason Zhang
 */

/**
 * happy-cli子命令选项
 */
export interface HappyOptions {
  command: 'status' | 'start' | 'stop' | 'logs';
}

/**
 * CLI命令接口
 */
export interface CLICommands {
  /**
   * 启动服务器模式
   */
  start(options: StartOptions): Promise<void>;

  /**
   * 停止服务器
   */
  stop(options: StopOptions): Promise<void>;

  /**
   * 启动客户端模式 (透明代理Claude Code)
   */
  code(options: CodeOptions): Promise<void>;

  /**
   * 查看服务器状态
   */
  status(options: StatusOptions): Promise<ServerStatus>;

  /**
   * 配置管理
   */
  config(options: ConfigOptions): Promise<void>;

  /**
   * happy-cli集成管理命令
   */
  // TODO: 临时注释，修复编译错误
  // happy(options: HappyOptions): Promise<void>;
}

/**
 * 启动选项
 */
export interface StartOptions {
  port?: number;
  host?: string;
  config?: string;
  debug?: boolean;
}

/**
 * 停止选项
 */
export interface StopOptions {
  port?: number;
  force?: boolean;
}

/**
 * 客户端选项
 */
export interface CodeOptions {
  port?: number;
  autoStart?: boolean;
  export?: boolean;
}

/**
 * 状态查询选项
 */
export interface StatusOptions {
  port?: number;
  detailed?: boolean;
}

/**
 * 配置选项
 */
export interface ConfigOptions {
  list?: boolean;
  validate?: boolean;
  reset?: boolean;
  path?: string;
}

/**
 * 服务器状态
 */
export interface ServerStatus {
  isRunning: boolean;
  port: number;
  host: string;
  startTime?: Date;
  version: string;
  activePipelines: number;
  totalRequests: number;
  uptime?: string;
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
  };
  pipeline?: {
    stats: any;
    activeRequests: number;
    layerHealth: any;
  };
}

/**
 * 健康检查结果
 */
export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  responseTime?: number;
}

/**
 * CLI处理器接口
 */
export interface CLIHandler {
  /**
   * 解析命令行参数
   */
  parseArguments(args: string[]): ParsedCommand;

  /**
   * 执行命令
   */
  executeCommand(command: ParsedCommand): Promise<void>;

  /**
   * 显示帮助信息
   */
  showHelp(command?: string): void;

  /**
   * 显示版本信息
   */
  showVersion(): void;
}

/**
 * 解析后的命令
 */
export interface ParsedCommand {
  command: string;
  subcommand?: string;
  options: Record<string, any>;
  args: string[];
}
