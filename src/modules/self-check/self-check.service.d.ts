/**
 * 自检服务实现
 *
 * 实现API密钥验证、token管理、流水线健康检查等核心功能
 *
 * @author Jason Zhang
 * @version 4.0.0
 */
import { ISelfCheckModule } from './self-check.interface';
import { ApiKeyInfo, PipelineCheckResult, AuthCheckResult, SelfCheckConfig, SelfCheckState } from './self-check-types';
import { ModuleStatus, ModuleMetrics, ModuleType } from '../../interfaces/module/base-module';
import { PipelineManager } from '../pipeline/src/pipeline-manager';
/**
 * 自检服务实现类
 */
export declare class SelfCheckService implements ISelfCheckModule {
    private moduleAdapter;
    private config;
    private apiKeyCache;
    private pipelineCheckResults;
    private authCheckResults;
    private state;
    private isInitialized;
    private pipelineManager;
    constructor();
    getId(): string;
    getName(): string;
    getType(): ModuleType;
    getVersion(): string;
    getStatus(): ModuleStatus;
    getMetrics(): ModuleMetrics;
    configure(config: any): Promise<void>;
    reset(): Promise<void>;
    cleanup(): Promise<void>;
    addConnection(module: import("../../interfaces/module/base-module").ModuleInterface): void;
    removeConnection(moduleId: string): void;
    getConnection(moduleId: string): import("../../interfaces/module/base-module").ModuleInterface | undefined;
    getConnections(): import("../../interfaces/module/base-module").ModuleInterface[];
    sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
    broadcastToModules(message: any, type?: string): Promise<void>;
    onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
    on(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(): this;
    start(): Promise<void>;
    stop(): Promise<void>;
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    process(input: any): Promise<any>;
    /**
     * 配置自检模块
     * @param config 自检配置
     */
    configureSelfCheck(config: SelfCheckConfig): Promise<void>;
    /**
     * 设置流水线管理器
     * @param pipelineManager 流水线管理器实例
     */
    setPipelineManager(pipelineManager: PipelineManager): void;
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
     * 执行API密钥验证
     * @param apiKeyId API密钥ID
     * @returns Promise<ApiKeyInfo> API密钥信息
     */
    private performApiKeyValidation;
    /**
     * 验证API密钥（真实的验证逻辑）
     * @param provider 提供商
     * @param apiKey API密钥
     * @returns Promise<boolean> 是否有效
     */
    private verifyApiKey;
    /**
     * 验证Iflow API密钥
     * @param apiKey API密钥
     * @returns boolean 是否有效
     */
    private verifyIflowApiKey;
    /**
     * 验证Qwen API密钥
     * @param apiKey API密钥
     * @returns boolean 是否有效
     */
    private verifyQwenApiKey;
    /**
     * 通用API密钥验证
     * @param apiKey API密钥
     * @returns boolean 是否有效
     */
    private verifyGenericApiKey;
    /**
     * 生成API密钥ID
     * @param provider 提供商
     * @param apiKey API密钥
     * @returns string API密钥ID
     */
    private generateApiKeyID;
    /**
     * 刷新即将过期的token
     * @returns Promise<number> 成功刷新的token数量
     */
    refreshToken(): Promise<number>;
    /**
     * 获取需要刷新的token列表
     * @returns string[] 需要刷新的token ID列表
     */
    private getTokensNeedingRefresh;
    /**
     * 刷新单个token
     * @param tokenId Token ID
     * @returns Promise<boolean> 刷新是否成功
     */
    private refreshSingleToken;
    /**
     * 检查所有流水线的健康状态
     * @returns Promise<PipelineCheckResult[]> 流水线检查结果列表
     */
    checkPipelineHealth(): Promise<PipelineCheckResult[]>;
    /**
     * 将流水线健康状态映射到检查状态
     * @param health 健康状态
     * @returns PipelineCheckStatus 检查状态
     */
    private mapPipelineHealthToCheckStatus;
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
//# sourceMappingURL=self-check.service.d.ts.map