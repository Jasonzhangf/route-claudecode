/**
 * Provider模块系统统一导出
 *
 * 提供完整的Provider管理解决方案，包括协议处理、服务管理、监控和测试
 *
 * @author Jason Zhang
 */
export * from './provider-service';
export * from './provider-manager';
export * from './provider-factory';
export * from './config-loader';
export * from './openai-protocol-handler';
export * from './anthropic-protocol-handler';
export * from './monitoring';
import { ProviderService } from './provider-service';
import { CompleteMonitoringSystem, DashboardConfig } from './monitoring';
/**
 * Provider模块完整系统
 *
 * 集成所有Provider相关功能的统一管理类
 */
export declare class ProviderModuleSystem {
    private providerService;
    private monitoringSystem;
    private isInitialized;
    private isRunning;
    constructor();
    /**
     * 初始化Provider模块系统
     */
    initialize(config: {
        providers: any;
        monitoring?: {
            enabled: boolean;
            dashboard?: DashboardConfig;
        };
        testing?: {
            runOnStartup: boolean;
            quickValidation: boolean;
        };
    }): Promise<void>;
    /**
     * 启动Provider模块系统
     */
    start(): Promise<void>;
    /**
     * 停止Provider模块系统
     */
    stop(): Promise<void>;
    /**
     * 重启Provider模块系统
     */
    restart(): Promise<void>;
    /**
     * 获取Provider服务
     */
    getProviderService(): ProviderService;
    /**
     * 获取监控系统
     */
    getMonitoringSystem(): CompleteMonitoringSystem;
    /**
     * 获取测试套件
     */
    /**
     * 获取系统状态
     */
    getStatus(): {
        initialized: boolean;
        running: boolean;
        providerService: any;
        monitoring: any;
        health: 'healthy' | 'degraded' | 'unhealthy';
    };
    /**
     * 运行健康检查
     */
    healthCheck(): Promise<{
        status: 'pass' | 'warn' | 'fail';
        checks: Array<{
            name: string;
            status: 'pass' | 'warn' | 'fail';
            message?: string;
            duration: number;
        }>;
        timestamp: number;
    }>;
    /**
     * 运行快速验证
     */
    runQuickValidation(): Promise<{
        success: boolean;
        errors: string[];
        warnings: string[];
        duration: number;
    }>;
    /**
     * 获取监控仪表板URL
     */
    getDashboardUrl(): string | null;
}
/**
 * 创建Provider模块系统的便捷函数
 */
export declare function createProviderModuleSystem(): ProviderModuleSystem;
/**
 * 快速启动Provider模块系统的便捷函数
 */
export declare function quickStartProviderSystem(config: {
    providers: any;
    monitoring?: boolean;
    dashboard?: DashboardConfig;
    runTests?: boolean;
}): Promise<ProviderModuleSystem>;
//# sourceMappingURL=index.d.ts.map