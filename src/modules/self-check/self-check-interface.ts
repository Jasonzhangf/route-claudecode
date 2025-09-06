/**
 * 自检模块接口定义
 *
 * 负责验证API密钥和token的有效性，处理认证和流水线管理
 *
 * @author Jason Zhang
 * @version 4.0.0
 */

import { ModuleInterface, ModuleStatus, ModuleMetrics } from '../interfaces/module/base-module';

/**
 * API密钥信息
 */
export interface ApiKeyInfo {
  /** API密钥 */
  apiKey: string;
  /** 提供商名称 */
  provider: string;
  /** 密钥状态 */
  status: 'valid' | 'invalid' | 'expired' | 'unknown';
  /** 最后验证时间 */
  lastChecked: Date;
  /** 过期时间（如果适用） */
  expiresAt?: Date;
  /** 相关的流水线ID列表 */
  pipelineIds: string[];
}

/**
 * 自检结果
 */
export interface SelfCheckResult {
  /** 自检是否成功 */
  success: boolean;
  /** API密钥验证结果 */
  apiKeyValidation: {
    /** 有效的API密钥数量 */
    validCount: number;
    /** 无效的API密钥数量 */
    invalidCount: number;
    /** 过期的API密钥数量 */
    expiredCount: number;
    /** 详细信息 */
    details: ApiKeyInfo[];
  };
  /** 流水线状态 */
  pipelineStatus: {
    /** 活跃的流水线数量 */
    activeCount: number;
    /** 被销毁的流水线数量 */
    destroyedCount: number;
    /** 暂时拉黑的流水线数量 */
    blacklistedCount: number;
  };
  /** 认证状态 */
  authStatus: {
    /** 是否需要认证 */
    requiresAuth: boolean;
    /** 认证连接状态 */
    authConnectionActive: boolean;
    /** 认证完成的流水线数量 */
    authCompletedCount: number;
  };
  /** 错误信息（如果有） */
  errors?: string[];
}

/**
 * 自检模块接口
 */
export interface SelfCheckModule extends ModuleInterface {
  /**
   * 获取模块状态 - 重写基接口方法以确保类型兼容
   * @returns ModuleStatus 标准模块状态
   */
  getStatus(): ModuleStatus;

  /**
   * 验证所有API密钥的有效性
   * @returns Promise<SelfCheckResult> 自检结果
   */
  validateApiKeys(): Promise<SelfCheckResult>;

  /**
   * 获取详细的自检结果
   * @returns Promise<SelfCheckResult> 详细的自检结果
   */
  getSelfCheckResult(): Promise<SelfCheckResult>;

  /**
   * 刷新过期的token
   * @returns Promise<boolean> 刷新是否成功
   */
  refreshToken(): Promise<boolean>;

  /**
   * 检查特定API密钥的有效性
   * @param apiKey API密钥
   * @param provider 提供商名称
   * @returns Promise<boolean> 是否有效
   */
  checkApiKeyValidity(apiKey: string, provider: string): Promise<boolean>;

  /**
   * 销毁无效API密钥相关的流水线
   * @param invalidApiKeys 无效的API密钥列表
   * @returns Promise<number> 销毁的流水线数量
   */
  destroyInvalidPipelines(invalidApiKeys: string[]): Promise<number>;

  /**
   * 拉黑过期token相关的流水线
   * @param expiredTokens 过期的token列表
   * @returns Promise<string[]> 被拉黑的流水线ID列表
   */
  blacklistExpiredPipelines(expiredTokens: string[]): Promise<string[]>;

  /**
   * 恢复通过认证的流水线
   * @returns Promise<number> 恢复的流水线数量
   */
  restoreAuthenticatedPipelines(): Promise<number>;

  /**
   * 启动动态调度服务器
   * @returns Promise<boolean> 启动是否成功
   */
  startDynamicScheduler(): Promise<boolean>;

  /**
   * 获取当前自检状态
   * @returns Promise<SelfCheckResult> 当前状态
   */
  getStatus(): Promise<SelfCheckResult>;
}