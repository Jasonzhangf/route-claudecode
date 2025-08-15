/**
 * Provider配置加载器
 *
 * 从配置文件加载Provider配置，支持多种格式
 *
 * @author Jason Zhang
 */
import { ProviderConfig } from './provider-factory';
/**
 * 配置文件格式
 */
export type ConfigFormat = 'json' | 'json5' | 'yaml' | 'yml';
/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
    /** 配置文件路径 */
    filePath: string;
    /** 配置格式(自动检测如果不指定) */
    format?: ConfigFormat;
    /** 环境变量前缀，用于覆盖配置 */
    envPrefix?: string;
    /** 验证配置 */
    validate?: boolean;
    /** 调试模式 */
    debug?: boolean;
}
/**
 * 配置文件结构
 */
export interface ProviderConfigFile {
    /** 版本信息 */
    version: string;
    /** Provider配置列表 */
    providers: ProviderConfig[];
    /** 全局配置 */
    global?: {
        /** 调试模式 */
        debug?: boolean;
        /** 日志级别 */
        logLevel?: string;
    };
}
/**
 * Provider配置加载器
 */
export declare class ConfigLoader {
    /**
     * 加载配置文件
     */
    static loadConfig(options: ConfigLoadOptions): Promise<ProviderConfigFile>;
    /**
     * 检测配置文件格式
     */
    private static detectFormat;
    /**
     * 解析配置内容
     */
    private static parseConfig;
    /**
     * 应用环境变量覆盖
     */
    private static applyEnvironmentOverrides;
    /**
     * 验证配置结构
     */
    private static validateConfig;
    /**
     * 验证单个Provider配置
     */
    private static validateProviderConfig;
    /**
     * 保存配置文件
     */
    static saveConfig(config: ProviderConfigFile, filePath: string, format?: ConfigFormat): Promise<void>;
    /**
     * 创建示例配置
     */
    static createExampleConfig(): ProviderConfigFile;
    /**
     * 合并配置文件
     */
    static mergeConfigs(baseConfig: ProviderConfigFile, overrideConfig: Partial<ProviderConfigFile>): ProviderConfigFile;
}
//# sourceMappingURL=config-loader.d.ts.map