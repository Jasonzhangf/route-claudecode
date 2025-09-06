/**
 * RCC v4.0 Router Preprocessor
 *
 * 一次性路由器预处理器 - 零接口暴露设计
 *
 * 设计理念：
 * - 只在系统初始化时运行一次
 * - 唯一的公开方法：preprocess()
 * - 所有内部方法使用下划线前缀，外部无法访问
 * - 输入：配置文件，输出：路由表和流水线配置
 * - 生命周期结束后即销毁，不保留任何引用
 *
 * @author Claude
 */
import { RoutingTable } from './routing-table-types';
/**
 * 流水线配置接口
 */
export interface PipelineConfig {
    pipelineId: string;
    routeId: string;
    provider: string;
    model: string;
    endpoint: string;
    apiKey: string;
    timeout: number;
    maxRetries: number;
    maxTokens?: number;
    layers: PipelineLayer[];
}
/**
 * 流水线层配置
 */
export interface PipelineLayer {
    name: string;
    type: 'client' | 'router' | 'transformer' | 'protocol' | 'server-compatibility' | 'server';
    order: number;
    config: Record<string, any>;
}
/**
 * 路由预处理结果
 */
export interface RouterPreprocessResult {
    success: boolean;
    routingTable?: _InternalRoutingTable;
    pipelineConfigs?: PipelineConfig[];
    errors: string[];
    warnings: string[];
    stats: {
        routesCount: number;
        pipelinesCount: number;
        processingTimeMs: number;
    };
}
/**
 * 内部路由表结构（与现有PipelineRouter兼容）
 */
interface _InternalRoutingTable {
    routes: Record<string, _PipelineRoute[]>;
    defaultRoute: string;
    metadata: {
        configSource: string;
        generatedAt: string;
        preprocessorVersion: string;
    };
}
/**
 * 内部流水线路由定义
 */
interface _PipelineRoute {
    routeId: string;
    routeName: string;
    virtualModel: string;
    provider: string;
    apiKeyIndex: number;
    pipelineId: string;
    isActive: boolean;
    health: 'healthy' | 'degraded' | 'unhealthy';
}
/**
 * 路由器预处理器 - 静态类，零接口暴露
 *
 * 外部只能访问preprocess()方法
 * 所有内部逻辑使用下划线前缀，完全封装
 */
export declare class RouterPreprocessor {
    /**
     * 预处理器版本（内部）
     */
    private static readonly _VERSION;
    /**
     * 默认流水线层配置（内部）
     * 流水线从transformer层开始到server层结束
     */
    private static readonly _DEFAULT_LAYERS;
    /**
     * 路由器预处理主方法 - 唯一的公开接口
     *
     * @param routingTable 来自ConfigPreprocessor的路由表
     * @returns 预处理结果，包含路由表和流水线配置
     */
    static preprocess(routingTable: RoutingTable): Promise<RouterPreprocessResult>;
    /**
     * 验证输入参数（内部方法）
     */
    private static _validateInput;
    /**
     * 生成内部路由表（内部方法）
     */
    private static _generateInternalRoutingTable;
    /**
     * 生成流水线配置（内部方法）
     */
    private static _generatePipelineConfigs;
    /**
     * 生成层配置（内部方法）
     */
    private static _generateLayerConfigs;
    /**
     * 验证生成结果（内部方法）
     */
    private static _validateResults;
}
export {};
//# sourceMappingURL=router-preprocessor.d.ts.map