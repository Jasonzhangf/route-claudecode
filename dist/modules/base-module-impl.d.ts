/**
 * 基础模块实现
 *
 * 提供ModuleInterface的标准实现基类
 *
 * @author Jason Zhang
 */
import { EventEmitter } from 'events';
import { ModuleInterface, ModuleType, ModuleStatus, ModuleMetrics } from './interfaces/module/base-module';
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
    protected connections: Map<string, ModuleInterface>;
    protected errors: Error[];
    protected messageHandlers: Array<(sourceModuleId: string, message: any, type: string) => void>;
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
    /**
     * 处理模块间消息
     */
    private handleInterModuleMessage;
    /**
     * 添加模块连接
     */
    addConnection(module: ModuleInterface): void;
    /**
     * 移除模块连接
     */
    removeConnection(moduleId: string): void;
    /**
     * 获取指定模块连接
     */
    getConnection(moduleId: string): ModuleInterface | undefined;
    /**
     * 获取所有连接
     */
    getConnections(): ModuleInterface[];
    /**
     * 向连接的模块广播消息
     */
    broadcastToConnected(message: any): Promise<void>;
    /**
     * 获取连接状态
     */
    getConnectionStatus(targetModuleId: string): 'connected' | 'disconnected' | 'connecting' | 'error';
    /**
     * 发送消息到目标模块
     */
    sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
    /**
     * 广播消息到所有连接的模块
     */
    broadcastToModules(message: any, type?: string): Promise<void>;
    /**
     * 监听来自其他模块的消息
     */
    onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
    /**
     * 验证连接
     */
    validateConnection(targetModule: ModuleInterface): boolean;
}
//# sourceMappingURL=base-module-impl.d.ts.map