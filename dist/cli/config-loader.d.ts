/**
 * 配置文件加载器
 *
 * 支持多种配置源的加载和合并：命令行参数、环境变量、配置文件
 *
 * @author Jason Zhang
 */
import { ParsedCommand } from '../interfaces';
/**
 * 配置源类型
 */
export type ConfigSource = 'default' | 'file' | 'env' | 'cli';
/**
 * 配置值定义
 */
export interface ConfigValue {
    value: any;
    source: ConfigSource;
    priority: number;
}
/**
 * 配置加载选项
 */
export interface ConfigLoadOptions {
    configPath?: string;
    envPrefix?: string;
    allowEnvOverride?: boolean;
    validateConfig?: boolean;
}
/**
 * 配置模式定义
 */
export interface ConfigSchema {
    [key: string]: {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array';
        default?: any;
        envVar?: string;
        description?: string;
        required?: boolean;
    };
}
/**
 * 配置加载器
 */
export declare class ConfigLoader {
    private defaultConfig;
    private schema;
    constructor();
    /**
     * 加载并合并配置
     */
    loadConfig(command: ParsedCommand, options?: ConfigLoadOptions): Promise<Record<string, any>>;
    /**
     * 初始化默认配置
     */
    private initializeDefaults;
    /**
     * 初始化配置模式
     */
    private initializeSchema;
    /**
     * 加载配置文件
     */
    private loadConfigFile;
    /**
     * 加载JSON配置文件
     */
    private loadJSONConfig;
    /**
     * 加载YAML配置文件
     */
    private loadYAMLConfig;
    /**
     * 加载TOML配置文件
     */
    private loadTOMLConfig;
    /**
     * 加载环境变量配置
     */
    private loadEnvironmentConfig;
    /**
     * 解析环境变量值
     */
    private parseEnvValue;
    /**
     * 环境变量名转配置键名
     */
    private envToConfigKey;
    /**
     * 合并配置
     */
    private mergeConfig;
    /**
     * 提取最终配置值
     */
    private extractFinalValues;
    /**
     * 验证配置
     */
    private validateConfig;
    /**
     * 验证值类型
     */
    private validateType;
    /**
     * 获取配置源信息
     */
    getConfigSources(config: Record<string, any>): Record<string, ConfigSource>;
    /**
     * 导出配置为环境变量格式
     */
    exportAsEnvVars(config: Record<string, any>, prefix?: string): string[];
    /**
     * 配置键名转环境变量名
     */
    private configToEnvKey;
    /**
     * 格式化环境变量值
     */
    private formatEnvValue;
}
//# sourceMappingURL=config-loader.d.ts.map