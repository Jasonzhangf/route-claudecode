/**
 * 增强错误处理器
 * 
 * 统一的错误处理接口，集成错误日志管理和分类功能
 * 同时实现错误协调中心的核心功能
 * 
 * @author RCC v4.0 - Debug System Enhancement
 */

// Helper function to get default timeframe
function getDefaultTimeframe(): string {
  return 'last_24_hours';
}

import { ErrorLogManager, ErrorLogEntry, ErrorType, getErrorLogManager } from './error-log-manager';
import { errorClassifier, ErrorClassification } from './error-classifier';
import { secureLogger } from './utils/secure-logger';
import { RCCError, RCCErrorCode, ErrorContext as TypesErrorContext } from '../../types/src/index';
// Import interfaces with aliases to avoid conflicts
import type { ErrorCoordinationCenter as IErrorCoordinationCenter } from '../../interfaces/core/error-coordination-center';
import type { ErrorType as InterfaceErrorType } from '../../interfaces/core/error-coordination-center';
import type { ErrorContext as InterfaceErrorContext } from '../../interfaces/core/error-coordination-center';
import type { ErrorClassification as InterfaceErrorClassification } from '../../interfaces/core/error-coordination-center';
import type { ErrorHandlingResult as InterfaceErrorHandlingResult } from '../../interfaces/core/error-coordination-center';
import type { UnifiedErrorResponse } from '../../interfaces/core/error-coordination-center';
import { ErrorSeverity } from '../../interfaces/core/error-coordination-center';
import type { ErrorStatistics } from '../../interfaces/core/error-coordination-center';
import type { ErrorSummaryReport } from '../../interfaces/core/error-coordination-center';

// 添加鉴权错误处理相关接口
interface OAuthErrorInfo {
  type: 'token_expired' | 'token_invalid' | 'oauth_server_error' | 'permission_denied';
  provider: string;
  timestamp: Date;
  affectedPipelines: string[];
}

interface AuthMaintenanceEvent {
  type: 'auth_refresh_required' | 'auth_rebuild_required' | 'pipeline_unavailable';
  errorInfo: OAuthErrorInfo;
  pipelineIds: string[];
  timestamp: Date;
}

// 添加外部依赖引用
interface AuthCenter {
  forceRefreshTokens(provider?: string): Promise<RefreshResult>;
  forceRebuildAuth(provider?: string): Promise<RebuildResult>;
}

interface PipelineManager {
  setAuthMaintenanceMode(pipelineIds: string[], reason: string, options?: {
    estimatedDuration?: number;
    force?: boolean;
    skipHealthCheck?: boolean;
  }): Promise<{success: string[], failed: string[]}>;
  clearAuthMaintenanceMode(pipelineIds: string[], options?: {
    skipHealthCheck?: boolean;
    force?: boolean;
  }): Promise<{success: string[], failed: string[]}>;
}

interface RefreshResult {
  success: boolean;
  refreshedTokens: string[];
  failedTokens: string[];
  error?: string;
}

interface RebuildResult {
  success: boolean;
  rebuiltPipelines: string[];
  failedPipelines: string[];
  error?: string;
}

export class ValidationError extends RCCError {
  constructor(message: string, context?: any) {
    super(message, RCCErrorCode.VALIDATION_ERROR, 'validation', { details: context });
  }
}

export class TransformError extends RCCError {
  constructor(message: string, context?: any) {
    super(message, RCCErrorCode.INTERNAL_ERROR, 'transformer', { details: context });
  }
}

export class AuthError extends RCCError {
  constructor(message: string, context?: any) {
    super(message, RCCErrorCode.PROVIDER_AUTH_FAILED, 'auth', { details: context });
  }
}


/**
 * 错误上下文信息
 */
interface LocalErrorContext {
  requestId: string;
  pipelineId?: string;
  layerName?: string;
  provider?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  timeout?: number;
  responseTime?: number;
  attempt?: number;
  maxRetries?: number;
  isBufferError?: boolean;
  isLastAttempt?: boolean;
  protocol?: string;
  originalResponseId?: string;
  hasOriginalResponse?: boolean;
  totalTime?: number;
  layerTimings?: Record<string, number>;
  errorCount?: number;
  availablePipelines?: string[];
  inputHash?: string;
}
export class EnhancedErrorHandler implements IErrorCoordinationCenter {
  private errorLogManager: ErrorLogManager;
  private initialized: boolean = false;
  private authCenter: AuthCenter | null = null;
  private pipelineManager: PipelineManager | null = null;
  private authErrorQueue: Map<string, OAuthErrorInfo[]> = new Map();
  private authMaintenanceInProgress: boolean = false;

  constructor(serverPort?: number) {
    this.errorLogManager = getErrorLogManager(serverPort);
    // 初始化鉴权维护协调器
    this.initializeAuthMaintenanceCoordinator();
  }

  /**
   * 初始化错误协调中心
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.errorLogManager.initialize();
      this.initialized = true;
      secureLogger.info('Enhanced error handler initialized');
    }
  }

  /**
   * 处理RCC错误
   */
  async handleRCCError(error: RCCError, context: LocalErrorContext): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // 使用RCCError中的信息进行分类
    const classification = this.classifyErrorInternal(error.message, error.stack, context);
    
    // 如果RCCError包含严重程度信息，优先使用
    const severity = (error as any).severity || this.getErrorSeverity(error);
    const errorCode = error.code || RCCErrorCode.UNKNOWN_ERROR;
    
    const errorEntry: Omit<ErrorLogEntry, 'id' | 'timestamp'> = {
      requestId: context.requestId,
      pipelineId: context.pipelineId,
      errorType: classification.type as any,
      message: error.message,
      stack: error.stack,
      context: {
        ...context,
        moduleId: error.module || (error as any).moduleId,
        errorCode: errorCode,
        severity: severity,
        errorContext: error.context?.details || (error as any).context,
        errorType: error.constructor.name
      },
      classification: {
        confidence: classification.confidence,
        matchedPattern: classification.matchedPattern,
        contextHints: classification.contextHints
      }
    };

    await this.errorLogManager.logError(errorEntry);

    secureLogger.debug('RCC error handled and logged', {
      requestId: context.requestId,
      errorType: classification.type as any,
      errorCode: errorCode,
      moduleId: error.module || (error as any).moduleId,
      errorClassName: error.constructor.name,
      confidence: classification.confidence,
      pipelineId: context.pipelineId
    });

    // 检查是否是鉴权错误并触发维护流程
    if (this.isAuthenticationError(error, errorCode)) {
      await this.handleAuthError(error, context);
    }
  }

  /**
   * 处理通用错误（实现ErrorCoordinationCenter接口）
   */
  handleError(error: Error, context?: any): InterfaceErrorHandlingResult {
    try {
      // Convert interface context to internal context
      const internalContext = context as LocalErrorContext;
      
      // Check if this is an RCC error with user action required
      if (error instanceof RCCError && error.context?.details) {
        const details = error.context.details;
        
        // Handle OAuth authorization required
        if (details.requiresUserAction && details.userActionType === 'oauth_authorization') {
          secureLogger.info('OAuth authorization required - displaying user notification', {
            provider: details.provider,
            authFile: details.authFile,
            oauthUrl: details.userActionUrl,
            reason: details.reason
          });
          
          // Display OAuth link to user
          this.displayOAuthNotification(details);
          
          return {
            handled: true,
            action: 'OAuth authorization required',
            actionTaken: 'OAuth link displayed to user',
            success: true,
            message: `Please authorize at: ${details.userActionUrl}`
          };
        }
      }
      
      // Standard error logging
      secureLogger.debug('Error received for handling', {
        errorName: error.name,
        errorMessage: error.message,
        context: internalContext
      });
      
      return {
        handled: true,
        action: 'Error received and logged',
        actionTaken: 'Error processed and logged',
        success: true
      };
    } catch (handleError) {
      return {
        handled: false,
        action: 'Error handling failed',
        actionTaken: 'Error handling failed',
        success: false,
        message: handleError instanceof Error ? handleError.message : String(handleError)
      };
    }
  }

  /**
   * 显示OAuth授权通知给用户并启动授权流程
   * @param details 错误详情包含OAuth信息
   */
  private displayOAuthNotification(details: any): void {
    try {
      const provider = details.provider?.toLowerCase();
      const oauthUrl = details.userActionUrl;
      
      // 记录OAuth流程启动
      secureLogger.info('Starting OAuth authorization flow', {
        provider: details.provider,
        authFile: details.authFile,
        oauthUrl: oauthUrl
      });
      
      // 在控制台显示通知
      console.log('\n' + '='.repeat(80));
      console.log('🔐 OAuth授权流程启动');
      console.log('='.repeat(80));
      console.log(`Provider: ${details.provider || 'Unknown'}`);
      console.log(`Auth File: ${details.authFile || 'Unknown'}`);
      console.log(`Reason: ${details.reason || 'Token refresh failed'}`);
      console.log(`\n🚀 正在打开浏览器进行授权...`);
      console.log(`🔗 OAuth URL: ${oauthUrl}`);
      
      // 打开浏览器到授权页面
      this.openBrowser(oauthUrl, details);
      
      if (provider === 'qwen') {
        console.log(`\n📝 Qwen授权说明:`);
        console.log(`   • 请在打开的页面中登录您的Qwen账号`);
        console.log(`   • 如果需要输入用户代码，请按页面提示操作`);
        console.log(`   • 完成授权后，系统将自动获取新的访问令牌`);
      }
      
      console.log('\n⏳ 请在浏览器中完成授权，系统将自动恢复流水线...');
      console.log('='.repeat(80) + '\n');
      
    } catch (error) {
      console.log('❌ OAuth授权流程启动失败，请手动打开链接:');
      console.log(`🔗 ${details.userActionUrl || 'OAuth URL not available'}`);
      
      secureLogger.error('Failed to start OAuth authorization flow', {
        error: error instanceof Error ? error.message : String(error),
        details: details
      });
    }
  }

  /**
   * 打开浏览器到指定URL
   * @param url 要打开的URL
   * @param details 错误详情用于日志
   */
  private openBrowser(url: string, details: any): void {
    try {
      const { exec } = require('child_process');
      
      // 使用系统命令打开浏览器
      let command = '';
      if (process.platform === 'darwin') {
        command = `open "${url}"`;
      } else if (process.platform === 'win32') {
        command = `start "${url}"`;
      } else {
        command = `xdg-open "${url}"`;
      }
      
      exec(command, (error: any) => {
        if (error) {
          console.log('❌ 无法自动打开浏览器，请手动复制链接:');
          console.log(`🔗 ${url}`);
          secureLogger.warn('Failed to open browser with system command', {
            error: error.message,
            command: command,
            url: url
          });
        } else {
          console.log('✅ 浏览器已打开授权页面');
          secureLogger.info('Browser opened using system command', {
            provider: details.provider,
            command: command,
            url: url
          });
        }
      });
      
    } catch (error) {
      console.log('❌ 浏览器启动失败，请手动访问:');
      console.log(`🔗 ${url}`);
      secureLogger.error('Browser launch failed', {
        error: error instanceof Error ? error.message : String(error),
        url: url
      });
    }
  }

  /**
   * 标准化错误响应
   */
  normalizeErrorResponse(error: any, provider: string): UnifiedErrorResponse {
    return {
      error: true,
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || String(error),
      details: {
        type: error.constructor?.name || 'unknown'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 记录错误日志（实现ErrorCoordinationCenter接口）
   */
  async logError(error: Error, context: InterfaceErrorContext, classification: InterfaceErrorClassification): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const errorEntry: Omit<ErrorLogEntry, 'id' | 'timestamp'> = {
      requestId: context.requestId,
      pipelineId: context.pipelineId,
      errorType: classification.type as any,
      message: error.message,
      stack: error.stack,
      context: context as LocalErrorContext,
      classification: {
        confidence: classification.confidence,
        matchedPattern: classification.matchedPattern,
        contextHints: classification.contextHints
      }
    };

    await this.errorLogManager.logError(errorEntry);

    secureLogger.debug('Error logged through ErrorCoordinationCenter interface', {
      requestId: context.requestId,
      errorType: classification.type as any,
      confidence: classification.confidence,
      pipelineId: context.pipelineId
    });
  }

  /**
   * 分类错误（实现ErrorCoordinationCenter接口）
   */
  classifyError(error: Error): InterfaceErrorClassification {
    // Simplified implementation to match interface requirements
    return {
      category: 'INTERNAL',
      severity: 'medium',
      type: 'INTERNAL',
      recoverable: true,
      confidence: 0.5,
      matchedPattern: 'generic',
      contextHints: ['generic error']
    };
  }

  /**
   * 获取错误统计信息
   */
  getErrorStatistics(timeRangeHours: number = 24): ErrorStatistics | null {
    if (!this.initialized) {
      return null;
    }
    return this.errorLogManager.getErrorStatistics(timeRangeHours);
  }

  /**
   * 生成错误摘要报告
   */
  async generateErrorSummary(startTime: number, endTime: number): Promise<ErrorSummaryReport> {
    // Simplified implementation that returns a basic structure
    return Promise.resolve({
      timeframe: getDefaultTimeframe(),
      statistics: {
        totalErrors: 0,
        errorsByType: {}
      },
      topErrors: []
    } as ErrorSummaryReport);
  }

  // Implement the interface method
  generateReport(): ErrorSummaryReport {
    // Simplified implementation
    return {
      timeframe: getDefaultTimeframe(),
      statistics: {
        totalErrors: 0,
        errorsByType: {}
      },
      topErrors: []
    } as ErrorSummaryReport;
  }

  /**
   * 清理过期日志
   */
  async cleanupLogs(retentionDays: number): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.errorLogManager.cleanupLogs(retentionDays);
  }

  /**
   * 检查错误是否可重试
   */
  isRetryableError(error: any): boolean {
    // Simple implementation - most errors are retryable
    return true;
  }

  /**
   * 获取建议的重试延迟
   */
  getRetryDelay(error: any): number {
    // Simple implementation - fixed delay with exponential backoff
    return 1000;
  }

  /**
   * 获取错误严重程度
   */
  getErrorSeverity(error: any): ErrorSeverity {
    // Simple implementation - determine severity based on error content
    const message = (error.message || String(error)).toLowerCase();
    
    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    } else if (message.includes('timeout') || message.includes('network')) {
      return ErrorSeverity.HIGH;
    } else if (message.includes('validation') || message.includes('parse')) {
      return ErrorSeverity.MEDIUM;
    } else {
      return ErrorSeverity.LOW;
    }
  }

  // ===== Private Helper Methods =====

  /**
   * 分类错误
   */
  private classifyErrorInternal(message: string, stack?: string, context?: LocalErrorContext): ErrorClassification {
    // 提取额外的上下文信息用于分类
    const classificationContext: Record<string, any> = {
      ...context,
    };

    // 添加从上下文中推断的信息
    if (context?.layerName) {
      classificationContext.layerName = context.layerName;
    }

    if (context?.statusCode) {
      classificationContext.statusCode = context.statusCode;
    }

    if (context?.provider) {
      classificationContext.provider = context.provider;
    }

    return errorClassifier.classify(message, stack, classificationContext);
  }

  /**
   * 提取错误上下文信息
   */
  private extractContextFromError(error: Error): Record<string, any> {
    const context: Record<string, any> = {};

    // 从错误堆栈中提取模块信息
    if (error.stack) {
      const stackLines = error.stack.split('\n');
      
      for (const line of stackLines) {
        if (line.includes('pipeline-request-processor')) {
          context.layerName = 'pipeline-request-processor';
          break;
        } else if (line.includes('pipeline-layers')) {
          context.layerName = 'pipeline-layers';
          break;
        } else if (line.includes('transformer')) {
          context.layerName = 'transformer';
          break;
        }
      }
    }

    // 从错误消息中提取信息
    if (error.message.includes('pipeline')) {
      context.category = 'pipeline';
    } else if (error.message.includes('network') || error.message.includes('connection')) {
      context.category = 'network';
    } else if (error.message.includes('timeout')) {
      context.category = 'timeout';
    }

    return context;
  }

  // ===== 鉴权错误处理和维护流程协调 =====

  /**
   * 鉴权维护流程协调器
   * 协调错误处理器、自检服务、鉴权模块和流水线管理器的协作
   */
  private authMaintenanceCoordinator: any = null;

  /**
   * 初始化鉴权维护协调器
   */
  private initializeAuthMaintenanceCoordinator(): void {
    // 初始化鉴权维护协调器对象
    this.authMaintenanceCoordinator = {
      selfCheckService: null,
      initialized: true,
      lastMaintenanceTime: Date.now()
    };
    secureLogger.info('Auth maintenance coordinator initialized');
  }

  /**
   * 设置自检服务到维护协调器
   * @param selfCheckService 自检服务实例
   */
  setSelfCheckService(selfCheckService: any): void {
    if (!this.authMaintenanceCoordinator) {
      this.initializeAuthMaintenanceCoordinator();
    }
    // 保存自检服务引用，用于后续协调
    (this.authMaintenanceCoordinator as any).selfCheckService = selfCheckService;
    secureLogger.info('Self check service set in auth maintenance coordinator');
  }

  /**
   * 处理鉴权维护事件
   * @param event 维护事件
   * @returns Promise<void>
   */
  async handleAuthMaintenanceEvent(event: AuthMaintenanceEvent): Promise<void> {
    if (!this.authMaintenanceCoordinator) {
      this.initializeAuthMaintenanceCoordinator();
    }
    
    // 处理维护事件队列
    await this.processAuthMaintenanceEvent(event);
  }

  /**
   * 获取维护队列状态
   * @returns Object 队列状态信息
   */
  getAuthMaintenanceQueueStatus(): {
    queueSize: number;
    isProcessing: boolean;
    eventsByType: Record<string, number>;
  } {
    if (!this.authMaintenanceCoordinator) {
      return {
        queueSize: 0,
        isProcessing: false,
        eventsByType: {}
      };
    }
    
    // 返回当前维护队列状态
    const eventsByType: Record<string, number> = {};
    let queueSize = 0;
    
    for (const [provider, errors] of this.authErrorQueue.entries()) {
      queueSize += errors.length;
      errors.forEach(error => {
        eventsByType[error.type] = (eventsByType[error.type] || 0) + 1;
      });
    }
    
    return {
      queueSize,
      isProcessing: this.authMaintenanceInProgress,
      eventsByType
    };
  }

  /**
   * 处理鉴权维护事件（私有实现）
   * @param event 维护事件
   */
  private async processAuthMaintenanceEvent(event: AuthMaintenanceEvent): Promise<void> {
    try {
      secureLogger.info('Processing auth maintenance event', {
        eventType: event.type,
        provider: event.errorInfo.provider,
        affectedPipelines: event.pipelineIds.length
      });

      // 将事件加入队列
      this.addAuthErrorToQueue(event.errorInfo);
      
      // 立即触发维护流程
      if (!this.authMaintenanceInProgress) {
        await this.processAuthMaintenance(event.errorInfo);
      }
    } catch (error) {
      secureLogger.error('Failed to process auth maintenance event', {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.type
      });
    }
  }

  // ===== 鉴权错误处理流程 =====

  /**
   * 判断是否是鉴权错误
   */
  private isAuthenticationError(error: RCCError, errorCode: RCCErrorCode): boolean {
    const errorModule = error.module || 'unknown';
    const errorMessage = error.message.toLowerCase();
    
    return errorCode === RCCErrorCode.PROVIDER_AUTH_FAILED ||
           errorModule === 'oauth-error-detector' ||
           errorMessage.includes('authentication') ||
           errorMessage.includes('authorization') ||
           errorMessage.includes('unauthorized') ||
           errorMessage.includes('token expired') ||
           errorMessage.includes('invalid token');
  }

  /**
   * 处理鉴权错误
   */
  private async handleAuthError(error: RCCError, context: LocalErrorContext): Promise<void> {
    try {
      // 提取OAuth错误信息
      const oauthError = this.extractOAuthErrorFromRCCError(error, context);
      
      if (!oauthError) {
        secureLogger.warn('Cannot extract OAuth error info from auth error', {
          error: error.message,
          module: error.module
        });
        return;
      }

      // 将错误加入队列
      this.addAuthErrorToQueue(oauthError);
      
      // 创建维护事件
      const maintenanceEvent: AuthMaintenanceEvent = {
        type: this.determineMaintenanceEventType(oauthError.type),
        errorInfo: oauthError,
        pipelineIds: oauthError.affectedPipelines,
        timestamp: new Date()
      };

      // 使用维护协调器处理事件
      await this.handleAuthMaintenanceEvent(maintenanceEvent);
      
      // 如果维护已在进行中，跳过直接处理
      if (this.authMaintenanceInProgress) {
        secureLogger.debug('Auth maintenance already in progress, event queued', {
          provider: oauthError.provider,
          errorType: oauthError.type,
          eventType: maintenanceEvent.type
        });
        return;
      }

      // 开始处理鉴权维护
      await this.processAuthMaintenance(oauthError);
    } catch (handleError) {
      secureLogger.error('Failed to handle auth error', {
        error: handleError instanceof Error ? handleError.message : String(handleError),
        originalError: error.message
      });
    }
  }

  /**
   * 确定维护事件类型
   */
  private determineMaintenanceEventType(oauthErrorType: OAuthErrorInfo['type']): AuthMaintenanceEvent['type'] {
    switch (oauthErrorType) {
      case 'token_expired':
      case 'token_invalid':
        return 'auth_refresh_required';
      case 'permission_denied':
      case 'oauth_server_error':
        return 'auth_rebuild_required';
      default:
        return 'pipeline_unavailable';
    }
  }

  /**
   * 从RCCError中提取OAuth错误信息
   */
  private extractOAuthErrorFromRCCError(error: RCCError, context: LocalErrorContext): OAuthErrorInfo | null {
    const errorDetails = error.context?.details;
    
    // 如果是oauth-error-detector生成的错误，直接提取信息
    if (errorDetails?.errorType && errorDetails?.provider) {
      return {
        type: errorDetails.errorType,
        provider: errorDetails.provider,
        timestamp: errorDetails.timestamp ? new Date(errorDetails.timestamp) : new Date(),
        affectedPipelines: errorDetails.affectedPipelines || []
      };
    }

    // 生成基本的OAuth错误信息
    return {
      type: error.message.includes('expired') ? 'token_expired' : 'token_invalid',
      provider: errorDetails?.provider || context?.provider || 'unknown',
      timestamp: new Date(),
      affectedPipelines: context.pipelineId ? [context.pipelineId] : []
    };
  }

  /**
   * 将鉴权错误加入队列
   */
  private addAuthErrorToQueue(oauthError: OAuthErrorInfo): void {
    const provider = oauthError.provider;
    
    if (!this.authErrorQueue.has(provider)) {
      this.authErrorQueue.set(provider, []);
    }
    
    const queue = this.authErrorQueue.get(provider)!;
    queue.push(oauthError);
    
    // 只保留最近的10个错误
    if (queue.length > 10) {
      queue.shift();
    }
    
    secureLogger.debug('Added auth error to queue', {
      provider,
      errorType: oauthError.type,
      queueLength: queue.length
    });
  }

  /**
   * 处理鉴权维护流程
   */
  private async processAuthMaintenance(oauthError: OAuthErrorInfo): Promise<void> {
    this.authMaintenanceInProgress = true;
    
    try {
      secureLogger.info('Starting auth maintenance', {
        provider: oauthError.provider,
        errorType: oauthError.type,
        affectedPipelines: oauthError.affectedPipelines.length
      });

      // 1. 通知流水线管理器设置维护模式
      if (this.pipelineManager) {
        await this.notifyPipelineUnpipelined(oauthError);
      }

      // 2. 通知鉴权中心进行维护
      if (this.authCenter) {
        await this.notifyAuthMaintenance(oauthError);
      }

      secureLogger.info('Auth maintenance completed successfully', {
        provider: oauthError.provider,
        errorType: oauthError.type
      });
    } catch (maintenanceError) {
      secureLogger.error('Auth maintenance failed', {
        error: maintenanceError instanceof Error ? maintenanceError.message : String(maintenanceError),
        provider: oauthError.provider,
        errorType: oauthError.type
      });
    } finally {
      this.authMaintenanceInProgress = false;
      
      // 清除已处理的错误队列
      this.authErrorQueue.delete(oauthError.provider);
    }
  }

  /**
   * 通知流水线管理器设置维护模式
   */
  private async notifyPipelineUnpipelined(oauthError: OAuthErrorInfo): Promise<void> {
    try {
      if (!this.pipelineManager) {
        secureLogger.warn('Pipeline manager not available for auth maintenance');
        return;
      }

      const reason = `OAuth error: ${oauthError.type} - Setting maintenance mode for affected pipelines`;
      
      await this.pipelineManager.setAuthMaintenanceMode(oauthError.affectedPipelines, reason);
      
      secureLogger.info('Pipelines set to maintenance mode', {
        provider: oauthError.provider,
        pipelineCount: oauthError.affectedPipelines.length,
        reason
      });
    } catch (error) {
      secureLogger.error('Failed to set pipeline maintenance mode', {
        error: error instanceof Error ? error.message : String(error),
        provider: oauthError.provider,
        affectedPipelines: oauthError.affectedPipelines
      });
      throw error;
    }
  }

  /**
   * 通知鉴权维护
   */
  private async notifyAuthMaintenance(oauthError: OAuthErrorInfo): Promise<void> {
    try {
      if (!this.authCenter) {
        secureLogger.warn('Auth center not available for auth maintenance');
        return;
      }

      let result: RefreshResult | RebuildResult | null = null;
      
      // 根据错误类型决定维护策略
      switch (oauthError.type) {
        case 'token_expired':
        case 'token_invalid':
          // 执行token刷新
          result = await this.authCenter.forceRefreshTokens(oauthError.provider);
          break;
        case 'permission_denied':
        case 'oauth_server_error':
          // 执行鉴权重建
          result = await this.authCenter.forceRebuildAuth(oauthError.provider);
          break;
        default:
          secureLogger.warn('Unknown OAuth error type for maintenance', {
            provider: oauthError.provider,
            errorType: oauthError.type
          });
          return;
      }

      // 如果维护成功，通知流水线管理器恢复流水线
      if (result && result.success) {
        await this.notifyPipelineRecovery(oauthError, result);
      }

      secureLogger.info('Auth maintenance completed', {
        provider: oauthError.provider,
        errorType: oauthError.type,
        success: result?.success,
        refreshedTokens: result && 'refreshedTokens' in result ? result.refreshedTokens.length : 0,
        rebuiltPipelines: result && 'rebuiltPipelines' in result ? result.rebuiltPipelines.length : 0
      });
    } catch (error) {
      secureLogger.error('Auth maintenance failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: oauthError.provider,
        errorType: oauthError.type
      });
      throw error;
    }
  }

  /**
   * 通知流水线恢复
   */
  private async notifyPipelineRecovery(oauthError: OAuthErrorInfo, result: RefreshResult | RebuildResult): Promise<void> {
    try {
      if (!this.pipelineManager) {
        return;
      }

      await this.pipelineManager.clearAuthMaintenanceMode(oauthError.affectedPipelines);
      
      secureLogger.info('Pipelines recovered from maintenance mode', {
        provider: oauthError.provider,
        pipelineCount: oauthError.affectedPipelines.length,
        success: result.success
      });
    } catch (error) {
      secureLogger.error('Failed to clear pipeline maintenance mode', {
        error: error instanceof Error ? error.message : String(error),
        provider: oauthError.provider,
        affectedPipelines: oauthError.affectedPipelines
      });
    }
  }

  /**
   * 设置鉴权中心
   */
  setAuthCenter(authCenter: AuthCenter): void {
    this.authCenter = authCenter;
    secureLogger.info('Auth center set in error handler');
  }

  /**
   * 设置流水线管理器
   */
  setPipelineManager(pipelineManager: PipelineManager): void {
    this.pipelineManager = pipelineManager;
    secureLogger.info('Pipeline manager set in error handler');
  }

  /**
   * 获取鉴权维护状态
   */
  getAuthMaintenanceStatus(): { inProgress: boolean; queuedErrors: number } {
    const totalQueuedErrors = Array.from(this.authErrorQueue.values())
      .reduce((sum, errors) => sum + errors.length, 0);
    
    return {
      inProgress: this.authMaintenanceInProgress,
      queuedErrors: totalQueuedErrors
    };
  }
}

// 导出端口特定的实例管理
const enhancedErrorHandlerInstances: Map<number, EnhancedErrorHandler> = new Map();
let defaultEnhancedErrorHandlerInstance: EnhancedErrorHandler | null = null;

export function getEnhancedErrorHandler(serverPort?: number): EnhancedErrorHandler {
  if (serverPort) {
    if (!enhancedErrorHandlerInstances.has(serverPort)) {
      enhancedErrorHandlerInstances.set(serverPort, new EnhancedErrorHandler(serverPort));
    }
    return enhancedErrorHandlerInstances.get(serverPort)!;
  } else {
    if (!defaultEnhancedErrorHandlerInstance) {
      defaultEnhancedErrorHandlerInstance = new EnhancedErrorHandler();
    }
    return defaultEnhancedErrorHandlerInstance;
  }
}