/**
 * Pipeline Module Interface
 *
 * 统一的模块接口定义，用于Pipeline组装器的动态模块注册
 *
 * @author Claude Code Router v4.0
 */
/**
 * 模块类型枚举
 */
export declare enum ModuleType {
    TRANSFORMER = "transformer",
    PROTOCOL = "protocol",
    SERVER_COMPATIBILITY = "server-compatibility",
    SERVER = "server"
}
/**
 * 模块状态
 */
export interface ModuleStatus {
    id: string;
    name: string;
    type: ModuleType;
    status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
    health: 'healthy' | 'degraded' | 'unhealthy';
    lastActivity?: Date;
    error?: Error;
}
/**
 * 模块性能指标
 */
export interface ModuleMetrics {
    requestsProcessed: number;
    averageProcessingTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
    lastProcessedAt?: Date;
}
/**
 * 统一模块接口
 *
 * 所有Pipeline模块必须实现此接口
 */
export interface ModuleInterface {
    getId(): string;
    getName(): string;
    getType(): ModuleType;
    getVersion(): string;
    getStatus(): ModuleStatus;
    getMetrics(): ModuleMetrics;
    configure(config: any): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    reset(): Promise<void>;
    cleanup(): Promise<void>;
    healthCheck(): Promise<{
        healthy: boolean;
        details: any;
    }>;
    process(input: any): Promise<any>;
    addConnection(module: ModuleInterface): void;
    removeConnection(moduleId: string): void;
    getConnection(moduleId: string): ModuleInterface | undefined;
    getConnections(): ModuleInterface[];
    hasConnection(moduleId: string): boolean;
    clearConnections(): void;
    getConnectionCount(): number;
    sendToModule(targetModuleId: string, message: any, type?: string): Promise<any>;
    broadcastToModules(message: any, type?: string): Promise<void>;
    onModuleMessage(listener: (sourceModuleId: string, message: any, type: string) => void): void;
}
/**
 * 模块注册信息
 */
export interface ModuleRegistration {
    id: string;
    name: string;
    type: ModuleType;
    version: string;
    filePath: string;
    className: string;
    module: ModuleInterface;
    isActive: boolean;
    registeredAt: Date;
}
/**
 * 模块工厂接口
 */
export interface ModuleFactory {
    createModule(type: ModuleType, config?: any): Promise<ModuleInterface>;
    getSupportedTypes(): ModuleType[];
}
//# sourceMappingURL=module-interface.d.ts.map