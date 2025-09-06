/**
 * 自检模块类型定义
 *
 * 定义自检模块相关的数据结构和接口
 *
 * @author Jason Zhang
 * @version 4.0.0
 */
import { ModuleType } from '../../interfaces/module/base-module';
/**
 * API密钥验证状态
 */
export type ApiKeyStatus = 'valid' | 'invalid' | 'expired' | 'pending' | 'unknown';
/**
 * 认证状态
 */
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'pending' | 'failed';
/**
 * 流水线状态
 */
export type PipelineCheckStatus = 'active' | 'destroyed' | 'blacklisted' | 'pending';
/**
 * API密钥信息
 */
export interface ApiKeyInfo {
    /** API密钥ID */
    id: string;
    /** API密钥值 */
    apiKey: string;
    /** 提供商名称 */
    provider: string;
    /** 密钥状态 */
    status: ApiKeyStatus;
    /** 最后验证时间 */
    lastCheckedAt: Date;
    /** 创建时间 */
    createdAt: Date;
    /** 过期时间（如果适用） */
    expiresAt?: Date;
    /** 相关的流水线ID列表 */
    associatedPipelines: string[];
    /** 验证错误信息 */
    errorMessage?: string;
}
/**
 * 流水线检查结果
 */
export interface PipelineCheckResult {
    /** 流水线ID */
    pipelineId: string;
    /** 流水线状态 */
    status: PipelineCheckStatus;
    /** 关联的API密钥ID */
    apiKeyId?: string;
    /** 检查时间 */
    checkedAt: Date;
    /** 错误信息 */
    errorMessage?: string;
}
/**
 * 认证检查结果
 */
export interface AuthCheckResult {
    /** 认证状态 */
    status: AuthStatus;
    /** 认证类型 */
    authType: 'api_key' | 'oauth' | 'token';
    /** 认证完成时间 */
    completedAt?: Date;
    /** 关联的流水线ID */
    pipelineId?: string;
    /** 认证错误信息 */
    errorMessage?: string;
}
/**
 * 自检配置
 */
export interface SelfCheckConfig {
    /** 是否启用API密钥验证 */
    enableApiKeyValidation: boolean;
    /** API密钥验证间隔（毫秒） */
    apiKeyValidationInterval: number;
    /** 是否启用token刷新 */
    enableTokenRefresh: boolean;
    /** token刷新提前时间（毫秒） */
    tokenRefreshAdvanceTime: number;
    /** 是否启用流水线健康检查 */
    enablePipelineHealthCheck: boolean;
    /** 流水线健康检查间隔（毫秒） */
    pipelineHealthCheckInterval: number;
    /** 自动销毁无效流水线 */
    autoDestroyInvalidPipelines: boolean;
    /** 认证超时时间（毫秒） */
    authTimeout: number;
}
/**
 * 自检结果统计
 */
export interface SelfCheckStatistics {
    /** 总检查次数 */
    totalChecks: number;
    /** 成功检查次数 */
    successfulChecks: number;
    /** 失败检查次数 */
    failedChecks: number;
    /** 最后检查时间 */
    lastCheckAt: Date;
    /** 平均检查耗时（毫秒） */
    averageCheckDuration: number;
}
/**
 * 自检模块状态
 */
export interface SelfCheckState {
    /** 模块ID */
    moduleId: string;
    /** 模块名称 */
    moduleName: string;
    /** 模块类型 */
    moduleType: ModuleType;
    /** 模块版本 */
    version: string;
    /** 是否正在运行 */
    isRunning: boolean;
    /** 上次启动时间 */
    startedAt?: Date;
    /** 统计信息 */
    statistics: SelfCheckStatistics;
    /** 配置信息 */
    config: SelfCheckConfig;
    /** 错误信息列表 */
    errors: string[];
}
//# sourceMappingURL=self-check-types.d.ts.map