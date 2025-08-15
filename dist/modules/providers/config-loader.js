"use strict";
/**
 * Provider配置加载器
 *
 * 从配置文件加载Provider配置，支持多种格式
 *
 * @author Jason Zhang
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const JSON5 = __importStar(require("json5"));
const yaml = __importStar(require("yaml"));
/**
 * Provider配置加载器
 */
class ConfigLoader {
    /**
     * 加载配置文件
     */
    static async loadConfig(options) {
        const { filePath, format, envPrefix, validate = true, debug = false } = options;
        try {
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                throw new Error(`Configuration file not found: ${filePath}`);
            }
            // 读取文件内容
            const fileContent = fs.readFileSync(filePath, 'utf8');
            if (debug) {
                console.log(`[ConfigLoader] Loading configuration from: ${filePath}`);
            }
            // 解析配置
            const parsedConfig = this.parseConfig(fileContent, format || this.detectFormat(filePath));
            // 应用环境变量覆盖
            if (envPrefix) {
                this.applyEnvironmentOverrides(parsedConfig, envPrefix);
            }
            // 验证配置
            if (validate) {
                this.validateConfig(parsedConfig);
            }
            if (debug) {
                console.log(`[ConfigLoader] Loaded ${parsedConfig.providers.length} provider configurations`);
            }
            return parsedConfig;
        }
        catch (error) {
            if (debug) {
                console.error(`[ConfigLoader] Failed to load configuration:`, error);
            }
            throw error;
        }
    }
    /**
     * 检测配置文件格式
     */
    static detectFormat(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.json':
                return 'json';
            case '.json5':
                return 'json5';
            case '.yaml':
                return 'yaml';
            case '.yml':
                return 'yml';
            default:
                return 'json'; // 默认为JSON
        }
    }
    /**
     * 解析配置内容
     */
    static parseConfig(content, format) {
        switch (format) {
            case 'json':
                return JSON.parse(content);
            case 'json5':
                return JSON5.parse(content);
            case 'yaml':
            case 'yml':
                return yaml.parse(content);
            default:
                throw new Error(`Unsupported configuration format: ${format}`);
        }
    }
    /**
     * 应用环境变量覆盖
     */
    static applyEnvironmentOverrides(config, envPrefix) {
        const prefix = envPrefix.toUpperCase();
        // 全局配置覆盖
        if (process.env[`${prefix}_DEBUG`]) {
            if (!config.global)
                config.global = {};
            config.global.debug = process.env[`${prefix}_DEBUG`] === 'true';
        }
        // Provider配置覆盖
        config.providers.forEach((provider, index) => {
            const providerPrefix = `${prefix}_PROVIDER_${index}`;
            // API Key覆盖
            const apiKeyEnv = process.env[`${providerPrefix}_API_KEY`];
            if (apiKeyEnv && provider.config) {
                provider.config.apiKey = apiKeyEnv;
            }
            // 启用状态覆盖
            const enabledEnv = process.env[`${providerPrefix}_ENABLED`];
            if (enabledEnv !== undefined) {
                provider.enabled = enabledEnv === 'true';
            }
        });
    }
    /**
     * 验证配置结构
     */
    static validateConfig(config) {
        const errors = [];
        // 验证版本信息
        if (!config.version) {
            errors.push('Configuration version is required');
        }
        // 验证Provider配置
        if (!config.providers || !Array.isArray(config.providers)) {
            errors.push('Providers configuration must be an array');
        }
        else if (config.providers.length === 0) {
            errors.push('At least one provider configuration is required');
        }
        else {
            // 验证每个Provider配置
            config.providers.forEach((provider, index) => {
                const providerErrors = this.validateProviderConfig(provider, index);
                errors.push(...providerErrors);
            });
        }
        // 检查Provider ID唯一性
        const providerIds = config.providers.map(p => p.id);
        const duplicateIds = providerIds.filter((id, index) => providerIds.indexOf(id) !== index);
        if (duplicateIds.length > 0) {
            errors.push(`Duplicate provider IDs found: ${duplicateIds.join(', ')}`);
        }
        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
        }
    }
    /**
     * 验证单个Provider配置
     */
    static validateProviderConfig(provider, index) {
        const errors = [];
        const prefix = `Provider ${index}`;
        if (!provider.id) {
            errors.push(`${prefix}: ID is required`);
        }
        if (!provider.type) {
            errors.push(`${prefix}: Type is required`);
        }
        if (!provider.name) {
            errors.push(`${prefix}: Name is required`);
        }
        if (typeof provider.enabled !== 'boolean') {
            errors.push(`${prefix}: Enabled must be a boolean`);
        }
        if (!provider.config) {
            errors.push(`${prefix}: Config is required`);
        }
        else {
            // 验证特定协议配置
            if (provider.type === 'openai' || provider.type === 'anthropic') {
                if (!provider.config.apiKey) {
                    errors.push(`${prefix}: API key is required for ${provider.type} provider`);
                }
                if (!provider.config.defaultModel) {
                    errors.push(`${prefix}: Default model is required for ${provider.type} provider`);
                }
            }
        }
        return errors;
    }
    /**
     * 保存配置文件
     */
    static async saveConfig(config, filePath, format) {
        const configFormat = format || this.detectFormat(filePath);
        let content;
        switch (configFormat) {
            case 'json':
                content = JSON.stringify(config, null, 2);
                break;
            case 'json5':
                content = JSON5.stringify(config, null, 2);
                break;
            case 'yaml':
            case 'yml':
                content = yaml.stringify(config);
                break;
            default:
                throw new Error(`Unsupported configuration format: ${configFormat}`);
        }
        // 确保目录存在
        const directory = path.dirname(filePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // 写入文件
        fs.writeFileSync(filePath, content, 'utf8');
    }
    /**
     * 创建示例配置
     */
    static createExampleConfig() {
        return {
            version: "4.0.0",
            global: {
                debug: false,
                logLevel: "info"
            },
            providers: [
                {
                    id: "openai-primary",
                    name: "OpenAI Primary",
                    type: "openai",
                    enabled: true,
                    config: {
                        apiKey: "sk-your-openai-api-key",
                        defaultModel: "gpt-3.5-turbo",
                        timeout: 30000,
                        maxRetries: 3,
                        enableStreaming: true,
                        enableToolCalls: true,
                        debug: false
                    }
                },
                {
                    id: "anthropic-primary",
                    name: "Anthropic Primary",
                    type: "anthropic",
                    enabled: true,
                    config: {
                        apiKey: "your-anthropic-api-key",
                        defaultModel: "claude-3-sonnet-20240229",
                        timeout: 30000,
                        maxRetries: 3,
                        enableToolCalls: true,
                        debug: false
                    }
                }
            ]
        };
    }
    /**
     * 合并配置文件
     */
    static mergeConfigs(baseConfig, overrideConfig) {
        const merged = {
            ...baseConfig,
            ...overrideConfig
        };
        // 合并providers数组
        if (overrideConfig.providers) {
            merged.providers = [...baseConfig.providers, ...overrideConfig.providers];
        }
        // 合并global配置
        if (overrideConfig.global) {
            merged.global = { ...baseConfig.global, ...overrideConfig.global };
        }
        return merged;
    }
}
exports.ConfigLoader = ConfigLoader;
//# sourceMappingURL=config-loader.js.map