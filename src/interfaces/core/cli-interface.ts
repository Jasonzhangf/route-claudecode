/**
 * CLI模块标准接口定义
 * 
 * 严格遵循六层架构模型，定义CLI模块的标准接口
 * 所有CLI实现必须遵循此接口规范
 * 
 * @module CLIInterface
 * @version 4.0.0-beta.1
 * @lastUpdated 2025-08-21
 * @author RCC v4.0 Team
 */

import { CLI_DEFAULTS, CLI_COMMANDS, EXIT_CODES } from '../../constants/cli-defaults';
import { ERROR_MESSAGES } from '../../constants/error-messages';
import { ModuleInterface, ModuleConfig, ModuleMetrics, ModuleStatus } from './router-interface';

// =============================================================================
// CLI核心接口定义
// =============================================================================

/**
 * 解析后的命令接口
 */
export interface ParsedCommand {
  readonly command: string;
  readonly action?: string;
  readonly subAction?: string;
  readonly args: readonly string[];
  readonly options: Record<string, unknown>;
  readonly flags: readonly string[];
  readonly rawArgs: readonly string[];
}

/**
 * 命令执行结果接口
 */
export interface ExecutionResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly message?: string;
  readonly data?: unknown;
  readonly error?: Error;
  readonly executionTime: number;
}

/**
 * CLI模块配置接口
 */
export interface CLIModuleConfig extends ModuleConfig {
  readonly module: 'cli';
  readonly logLevel: string;
  readonly timeout: number;
  readonly outputFormat: string;
}

/**
 * CLI模块指标接口
 */
export interface CLIModuleMetrics extends ModuleMetrics {
  readonly commandStats: {
    readonly totalCommands: number;
    readonly successfulCommands: number;
    readonly failedCommands: number;
  };
}

/**
 * CLI模块标准接口
 */
export interface CLIModuleInterface extends ModuleInterface {
  readonly name: 'cli';
  
  initialize(config: CLIModuleConfig): Promise<void>;
  shutdown(): Promise<void>;
  getStatus(): ModuleStatus;
  getMetrics(): CLIModuleMetrics;
  
  run(args: readonly string[]): Promise<void>;
  parseCommand(args: readonly string[]): ParsedCommand;
  executeCommand(command: ParsedCommand): Promise<ExecutionResult>;
}

// =============================================================================
// 命令相关接口
// =============================================================================

/**
 * 命令定义接口
 */
export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly usage: string;
  readonly options: readonly OptionDefinition[];
  readonly examples?: readonly string[];
}

/**
 * 选项定义接口
 */
export interface OptionDefinition {
  readonly name: string;
  readonly short?: string;
  readonly long: string;
  readonly description: string;
  readonly type: 'string' | 'number' | 'boolean' | 'array';
  readonly required?: boolean;
  readonly defaultValue?: unknown;
}

/**
 * 命令解析器接口
 */
export interface CommandParser {
  readonly name: 'command-parser';
  readonly version: string;
  
  parse(args: readonly string[]): ParsedCommand;
  addCommand(command: CommandDefinition): void;
  removeCommand(name: string): void;
  listCommands(): readonly string[];
}

/**
 * 参数验证器接口
 */
export interface ArgumentValidator {
  readonly name: 'argument-validator';
  readonly version: string;
  
  validate(command: ParsedCommand): ValidationResult;
  addRule(name: string, rule: ValidationRule): void;
  removeRule(name: string): void;
}

/**
 * 验证规则接口
 */
export interface ValidationRule {
  readonly pattern?: string;
  readonly range?: { min: number; max: number };
  readonly allowedValues?: readonly string[];
  readonly required?: boolean;
  readonly customValidator?: (value: unknown) => boolean;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

/**
 * 验证错误接口
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
  readonly rule: string;
}

/**
 * 验证警告接口
 */
export interface ValidationWarning {
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
  readonly suggestion?: string;
}

/**
 * 命令执行器接口
 */
export interface CommandExecutor {
  readonly name: 'command-executor';
  readonly version: string;
  
  execute(command: ParsedCommand): Promise<ExecutionResult>;
  canExecute(command: string): boolean;
  getExecutionHistory(): readonly ExecutionHistoryEntry[];
}

/**
 * 执行历史条目接口
 */
export interface ExecutionHistoryEntry {
  readonly id: string;
  readonly command: ParsedCommand;
  readonly result: ExecutionResult;
  readonly timestamp: number;
  readonly duration: number;
}

/**
 * CLI模块基类
 */
export abstract class BaseCLIModule implements CLIModuleInterface {
  readonly name = 'cli' as const;
  readonly version: string;
  
  protected config: CLIModuleConfig;
  public status: ModuleStatus = ModuleStatus.UNINITIALIZED;
  protected metrics: CLIModuleMetrics;
  
  constructor(version: string = '4.0.0') {
    this.version = version;
    this.metrics = this.initializeMetrics();
  }
  
  abstract run(args: readonly string[]): Promise<void>;
  
  async initialize(config: CLIModuleConfig): Promise<void> {
    this.status = ModuleStatus.INITIALIZING;
    this.config = config;
    this.status = ModuleStatus.READY;
  }
  
  async shutdown(): Promise<void> {
    this.status = ModuleStatus.SHUTDOWN;
  }
  
  getStatus(): ModuleStatus {
    return this.status;
  }
  
  getMetrics(): CLIModuleMetrics {
    return { ...this.metrics };
  }
  
  abstract parseCommand(args: readonly string[]): ParsedCommand;
  abstract executeCommand(command: ParsedCommand): Promise<ExecutionResult>;
  
  private initializeMetrics(): CLIModuleMetrics {
    return {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      lastActivity: Date.now(),
      uptime: 0,
      commandStats: {
        totalCommands: 0,
        successfulCommands: 0,
        failedCommands: 0
      }
    };
  }
}

// =============================================================================
// 选项和错误处理接口
// =============================================================================

/**
 * Start选项接口
 */
export interface StartOptions {
  readonly port?: number;
  readonly host?: string;
  readonly config?: string;
  readonly debug?: boolean;
}

/**
 * Stop选项接口
 */
export interface StopOptions {
  readonly port?: number;
  readonly force?: boolean;
}

/**
 * Status选项接口
 */
export interface StatusOptions {
  readonly port?: number;
  readonly detailed?: boolean;
}

/**
 * Code选项接口
 */
export interface CodeOptions {
  readonly port?: number;
  readonly autoStart?: boolean;
  readonly export?: boolean;
}

/**
 * CLI处理器接口
 */
export interface CLIHandler {
  parseArguments(args: string[]): ParsedCommand;
  executeCommand(parsedCommand: ParsedCommand): Promise<void>;
  showHelp(command?: string): void;
  showVersion(): void;
}

/**
 * CLI命令接口
 */
export interface CLICommands {
  start(options: StartOptions): Promise<void>;
  stop(options: StopOptions): Promise<void>;
  code(options: CodeOptions): Promise<void>;
  status(options: StatusOptions): Promise<ServerStatus>;
  config(options: ConfigOptions): Promise<void>;
}

/**
 * Config选项接口
 */
export interface ConfigOptions {
  readonly list?: boolean;
  readonly validate?: boolean;
  readonly reset?: boolean;
  readonly path?: string;
}

/**
 * 健康检查接口
 */
export interface HealthCheck {
  readonly name: string;
  readonly status: 'pass' | 'fail' | 'warn';
  readonly responseTime: number;
}

/**
 * 服务器状态接口
 */
export interface ServerStatus {
  readonly isRunning: boolean;
  readonly port: number;
  readonly host: string;
  readonly startTime?: Date;
  readonly version: string;
  readonly activePipelines: number;
  readonly totalRequests: number;
  readonly uptime: string;
  readonly health: {
    readonly status: 'healthy' | 'degraded' | 'unhealthy';
    readonly checks: readonly HealthCheck[];
  };
  readonly pipeline?: {
    readonly stats: any;
    readonly activeRequests: number;
    readonly layerHealth: any;
  };
}

// =============================================================================
// 导出类型别名
// =============================================================================

export type CLIModuleType = CLIModuleInterface;
export type CLIConfigType = CLIModuleConfig;
export type CLIMetricsType = CLIModuleMetrics;