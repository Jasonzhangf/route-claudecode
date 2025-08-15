/**
 * 基础模块实现
 *
 * 提供ModuleInterface的标准实现基类
 *
 * @author Jason Zhang
 */
import { EventEmitter } from 'events';
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from '../interfaces/module/base-module';
/**
 * 基础模块抽象类
 */
export declare abstract class BaseModule extends EventEmitter implements ModuleInterface {
    protected readonly id: string;
    protected readonly name: string;
    protected readonly type: ModuleType;
    protected readonly version: string;
    protected status: ModuleStatus['status'];
    protected config: any;
    protected metrics: ModuleMetrics;
    protected processingTimes: number[];
    protected errors: Error[];
    constructor(id: string, name: string, type: ModuleType, version?: string);
    /**
     * 获取模块ID
     */
    getId(): string;
    /**
     * 获取模块名称
     */
    getName(): string;
    /**
     * 获取模块类型
     */
    getType(): ModuleType;
    /**
     * 获取模块版本
     */
    getVersion(): string;
    /**
     * 获取模块状态
     */
    getStatus(): ModuleStatus;
    /**
     * 获取模块指标
     */
    getMetrics(): ModuleMetrics;
    /**
     * 配置模块
     */
    configure(config: any): Promise<void>;
    /**
     * 启动模块
     */
    start(): Promise<void>;
    /**
     * 停止模块
     */
    stop(): Promise<void>;
    /**
     * 处理输入
     */
    process(input: any): Promise<any>;
    /**
     * 重置模块
     */
    reset(): Promise<void>;
    /**
     * 清理资源
     */
    cleanup(): Promise<void>;
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    /**
     * 配置处理 - 子类可重写
     */
    protected onConfigure(config: any): Promise<void>;
    /**
     * 启动处理 - 子类可重写
     */
    protected onStart(): Promise<void>;
    /**
     * 停止处理 - 子类可重写
     */
    protected onStop(): Promise<void>;
    /**
     * 处理逻辑 - 子类必须实现
     */
    protected abstract onProcess(input: any): Promise<any>;
    /**
     * 重置处理 - 子类可重写
     */
    protected onReset(): Promise<void>;
    /**
     * 清理处理 - 子类可重写
     */
    protected onCleanup(): Promise<void>;
    /**
     * 健康检查处理 - 子类可重写
     */
    protected onHealthCheck(): Promise<any>;
    /**
     * 记录处理时间
     */
    private recordProcessingTime;
    /**
     * 记录错误
     */
    private recordError;
    /**
     * 更新错误率
     */
    private updateErrorRate;
    /**
     * 计算健康状态
     */
    private calculateHealthStatus;
}
//# sourceMappingURL=base-module-impl.d.ts.map