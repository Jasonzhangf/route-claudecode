/**
 * 客户端模块接口定义
 * 
 * 定义客户端模块的标准接口，包括CLI管理、服务器管理、会话管理等功能
 * 严格遵循模块边界，不允许直接调用其他模块的具体实现
 * 
 * @author Jason Zhang
 */

import { IModule, ModuleConfig } from './module-interface';

/**
 * CLI命令类型枚举
 */
export enum CLICommandType {
  START = 'start',
  STOP = 'stop', 
  STATUS = 'status',
  CONFIG = 'config',
  DEBUG = 'debug',
  VERSION = 'version'
}

/**
 * CLI命令参数
 */
export interface CLICommand {
  readonly type: CLICommandType;
  readonly args: string[];
  readonly options: Record<string, any>;
  readonly timestamp: Date;
}

/**
 * CLI命令执行结果
 */
export interface CLIResult {
  readonly success: boolean;
  readonly output: string;
  readonly error?: string;
  readonly exitCode: number;
  readonly executionTime: number;
}

/**
 * 服务器状态信息
 */
export interface ServerInfo {
  readonly isRunning: boolean;
  readonly port: number;
  readonly host: string;
  readonly startTime?: Date;
  readonly pid?: number;
  readonly version: string;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  readonly id: string;
  readonly port: number;
  readonly startTime: Date;
  readonly requestCount: number;
  readonly isActive: boolean;
}

/**
 * 客户端配置接口
 */
export interface ClientConfig extends ModuleConfig {
  readonly defaultPort: number;
  readonly defaultHost: string;
  readonly autoRestart: boolean;
  readonly sessionTimeout: number;
  readonly debugMode: boolean;
}

/**
 * CLI管理器接口
 */
export interface ICLIManager {
  /**
   * 执行CLI命令
   * @param command CLI命令
   * @returns Promise<CLIResult> 执行结果
   */
  executeCommand(command: CLICommand): Promise<CLIResult>;
  
  /**
   * 解析命令行参数
   * @param argv 命令行参数数组
   * @returns CLICommand 解析后的命令
   */
  parseArguments(argv: string[]): CLICommand;
  
  /**
   * 获取命令帮助信息
   * @param commandType 命令类型
   * @returns string 帮助文本
   */
  getHelp(commandType?: CLICommandType): string;
  
  /**
   * 注册命令处理器
   * @param commandType 命令类型
   * @param handler 处理函数
   */
  registerCommandHandler(
    commandType: CLICommandType, 
    handler: (command: CLICommand) => Promise<CLIResult>
  ): void;
}

/**
 * 服务器管理器接口
 */
export interface IServerManager {
  /**
   * 启动RCC服务器
   * @param port 端口号
   * @param host 主机地址
   * @returns Promise<ServerInfo> 服务器信息
   */
  startServer(port: number, host: string): Promise<ServerInfo>;
  
  /**
   * 停止RCC服务器
   * @returns Promise<void>
   */
  stopServer(): Promise<void>;
  
  /**
   * 获取服务器状态
   * @returns Promise<ServerInfo> 服务器信息
   */
  getServerStatus(): Promise<ServerInfo>;
  
  /**
   * 重启服务器
   * @returns Promise<ServerInfo> 新的服务器信息
   */
  restartServer(): Promise<ServerInfo>;
  
  /**
   * 检查端口是否可用
   * @param port 端口号
   * @returns Promise<boolean> 是否可用
   */
  isPortAvailable(port: number): Promise<boolean>;
}

/**
 * 会话管理器接口
 */
export interface ISessionManager {
  /**
   * 创建新会话
   * @param port 服务器端口
   * @returns Promise<SessionInfo> 会话信息
   */
  createSession(port: number): Promise<SessionInfo>;
  
  /**
   * 获取会话信息
   * @param sessionId 会话ID
   * @returns SessionInfo | null 会话信息
   */
  getSession(sessionId: string): SessionInfo | null;
  
  /**
   * 获取所有活跃会话
   * @returns SessionInfo[] 会话信息数组
   */
  getActiveSessions(): SessionInfo[];
  
  /**
   * 关闭会话
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  closeSession(sessionId: string): Promise<void>;
  
  /**
   * 清理过期会话
   * @returns Promise<string[]> 被清理的会话ID列表
   */
  cleanupExpiredSessions(): Promise<string[]>;
}

/**
 * 错误处理器接口
 */
export interface IClientErrorHandler {
  /**
   * 处理CLI命令错误
   * @param error 错误对象
   * @param command 出错的命令
   * @returns CLIResult 错误结果
   */
  handleCLIError(error: Error, command: CLICommand): CLIResult;
  
  /**
   * 处理服务器错误
   * @param error 错误对象
   * @param context 错误上下文
   * @returns Promise<void>
   */
  handleServerError(error: Error, context: any): Promise<void>;
  
  /**
   * 处理会话错误
   * @param error 错误对象
   * @param sessionId 会话ID
   * @returns Promise<void>
   */
  handleSessionError(error: Error, sessionId: string): Promise<void>;
  
  /**
   * 记录错误日志
   * @param error 错误对象
   * @param level 日志级别
   * @param context 错误上下文
   */
  logError(error: Error, level: 'warn' | 'error' | 'fatal', context?: any): void;
}

/**
 * 客户端模块接口
 * 继承标准模块接口，提供客户端特有的功能
 */
export interface IClientModule extends IModule {
  readonly config: ClientConfig;
  readonly cliManager: ICLIManager;
  readonly serverManager: IServerManager;
  readonly sessionManager: ISessionManager;
  readonly errorHandler: IClientErrorHandler;
  
  /**
   * 处理CLI请求
   * @param argv 命令行参数
   * @returns Promise<CLIResult> 执行结果
   */
  handleCLIRequest(argv: string[]): Promise<CLIResult>;
  
  /**
   * 启动客户端服务
   * @param port 端口号
   * @param host 主机地址
   * @returns Promise<void>
   */
  startService(port: number, host: string): Promise<void>;
  
  /**
   * 停止客户端服务
   * @returns Promise<void>
   */
  stopService(): Promise<void>;
  
  /**
   * 获取客户端状态摘要
   * @returns Promise<any> 状态信息
   */
  getStatusSummary(): Promise<any>;
}

/**
 * 客户端事件类型
 */
export interface ClientEvents {
  'server-started': (serverInfo: ServerInfo) => void;
  'server-stopped': () => void;
  'session-created': (sessionInfo: SessionInfo) => void;
  'session-closed': (sessionId: string) => void;
  'command-executed': (command: CLICommand, result: CLIResult) => void;
  'error-handled': (error: Error, context: any) => void;
}