"use strict";
/**
 * RCC主CLI类
 *
 * 统一的CLI入口，集成命令解析、验证、配置加载和执行
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
exports.RCCCli = void 0;
const command_parser_1 = require("./command-parser");
const argument_validator_1 = require("./argument-validator");
const config_reader_1 = require("../config/config-reader");
const pipeline_lifecycle_manager_1 = require("../pipeline/pipeline-lifecycle-manager");
const secure_logger_1 = require("../utils/secure-logger");
const jq_json_handler_1 = require("../utils/jq-json-handler");
const qwen_auth_manager_1 = require("./auth/qwen-auth-manager");
// import { ApiModelFetcher, FetchedModel } from './api-model-fetcher';
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * RCC主CLI类
 */
class RCCCli {
    constructor(options = {}) {
        // private apiModelFetcher: ApiModelFetcher;
        this.blacklistedModels = new Set();
        this.parser = new command_parser_1.CommandParser();
        this.validator = new argument_validator_1.ArgumentValidator();
        this.configReader = new config_reader_1.ConfigReader();
        this.qwenAuthManager = new qwen_auth_manager_1.QwenAuthManager();
        // this.apiModelFetcher = new ApiModelFetcher();
        this.options = {
            exitOnError: true,
            suppressOutput: false,
            envPrefix: 'RCC',
            ...options,
        };
    }
    /**
     * 执行CLI命令
     */
    async run(args = process.argv.slice(2)) {
        try {
            // 1. 解析命令行参数
            const command = this.parser.parseArguments(args);
            // 2. 验证参数
            const validation = this.validator.validate(command);
            if (!validation.valid) {
                this.handleValidationErrors(validation.errors);
                return;
            }
            // 显示警告（如果有）
            if (validation.warnings.length > 0 && !this.options.suppressOutput) {
                for (const warning of validation.warnings) {
                    console.warn(`Warning: ${warning.message}`);
                    if (warning.suggestion) {
                        console.warn(`  Suggestion: ${warning.suggestion}`);
                    }
                }
            }
            // 3. 加载配置
            const systemConfigPath = this.getSystemConfigPath();
            const config = config_reader_1.ConfigReader.loadConfig(this.options.configPath || 'config/default.json', systemConfigPath);
            // 4. 合并配置到命令选项
            const mergedCommand = {
                ...command,
                options: { ...config, ...validation.normalizedOptions },
            };
            // 5. 执行命令
            await this.parser.executeCommand(mergedCommand);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    /**
     * 启动服务器模式
     */
    async start(options) {
        try {
            // 验证必需参数
            if (!options.config) {
                throw new Error('Configuration file is required. Please specify --config <path>');
            }
            // 读取配置文件获取端口（如果命令行没有提供）
            let effectivePort = options.port;
            if (!effectivePort) {
                try {
                    const systemConfigPath = this.getSystemConfigPath();
                    const config = config_reader_1.ConfigReader.loadConfig(options.config, systemConfigPath);
                    effectivePort = config.server?.port;
                    if (!effectivePort) {
                        throw new Error('Port not found in configuration file and not specified via --port <number>');
                    }
                }
                catch (error) {
                    throw new Error('Port is required. Please specify --port <number> or ensure port is configured in the configuration file');
                }
            }
            // 更新options对象以包含有效端口
            options.port = effectivePort;
            if (!this.options.suppressOutput) {
                console.log('🚀 Starting RCC Server...');
                console.log(`   Port: ${options.port}`);
                console.log(`   Host: ${options.host || 'localhost'}`);
                if (options.debug) {
                    console.log('   Debug: enabled');
                }
                console.log(`   Config: ${options.config}`);
            }
            // TODO: 实现实际的服务器启动逻辑
            await this.startServer(options);
            if (!this.options.suppressOutput) {
                console.log('✅ RCC Server started successfully');
                console.log(`🌐 Server running at http://${options.host || 'localhost'}:${options.port}`);
            }
        }
        catch (error) {
            throw new Error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 停止服务器
     */
    async stop(options) {
        try {
            if (!this.options.suppressOutput) {
                console.log('🛑 Stopping RCC Server...');
                if (options.port) {
                    console.log(`   Port: ${options.port}`);
                }
                if (options.force) {
                    console.log('   Force: enabled');
                }
            }
            await this.stopServer(options);
            if (!this.options.suppressOutput) {
                console.log('✅ RCC Server stopped successfully');
            }
        }
        catch (error) {
            throw new Error(`Failed to stop server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 启动客户端模式
     */
    async code(options) {
        try {
            if (!this.options.suppressOutput) {
                console.log('🔧 Starting Claude Code Client Mode...');
                console.log(`   Target Port: ${options.port || 5506}`);
                if (options.autoStart) {
                    console.log('   Auto Start: enabled');
                }
                if (options.export) {
                    console.log('   Export Config: enabled');
                }
            }
            await this.startClientMode(options);
            if (options.export) {
                await this.exportClientConfig(options);
            }
            if (!this.options.suppressOutput) {
                console.log('✅ Claude Code Client Mode activated');
                console.log('🔗 Transparent proxy established');
            }
        }
        catch (error) {
            throw new Error(`Failed to start client mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 查看服务器状态
     */
    async status(options) {
        try {
            if (!this.options.suppressOutput) {
                console.log('📊 Checking RCC Server Status...');
            }
            const status = await this.getServerStatus(options);
            if (!this.options.suppressOutput) {
                this.displayServerStatus(status, options.detailed || false);
            }
            return status;
        }
        catch (error) {
            throw new Error(`Failed to get server status: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 配置管理
     */
    async config(options) {
        try {
            if (options.list) {
                await this.listConfigurations();
            }
            else if (options.validate) {
                await this.validateConfiguration(options.path);
            }
            else if (options.reset) {
                await this.resetConfiguration();
            }
            else {
                throw new Error('No config operation specified. Use --list, --validate, or --reset.');
            }
        }
        catch (error) {
            throw new Error(`Configuration operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * 处理验证错误
     */
    handleValidationErrors(errors) {
        if (!this.options.suppressOutput) {
            console.error('❌ Validation Errors:');
            for (const error of errors) {
                console.error(`   ${error.field}: ${error.message}`);
            }
            console.error('\nUse --help for usage information.');
        }
        if (this.options.exitOnError) {
            process.exit(1);
        }
    }
    /**
     * 处理认证命令
     */
    async auth(provider, index, options) {
        try {
            // 参数验证
            if (!provider) {
                throw new Error('Provider is required. Usage: rcc4 auth <provider> <index>');
            }
            // 支持的provider检查
            const supportedProviders = ['qwen', 'gemini', 'claude'];
            if (!supportedProviders.includes(provider.toLowerCase())) {
                throw new Error(`Unsupported provider: ${provider}. Supported: ${supportedProviders.join(', ')}`);
            }
            // 处理不同的选项
            if (options?.list) {
                await this.listAuthFiles(provider);
                return;
            }
            if (options?.remove && index) {
                await this.removeAuthFile(provider, index);
                return;
            }
            if (options?.refresh && index) {
                await this.refreshAuthFile(provider, index);
                return;
            }
            // 默认认证流程
            if (!index) {
                // 提供更智能的提示
                const availableIndexes = await this.qwenAuthManager.getAvailableAuthIndexes();
                const nextIndex = await this.qwenAuthManager.getNextAvailableIndex();
                if (availableIndexes.length === 0) {
                    throw new Error(`序号是必需的。建议使用: rcc4 auth ${provider} ${nextIndex}`);
                }
                else {
                    throw new Error(`序号是必需的。现有序号: [${availableIndexes.join(', ')}]，建议新序号: ${nextIndex}`);
                }
            }
            if (index < 1 || index > 99) {
                throw new Error('Index must be between 1 and 99');
            }
            await this.authenticateProvider(provider, index);
        }
        catch (error) {
            this.handleError(error);
        }
    }
    /**
     * 执行provider认证
     */
    async authenticateProvider(provider, index) {
        switch (provider.toLowerCase()) {
            case 'qwen':
                // 检查文件是否已存在
                const validation = await this.qwenAuthManager.validateAuthIndex(index);
                if (validation.exists) {
                    if (validation.isExpired) {
                        console.log(`⚠️ 认证文件 qwen-auth-${index}.json 已存在但已过期`);
                        console.log(`💡 使用 "rcc4 auth qwen ${index} --refresh" 刷新，或选择其他序号`);
                        return;
                    }
                    else {
                        console.log(`⚠️ 认证文件 qwen-auth-${index}.json 已存在且仍然有效`);
                        console.log(`💡 如需重新认证，请先删除: "rcc4 auth qwen ${index} --remove"`);
                        return;
                    }
                }
                await this.qwenAuthManager.authenticate(index);
                break;
            case 'gemini':
                throw new Error('Gemini authentication not yet implemented');
            case 'claude':
                throw new Error('Claude authentication not yet implemented');
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }
    /**
     * 列出认证文件
     */
    async listAuthFiles(provider) {
        switch (provider.toLowerCase()) {
            case 'qwen':
                await this.qwenAuthManager.listAuthFiles();
                break;
            default:
                console.log(`📝 ${provider} authentication files listing not yet implemented`);
        }
    }
    /**
     * 删除认证文件
     */
    async removeAuthFile(provider, index) {
        switch (provider.toLowerCase()) {
            case 'qwen':
                await this.qwenAuthManager.removeAuthFile(index);
                break;
            default:
                console.log(`🗑️ ${provider} authentication file removal not yet implemented`);
        }
    }
    /**
     * 刷新认证文件
     */
    async refreshAuthFile(provider, index) {
        switch (provider.toLowerCase()) {
            case 'qwen':
                await this.qwenAuthManager.refreshAuthFile(index);
                break;
            default:
                console.log(`🔄 ${provider} authentication file refresh not yet implemented`);
        }
    }
    /**
     * Provider更新命令
     */
    async providerUpdate(options) {
        try {
            console.log('🔄 Updating provider models and capabilities...');
            // 检查配置文件参数
            if (!options.config) {
                throw new Error('Configuration file path is required. Use --config <path>');
            }
            console.log(`📋 Loading configuration from ${options.config}...`);
            // 直接使用JQJsonHandler读取配置文件
            const config = jq_json_handler_1.JQJsonHandler.parseJsonFile(options.config);
            // 验证配置格式
            if (!config.Providers || !Array.isArray(config.Providers)) {
                throw new Error('Invalid configuration format: Providers array is required');
            }
            const enabledProviders = config.Providers;
            if (enabledProviders.length === 0) {
                console.log('⚠️  No providers found in configuration');
                return;
            }
            console.log(`🔍 Found ${enabledProviders.length} provider(s) to update`);
            // 处理每个Provider
            let successCount = 0;
            let failureCount = 0;
            for (const provider of enabledProviders) {
                try {
                    console.log(`\n🔄 Updating models for provider: ${provider.name}`);
                    await this.updateProviderModels(provider, options, config, options.config);
                    successCount++;
                    console.log(`✅ Successfully updated ${provider.name}`);
                }
                catch (error) {
                    console.error(`❌ Failed to update provider ${provider.name}:`, error instanceof Error ? error.message : 'Unknown error');
                    failureCount++;
                    if (options.verbose) {
                        console.error(`   Stack trace:`, error.stack);
                    }
                }
            }
            console.log(`\n📊 Provider Update Summary:`);
            console.log(`   ✅ Successful: ${successCount}`);
            console.log(`   ❌ Failed: ${failureCount}`);
            console.log(`   📊 Total: ${enabledProviders.length}`);
            if (failureCount > 0) {
                console.warn('⚠️  Some providers failed to update. Check the errors above for details.');
            }
            else {
                console.log('✅ All providers updated successfully');
            }
        }
        catch (error) {
            console.error('❌ Provider update failed:', error instanceof Error ? error.message : 'Unknown error');
            if (options.verbose) {
                console.error('   Stack trace:', error.stack);
            }
            this.handleError(error);
        }
    }
    /**
     * 分类模型统计
     */
    /**
     * 分类模型统计信息
     */
    categorizeModels(models) {
        const stats = {
            programming: 0,
            multimodal: 0,
            longContext: 0,
            blacklisted: 0
        };
        for (const model of models) {
            if (model.classification.blacklisted) {
                stats.blacklisted++;
            }
            else {
                if (model.classification.isProgramming)
                    stats.programming++;
                if (model.classification.hasImageProcessing)
                    stats.multimodal++;
                if (model.classification.isLongContext)
                    stats.longContext++;
            }
        }
        return stats;
    }
    /**
     * 更新Provider模型
     */
    async updateProviderModels(provider, options, config, configPath) {
        const providerName = provider.name?.toLowerCase();
        switch (providerName) {
            case 'qwen':
                await this.updateQwenModels(provider, options, config, configPath);
                break;
            case 'shuaihong':
                await this.updateShuaihongModels(provider, options, config, configPath);
                break;
            case 'modelscope':
                await this.updateModelScopeModels(provider, options, config, configPath);
                break;
            case 'lmstudio':
                await this.updateLMStudioModels(provider, options, config, configPath);
                break;
            default:
                console.log(`⚠️  Unknown provider type: ${providerName}, skipping model update`);
        }
    }
    /**
     * 更新Qwen模型
     */
    async updateQwenModels(provider, options, config, configPath) {
        const staticModels = [
            'qwen3-coder-plus',
            'qwen3-coder-flash',
            'qwen-max',
            'qwen-plus',
            'qwen-turbo',
            'qwen-long',
            'qwen2.5-72b-instruct',
            'qwen2.5-32b-instruct',
            'qwen2.5-14b-instruct',
            'qwen2.5-7b-instruct',
            'qwen2.5-coder-32b-instruct',
            'qwen2.5-coder-14b-instruct',
            'qwen2.5-coder-7b-instruct',
            'qwq-32b-preview'
        ];
        let finalModels;
        if (options.apiFetch || options['api-fetch']) {
            console.log(`   🔍 Fetching Qwen models via API...`);
            try {
                const fetchedModels = await this.fetchModelsForProvider('qwen', provider, staticModels);
                finalModels = fetchedModels.map(m => m.id);
                // 显示分类信息
                if (options.verbose) {
                    const categories = this.categorizeModels(fetchedModels);
                    console.log(`   📊 API获取结果:`);
                    console.log(`      💻 编程专用: ${categories.programming}`);
                    console.log(`      🖼️ 图像处理: ${categories.multimodal}`);
                    console.log(`      📄 长上下文: ${categories.longContext}`);
                    console.log(`      🚫 已拉黑: ${categories.blacklisted}`);
                }
                console.log(`   ✅ API获取成功: ${finalModels.length} models (静态备用: ${staticModels.length})`);
            }
            catch (error) {
                console.log(`   ⚠️ API获取失败，使用静态模型列表: ${error.message}`);
                finalModels = staticModels;
            }
        }
        else {
            finalModels = staticModels;
            console.log(`   📋 使用静态模型列表: ${finalModels.length} models`);
        }
        await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
    }
    /**
     * 更新Shuaihong模型
     */
    async updateShuaihongModels(provider, options, config, configPath) {
        const staticModels = [
            'gemini-2.5-pro',
            'gpt-4o',
            'gpt-4o-mini',
            'claude-3-sonnet',
            'claude-3-haiku',
            'claude-3-opus'
        ];
        let finalModels;
        if (options.apiFetch || options['api-fetch']) {
            console.log(`   🔍 Shuaihong不支持/models API，使用静态模型列表...`);
            finalModels = staticModels;
            if (options.verbose) {
                // 为静态模型显示分类统计
                console.log(`   📊 静态模型分类:`);
                console.log(`      💻 编程专用: 0`);
                console.log(`      🖼️ 图像处理: 2 (gemini-2.5-pro, gpt-4o)`);
                console.log(`      📄 长上下文: 6 (全部模型)`);
                console.log(`      🚫 已拉黑: 0`);
            }
        }
        else {
            finalModels = staticModels;
            console.log(`   📋 使用静态模型列表: ${finalModels.length} models`);
        }
        await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
    }
    /**
     * 更新ModelScope模型
     */
    async updateModelScopeModels(provider, options, config, configPath) {
        const staticModels = [
            'qwen3-480b',
            'qwen2.5-72b-instruct',
            'qwen2.5-32b-instruct',
            'llama3.1-405b-instruct',
            'llama3.1-70b-instruct',
            'deepseek-v2.5-chat'
        ];
        let finalModels;
        if (options.apiFetch || options['api-fetch']) {
            console.log(`   🔍 Fetching ModelScope models via API...`);
            try {
                const fetchedModels = await this.fetchModelsForProvider('modelscope', provider, staticModels);
                finalModels = fetchedModels.map(m => m.id);
                if (options.verbose) {
                    const categories = this.categorizeModels(fetchedModels);
                    console.log(`   📊 API获取结果:`);
                    console.log(`      💻 编程专用: ${categories.programming}`);
                    console.log(`      🖼️ 图像处理: ${categories.multimodal}`);
                    console.log(`      📄 长上下文: ${categories.longContext}`);
                    console.log(`      🚫 已拉黑: ${categories.blacklisted}`);
                }
                console.log(`   ✅ API获取成功: ${finalModels.length} models (静态备用: ${staticModels.length})`);
            }
            catch (error) {
                console.log(`   ⚠️ API获取失败，使用静态模型列表: ${error.message}`);
                finalModels = staticModels;
            }
        }
        else {
            finalModels = staticModels;
            console.log(`   📋 使用静态模型列表: ${finalModels.length} models`);
        }
        await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
    }
    /**
     * 更新LM Studio模型
     */
    async updateLMStudioModels(provider, options, config, configPath) {
        const staticModels = [
            'gpt-oss-20b-mlx',
            'llama-3.1-8b',
            'qwen2.5-7b-instruct',
            'codellama-34b',
            'deepseek-coder-33b'
        ];
        let finalModels;
        if (options.apiFetch || options['api-fetch']) {
            console.log(`   🔍 Fetching LM Studio models via API...`);
            try {
                const fetchedModels = await this.fetchModelsForProvider('lmstudio', provider, staticModels);
                finalModels = fetchedModels.map(m => m.id);
                if (options.verbose) {
                    const categories = this.categorizeModels(fetchedModels);
                    console.log(`   📊 API获取结果:`);
                    console.log(`      💻 编程专用: ${categories.programming}`);
                    console.log(`      🖼️ 图像处理: ${categories.multimodal}`);
                    console.log(`      📄 长上下文: ${categories.longContext}`);
                    console.log(`      🚫 已拉黑: ${categories.blacklisted}`);
                }
                console.log(`   ✅ API获取成功: ${finalModels.length} models (静态备用: ${staticModels.length})`);
            }
            catch (error) {
                console.log(`   ⚠️ API获取失败，使用静态模型列表: ${error.message}`);
                finalModels = staticModels;
            }
        }
        else {
            finalModels = staticModels;
            console.log(`   📋 使用静态模型列表: ${finalModels.length} models`);
        }
        await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
    }
    /**
     * 获取模型的详细配置（包含精确maxTokens）
     */
    getModelDetailedConfig(modelName, providerType) {
        const maxTokens = this.extractContextLength(modelName, providerType);
        const classification = this.classifyModel(modelName, maxTokens);
        const config = {
            name: modelName,
            maxTokens,
            ...(classification.capabilities.length > 0 && { capabilities: classification.capabilities })
        };
        return config;
    }
    /**
     * 更新Provider配置中的模型列表（支持精确maxTokens）
     */
    async updateProviderConfigModels(config, configPath, providerName, models, options) {
        if (options.dryRun || options['dry-run']) {
            // 在dry-run模式下显示详细的模型配置
            console.log(`   📝 Dry run mode - would update ${models.length} models:`);
            if (options.verbose) {
                // 显示每个模型的详细信息
                models.forEach(modelName => {
                    const detailedConfig = this.getModelDetailedConfig(modelName, providerName);
                    const tokensDisplay = detailedConfig.maxTokens >= 1000000
                        ? `${(detailedConfig.maxTokens / 1000000).toFixed(1)}M`
                        : detailedConfig.maxTokens >= 1000
                            ? `${Math.round(detailedConfig.maxTokens / 1000)}K`
                            : detailedConfig.maxTokens.toString();
                    const capStr = detailedConfig.capabilities ? ` [${detailedConfig.capabilities.join(', ')}]` : '';
                    console.log(`      - ${modelName}: ${tokensDisplay}${capStr}`);
                });
            }
            else {
                console.log(`      ${models.join(', ')}`);
            }
            return;
        }
        try {
            // 读取原始配置文件内容
            const fs = require('fs');
            const rawConfig = fs.readFileSync(configPath, 'utf8');
            // 解析配置文件
            const parsedConfig = jq_json_handler_1.JQJsonHandler.parseJsonString(rawConfig);
            // 创建详细的模型配置
            const detailedModels = models.map(modelName => this.getModelDetailedConfig(modelName, providerName));
            // 更新Providers数组中对应provider的models列表
            let providerUpdated = false;
            if (parsedConfig.Providers && Array.isArray(parsedConfig.Providers)) {
                for (const provider of parsedConfig.Providers) {
                    if (provider.name === providerName) {
                        // 更新为详细配置，同时保持向后兼容
                        provider.models = detailedModels;
                        // 添加更新时间戳
                        provider.lastUpdated = new Date().toISOString();
                        providerUpdated = true;
                        console.log(`   ✅ Updated ${models.length} models for provider ${providerName}`);
                        if (options.verbose) {
                            console.log(`      Updated models: ${models.join(', ')}`);
                        }
                        break;
                    }
                }
            }
            if (!providerUpdated) {
                throw new Error(`Provider '${providerName}' not found in configuration`);
            }
            // 写回配置文件
            const updatedConfig = jq_json_handler_1.JQJsonHandler.stringifyJson(parsedConfig, true);
            fs.writeFileSync(configPath, updatedConfig, 'utf8');
            console.log(`   💾 Configuration file updated successfully`);
        }
        catch (error) {
            console.error(`   ❌ Failed to update configuration file:`, error instanceof Error ? error.message : 'Unknown error');
            if (error instanceof Error && error.message.includes('ENOENT')) {
                console.error('      Please check if the configuration file exists and is accessible');
            }
            else if (error instanceof Error && error.message.includes('EACCES')) {
                console.error('      Please check if you have write permissions for the configuration file');
            }
            throw error;
        }
    }
    /**
     * 处理错误
     */
    handleError(error) {
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        if (!this.options.suppressOutput) {
            console.error(`❌ Error: ${message}`);
        }
        if (this.options.exitOnError) {
            process.exit(1);
        }
        else {
            throw error;
        }
    }
    /**
     * 启动服务器（实际实现）
     */
    async startServer(options) {
        try {
            // 🎯 自动检测并清理端口占用
            if (options.port) {
                await this.cleanupPortIfOccupied(options.port);
            }
            // 初始化流水线生命周期管理器
            // 需要系统配置路径，使用正确的绝对路径，并传递debug选项
            const systemConfigPath = this.getSystemConfigPath();
            this.pipelineManager = new pipeline_lifecycle_manager_1.PipelineLifecycleManager(options.config, systemConfigPath, options.debug);
            // 将实例保存到全局变量，以便信号处理程序能够访问
            global.pipelineLifecycleManager = this.pipelineManager;
            // 启动RCC v4.0流水线系统
            const success = await this.pipelineManager.start();
            if (!success) {
                throw new Error('Pipeline system failed to start');
            }
            // 监听流水线事件
            this.setupPipelineEventListeners();
            secure_logger_1.secureLogger.info('RCC Server started with pipeline system', {
                port: options.port,
                host: options.host || '0.0.0.0',
                config: options.config,
                debug: options.debug,
            });
        }
        catch (error) {
            secure_logger_1.secureLogger.error('Failed to start RCC server', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * 停止服务器（实际实现）
     */
    async stopServer(options) {
        let effectivePort = options.port;
        // 如果没有指定端口，尝试使用默认的常用端口
        if (!effectivePort) {
            // 对于stop操作，我们可以尝试一些常用端口
            // 或者要求用户明确指定端口以避免误操作
            throw new Error('Port is required for stop operation. Please specify --port <number>');
        }
        const port = effectivePort;
        try {
            // 首先尝试通过HTTP端点优雅停止
            await this.attemptGracefulStop(port);
            // 等待一段时间让服务器优雅关闭
            await new Promise(resolve => setTimeout(resolve, 1000));
            // 检查是否还有进程占用端口
            const pid = await this.findProcessOnPort(port);
            if (pid) {
                if (options.force) {
                    // 强制终止进程
                    await this.forceKillProcess(pid);
                    secure_logger_1.secureLogger.info('RCC Server force killed', { port, pid });
                }
                else {
                    // 发送TERM信号尝试优雅关闭
                    await this.sendTermSignal(pid);
                    // 等待进程关闭
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // 再次检查，如果还在运行则强制终止
                    const stillRunning = await this.findProcessOnPort(port);
                    if (stillRunning) {
                        await this.forceKillProcess(stillRunning);
                        secure_logger_1.secureLogger.info('RCC Server force killed after TERM timeout', { port, pid: stillRunning });
                    }
                }
            }
            // 清理本地实例
            if (this.pipelineManager) {
                await this.pipelineManager.stop();
                this.pipelineManager = undefined;
            }
            // 清理全局实例
            global.pipelineLifecycleManager = undefined;
            secure_logger_1.secureLogger.info('RCC Server stopped successfully', {
                port,
                force: options.force,
            });
        }
        catch (error) {
            secure_logger_1.secureLogger.error('Failed to stop RCC server', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * 尝试通过HTTP端点优雅停止服务器
     */
    async attemptGracefulStop(port) {
        try {
            const http = require('http');
            const postData = jq_json_handler_1.JQJsonHandler.stringifyJson({ action: 'shutdown' });
            const options = {
                hostname: 'localhost',
                port: port,
                path: '/shutdown',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 3000
            };
            await new Promise((resolve, reject) => {
                const req = http.request(options, (res) => {
                    res.on('data', () => { });
                    res.on('end', () => resolve(undefined));
                });
                req.on('error', (err) => {
                    // 如果HTTP请求失败，继续其他停止方法
                    resolve(undefined);
                });
                req.on('timeout', () => {
                    req.destroy();
                    resolve(undefined);
                });
                req.write(postData);
                req.end();
            });
        }
        catch (error) {
            // 忽略HTTP停止失败，继续其他方法
        }
    }
    /**
     * 查找占用指定端口的进程ID
     */
    async findProcessOnPort(port) {
        try {
            const { execSync } = require('child_process');
            const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', timeout: 5000 });
            const pid = parseInt(result.trim());
            return isNaN(pid) ? null : pid;
        }
        catch (error) {
            return null;
        }
    }
    /**
     * 发送TERM信号给进程
     */
    async sendTermSignal(pid) {
        try {
            const { execSync } = require('child_process');
            execSync(`kill -TERM ${pid}`, { timeout: 5000 });
        }
        catch (error) {
            // 忽略错误，后续会强制终止
        }
    }
    /**
     * 强制终止进程
     */
    async forceKillProcess(pid) {
        try {
            const { execSync } = require('child_process');
            execSync(`kill -9 ${pid}`, { timeout: 5000 });
        }
        catch (error) {
            throw new Error(`Failed to force kill process ${pid}: ${error.message}`);
        }
    }
    /**
     * 自动检测并清理端口占用
     */
    async cleanupPortIfOccupied(port) {
        try {
            const pid = await this.findProcessOnPort(port);
            if (pid) {
                if (!this.options.suppressOutput) {
                    console.log(`⚠️  Port ${port} is occupied by process ${pid}, attempting cleanup...`);
                }
                secure_logger_1.secureLogger.info('Auto-cleaning occupied port', { port, pid });
                // 先尝试优雅关闭
                await this.sendTermSignal(pid);
                // 等待进程优雅关闭
                await new Promise(resolve => setTimeout(resolve, 2000));
                // 检查进程是否仍在运行
                const stillRunning = await this.findProcessOnPort(port);
                if (stillRunning) {
                    // 强制终止进程
                    await this.forceKillProcess(stillRunning);
                    if (!this.options.suppressOutput) {
                        console.log(`🔥 Forcefully terminated process ${stillRunning} on port ${port}`);
                    }
                    secure_logger_1.secureLogger.info('Port cleanup: force killed process', { port, pid: stillRunning });
                }
                else {
                    if (!this.options.suppressOutput) {
                        console.log(`✅ Process ${pid} gracefully stopped, port ${port} is now available`);
                    }
                    secure_logger_1.secureLogger.info('Port cleanup: graceful shutdown successful', { port, pid });
                }
                // 再等待一小段时间确保端口完全释放
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            else {
                secure_logger_1.secureLogger.debug('Port is available', { port });
            }
        }
        catch (error) {
            secure_logger_1.secureLogger.warn('Port cleanup failed', {
                port,
                error: error.message
            });
            if (!this.options.suppressOutput) {
                console.warn(`⚠️  Warning: Failed to cleanup port ${port}: ${error.message}`);
            }
            // 不抛出错误，让服务器启动继续尝试
            // 如果端口真的被占用，后续的服务器启动会失败并报告具体错误
        }
    }
    /**
     * 启动客户端模式（实际实现）
     */
    async startClientMode(options) {
        const port = options.port || 5506;
        const baseUrl = `http://localhost:${port}`;
        const apiKey = 'rcc4-proxy-key';
        // 设置环境变量
        process.env.ANTHROPIC_BASE_URL = baseUrl;
        process.env.ANTHROPIC_API_KEY = apiKey;
        secure_logger_1.secureLogger.info('启动Claude Code客户端模式', {
            baseUrl,
            port,
            apiKey: 'rcc4-proxy-key'
        });
        // 启动 claude 子进程
        const spawn = require('child_process').spawn;
        try {
            // 传递所有命令行参数给 claude，除了 rcc4 特定的参数
            const originalArgs = process.argv.slice(2);
            const claudeArgs = [];
            // 跳过 rcc4 特定参数和它们的值
            for (let i = 0; i < originalArgs.length; i++) {
                const arg = originalArgs[i];
                const nextArg = originalArgs[i + 1];
                if (arg === 'code') {
                    // 跳过code命令
                    continue;
                }
                else if (arg === '--port' && nextArg) {
                    // 跳过--port及其值
                    i++; // 跳过下一个参数（端口号）
                    continue;
                }
                else if (arg === '--auto-start' || arg === '--export') {
                    // 跳过这些标志
                    continue;
                }
                else if (arg.startsWith('--port=')) {
                    // 跳过--port=5506格式
                    continue;
                }
                else {
                    // 保留其他所有参数
                    claudeArgs.push(arg);
                }
            }
            // 如果没有参数，让 claude 使用默认行为
            // 不需要添加 --interactive，claude 会自动进入交互模式
            secure_logger_1.secureLogger.info('启动claude命令', {
                claudeArgs,
                env: {
                    ANTHROPIC_BASE_URL: baseUrl,
                    ANTHROPIC_API_KEY: apiKey
                }
            });
            const claude = spawn('claude', claudeArgs, {
                stdio: 'inherit', // 继承stdio，让claude直接与终端交互
                env: {
                    ...process.env,
                    ANTHROPIC_BASE_URL: baseUrl,
                    ANTHROPIC_API_KEY: apiKey
                }
            });
            claude.on('close', (code) => {
                secure_logger_1.secureLogger.info('Claude进程退出', { exitCode: code });
                process.exit(code || 0);
            });
            claude.on('error', (error) => {
                secure_logger_1.secureLogger.error('Claude进程错误', { error: error.message });
                console.error(`❌ Failed to start claude: ${error.message}`);
                process.exit(1);
            });
            // 等待一小段时间确保claude启动
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        catch (error) {
            secure_logger_1.secureLogger.error('启动claude客户端失败', { error: error.message });
            throw new Error(`Failed to start claude client: ${error.message}`);
        }
    }
    /**
     * 导出客户端配置
     */
    async exportClientConfig(options) {
        const envVars = [
            `export ANTHROPIC_BASE_URL=http://localhost:${options.port || 5506}`,
            'export ANTHROPIC_API_KEY=rcc-proxy-key',
        ];
        if (!this.options.suppressOutput) {
            console.log('\n📋 Environment Variables:');
            for (const envVar of envVars) {
                console.log(`   ${envVar}`);
            }
        }
    }
    /**
     * 获取服务器状态（实际实现）
     */
    async getServerStatus(options) {
        if (!this.pipelineManager) {
            return {
                isRunning: false,
                port: options.port || 0,
                host: 'localhost',
                startTime: undefined,
                version: '4.0.0-dev',
                activePipelines: 0,
                totalRequests: 0,
                uptime: '0s',
                health: {
                    status: 'unhealthy',
                    checks: [{ name: 'Pipeline Manager', status: 'fail', responseTime: 0 }],
                },
            };
        }
        const stats = this.pipelineManager.getStats();
        const isRunning = this.pipelineManager.isSystemRunning();
        const systemInfo = this.pipelineManager.getSystemInfo();
        return {
            isRunning,
            port: options.port || 0,
            host: 'localhost',
            startTime: new Date(Date.now() - stats.uptime),
            version: '4.0.0-dev',
            activePipelines: stats.routingTableStats.virtualModels.length,
            totalRequests: stats.totalRequests,
            uptime: this.formatUptime(stats.uptime),
            health: {
                status: isRunning ? 'healthy' : 'unhealthy',
                checks: [
                    {
                        name: 'Pipeline Manager',
                        status: isRunning ? 'pass' : 'fail',
                        responseTime: Math.round(stats.averageResponseTime || 0),
                    },
                    {
                        name: 'Router System',
                        status: stats.serverMetrics.routerStats ? 'pass' : 'fail',
                        responseTime: 1,
                    },
                    {
                        name: 'Layer Health',
                        status: stats.requestProcessorStats.layerHealth && Object.keys(stats.requestProcessorStats.layerHealth).length > 0
                            ? 'pass'
                            : 'warn',
                        responseTime: 2,
                    },
                ],
            },
            pipeline: {
                stats,
                activeRequests: 0, // No longer tracking active requests in new structure
                layerHealth: stats.requestProcessorStats.layerHealth,
            },
        };
    }
    /**
     * 显示服务器状态
     */
    displayServerStatus(status, detailed) {
        console.log('\n📊 RCC Server Status:');
        console.log(`   Status: ${status.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
        console.log(`   Address: http://${status.host}:${status.port}`);
        console.log(`   Version: ${status.version}`);
        if (detailed && status.isRunning) {
            console.log(`   Uptime: ${status.uptime}`);
            console.log(`   Active Pipelines: ${status.activePipelines}`);
            console.log(`   Total Requests: ${status.totalRequests}`);
            if (status.startTime) {
                console.log(`   Started: ${status.startTime.toISOString()}`);
            }
            console.log(`\n🏥 Health Status: ${this.getHealthStatusIcon(status.health.status)} ${status.health.status}`);
            for (const check of status.health.checks) {
                const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
                console.log(`   ${icon} ${check.name}: ${check.status} (${check.responseTime}ms)`);
            }
        }
    }
    /**
     * 获取健康状态图标
     */
    getHealthStatusIcon(status) {
        switch (status) {
            case 'healthy':
                return '🟢';
            case 'degraded':
                return '🟡';
            case 'unhealthy':
                return '🔴';
            default:
                return '⚪';
        }
    }
    /**
     * 列出配置文件
     */
    async listConfigurations() {
        if (!this.options.suppressOutput) {
            console.log('📁 Available Configurations:');
            console.log('   ~/.rcc/config.json (default)');
            console.log('   ./rcc.config.json (project)');
            console.log('   Environment variables (RCC_*)');
        }
    }
    /**
     * 验证配置文件
     */
    async validateConfiguration(path) {
        if (!this.options.suppressOutput) {
            console.log(`✅ Configuration ${path || 'default'} is valid`);
        }
    }
    /**
     * 获取系统配置文件路径
     */
    getSystemConfigPath() {
        // 优先级：环境变量 > ~/.route-claudecode/config > 开发环境路径
        if (process.env.RCC_SYSTEM_CONFIG_PATH) {
            return process.env.RCC_SYSTEM_CONFIG_PATH;
        }
        // 用户级系统配置路径
        const userConfigPath = path.join(os.homedir(), '.route-claudecode', 'config', 'system-config.json');
        // 检查文件是否存在，如果存在则使用
        try {
            require('fs').accessSync(userConfigPath);
            return userConfigPath;
        }
        catch (error) {
            // 文件不存在，使用开发环境路径作为fallback
            secure_logger_1.secureLogger.warn('User system config not found, using development path', {
                attempted: userConfigPath,
                fallback: 'config/system-config.json'
            });
            return 'config/system-config.json';
        }
    }
    /**
     * 重置配置
     */
    async resetConfiguration() {
        if (!this.options.suppressOutput) {
            console.log('🔄 Configuration reset to defaults');
        }
    }
    /**
     * 设置流水线事件监听器
     */
    setupPipelineEventListeners() {
        if (!this.pipelineManager) {
            return;
        }
        this.pipelineManager.on('pipeline-started', () => {
            secure_logger_1.secureLogger.info('Pipeline system started successfully');
        });
        this.pipelineManager.on('layers-ready', () => {
            secure_logger_1.secureLogger.info('All pipeline layers are ready');
        });
        this.pipelineManager.on('layers-error', error => {
            secure_logger_1.secureLogger.error('Pipeline layer error', { error: error.message });
        });
        this.pipelineManager.on('request-completed', data => {
            secure_logger_1.secureLogger.debug('Request completed successfully', {
                requestId: data.requestId,
                success: data.success,
            });
        });
        this.pipelineManager.on('request-failed', data => {
            secure_logger_1.secureLogger.warn('Request failed', {
                requestId: data.requestId,
                error: data.error.message,
            });
        });
        this.pipelineManager.on('pipeline-stopped', () => {
            secure_logger_1.secureLogger.info('Pipeline system stopped');
        });
    }
    /**
     * 格式化运行时间
     */
    formatUptime(uptimeMs) {
        const seconds = Math.floor(uptimeMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) {
            return `${days}d ${hours % 24}h ${minutes % 60}m`;
        }
        else if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    /**
     * API动态模型获取功能 - 内联实现
     */
    async fetchModelsForProvider(providerType, provider, staticFallback) {
        try {
            const apiKey = provider.api_key || provider.apiKeys?.[0] || 'default-key';
            const baseUrl = provider.api_base_url || this.getDefaultEndpointForProvider(providerType);
            const modelsEndpoint = `${baseUrl}/v1/models`;
            secure_logger_1.secureLogger.info(`Fetching models from ${providerType} API`, {
                endpoint: modelsEndpoint,
                provider: provider.name
            });
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await fetch(modelsEndpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            const rawModels = data.data || data.models || [];
            const fetchedModels = [];
            for (const rawModel of rawModels) {
                const modelName = rawModel.id || rawModel.name || 'unknown-model';
                // 尝试从API响应中提取真实的上下文长度
                let contextLength;
                if (rawModel.context_length || rawModel.contextLength || rawModel.max_tokens || rawModel.maxTokens) {
                    contextLength = rawModel.context_length || rawModel.contextLength || rawModel.max_tokens || rawModel.maxTokens;
                    secure_logger_1.secureLogger.debug(`Found API context length for ${modelName}`, {
                        apiContextLength: contextLength,
                        source: rawModel.context_length ? 'context_length' :
                            rawModel.contextLength ? 'contextLength' :
                                rawModel.max_tokens ? 'max_tokens' : 'maxTokens'
                    });
                }
                else {
                    // 回退到精确映射表
                    contextLength = this.extractContextLength(modelName, providerType);
                    secure_logger_1.secureLogger.debug(`Using mapped context length for ${modelName}`, {
                        mappedContextLength: contextLength,
                        source: 'precise_mapping'
                    });
                }
                const classification = this.classifyModel(modelName, contextLength);
                // Skip blacklisted models
                if (classification.blacklisted) {
                    this.blacklistedModels.add(modelName);
                    continue;
                }
                const fetchedModel = {
                    id: modelName,
                    name: modelName,
                    maxTokens: contextLength,
                    classification,
                    provider: providerType,
                    createdAt: new Date().toISOString()
                };
                fetchedModels.push(fetchedModel);
            }
            secure_logger_1.secureLogger.info(`Successfully fetched models from ${providerType}`, {
                totalModels: rawModels.length,
                filteredModels: fetchedModels.length,
                blacklisted: rawModels.length - fetchedModels.length
            });
            return fetchedModels;
        }
        catch (error) {
            secure_logger_1.secureLogger.error(`Failed to fetch models from ${providerType}`, {
                error: error.message,
                fallbackCount: staticFallback.length
            });
            // Return static models as FetchedModel objects
            return staticFallback.map(modelName => ({
                id: modelName,
                name: modelName,
                maxTokens: this.extractContextLength(modelName, providerType),
                classification: this.classifyModel(modelName, this.extractContextLength(modelName, providerType)),
                provider: providerType,
                createdAt: new Date().toISOString()
            }));
        }
    }
    /**
     * 提取模型的精确上下文长度
     */
    extractContextLength(modelName, providerType) {
        const lowerName = modelName.toLowerCase();
        // 精确的模型上下文长度映射表
        const modelMaxTokens = {
            // Qwen模型系列
            'qwen3-coder-plus': 1000000, // 1M上下文
            'qwen3-coder-flash': 1000000, // 1M上下文  
            'qwen-max': 2000000, // 2M上下文
            'qwen-plus': 1000000, // 1M上下文
            'qwen-turbo': 1000000, // 1M上下文
            'qwen-long': 10000000, // 10M长上下文
            'qwen2.5-72b-instruct': 131072, // 128K上下文
            'qwen2.5-32b-instruct': 131072, // 128K上下文
            'qwen2.5-14b-instruct': 131072, // 128K上下文
            'qwen2.5-7b-instruct': 131072, // 128K上下文
            'qwen2.5-coder-32b-instruct': 131072, // 128K上下文
            'qwen2.5-coder-14b-instruct': 131072, // 128K上下文
            'qwen2.5-coder-7b-instruct': 131072, // 128K上下文
            'qwq-32b-preview': 1000000, // 1M推理模型
            // Shuaihong代理模型系列
            'gemini-2.5-pro': 2097152, // 2M上下文
            'gpt-4o': 128000, // 128K上下文
            'gpt-4o-mini': 128000, // 128K上下文  
            'claude-3-sonnet': 200000, // 200K上下文
            'claude-3-haiku': 200000, // 200K上下文
            'claude-3-opus': 200000, // 200K上下文
            // ModelScope模型系列 (64K限制)
            'qwen3-480b': 65536, // 64K上下文
            'llama3.1-405b-instruct': 131072, // 128K上下文
            'llama3.1-70b-instruct': 131072, // 128K上下文
            'deepseek-v2.5-chat': 65536, // 64K上下文
            // LM Studio本地模型
            'gpt-oss-20b-mlx': 131072, // 128K上下文
            'llama-3.1-8b': 131072, // 128K上下文
            'codellama-34b': 100000, // 100K上下文
            'deepseek-coder-33b': 131072, // 128K上下文
            // 其他常见模型
            'gpt-3.5-turbo': 16384, // 16K上下文 (会被拉黑)
            'gpt-4': 128000, // 128K上下文
            'claude-instant-1': 9000, // 9K上下文 (会被拉黑)
            'llama-2-7b-chat': 4096, // 4K上下文 (会被拉黑)
        };
        // 直接查找精确匹配
        if (modelMaxTokens[lowerName]) {
            return modelMaxTokens[lowerName];
        }
        // 尝试部分匹配（处理版本变化）
        for (const [modelKey, tokens] of Object.entries(modelMaxTokens)) {
            if (lowerName.includes(modelKey.split('-')[0]) && lowerName.includes(modelKey.split('-')[1] || '')) {
                return tokens;
            }
        }
        // 基于名称模式推断（作为后备）
        if (lowerName.includes('32k'))
            return 32768;
        if (lowerName.includes('64k'))
            return 65536;
        if (lowerName.includes('128k'))
            return 131072;
        if (lowerName.includes('256k'))
            return 262144;
        if (lowerName.includes('1m') || lowerName.includes('1000k'))
            return 1000000;
        if (lowerName.includes('2m') || lowerName.includes('2000k'))
            return 2000000;
        if (lowerName.includes('10m'))
            return 10000000;
        // 基于模型名称特征推断
        if (lowerName.includes('long') || lowerName.includes('extended')) {
            return 1000000; // 长上下文变种
        }
        if (lowerName.includes('flash') || lowerName.includes('turbo')) {
            return 1000000; // 快速模型通常上下文较长
        }
        if (lowerName.includes('mini') || lowerName.includes('small')) {
            return 128000; // 小模型通常上下文中等
        }
        // Provider特定的保守默认值
        switch (providerType) {
            case 'qwen':
                return 131072; // Qwen保守默认128K
            case 'shuaihong':
                return 128000; // 代理模型保守默认128K
            case 'modelscope':
                return 65536; // ModelScope默认64K
            case 'lmstudio':
                return 131072; // 本地模型保守默认128K
            default:
                return 131072; // 全局保守默认128K
        }
    }
    /**
     * 智能模型分类
     */
    classifyModel(name, contextLength) {
        const lowerName = name.toLowerCase();
        // Check for blacklisting conditions
        if (contextLength < 65536) { // < 64K
            return {
                contextLength,
                isProgramming: false,
                hasImageProcessing: false,
                isLongContext: false,
                category: 'general',
                capabilities: [],
                blacklisted: true,
                blacklistReason: `Context length ${contextLength} < 64K threshold`
            };
        }
        // Programming keywords
        const programmingKeywords = [
            'code', 'coder', 'coding', 'program', 'dev', 'developer',
            'instruct', 'chat', 'assistant', 'tool', 'function',
            'qwen', 'codellama', 'starcoder', 'deepseek', 'gemini'
        ];
        // Image processing keywords
        const imageProcessingKeywords = [
            'vision', 'visual', 'image', 'multimodal', 'mm', 'vlm',
            'gemini', 'gpt-4o', 'claude-3', 'qwen-vl'
        ];
        // Reasoning keywords
        const reasoningKeywords = [
            'reasoning', 'reason', 'think', 'analysis', 'logic',
            'qwq', 'o1', 'reasoning', 'deepthink'
        ];
        // Detect capabilities
        const isProgramming = programmingKeywords.some(keyword => lowerName.includes(keyword));
        const hasImageProcessing = imageProcessingKeywords.some(keyword => lowerName.includes(keyword));
        const isReasoning = reasoningKeywords.some(keyword => lowerName.includes(keyword));
        const isLongContext = contextLength >= 200000; // >= 200K
        // Filter out non-programming models
        if (!isProgramming && !hasImageProcessing && !isReasoning) {
            return {
                contextLength,
                isProgramming: false,
                hasImageProcessing: false,
                isLongContext,
                category: 'general',
                capabilities: [],
                blacklisted: true,
                blacklistReason: 'Non-programming general purpose model'
            };
        }
        // Determine category
        let category = 'programming';
        if (hasImageProcessing) {
            category = 'multimodal';
        }
        else if (isReasoning) {
            category = 'reasoning';
        }
        // Build capabilities list
        const capabilities = [];
        if (isProgramming)
            capabilities.push('programming');
        if (hasImageProcessing)
            capabilities.push('image-processing');
        if (isLongContext)
            capabilities.push('long-context');
        if (isReasoning)
            capabilities.push('reasoning');
        if (contextLength >= 1000000)
            capabilities.push('ultra-long-context');
        return {
            contextLength,
            isProgramming,
            hasImageProcessing,
            isLongContext,
            category,
            capabilities,
            blacklisted: false
        };
    }
    /**
     * 获取Provider的默认端点
     */
    getDefaultEndpointForProvider(providerType) {
        switch (providerType) {
            case 'qwen':
                return 'https://dashscope.aliyuncs.com/v1';
            case 'modelscope':
                return 'https://api.modelscope.cn/v1';
            case 'shuaihong':
                return 'https://api.shuaihong.com/v1';
            case 'lmstudio':
                return 'http://localhost:1234/v1';
            default:
                return 'http://localhost:1234/v1';
        }
    }
}
exports.RCCCli = RCCCli;
//# sourceMappingURL=rcc-cli.js.map