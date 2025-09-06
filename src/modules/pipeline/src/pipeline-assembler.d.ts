/**
 * Pipeline Assembler
 *
 * 一次性Pipeline组装器 - 动态组装流水线模块
 *
 * @author Claude Code Router v4.0
 */
import { PipelineConfig } from '../../router/src/router-preprocessor';
import { PipelineAssemblyResult } from './assembly-types';
/**
 * Pipeline组装器
 *
 * 一次性生命周期：启动 → 扫描 → 组装 → 输出 → 销毁
 */
export declare class PipelineAssembler {
    private registry;
    private selectionStrategy;
    private assembledPipelines;
    private isDestroyed;
    constructor();
    /**
     * 组装流水线 - 主要入口方法
     *
     * @param pipelineConfigs 来自RouterPreprocessor的流水线配置数组
     * @returns 组装结果
     */
    assemble(pipelineConfigs: PipelineConfig[]): Promise<PipelineAssemblyResult>;
    /**
     * 销毁组装器
     */
    destroy(): Promise<void>;
    /**
     * 组装单个流水线
     */
    private _assembleSinglePipeline;
    /**
     * 按路由模型分组流水线
     */
    private _groupPipelinesByRouteModel;
    /**
     * 验证所有连接
     */
    private _validateAllConnections;
    /**
     * 执行健康检查
     */
    private _performHealthChecks;
    /**
     * 从routeId提取routeName
     */
    private _extractRouteNameFromRouteId;
    /**
     * 创建失败结果
     */
    private _createFailureResult;
}
//# sourceMappingURL=pipeline-assembler.d.ts.map