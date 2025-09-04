/**
 * RCC v4.0 配置管理模块 - 统一导出接口
 *
 * 零接口暴露设计：只导出公开接口，所有内部实现完全隐藏
 *
 * @author RCC v4.0 Architecture Team
 */
export { ConfigPreprocessor, ConfigPreprocessResult } from './config-preprocessor';
export { RoutingTable, ProviderInfo, RouteMapping } from './routing-table-types';
export declare const MODULE_INFO: {
    readonly name: "config";
    readonly version: "4.1.0";
    readonly description: "RCC v4.0 Configuration Management Module";
    readonly apiVersion: "4.1.0";
    readonly isolationLevel: "complete";
};
//# sourceMappingURL=index.d.ts.map