/**
 * RCC主CLI类
 *
 * 统一的CLI入口，集成命令解析、验证、配置加载和执行
 *
 * @author Jason Zhang
 */

import {
  CLICommands,
  ParsedCommand,
  StartOptions,
  StopOptions,
  CodeOptions,
  StatusOptions,
  ConfigOptions,
  ServerStatus,
  HappyOptions,
} from '../interfaces/client/cli-interface';
import { CommandParser } from './command-parser';
import { ArgumentValidator } from './argument-validator';
import { ConfigReader } from '../config/config-reader';
import { PipelineLifecycleManager } from '../pipeline/pipeline-lifecycle-manager';
import { secureLogger } from '../utils/secure-logger';
import { getServerPort } from '../constants/server-defaults';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { QwenAuthManager } from './auth/qwen-auth-manager';
import { ModelTestHistoryManager } from './history/model-test-history-manager';
import { getProviderRequestTimeout } from '../constants/timeout-defaults';
import type { RCCv4Config } from '../config/config-types';
// import { ApiModelFetcher, FetchedModel } from './api-model-fetcher';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import * as fs from 'fs';

/**
 * CLI执行选项
 */
export interface CLIOptions {
  exitOnError?: boolean;
  suppressOutput?: boolean;
  configPath?: string;
  envPrefix?: string;
}

/**
 * RCC主CLI类
 */
export class RCCCli implements CLICommands {
  private parser: CommandParser;
  private validator: ArgumentValidator;
  private configReader: ConfigReader;
  private options: CLIOptions;
  private pipelineManager?: PipelineLifecycleManager;
  private qwenAuthManager: QwenAuthManager;
  private historyManager: ModelTestHistoryManager;
  // private apiModelFetcher: ApiModelFetcher;
  private blacklistedModels: Set<string> = new Set();

  constructor(options: CLIOptions = {}) {
    this.parser = new CommandParser();
    this.validator = new ArgumentValidator();
    this.configReader = new ConfigReader();
    this.qwenAuthManager = new QwenAuthManager();
    this.historyManager = new ModelTestHistoryManager();
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
  async run(args: string[] = process.argv.slice(2)): Promise<void> {
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
      const config = ConfigReader.loadConfig(
        this.options.configPath || 'config/default.json',
        systemConfigPath
      );

      // 4. 合并配置到命令选项
      const mergedCommand: ParsedCommand = {
        ...command,
        options: { ...config, ...validation.normalizedOptions },
      };

      // 5. 执行命令
      await this.parser.executeCommand(mergedCommand);
    } catch (error) {
      // Zero Fallback Policy: 立即抛出错误，不进行fallback处理
      this.handleError(error);
    }
  }



  /**
   * 启动服务器模式
   */
  async start(options: StartOptions): Promise<void> {
    // 启动 happy-cli 守护进程
    // await this.startHappyCliDaemon();
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
          const config = ConfigReader.loadConfig(options.config, systemConfigPath);
          effectivePort = config.server?.port;
          if (!effectivePort) {
            throw new Error('Port not found in configuration file and not specified via --port <number>');
          }
        } catch (error) {
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
    } catch (error) {
      throw new Error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 停止服务器
   */
  async stop(options: StopOptions): Promise<void> {
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
    } catch (error) {
      throw new Error(`Failed to stop server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 启动客户端模式
   */
  async code(options: CodeOptions): Promise<void> {
    try {
      if (!this.options.suppressOutput) {
        console.log('🔧 Starting Claude Code Client Mode...');
        console.log(`   Target Port: ${options.port || getServerPort()}`);
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
    } catch (error) {
      throw new Error(`Failed to start client mode: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 查看服务器状态
   */
  async status(options: StatusOptions): Promise<ServerStatus> {
    try {
      if (!this.options.suppressOutput) {
        console.log('📊 Checking RCC Server Status...');
      }

      const status = await this.getServerStatus(options);

      if (!this.options.suppressOutput) {
        this.displayServerStatus(status, options.detailed || false);
      }

      return status;
    } catch (error) {
      throw new Error(`Failed to get server status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 配置管理
   */
  async config(options: ConfigOptions): Promise<void> {
    try {
      if (options.list) {
        await this.listConfigurations();
      } else if (options.validate) {
        await this.validateConfiguration(options.path);
      } else if (options.reset) {
        await this.resetConfiguration();
      } else {
        throw new Error('No config operation specified. Use --list, --validate, or --reset.');
      }
    } catch (error) {
      throw new Error(`Configuration operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 处理验证错误
   */
  private handleValidationErrors(errors: any[]): void {
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
  async auth(provider: string, index?: number, options?: any): Promise<void> {
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
        } else {
          throw new Error(`序号是必需的。现有序号: [${availableIndexes.join(', ')}]，建议新序号: ${nextIndex}`);
        }
      }

      if (index < 1 || index > 99) {
        throw new Error('Index must be between 1 and 99');
      }

      await this.authenticateProvider(provider, index);

    } catch (error) {
      // Zero Fallback Policy: 认证失败立即抛出，不尝试fallback
      this.handleError(error);
    }
  }

  /**
   * 执行provider认证
   */
  private async authenticateProvider(provider: string, index: number): Promise<void> {
    switch (provider.toLowerCase()) {
      case 'qwen':
        // 检查文件是否已存在
        const validation = await this.qwenAuthManager.validateAuthIndex(index);
        if (validation.exists) {
          if (validation.isExpired) {
            console.log(`⚠️ 认证文件 qwen-auth-${index}.json 已存在但已过期`);
            console.log(`💡 使用 "rcc4 auth qwen ${index} --refresh" 刷新，或选择其他序号`);
            return;
          } else {
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
  private async listAuthFiles(provider: string): Promise<void> {
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
  private async removeAuthFile(provider: string, index: number): Promise<void> {
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
  private async refreshAuthFile(provider: string, index: number): Promise<void> {
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
  async providerUpdate(options: any): Promise<void> {
    try {
      console.log('🔄 Updating provider models and capabilities...');
      
      // 初始化历史记录管理器
      console.log('📚 Initializing model test history manager...');
      await this.historyManager.initialize();

      // 处理历史记录相关选项
      if (options.historyStats) {
        const stats = await this.historyManager.getStatistics();
        console.log('\n📊 Model Test History Statistics:');
        console.log(`   📝 Total Records: ${stats.totalRecords}`);
        console.log(`   ✅ Successful Tests: ${stats.successCount}`);
        console.log(`   ❌ Failed Tests: ${stats.failedCount}`);
        console.log(`   📁 File Size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
        if (stats.lastTestedAt) {
          console.log(`   🕒 Last Test: ${stats.lastTestedAt}`);
        }
        
        if (Object.keys(stats.byProvider).length > 0) {
          console.log('\n📊 By Provider:');
          for (const [provider, providerStats] of Object.entries(stats.byProvider)) {
            console.log(`   ${provider}: ${providerStats.success}/${providerStats.total} successful`);
          }
        }
        return; // 只显示统计信息后退出
      }

      if (options.exportHistory) {
        const outputPath = options.exportHistory;
        const format = outputPath.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
        await this.historyManager.exportHistory(outputPath, format);
        console.log(`✅ History exported to: ${outputPath}`);
        return; // 导出后退出
      }

      if (options.clearHistory) {
        console.log('🗑️ Clearing model test history...');
        const result = await this.historyManager.clearHistory({ confirmClear: true });
        console.log(`✅ Cleared ${result.deletedCount} records, ${result.remainingCount} remaining`);
      }

      // 检查配置文件参数
      if (!options.config) {
        throw new Error('Configuration file path is required. Use --config <path>');
      }

      console.log(`📋 Loading configuration from ${options.config}...`);
      
      // 直接使用JQJsonHandler读取配置文件
      const config = JQJsonHandler.parseJsonFile(options.config);
      
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
        } catch (error) {
          console.error(`❌ Failed to update provider ${provider.name}:`, error instanceof Error ? error.message : 'Unknown error');
          failureCount++;
          if (options.verbose) {
            console.error(`   Stack trace:`, (error as Error).stack);
          }
        }
      }

      console.log(`\n📊 Provider Update Summary:`);
      console.log(`   ✅ Successful: ${successCount}`);
      console.log(`   ❌ Failed: ${failureCount}`);
      console.log(`   📊 Total: ${enabledProviders.length}`);

      if (failureCount > 0) {
        console.warn('⚠️  Some providers failed to update. Check the errors above for details.');
      } else {
        console.log('✅ All providers updated successfully');
      }
      
    } catch (error) {
      console.error('❌ Provider update failed:', error instanceof Error ? error.message : 'Unknown error');
      if (options.verbose) {
        console.error('   Stack trace:', (error as Error).stack);
      }
      // Zero Fallback Policy: Provider更新失败立即抛出
      this.handleError(error);
    }
  }

  /**
   * 分类模型统计
   */
  /**
   * 分类模型统计信息
   */
  private categorizeModels(models: FetchedModel[]): {
    programming: number;
    multimodal: number; 
    longContext: number;
    blacklisted: number;
  } {
    const stats = {
      programming: 0,
      multimodal: 0,
      longContext: 0,
      blacklisted: 0
    };

    for (const model of models) {
      if (model.classification.blacklisted) {
        stats.blacklisted++;
      } else {
        if (model.classification.isProgramming) stats.programming++;
        if (model.classification.hasImageProcessing) stats.multimodal++;
        if (model.classification.isLongContext) stats.longContext++;
      }
    }

    return stats;
  }

  /**
   * 更新Provider模型
   */
  private async updateProviderModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    const providerName = provider.name?.toLowerCase();
    
    switch (providerName) {
      case 'qwen':
        await this.updateQwenModels(provider, options, config, configPath);
        break;
      case 'modelscope':
        await this.updateModelScopeModels(provider, options, config, configPath);
        break;
      case 'lmstudio':
        await this.updateLMStudioModels(provider, options, config, configPath);
        break;
      default:
        // 对于未知的provider类型，使用通用OpenAI兼容方式
        // 这包括 Shuaihong 和其他 OpenAI 兼容的 provider
        await this.updateGenericOpenAIProvider(provider, options, config, configPath);
    }
  }

  /**
   * 更新通用OpenAI兼容Provider模型 (如 Shuaihong, OpenAI, Anthropic 等)
   */
  private async updateGenericOpenAIProvider(provider: any, options: any, config: any, configPath: string): Promise<void> {
    // 默认静态模型，适用于大多数OpenAI兼容provider
    const staticModels = [
      'gpt-4o',
      'gpt-4o-mini', 
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3.5-sonnet',
      'claude-3-haiku',
      'gemini-pro'
    ];

    let finalModels: string[];

    if (options.static) {
      finalModels = staticModels;
      console.log(`   📋 使用静态模型列表 (--static): ${finalModels.length} models`);
    } else {
      console.log(`   🔍 Fetching ${provider.name} models via API (default behavior)...`);
      try {
        const fetchedModels = await this.fetchModelsForProvider(provider.name, provider, staticModels, options);
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
      } catch (error) {
        console.log(`   ⚠️ API获取失败，回退到静态模型列表`);
        finalModels = staticModels;
      }
    }

    await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
  }

  /**
   * 更新Qwen模型
   */
  private async updateQwenModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
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

    let finalModels: string[];

    // 默认使用API获取，--static参数强制使用静态列表
    if (options.static) {
      finalModels = staticModels;
      console.log(`   📋 使用静态模型列表 (--static): ${finalModels.length} models`);
    } else {
      console.log(`   🔍 Fetching Qwen models via API (default behavior)...`);
      try {
        const fetchedModels = await this.fetchModelsForProvider(provider.name, provider, staticModels, options);
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
      } catch (error) {
        console.log(`   ⚠️ API获取失败，回退到静态模型列表: ${error instanceof Error ? error.message : 'Unknown error'}`);
        finalModels = staticModels;
        console.log(`   📋 使用静态备用列表: ${finalModels.length} models`);
      }
    }

    await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
  }


  /**
   * 更新ModelScope模型
   */
  private async updateModelScopeModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    const staticModels = [
      'qwen3-480b',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'llama3.1-405b-instruct', 
      'llama3.1-70b-instruct',
      'deepseek-v2.5-chat'
    ];

    let finalModels: string[];

    if (options.static) {
      finalModels = staticModels;
      console.log(`   📋 使用静态模型列表 (--static): ${finalModels.length} models`);
    } else {
      console.log(`   🔍 Fetching ModelScope models via API (default behavior)...`);
      try {
        const fetchedModels = await this.fetchModelsForProvider(provider.name, provider, staticModels, options);
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
      } catch (error) {
        console.log(`   ⚠️ API获取失败，回退到静态模型列表`);
        finalModels = staticModels;
      }
    }

    await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
  }

  /**
   * 更新LM Studio模型
   */
  private async updateLMStudioModels(provider: any, options: any, config: any, configPath: string): Promise<void> {
    const staticModels = [
      'gpt-oss-20b-mlx',
      'llama-3.1-8b',
      'qwen2.5-7b-instruct',
      'codellama-34b',
      'deepseek-coder-33b'
    ];

    let finalModels: string[];

    if (options.static) {
      finalModels = staticModels;
      console.log(`   📋 使用静态模型列表 (--static): ${finalModels.length} models`);
    } else {
      console.log(`   🔍 Fetching LM Studio models via API (default behavior)...`);
      try {
        const fetchedModels = await this.fetchModelsForProvider(provider.name, provider, staticModels, options);
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
      } catch (error) {
        console.log(`   ⚠️ API获取失败，回退到静态模型列表`);
        finalModels = staticModels;
      }
    }

    await this.updateProviderConfigModels(config, configPath, provider.name, finalModels, options);
  }

  /**
   * 获取模型的详细配置（包含精确maxTokens）
   */
  private getModelDetailedConfig(modelName: string, providerType: string): { name: string; maxTokens: number; capabilities?: string[] } {
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
  private async updateProviderConfigModels(config: any, configPath: string, providerName: string, models: string[], options: any): Promise<void> {
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
      } else {
        console.log(`      ${models.join(', ')}`);
      }
      return;
    }

    try {
      // 读取原始配置文件内容
      const fs = require('fs');
      const rawConfig = fs.readFileSync(configPath, 'utf8');
      
      // 解析配置文件
      const parsedConfig = JQJsonHandler.parseJsonString(rawConfig);
      
      // 创建详细的模型配置
      const detailedModels = models.map(modelName => 
        this.getModelDetailedConfig(modelName, providerName)
      );
      
      // 更新Providers数组中对应provider的models列表
      let providerUpdated = false;
      if (parsedConfig.Providers && Array.isArray(parsedConfig.Providers)) {
        for (const provider of parsedConfig.Providers) {
          if (provider.name === providerName) {
            // 🔧 BUG修复: 智能合并模型而非直接替换
            // 保护现有配置，避免数据丢失
            
            // 检查新模型数据的有效性
            if (!Array.isArray(detailedModels) || detailedModels.length === 0) {
              console.warn(`   ⚠️  警告: 获取到的模型列表为空，跳过更新以保护现有配置`);
              console.warn(`      Provider: ${providerName}, 现有模型数量: ${Array.isArray(provider.models) ? provider.models.length : 0}`);
              return;
            }
            
            // 智能合并逻辑：保留现有模型配置，更新新模型信息
            const existingModels = Array.isArray(provider.models) ? provider.models : [];
            const mergedModels = [...existingModels];
            let addedCount = 0;
            let updatedCount = 0;
            
            // 对每个新模型进行合并处理
            for (const newModel of detailedModels) {
              const modelName = typeof newModel === 'string' ? newModel : newModel.name;
              const existingIndex = mergedModels.findIndex(existing => {
                const existingName = typeof existing === 'string' ? existing : existing.name;
                return existingName === modelName;
              });
              
              if (existingIndex >= 0) {
                // 更新现有模型：保留用户配置，更新系统信息
                if (typeof newModel === 'object' && typeof mergedModels[existingIndex] === 'object') {
                  mergedModels[existingIndex] = {
                    ...mergedModels[existingIndex], // 保留现有配置
                    ...newModel, // 更新新信息
                    // 特殊保护：如果现有配置有自定义maxTokens，优先保留
                    maxTokens: mergedModels[existingIndex].maxTokens || newModel.maxTokens
                  };
                  updatedCount++;
                } else if (typeof newModel === 'string' && typeof mergedModels[existingIndex] === 'string') {
                  // 字符串模型无需更新
                  continue;
                }
              } else {
                // 添加新模型
                mergedModels.push(newModel);
                addedCount++;
              }
            }
            
            // 更新provider配置
            provider.models = mergedModels;
            provider.lastUpdated = new Date().toISOString();
            providerUpdated = true;
            
            console.log(`   ✅ 智能合并完成 - Provider: ${providerName}`);
            console.log(`      📊 统计: 新增 ${addedCount} 个, 更新 ${updatedCount} 个, 总计 ${mergedModels.length} 个模型`);
            
            if (options.verbose) {
              console.log(`      📝 详细信息:`);
              console.log(`         - 新增模型: ${addedCount > 0 ? detailedModels.slice(-addedCount).map(m => typeof m === 'string' ? m : m.name).join(', ') : '无'}`);
              console.log(`         - 更新模型: ${updatedCount > 0 ? '已更新' + updatedCount + '个现有模型' : '无'}`);
              console.log(`         - 保留模型: ${existingModels.length - updatedCount} 个现有模型配置已保留`);
            }
            break;
          }
        }
      }
      
      if (!providerUpdated) {
        throw new Error(`Provider '${providerName}' not found in configuration`);
      }
      
      // 写回配置文件（使用用户友好的格式化输出）
      const updatedConfig = JQJsonHandler.stringifyJson(parsedConfig, false);
      fs.writeFileSync(configPath, updatedConfig, 'utf8');
      
      console.log(`   💾 Configuration file updated successfully`);
      
    } catch (error) {
      console.error(`   ❌ Failed to update configuration file:`, error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.error('      Please check if the configuration file exists and is accessible');
      } else if (error instanceof Error && error.message.includes('EACCES')) {
        console.error('      Please check if you have write permissions for the configuration file');
      }
      throw error;
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';

    if (!this.options.suppressOutput) {
      console.error(`❌ Error: ${message}`);
    }

    if (this.options.exitOnError) {
      process.exit(1);
    } else {
      throw error;
    }
  }

  /**
   * 启动服务器（实际实现）
   */
  private async startServer(options: StartOptions): Promise<void> {
    try {
      // 🎯 自动检测并清理端口占用
      if (options.port) {
        await this.cleanupPortIfOccupied(options.port);
      }

      // 🔧 配置secureLogger启用文件日志记录
      if (options.port) {
        secureLogger.configureFileLogging(options.port, './test-debug-logs');
        secureLogger.info('启用文件日志记录', {
          port: options.port,
          debugLogsPath: './test-debug-logs'
        });
      }

      // 初始化流水线生命周期管理器
      // 需要系统配置路径，使用正确的绝对路径，并传递debug选项和CLI端口参数
      const systemConfigPath = this.getSystemConfigPath();
      this.pipelineManager = new PipelineLifecycleManager(options.config, systemConfigPath, options.debug, options.port);
      
      // 将实例保存到全局变量，以便信号处理程序能够访问
      (global as any).pipelineLifecycleManager = this.pipelineManager;

      // 启动RCC v4.0流水线系统
      const success = await this.pipelineManager.start();
      if (!success) {
        throw new Error('Pipeline system failed to start');
      }

      // 监听流水线事件
      this.setupPipelineEventListeners();

      secureLogger.info('RCC Server started with pipeline system', {
        port: options.port,
        host: options.host || '0.0.0.0',
        config: options.config,
        debug: options.debug,
      });
    } catch (error) {
      secureLogger.error('Failed to start RCC server', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 停止服务器（实际实现）
   */
  private async stopServer(options: StopOptions): Promise<void> {
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
          secureLogger.info('RCC Server force killed', { port, pid });
        } else {
          // 发送TERM信号尝试优雅关闭
          await this.sendTermSignal(pid);
          
          // 等待进程关闭
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // 再次检查，如果还在运行则强制终止
          const stillRunning = await this.findProcessOnPort(port);
          if (stillRunning) {
            await this.forceKillProcess(stillRunning);
            secureLogger.info('RCC Server force killed after TERM timeout', { port, pid: stillRunning });
          }
        }
      }
      
      // 清理本地实例
      if (this.pipelineManager) {
        await this.pipelineManager.stop();
        this.pipelineManager = undefined;
      }
      
      // 清理全局实例
      (global as any).pipelineLifecycleManager = undefined;

      secureLogger.info('RCC Server stopped successfully', {
        port,
        force: options.force,
      });
    } catch (error) {
      secureLogger.error('Failed to stop RCC server', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * 尝试通过HTTP端点优雅停止服务器
   */
  private async attemptGracefulStop(port: number): Promise<void> {
    try {
      const http = require('http');
      const postData = JQJsonHandler.stringifyJson({ action: 'shutdown' });
      
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
          res.on('data', () => {});
          res.on('end', () => resolve(undefined));
        });

        // 设置最大监听器数量，防止内存泄漏警告
        req.setMaxListeners(20);

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
    } catch (error) {
      // 忽略HTTP停止失败，继续其他方法
    }
  }

  /**
   * 查找占用指定端口的进程ID
   */
  private async findProcessOnPort(port: number): Promise<number | null> {
    try {
      const { execSync } = require('child_process');
      const result = execSync(`lsof -ti :${port}`, { encoding: 'utf8', timeout: 5000 });
      const pid = parseInt(result.trim());
      return isNaN(pid) ? null : pid;
    } catch (error) {
      return null;
    }
  }

  /**
   * 发送TERM信号给进程
   */
  private async sendTermSignal(pid: number): Promise<void> {
    try {
      const { execSync } = require('child_process');
      execSync(`kill -TERM ${pid}`, { timeout: 5000 });
    } catch (error) {
      // 忽略错误，后续会强制终止
    }
  }

  /**
   * 强制终止进程
   */
  private async forceKillProcess(pid: number): Promise<void> {
    try {
      const { execSync } = require('child_process');
      execSync(`kill -9 ${pid}`, { timeout: 5000 });
    } catch (error) {
      throw new Error(`Failed to force kill process ${pid}: ${error.message}`);
    }
  }

  /**
   * 自动检测并清理端口占用
   */
  private async cleanupPortIfOccupied(port: number): Promise<void> {
    try {
      const pid = await this.findProcessOnPort(port);
      
      if (pid) {
        if (!this.options.suppressOutput) {
          console.log(`⚠️  Port ${port} is occupied by process ${pid}, attempting cleanup...`);
        }
        
        secureLogger.info('Auto-cleaning occupied port', { port, pid });
        
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
          
          secureLogger.info('Port cleanup: force killed process', { port, pid: stillRunning });
        } else {
          if (!this.options.suppressOutput) {
            console.log(`✅ Process ${pid} gracefully stopped, port ${port} is now available`);
          }
          
          secureLogger.info('Port cleanup: graceful shutdown successful', { port, pid });
        }
        
        // 再等待一小段时间确保端口完全释放
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } else {
        secureLogger.debug('Port is available', { port });
      }
    } catch (error) {
      secureLogger.warn('Port cleanup failed', { 
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
  private async startClientMode(options: CodeOptions): Promise<void> {
    const port = options.port || getServerPort();
    const baseUrl = `http://localhost:${port}`;
    const apiKey = 'rcc4-proxy-key';

    // 设置环境变量
    process.env.ANTHROPIC_BASE_URL = baseUrl;
    process.env.ANTHROPIC_API_KEY = apiKey;

    secureLogger.info('启动Claude Code客户端模式', {
      baseUrl,
      port,
      apiKey: 'rcc4-proxy-key'
    });

    // 启动 happy-cli 子进程
    const spawn = require('child_process').spawn;
    
    try {
      // 获取 happy-cli 路径
      const happyCliPath = path.resolve(os.homedir(), 'Documents/github/happy-cli');
      const entrypoint = path.join(happyCliPath, 'dist', 'index.mjs');

      if (!require('fs').existsSync(entrypoint)) {
        secureLogger.warn('[Happy-CLI] Entrypoint not found, falling back to claude command.', { entrypoint });
        if (!this.options.suppressOutput) {
          console.warn('⚠️  [Happy-CLI] Could not find happy-cli, falling back to claude command.');
        }
        // 回退到原始的 claude 命令
        return this.startClaudeDirectly(options, baseUrl, apiKey);
      }

      // 传递所有命令行参数给 happy-cli，除了 rcc4 特定的参数
      const originalArgs = process.argv.slice(2);
      const happyCliArgs: string[] = [];
      
      // 跳过 rcc4 特定参数和它们的值
      for (let i = 0; i < originalArgs.length; i++) {
        const arg = originalArgs[i];
        const nextArg = originalArgs[i + 1];
        
        if (arg === 'code') {
          // 跳过code命令
          continue;
        } else if (arg === '--port' && nextArg) {
          // 跳过--port及其值
          i++; // 跳过下一个参数（端口号）
          continue;
        } else if (arg === '--auto-start' || arg === '--export') {
          // 跳过这些标志
          continue;
        } else if (arg.startsWith('--port=')) {
          // 跳过--port=5506格式
          continue;
        } else {
          // 保留其他所有参数
          happyCliArgs.push(arg);
        }
      }

      // 如果没有参数，让 happy-cli 使用默认行为

      secureLogger.info('启动happy-cli命令', {
        happyCliArgs,
        entrypoint,
        env: {
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_API_KEY: apiKey
        }
      });

      const happyCli = spawn('node', [entrypoint, ...happyCliArgs], {
        stdio: 'inherit',  // 恢复inherit模式以确保交互正常
        env: {
          ...process.env,
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_API_KEY: apiKey
        }
      });

      // 添加错误处理但不拦截stdio
      process.stdin.on('error', (error: any) => {
        if (error.code === 'EIO') {
          secureLogger.warn('终端stdin EIO错误，通常是终端断开导致', { error: error.message });
          // EIO错误不是致命的，继续运行
          return;
        }
        secureLogger.error('Process stdin严重错误', { error: error.message });
      });

      process.stdout.on('error', (error: any) => {
        if (error.code === 'EIO' || error.code === 'EPIPE') {
          secureLogger.warn('终端输出管道错误，通常是终端断开导致', { error: error.message });
          return;
        }
        secureLogger.error('Process stdout严重错误', { error: error.message });
      });

      process.stderr.on('error', (error: any) => {
        if (error.code === 'EIO' || error.code === 'EPIPE') {
          secureLogger.warn('终端错误输出管道错误', { error: error.message });
          return;
        }
        secureLogger.error('Process stderr严重错误', { error: error.message });
      });

      happyCli.on('close', (code) => {
        secureLogger.info('Happy-CLI进程退出', { exitCode: code });
        process.exit(code || 0);
      });

      happyCli.on('error', (error) => {
        secureLogger.error('Happy-CLI进程错误', { error: error.message });
        console.error(`❌ Failed to start happy-cli: ${error.message}`);
        process.exit(1);
      });

      // 等待一小段时间确保happy-cli启动
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      secureLogger.error('启动happy-cli客户端失败', { error: error.message });
      // 如果 happy-cli 启动失败，回退到 claude 命令
      if (!this.options.suppressOutput) {
        console.warn('⚠️  Failed to start happy-cli, falling back to claude command.');
      }
      return this.startClaudeDirectly(options, baseUrl, apiKey);
    }
  }

  /**
   * 导出客户端配置
   */
  private async exportClientConfig(options: CodeOptions): Promise<void> {
    const envVars = [
      `export ANTHROPIC_BASE_URL=http://localhost:${options.port || getServerPort()}`,
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
  private async getServerStatus(options: StatusOptions): Promise<ServerStatus> {
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
            status:
              stats.requestProcessorStats.layerHealth && Object.keys(stats.requestProcessorStats.layerHealth).length > 0
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
  private displayServerStatus(status: ServerStatus, detailed: boolean): void {
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
  private getHealthStatusIcon(status: string): string {
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
  private async listConfigurations(): Promise<void> {
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
  private async validateConfiguration(path?: string): Promise<void> {
    try {
      const configPath = path || this.getSystemConfigPath();
      if (!this.options.suppressOutput) {
        console.log(`🔍 Validating configuration: ${configPath}`);
      }

      // 加载配置
      const config = ConfigReader.loadConfig(configPath, this.getSystemConfigPath());
      let hasErrors = false;

      // 验证Provider配置
      if (config.providers && Array.isArray(config.providers)) {
        for (const provider of config.providers) {
          const providerErrors = await this.validateProvider(provider);
          if (providerErrors.length > 0) {
            hasErrors = true;
            console.error(`❌ Provider '${provider.name}' validation failed:`);
            providerErrors.forEach(error => console.error(`   - ${error}`));
          }
        }
      } else {
        hasErrors = true;
        console.error('❌ No valid providers found in configuration');
      }

      // 验证路由配置
      if (config.router) {
        const routeErrors = this.validateRouterConfig(config.router);
        if (routeErrors.length > 0) {
          hasErrors = true;
          console.error('❌ Router configuration validation failed:');
          routeErrors.forEach(error => console.error(`   - ${error}`));
        }
      }

      if (!hasErrors) {
        if (!this.options.suppressOutput) {
          console.log(`✅ Configuration ${path || 'default'} is valid`);
        }
      } else {
        throw new Error('Configuration validation failed');
      }
    } catch (error) {
      throw new Error(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 验证单个Provider配置
   */
  private async validateProvider(provider: any): Promise<string[]> {
    const errors: string[] = [];

    // 必需字段验证
    if (!provider.name) {
      errors.push('Missing required field: name');
    }
    if (!provider.api_base_url && !provider.endpoint) {
      errors.push('Missing required field: api_base_url or endpoint');
    }
    if (!provider.api_key && !provider.apiKeys) {
      errors.push('Missing required field: api_key or apiKeys');
    }

    // API endpoint格式验证
    const endpoint = provider.api_base_url || provider.endpoint;
    if (endpoint) {
      try {
        new URL(endpoint);
        
        // 特定Provider的endpoint验证
        if (provider.name === 'modelscope' && endpoint.includes('api.modelscope.cn')) {
          errors.push('Incorrect ModelScope endpoint: should use api-inference.modelscope.cn instead of api.modelscope.cn');
        }
      } catch {
        errors.push(`Invalid URL format: ${endpoint}`);
      }
    }

    // 连接性测试 (可选，仅在verbose模式)
    if (endpoint && provider.api_key && process.argv.includes('--verbose')) {
      try {
        const testUrl = endpoint.endsWith('/v1/models') ? endpoint : `${endpoint}/v1/models`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${Array.isArray(provider.api_key) ? provider.api_key[0] : provider.api_key}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          errors.push(`API connectivity test failed: HTTP ${response.status}`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          errors.push('API connectivity test timed out');
        } else if (error.code === 'ENOTFOUND') {
          errors.push(`DNS resolution failed for endpoint: ${endpoint}`);
        } else {
          errors.push(`API connectivity test failed: ${error.message}`);
        }
      }
    }

    return errors;
  }

  /**
   * 验证路由配置
   */
  private validateRouterConfig(router: any): string[] {
    const errors: string[] = [];
    
    const requiredRoutes = ['default', 'coding'];
    for (const route of requiredRoutes) {
      if (!router[route]) {
        errors.push(`Missing required route: ${route}`);
      }
    }

    return errors;
  }

  /**
   * 获取系统配置文件路径
   */
  private getSystemConfigPath(): string {
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
    } catch (error) {
      // 文件不存在，使用开发环境路径作为fallback
      secureLogger.warn('User system config not found, using development path', { 
        attempted: userConfigPath,
        fallback: 'config/system-config.json'
      });
      return 'config/system-config.json';
    }
  }

  /**
   * 重置配置
   */
  private async resetConfiguration(): Promise<void> {
    if (!this.options.suppressOutput) {
      console.log('🔄 Configuration reset to defaults');
    }
  }

  /**
   * 设置流水线事件监听器
   */
  private setupPipelineEventListeners(): void {
    if (!this.pipelineManager) {
      return;
    }

    this.pipelineManager.on('pipeline-started', () => {
      secureLogger.info('Pipeline system started successfully');
    });

    this.pipelineManager.on('layers-ready', () => {
      secureLogger.info('All pipeline layers are ready');
    });

    this.pipelineManager.on('layers-error', error => {
      secureLogger.error('Pipeline layer error', { error: error.message });
    });

    this.pipelineManager.on('request-completed', data => {
      secureLogger.debug('Request completed successfully', {
        requestId: data.requestId,
        success: data.success,
      });
    });

    this.pipelineManager.on('request-failed', data => {
      secureLogger.warn('Request failed', {
        requestId: data.requestId,
        error: data.error.message,
      });
    });

    this.pipelineManager.on('pipeline-stopped', () => {
      secureLogger.info('Pipeline system stopped');
    });
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * API动态模型获取功能 - 内联实现
   */
  /**
   * 增强版模型获取 - 支持能力测试和429重试
   */
  private async fetchModelsForProvider(providerType: string, provider: any, staticFallback: string[], options: any = {}): Promise<FetchedModel[]> {
    try {
      const apiKey = provider.api_key || provider.apiKeys?.[0] || 'default-key';
      
      // 使用provider配置中的api_base_url，不依赖硬编码映射
      if (!provider.api_base_url) {
        throw new Error(`Provider ${provider.name || providerType} 缺少 api_base_url 配置`);
      }
      
      // 智能推断 models API 端点
      let modelsEndpoint: string;
      const apiBaseUrl = provider.api_base_url.replace(/\/+$/, ''); // 移除末尾的/
      
      if (apiBaseUrl.includes('/chat/completions')) {
        // 如果 api_base_url 包含 /chat/completions，则替换为 /models
        modelsEndpoint = apiBaseUrl.replace('/chat/completions', '/models');
      } else if (apiBaseUrl.endsWith('/v1')) {
        // 如果以 /v1 结尾，直接添加 /models
        modelsEndpoint = `${apiBaseUrl}/models`;
      } else {
        // 其他情况，假设需要添加 /v1/models
        modelsEndpoint = `${apiBaseUrl}/v1/models`;
      }

      secureLogger.info(`Fetching models from ${providerType} API with enhanced testing`, {
        endpoint: modelsEndpoint,
        provider: provider.name
      });

      // 获取模型列表（带429重试）
      const rawModels = await this.fetchModelsWithRetry(modelsEndpoint, apiKey);
      
      const fetchedModels: FetchedModel[] = [];
      const testedModels: FetchedModel[] = [];

      // 第一轮：基础分类和过滤
      for (const rawModel of rawModels) {
        const modelName = rawModel.id || rawModel.name || 'unknown-model';
        
        // 尝试从API响应中提取真实的上下文长度
        let contextLength: number;
        if (rawModel.context_length || rawModel.contextLength || rawModel.max_tokens || rawModel.maxTokens) {
          contextLength = rawModel.context_length || rawModel.contextLength || rawModel.max_tokens || rawModel.maxTokens;
          secureLogger.debug(`Found API context length for ${modelName}`, {
            apiContextLength: contextLength,
            source: rawModel.context_length ? 'context_length' : 
                    rawModel.contextLength ? 'contextLength' :
                    rawModel.max_tokens ? 'max_tokens' : 'maxTokens'
          });
        } else {
          // 回退到精确映射表
          contextLength = this.extractContextLength(modelName, providerType);
          secureLogger.debug(`Using mapped context length for ${modelName}`, {
            mappedContextLength: contextLength,
            source: 'precise_mapping'
          });
        }
        
        const classification = this.classifyModel(modelName, contextLength);

        // Skip blacklisted models
        if (classification.blacklisted) {
          this.blacklistedModels.add(modelName);
          secureLogger.info(`🚫 Blacklisted model: ${modelName} - ${classification.blacklistReason}`);
          continue;
        }

        // Check user-defined blacklist in provider config
        if (provider.model_blacklist && Array.isArray(provider.model_blacklist)) {
          const userBlacklist = provider.model_blacklist.filter(item => 
            typeof item === 'string' && !item.startsWith('//') && item.trim() !== ''
          );
          
          if (userBlacklist.some(blacklistedModel => 
            modelName === blacklistedModel || modelName.includes(blacklistedModel)
          )) {
            this.blacklistedModels.add(modelName);
            secureLogger.info(`🚫 User blacklisted model: ${modelName} - Found in provider.model_blacklist`);
            console.log(`🚫 User blacklisted model: ${modelName} - Found in provider.model_blacklist`);
            continue;
          }
        }

        const fetchedModel: FetchedModel = {
          id: modelName,
          name: modelName,
          maxTokens: contextLength,
          classification,
          provider: providerType,
          createdAt: new Date().toISOString()
        };

        fetchedModels.push(fetchedModel);
      }

      console.log(`📋 Initial filtering: ${fetchedModels.length}/${rawModels.length} models passed basic classification`);
      
      // 快速模式历史记录检查
      if (options.fast) {
        console.log('⚡ Fast mode enabled - checking test history...');
        const historyStats = {
          skipped: 0,
          newModels: 0,
          failedModels: 0,
          lowContextModels: 0
        };
        
        const modelsToTest: FetchedModel[] = [];
        
        for (const model of fetchedModels) {
          const skipResult = await this.historyManager.shouldSkipModel(providerType, model.name, 'full');
          
          if (skipResult.shouldSkip && skipResult.record) {
            // 使用历史记录中的数据
            model.classification.contextLength = skipResult.record.result.contextLength || model.classification.contextLength;
            model.maxTokens = skipResult.record.result.maxTokens || model.maxTokens;
            if (skipResult.record.result.category) {
              // 只设置兼容的category类型
              const compatibleCategories = ['multimodal', 'reasoning', 'programming', 'general'] as const;
              if (compatibleCategories.includes(skipResult.record.result.category as any)) {
                model.classification.category = skipResult.record.result.category as any;
              }
            }
            
            // 检查是否是低上下文模型需要重新测试
            if (skipResult.record.result.contextLength && skipResult.record.result.contextLength < 128000) {
              console.log(`🔄 ${model.name}: Low context (${skipResult.record.result.contextLength} < 128K), re-testing...`);
              modelsToTest.push(model);
              historyStats.lowContextModels++;
            } else {
              console.log(`⏩ ${model.name}: Skipped (successful test from ${skipResult.record.testedAt.split('T')[0]})`);
              testedModels.push(model);
              historyStats.skipped++;
            }
          } else {
            if (skipResult.reason === 'no_history') {
              console.log(`🆕 ${model.name}: New model, will test`);
              historyStats.newModels++;
            } else if (skipResult.reason === 'previous_failed') {
              console.log(`🔄 ${model.name}: Previous test failed, re-testing...`);
              historyStats.failedModels++;
            } else {
              console.log(`🔄 ${model.name}: ${skipResult.reason}, will test`);
            }
            modelsToTest.push(model);
          }
        }
        
        console.log(`📊 Fast mode statistics:`);
        console.log(`   ⏩ Skipped: ${historyStats.skipped} models`);
        console.log(`   🆕 New models: ${historyStats.newModels}`);
        console.log(`   ❌ Failed retries: ${historyStats.failedModels}`);
        console.log(`   🔄 Low context retries: ${historyStats.lowContextModels}`);
        console.log(`   🧪 Total to test: ${modelsToTest.length}`);
        
        // 在快速模式下只测试需要测试的模型
        fetchedModels.length = 0;
        fetchedModels.push(...modelsToTest);
      }
      
      // 第二轮：上下文长度测试（512K测试，过滤<64K）
      console.log(`🔍 Starting context length testing with 512K tokens...`);
      for (const model of fetchedModels) {
        try {
          const testedModel = await this.testModelContextLength(model, provider, 512000); // 512K测试
          if (testedModel.classification.contextLength >= 65536) { // 保留>=64K的模型
            testedModels.push(testedModel);
            console.log(`✅ ${model.name}: Context ${testedModel.classification.contextLength} tokens (${testedModel.classification.capabilities.join(', ')})`);
          } else {
            console.log(`🚫 ${model.name}: Context too small (${testedModel.classification.contextLength} < 64K)`);
          }
        } catch (error) {
          console.log(`⚠️  ${model.name}: Context test failed - ${error.message}`);
          // 测试失败的模型使用原始分类，但标记为需要人工验证
          model.classification.capabilities.push('test-failed');
          testedModels.push(model);
        }
      }

      // 第三轮：可用性和多模态能力测试
      console.log(`🧪 Starting availability and multimodal capability testing...`);
      const finalModels: FetchedModel[] = [];
      
      for (const model of testedModels) {
        try {
          // 基础可用性测试
          const availabilityTest = await this.testModelAvailability(model, provider);
          if (!availabilityTest.available) {
            console.log(`❌ ${model.name}: Not available - ${availabilityTest.reason}`);
            continue;
          }
          
          // 多模态能力测试（仅对可能的多模态模型）
          if (model.classification.hasImageProcessing) {
            const multimodalTest = await this.testMultimodalCapability(model, provider);
            if (multimodalTest.hasMultimodal) {
              model.classification.capabilities.push('confirmed-multimodal');
              console.log(`🖼️  ${model.name}: ✅ Multimodal confirmed (${multimodalTest.supportedTypes.join(', ')})`);
            } else {
              // 移除多模态标记
              model.classification.hasImageProcessing = false;
              model.classification.capabilities = model.classification.capabilities.filter(cap => 
                !['image-processing', 'multimodal'].includes(cap));
              if (model.classification.category === 'multimodal') {
                model.classification.category = 'programming';
              }
              console.log(`📝 ${model.name}: ❌ Multimodal test failed, reclassified as programming model`);
            }
          }
          
          finalModels.push(model);
          console.log(`✅ ${model.name}: Final classification - ${model.classification.category} (${model.classification.capabilities.join(', ')})`);
          
          // 保存成功测试结果到历史记录
          try {
            await this.historyManager.saveTestRecord({
              providerName: providerType,
              modelName: model.name,
              testType: 'full',
              status: 'success',
              result: {
                category: model.classification.category,
                contextLength: model.classification.contextLength,
                maxTokens: model.maxTokens,
                available: true,
                multimodal: model.classification.hasImageProcessing,
                duration: Date.now() - (model as any)._testStartTime || 0,
                endpoint: provider.api_base_url
              },
              testedAt: new Date().toISOString()
            });
          } catch (historyError) {
            // 历史记录保存失败不应该影响主流程
            secureLogger.error('Failed to save test history', {
              model: model.name,
              error: historyError.message
            });
          }
          
        } catch (error) {
          if (error.message.includes('429')) {
            console.log(`⏳ ${model.name}: Rate limited, will retry later...`);
            // 将模型添加到延迟测试队列
            finalModels.push(model);
          } else {
            console.log(`❌ ${model.name}: Capability test failed - ${error.message}`);
            
            // 保存失败测试结果到历史记录
            try {
              await this.historyManager.saveTestRecord({
                providerName: providerType,
                modelName: model.name,
                testType: 'full',
                status: 'failed',
                result: {
                  category: model.classification.category,
                  contextLength: model.classification.contextLength,
                  maxTokens: model.maxTokens,
                  available: false,
                  multimodal: model.classification.hasImageProcessing,
                  error: error.message,
                  endpoint: provider.api_base_url
                },
                testedAt: new Date().toISOString()
              });
            } catch (historyError) {
              secureLogger.error('Failed to save test history for failed model', {
                model: model.name,
                error: historyError.message
              });
            }
          }
        }
      }

      secureLogger.info(`Enhanced model fetching completed for ${providerType}`, {
        totalRaw: rawModels.length,
        afterFiltering: fetchedModels.length,
        afterContextTest: testedModels.length,
        final: finalModels.length,
        multimodalConfirmed: finalModels.filter(m => m.classification.capabilities.includes('confirmed-multimodal')).length,
        longContextModels: finalModels.filter(m => m.classification.capabilities.includes('extended-long-context')).length
      });

      return finalModels;

    } catch (error) {
      secureLogger.error(`Failed to fetch models from ${providerType}`, {
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
  private extractContextLength(modelName: string, providerType: string): number {
    const lowerName = modelName.toLowerCase();
    
    // 精确的模型上下文长度映射表
    const modelMaxTokens: Record<string, number> = {
      // Qwen模型系列
      'qwen3-coder-plus': 1000000,        // 1M上下文
      'qwen3-coder-flash': 1000000,       // 1M上下文  
      'qwen-max': 2000000,                // 2M上下文
      'qwen-plus': 1000000,               // 1M上下文
      'qwen-turbo': 1000000,              // 1M上下文
      'qwen-long': 10000000,              // 10M长上下文
      'qwen2.5-72b-instruct': 131072,     // 128K上下文
      'qwen2.5-32b-instruct': 131072,     // 128K上下文
      'qwen2.5-14b-instruct': 131072,     // 128K上下文
      'qwen2.5-7b-instruct': 131072,      // 128K上下文
      'qwen2.5-coder-32b-instruct': 131072, // 128K上下文
      'qwen2.5-coder-14b-instruct': 131072, // 128K上下文
      'qwen2.5-coder-7b-instruct': 131072,  // 128K上下文
      'qwq-32b-preview': 1000000,         // 1M推理模型
      
      // Shuaihong代理模型系列
      'gemini-2.5-pro': 2097152,          // 2M上下文
      'gpt-4o': 128000,                   // 128K上下文
      'gpt-4o-mini': 128000,              // 128K上下文  
      'claude-3-sonnet': 200000,          // 200K上下文
      'claude-3-haiku': 200000,           // 200K上下文
      'claude-3-opus': 200000,            // 200K上下文
      
      // ModelScope模型系列 (64K限制)
      'qwen3-480b': 65536,                // 64K上下文
      'llama3.1-405b-instruct': 131072,   // 128K上下文
      'llama3.1-70b-instruct': 131072,    // 128K上下文
      'deepseek-v2.5-chat': 65536,        // 64K上下文
      
      // LM Studio本地模型
      'gpt-oss-20b-mlx': 131072,          // 128K上下文
      'llama-3.1-8b': 131072,             // 128K上下文
      'codellama-34b': 100000,            // 100K上下文
      'deepseek-coder-33b': 131072,       // 128K上下文
      
      // 其他常见模型
      'gpt-3.5-turbo': 16384,             // 16K上下文 (会被拉黑)
      'gpt-4': 128000,                    // 128K上下文
      'claude-instant-1': 9000,           // 9K上下文 (会被拉黑)
      'llama-2-7b-chat': 4096,            // 4K上下文 (会被拉黑)
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
    if (lowerName.includes('32k')) return 32768;
    if (lowerName.includes('64k')) return 65536;
    if (lowerName.includes('128k')) return 131072;
    if (lowerName.includes('256k')) return 262144;
    if (lowerName.includes('1m') || lowerName.includes('1000k')) return 1000000;
    if (lowerName.includes('2m') || lowerName.includes('2000k')) return 2000000;
    if (lowerName.includes('10m')) return 10000000;
    
    // 基于模型名称特征推断
    if (lowerName.includes('long') || lowerName.includes('extended')) {
      return 1000000; // 长上下文变种
    }
    if (lowerName.includes('flash') || lowerName.includes('turbo')) {
      return 1000000; // 快速模型通常上下文较长
    }
    if (lowerName.includes('mini') || lowerName.includes('small')) {
      return 128000;  // 小模型通常上下文中等
    }
    
    // Provider特定的保守默认值
    switch (providerType) {
      case 'qwen':
        return 131072;  // Qwen保守默认128K
      case 'shuaihong':
        return 128000;  // 代理模型保守默认128K
      case 'modelscope':
        return 65536;   // ModelScope默认64K
      case 'lmstudio':
        return 131072;  // 本地模型保守默认128K
      default:
        return 131072;  // 全局保守默认128K
    }
  }

  /**
   * 智能模型分类
   */
  private classifyModel(name: string, contextLength: number): ModelClassification {
    const lowerName = name.toLowerCase();
    
    // 1. 永久过滤非大模型 - 检测嵌入模型、音频模型、图像模型
    const nonChatModelKeywords = [
      'embedding', 'embed', 'text-embedding', 'ada', 'similarity',
      'whisper', 'tts', 'speech', 'audio', 'voice',
      'dalle', 'midjourney', 'stable-diffusion', 'image-gen',
      'clip', 'blip', 'vit', 'dino'
    ];
    
    if (nonChatModelKeywords.some(keyword => lowerName.includes(keyword))) {
      return {
        contextLength,
        isProgramming: false,
        hasImageProcessing: false,
        isLongContext: false,
        category: 'general' as const,
        capabilities: [],
        blacklisted: true,
        blacklistReason: `Non-chat model: detected embedding/audio/image generation model`
      };
    }
    
    // 2. 上下文长度过滤 - 低于64K的模型拉黑
    if (contextLength < 65536) {
      return {
        contextLength,
        isProgramming: false,
        hasImageProcessing: false,
        isLongContext: false,
        category: 'general' as const,
        capabilities: [],
        blacklisted: true,
        blacklistReason: `Context length ${contextLength} < 64K threshold`
      };
    }

    // 3. 检测模型能力关键词
    const programmingKeywords = [
      'code', 'coder', 'coding', 'program', 'dev', 'developer', 
      'instruct', 'chat', 'assistant', 'tool', 'function',
      'qwen', 'codellama', 'starcoder', 'deepseek', 'gemini'
    ];
    
    // 多模态能力检测 - 重点标记
    const multimodalKeywords = [
      'vision', 'visual', 'image', 'multimodal', 'mm', 'vlm',
      'gemini', 'gpt-4o', 'claude-3', 'qwen-vl', 'llava',
      'internvl', 'cogvlm', 'blip', 'minigpt'
    ];
    
    // 推理能力检测
    const reasoningKeywords = [
      'reasoning', 'reason', 'think', 'analysis', 'logic',
      'qwq', 'o1', 'reasoning', 'deepthink', 'cot'
    ];

    // 检测具体能力
    const isProgramming = programmingKeywords.some(keyword => lowerName.includes(keyword));
    const hasImageProcessing = multimodalKeywords.some(keyword => lowerName.includes(keyword));
    const isReasoning = reasoningKeywords.some(keyword => lowerName.includes(keyword));
    const isLongContext = contextLength >= 200000; // >= 200K
    const isUltraLongContext = contextLength >= 1000000; // >= 1M
    const isExtendedLongContext = contextLength >= 256000; // >= 256K (用户要求的标记阈值)

    // 4. 通用模型判断：只要上下文窗口足够(>=64K)就允许使用
    // 不再过滤纯通用模型 - 用户反馈：通用模型并非不能编程，只要上下文窗口够
    // 已经在前面过滤了非聊天模型(embedding/audio/image)和低上下文模型(<64K)

    // 5. 确定模型分类优先级
    let category: ModelClassification['category'] = 'general'; // 默认通用模型
    if (hasImageProcessing) {
      category = 'multimodal';  // 多模态优先级最高
    } else if (isReasoning) {
      category = 'reasoning';   // 推理次之
    } else if (isProgramming) {
      category = 'programming'; // 编程模型
    }

    // 6. 构建能力标签列表
    const capabilities: string[] = [];
    if (isProgramming) capabilities.push('programming');
    if (hasImageProcessing) {
      capabilities.push('multimodal');
      capabilities.push('image-processing'); // 特别标记多模态
    }
    if (isReasoning) capabilities.push('reasoning');
    if (isLongContext) capabilities.push('long-context');
    if (isExtendedLongContext) capabilities.push('extended-long-context'); // 256K+标记
    if (isUltraLongContext) capabilities.push('ultra-long-context');

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
   * 429错误重试的模型获取
   */
  private async fetchModelsWithRetry(endpoint: string, apiKey: string, maxRetries: number = 3): Promise<any[]> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), getProviderRequestTimeout());

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) {
          const waitTime = Math.min(5000 * attempt, 30000); // 5s, 10s, 15s 最大30s
          console.log(`⏳ Rate limited (429), waiting ${waitTime/1000}s before retry ${attempt}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = JQJsonHandler.parseJsonString(await response.text());
        return data.data || data.models || [];
        
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // 网络错误也重试
        if (error.name === 'AbortError' || error.message.includes('fetch')) {
          const waitTime = 2000 * attempt;
          console.log(`🔄 Network error, retrying in ${waitTime/1000}s... (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Max retries exceeded');
  }

  /**
   * 测试模型上下文长度 - 通过max_tokens参数递归测试
   */
  private async testModelContextLength(model: FetchedModel, provider: any, testTokens: number): Promise<FetchedModel> {
    return await this.recursiveTokenTest(model, provider, testTokens, 4096, 5); // 最小4K，最多5次重试
  }

  /**
   * 递归测试token长度 - 实现二分查找逻辑
   */
  private async recursiveTokenTest(model: FetchedModel, provider: any, currentTokens: number, minTokens: number = 4096, maxRetries: number = 5): Promise<FetchedModel> {
    if (maxRetries <= 0 || currentTokens < minTokens) {
      // 达到最大重试次数或低于最小值，使用当前值
      model.maxTokens = Math.max(currentTokens, minTokens);
      model.classification = this.classifyModel(model.name, model.maxTokens);
      return model;
    }

    try {
      const chatEndpoint = `${provider.api_base_url}/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s超时

      console.log(`🔍 Testing ${model.name} with ${currentTokens} max_tokens (${maxRetries} retries left)`);

      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JQJsonHandler.stringifyJson({
          model: model.name,
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: currentTokens
        }, true),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 413 || response.status === 400) {
        // max_tokens太大，折半继续测试
        const nextTokens = Math.floor(currentTokens * 0.5);
        console.log(`❌ ${currentTokens} tokens failed, trying ${nextTokens} tokens`);
        return await this.recursiveTokenTest(model, provider, nextTokens, minTokens, maxRetries - 1);
      } else if (response.ok) {
        // 成功！使用当前值
        console.log(`✅ ${currentTokens} tokens succeeded`);
        model.maxTokens = currentTokens;
        model.classification = this.classifyModel(model.name, currentTokens);
        return model;
      } else {
        throw new Error(`Context test failed: ${response.status}`);
      }
      
    } catch (error) {
      if (error.message && error.message.includes('429')) {
        throw error; // 429错误向上传递
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`⏱️  Context test timeout for ${model.name}, reducing tokens and retrying`);
        // 超时也视为当前值太大，折半重试
        const nextTokens = Math.floor(currentTokens * 0.5);
        return await this.recursiveTokenTest(model, provider, nextTokens, minTokens, maxRetries - 1);
      } else {
        console.log(`⚠️  Context test failed for ${model.name}:`, error instanceof Error ? error.message : 'Unknown error');
        // 网络错误等，使用保守估计
        model.maxTokens = Math.max(Math.floor(currentTokens * 0.5), minTokens);
        model.classification = this.classifyModel(model.name, model.maxTokens);
        return model;
      }
    }
  }

  /**
   * 测试模型可用性
   */
  private async testModelAvailability(model: FetchedModel, provider: any): Promise<{available: boolean, reason?: string}> {
    try {
      const chatEndpoint = `${provider.api_base_url}/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), getProviderRequestTimeout());

      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JQJsonHandler.stringifyJson({
          model: model.name,
          messages: [{ role: 'user', content: 'Hello' }]
        }, true),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return { available: false, reason: 'Model not found (404)' };
      } else if (response.status === 403) {
        return { available: false, reason: 'Access denied (403)' };
      } else if (response.status === 429) {
        throw new Error('429: Rate limited');
      } else if (response.ok || response.status === 400) {
        // 200 OK 或 400 (bad request) 都说明模型存在
        return { available: true };
      } else {
        return { available: false, reason: `HTTP ${response.status}` };
      }
      
    } catch (error) {
      if (error.message.includes('429')) {
        throw error; // 429错误向上传递
      }
      return { available: false, reason: error.message };
    }
  }

  /**
   * 测试多模态能力
   */
  private async testMultimodalCapability(model: FetchedModel, provider: any): Promise<{hasMultimodal: boolean, supportedTypes: string[]}> {
    try {
      const chatEndpoint = `${provider.api_base_url}/chat/completions`;
      
      // 测试图像处理能力
      const testImageMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'What do you see in this image?' },
          { 
            type: 'image_url', 
            image_url: { 
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' 
            }
          }
        ]
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), getProviderRequestTimeout());

      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${provider.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JQJsonHandler.stringifyJson({
          model: model.name,
          messages: [testImageMessage]
        }, true),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error('429: Rate limited');
      }
      
      if (response.ok) {
        const data = JQJsonHandler.parseJsonString(await response.text());
        if (data.choices && data.choices[0]?.message?.content) {
          return { hasMultimodal: true, supportedTypes: ['image'] };
        }
      } else if (response.status === 400) {
        // 400错误可能表示不支持multimodal格式
        const errorData = JQJsonHandler.parseJsonString(await response.text()).catch(() => ({}));
        if (errorData.error?.message?.includes('image') || errorData.error?.message?.includes('multimodal')) {
          return { hasMultimodal: false, supportedTypes: [] };
        }
      }
      
      return { hasMultimodal: false, supportedTypes: [] };
      
    } catch (error) {
      if (error.message.includes('429')) {
        throw error; // 429错误向上传递
      }
      return { hasMultimodal: false, supportedTypes: [] };
    }
  }

  /**
   * 生成长测试消息
   */
  private generateLongTestMessage(targetTokens: number): string {
    // 估算：平均每个英文单词约1.3个token，每个中文字符约1个token
    const wordsNeeded = Math.floor(targetTokens / 1.3);
    const paragraph = 'The quick brown fox jumps over the lazy dog. This is a sample text for testing purposes. ';
    const repetitions = Math.ceil(wordsNeeded / (paragraph.split(' ').length));
    
    return Array(repetitions).fill(paragraph).join('\n');
  }

  /**
   * 获取Provider的默认端点 (已废弃 - 现在使用配置驱动)
   */
  private getDefaultEndpointForProvider(providerType: string): string {
    // 保留向后兼容，但应该使用provider.api_base_url
    switch (providerType) {
      case 'qwen':
        return 'https://dashscope.aliyuncs.com/v1';
      case 'modelscope':
        return 'https://api-inference.modelscope.cn/v1';
      case 'shuaihong':
        return 'https://api.shuaihong.com/v1';
      case 'lmstudio':
        return 'http://localhost:1234/v1';
      default:
        return 'http://localhost:1234/v1';
    }
  }
  /**
   * Directly starts the Claude command (as a fallback for happy-cli).
   * @internal
   * @private
   */
  private async startClaudeDirectly(options: CodeOptions, baseUrl: string, apiKey: string): Promise<void> {
    try {
      // 查找 Claude 可执行文件
      const claudeCommand = await this.findClaudeExecutable();
      
      if (!claudeCommand) {
        console.error('❌ Claude 命令未找到。请确保已安装 Claude CLI。');
        return;
      }

      console.log(`📍 Found Claude at: ${claudeCommand}`);
      console.log('🚀 Starting Claude with RCC proxy integration...');

      // 设置环境变量
      const env = {
        ...process.env,
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_API_KEY: apiKey,
        RCC_PROXY_MODE: 'active',
      };

      // 启动 Claude 进程
      const claudeProcess = spawn(claudeCommand, [], {
        env,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      claudeProcess.on('error', (error: any) => {
        console.error('❌ Failed to start Claude:', error.message);
        process.exit(1);
      });

      claudeProcess.on('exit', (code: number | null) => {
        console.log(`👋 Claude exited with code ${code}`);
        process.exit(code || 0);
      });

      // 处理进程信号
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping Claude proxy...');
        claudeProcess.kill('SIGINT');
      });

      process.on('SIGTERM', () => {
        console.log('\n🛑 Terminating Claude proxy...');
        claudeProcess.kill('SIGTERM');
      });

      console.log('✅ Claude started with RCC proxy integration');
      console.log('💡 All AI requests will be transparently routed through RCC');
      console.log(`🌐 Proxy URL: ${baseUrl}`);

    } catch (error: any) {
      console.error('❌ Failed to start Claude directly:', error.message);
      throw error;
    }
  }

  /**
   * 查找 Claude 可执行文件
   */
  private async findClaudeExecutable(): Promise<string | null> {
    const { execSync } = await import('child_process');

    try {
      // 尝试通过 which/where 命令查找
      const command = process.platform === 'win32' ? 'where' : 'which';
      const result = execSync(`${command} claude`, { encoding: 'utf8' });
      return result.trim();
    } catch (error) {
      return null;
    }
  }
}

/**
 * 模型分类接口
 */
interface ModelClassification {
  contextLength: number;
  isProgramming: boolean;
  hasImageProcessing: boolean;
  isLongContext: boolean;
  category: 'programming' | 'general' | 'multimodal' | 'reasoning';
  capabilities: string[];
  blacklisted: boolean;
  blacklistReason?: string;
}

/**
 * 获取的模型接口
 */
interface FetchedModel {
  id: string;
  name: string;
  maxTokens: number;
  classification: ModelClassification;
  provider: string;
  createdAt: string;
}

/**
 * 模型分组接口
 */
interface ModelGroups {
  multimodal: any[];
  extendedLongContext: any[];
  ultraLongContext: any[];
  programming: any[];
  reasoning: any[];
  general: any[];
}
