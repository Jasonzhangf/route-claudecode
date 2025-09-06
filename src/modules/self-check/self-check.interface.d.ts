/**
 * 自检模块接口
 *
 * 定义自检模块的公共接口和契约
 *
 * @author Jason Zhang
 * @version 4.0.0
 */
import { ModuleInterface } from '../../interfaces/module/base-module';
import { ApiKeyInfo, PipelineCheckResult, AuthCheckResult, SelfCheckConfig, SelfCheckState } from './self-check-types';
/**
 * 自检模块接口
 */
export interface ISelfCheckModule extends ModuleInterface {
    /**
     * 配置自检模块
     * @param config 自检配置
     */
    configureSelfCheck(config: SelfCheckConfig): Promise<void>;
    /**
     * 执行完整的自检流程
     * @returns Promise<boolean> 自检是否成功
     */
    performSelfCheck(): Promise<boolean>;
    /**
     * 验证所有API密钥的有效性
     * @returns Promise<ApiKeyInfo[]> API密钥验证结果列表
     */
    validateAllApiKeys(): Promise<ApiKeyInfo[]>;
    /**
     * 检查特定API密钥的有效性
     * @param apiKeyId API密钥ID
     * @returns Promise<ApiKeyInfo> API密钥信息
     */
    validateApiKey(apiKeyId: string): Promise<ApiKeyInfo>;
    /**
     * 刷新即将过期的token
     * @returns Promise<number> 成功刷新的token数量
     */
    refreshToken(): Promise<number>;
    /**
     * 检查所有流水线的健康状态
     * @returns Promise<PipelineCheckResult[]> 流水线检查结果列表
     */
    checkPipelineHealth(): Promise<PipelineCheckResult[]>;
    /**
     * 销毁无效API密钥相关的流水线
     * @param invalidApiKeyIds 无效的API密钥ID列表
     * @returns Promise<string[]> 被销毁的流水线ID列表
     */
    destroyInvalidPipelines(invalidApiKeyIds: string[]): Promise<string[]>;
    /**
     * 拉黑过期token相关的流水线
     * @param expiredTokenIds 过期的token ID列表
     * @returns Promise<string[]> 被拉黑的流水线ID列表
     */
    blacklistExpiredPipelines(expiredTokenIds: string[]): Promise<string[]>;
    /**
     * 恢复通过认证的流水线
     * @returns Promise<string[]> 恢复的流水线ID列表
     */
    restoreAuthenticatedPipelines(): Promise<string[]>;
    /**
     * 启动动态调度服务器
     * @returns Promise<boolean> 启动是否成功
     */
    startDynamicScheduler(): Promise<boolean>;
    /**
     * 获取认证检查结果
     * @returns Promise<AuthCheckResult[]> 认证检查结果列表
     */
    getAuthCheckResults(): Promise<AuthCheckResult[]>;
    /**
     * 获取自检模块状态
     * @returns Promise<SelfCheckState> 自检模块状态
     */
    getSelfCheckState(): Promise<SelfCheckState>;
    /**
     * 重置自检模块状态
     */
    resetSelfCheck(): Promise<void>;
    /**
     * 清理自检模块资源
     */
    cleanupSelfCheck(): Promise<void>;
}
//# sourceMappingURL=self-check.interface.d.ts.map