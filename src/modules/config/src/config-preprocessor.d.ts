import { ConfigPreprocessResult } from './routing-table-types';
export { ConfigPreprocessResult } from './routing-table-types';
export declare class ConfigPreprocessor {
    private static systemConfig;
    static preprocess(configPath: string): ConfigPreprocessResult;
    private static _readConfigFile;
    private static _loadSystemConfig;
    private static _parseConfigContent;
    private static _expandProviders;
    private static _generateRoutes;
    private static _normalizeServerConfig;
}
//# sourceMappingURL=config-preprocessor.d.ts.map