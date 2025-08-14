/**
 * 配置合并器 - 将用户配置和系统配置合并成完整的V3配置
 * 用户只需要配置基本信息，系统配置自动处理复杂部分
 * 
 * Project owner: Jason Zhang
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigMerger {
    constructor() {
        this.systemConfigDir = path.join(__dirname, '../../../config/system');
        this.loadSystemConfigs();
    }

    /**
     * 加载系统配置文件
     */
    loadSystemConfigs() {
        try {
            // 加载协议映射配置
            const protocolMappingPath = path.join(this.systemConfigDir, 'provider-protocol-mapping.json');
            this.protocolMapping = JSON.parse(fs.readFileSync(protocolMappingPath, 'utf8'));

            // 加载系统默认配置
            const systemDefaultsPath = path.join(this.systemConfigDir, 'system-defaults.json');
            this.systemDefaults = JSON.parse(fs.readFileSync(systemDefaultsPath, 'utf8'));

            console.log('✅ 系统配置加载成功');
        } catch (error) {
            throw new Error(`Failed to load system configs: ${error.message}`);
        }
    }

    /**
     * 合并用户配置和系统配置
     * @param {Object} userConfig - 用户配置
     * @returns {Object} 完整的V3配置
     */
    mergeConfigs(userConfig) {
        try {
            console.log('🔄 开始合并用户配置和系统配置...');

            // 1. 从系统默认配置开始
            const mergedConfig = JSON.parse(JSON.stringify(this.systemDefaults));

            // 2. 合并服务器配置
            mergedConfig.server = {
                ...mergedConfig.server,
                ...userConfig.server
            };

            // 3. 处理providers配置
            mergedConfig.providers = {};
            if (userConfig.providers) {
                for (const [providerName, userProviderConfig] of Object.entries(userConfig.providers)) {
                    mergedConfig.providers[providerName] = this.mergeProviderConfig(
                        providerName, 
                        userProviderConfig
                    );
                }
            }

            // 4. 合并路由配置
            if (userConfig.routing) {
                mergedConfig.routing = {
                    ...mergedConfig.routing,
                    ...userConfig.routing
                };
                // 确保categories字段正确设置
                if (userConfig.routing.categories) {
                    mergedConfig.routing.categories = userConfig.routing.categories;
                }
            }

            // 5. 合并调试配置
            if (userConfig.debug) {
                mergedConfig.debug = {
                    ...mergedConfig.debug,
                    ...userConfig.debug
                };
            }

            // 6. 处理六层架构和预处理配置
            this.configureArchitectureLayers(mergedConfig, userConfig);

            console.log('✅ 配置合并完成');
            console.log(`   - Providers: ${Object.keys(mergedConfig.providers).length}`);
            console.log(`   - Categories: ${Object.keys(mergedConfig.routing.categories || {}).length}`);
            console.log(`   - Architecture: ${mergedConfig.server.architecture}`);
            console.log(`   - Preprocessing: ${mergedConfig.preprocessing.enabled ? 'Enabled' : 'Disabled'}`);

            return mergedConfig;

        } catch (error) {
            throw new Error(`Config merge failed: ${error.message}`);
        }
    }

    /**
     * 合并单个Provider配置
     * @param {string} providerName - Provider名称
     * @param {Object} userProviderConfig - 用户Provider配置
     * @returns {Object} 完整的Provider配置
     */
    mergeProviderConfig(providerName, userProviderConfig) {
        // 从协议映射中获取系统配置，如果没有找到则尝试自动检测
        let protocolConfig = this.protocolMapping.protocolMapping[providerName];
        
        if (!protocolConfig) {
            // 自动检测provider类型
            protocolConfig = this.autoDetectProviderType(userProviderConfig);
            if (!protocolConfig) {
                throw new Error(`Unknown provider type: ${providerName}. Supported providers: ${Object.keys(this.protocolMapping.protocolMapping).join(', ')}`);
            }
        }

        // 合并配置
        const mergedProviderConfig = {
            type: protocolConfig.type,
            endpoint: userProviderConfig.endpoint,
            authentication: {
                ...protocolConfig.authentication
            },
            models: userProviderConfig.models || [],
            timeout: protocolConfig.timeout,
            maxRetries: protocolConfig.maxRetries,
            retryDelay: protocolConfig.retryDelay
        };

        // 处理认证凭据 - 支持单个apiKey或apiKeys数组
        if (userProviderConfig.authentication?.credentials?.apiKeys) {
            // 处理用户配置中的apiKeys数组格式
            mergedProviderConfig.authentication.credentials = {
                apiKeys: userProviderConfig.authentication.credentials.apiKeys
            };
        } else if (userProviderConfig.apiKey) {
            // 处理传统的单个apiKey格式
            if (protocolConfig.authentication.type === 'bearer') {
                mergedProviderConfig.authentication.credentials = {
                    apiKey: [userProviderConfig.apiKey]
                };
            } else if (protocolConfig.authentication.type === 'api-key') {
                mergedProviderConfig.authentication.credentials = {
                    apiKey: [userProviderConfig.apiKey]
                };
            }
        } else if (userProviderConfig.authentication?.credentials) {
            // 直接传递用户的credentials配置
            mergedProviderConfig.authentication.credentials = userProviderConfig.authentication.credentials;
        }

        // 处理AWS CodeWhisperer特殊配置
        if (protocolConfig.authentication.type === 'aws-codewhisperer') {
            mergedProviderConfig.authentication.credentials = {
                profile: userProviderConfig.profile || 'primary'
            };
        }

        return mergedProviderConfig;
    }

    /**
     * 自动检测Provider类型
     * @param {Object} userProviderConfig - 用户Provider配置
     * @returns {Object|null} 检测到的协议配置
     */
    autoDetectProviderType(userProviderConfig) {
        const endpoint = userProviderConfig.endpoint;
        
        if (!endpoint) {
            return null;
        }

        // AWS CodeWhisperer检测
        if (endpoint.includes('codewhisperer') && endpoint.includes('amazonaws.com')) {
            return this.protocolMapping.protocolMapping['codewhisperer-primary'];
        }

        // Google Gemini检测
        if (endpoint.includes('generativelanguage.googleapis.com')) {
            return this.protocolMapping.protocolMapping['google'];
        }

        // Anthropic检测
        if (endpoint.includes('api.anthropic.com')) {
            return this.protocolMapping.protocolMapping['anthropic'];
        }

        // LMStudio特殊处理 (本地无认证)
        if (endpoint.includes('localhost:1234') || endpoint.includes('127.0.0.1:1234')) {
            return this.protocolMapping.protocolMapping['lmstudio'];
        }

        // 所有其他OpenAI兼容服务统一使用openai-compatible
        // 包括ShuaiHong、ModelScope等第三方服务
        if (endpoint.includes('/chat/completions') || endpoint.includes('/v1/')) {
            return this.protocolMapping.protocolMapping['openai-compatible'];
        }

        // 默认假设为OpenAI兼容
        if (endpoint.includes('/chat/completions')) {
            return this.protocolMapping.protocolMapping['lmstudio']; // 使用LMStudio的配置作为默认OpenAI兼容
        }

        return null;
    }

    /**
     * 配置六层架构和预处理功能
     * @param {Object} mergedConfig - 合并后的配置
     * @param {Object} userConfig - 用户配置
     */
    configureArchitectureLayers(mergedConfig, userConfig) {
        // 确保六层架构配置存在
        if (!mergedConfig.layers) {
            mergedConfig.layers = this.systemDefaults.layers;
        }

        // 确保预处理配置存在
        if (!mergedConfig.preprocessing) {
            mergedConfig.preprocessing = this.systemDefaults.preprocessing;
        }

        // 为使用LMStudio的配置启用工具兼容性预处理
        if (userConfig.providers) {
            const hasLMStudio = Object.values(userConfig.providers).some(providerConfig => 
                providerConfig.endpoint?.includes('localhost:1234') ||
                providerConfig.endpoint?.includes('127.0.0.1:1234')
            );

            if (hasLMStudio && mergedConfig.preprocessing.processors['lmstudio-tool-compatibility']) {
                mergedConfig.preprocessing.processors['lmstudio-tool-compatibility'].enabled = true;
                console.log('🔧 为LMStudio启用工具兼容性预处理');
            }
        }

        // 确保六层架构映射
        mergedConfig.architecture = {
            layers: mergedConfig.layers,
            flow: [
                'client',
                'router', 
                'postProcessor',
                'transformer',
                'providerProtocol',
                'preprocessor'
            ]
        };
    }

    /**
     * 从文件加载用户配置并合并
     * @param {string} userConfigPath - 用户配置文件路径
     * @returns {Object} 完整的V3配置
     */
    loadAndMerge(userConfigPath) {
        try {
            console.log(`📋 加载用户配置: ${userConfigPath}`);
            
            if (!fs.existsSync(userConfigPath)) {
                throw new Error(`User config file not found: ${userConfigPath}`);
            }

            const userConfigContent = fs.readFileSync(userConfigPath, 'utf8');
            const userConfig = JSON.parse(userConfigContent);

            return this.mergeConfigs(userConfig);

        } catch (error) {
            throw new Error(`Failed to load and merge config: ${error.message}`);
        }
    }

    /**
     * 验证合并后的配置
     * @param {Object} config - 合并后的配置
     * @returns {boolean} 验证是否通过
     */
    validateMergedConfig(config) {
        try {
            const required = this.systemDefaults.validation.required;
            
            for (const requiredPath of required) {
                const pathParts = requiredPath.split('.');
                let current = config;
                
                for (const part of pathParts) {
                    if (!current || typeof current !== 'object' || !(part in current)) {
                        throw new Error(`Missing required configuration: ${requiredPath}`);
                    }
                    current = current[part];
                }
            }

            console.log('✅ 配置验证通过');
            return true;

        } catch (error) {
            console.error('❌ 配置验证失败:', error.message);
            return false;
        }
    }
}

/**
 * 便捷函数：加载并合并配置
 * @param {string} userConfigPath - 用户配置文件路径
 * @returns {Object} 完整的V3配置
 */
export function loadUserConfig(userConfigPath) {
    const merger = new ConfigMerger();
    const mergedConfig = merger.loadAndMerge(userConfigPath);
    
    if (!merger.validateMergedConfig(mergedConfig)) {
        throw new Error('Configuration validation failed');
    }
    
    return mergedConfig;
}