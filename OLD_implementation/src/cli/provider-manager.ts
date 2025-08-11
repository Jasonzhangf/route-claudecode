#!/usr/bin/env node

/**
 * Provider管理器 - 集成动态模型发现到rcc命令
 * 项目所有者: Jason Zhang
 */

import { readdir, readFile, writeFile, stat, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import { createDynamicModelConfigManager, DEFAULT_MODEL_CONFIG_MANAGER_CONFIG } from '../utils/dynamic-model-config-manager';
import { DynamicModelDiscovery, createDynamicModelDiscovery, ModelInfo } from '../utils/dynamic-model-discovery';
import { ProviderConfig, RouterConfig } from '../types';

export interface ProviderUpdateResult {
  providerId: string;
  totalModelsFound: number;
  availableModels: string[];
  unavailableModels: string[];
  configFiles: {
    single: string;
    loadBalancing?: string;
    openaiMixed?: string;
  };
  averageResponseTime: number;
  errors: string[];
  success: boolean;
}

export interface UpdateSummary {
  totalProviders: number;
  successfulUpdates: number;
  totalModelsDiscovered: number;
  totalAvailableModels: number;
  configFilesGenerated: string[];
  errors: string[];
  recommendations: string[];
}

/**
 * Provider管理器主类
 */
export class ProviderManager {
  private configBaseDir: string;
  private dynamicConfigDir: string;

  constructor() {
    this.configBaseDir = join(homedir(), '.route-claude-code', 'config');
    this.dynamicConfigDir = join(this.configBaseDir, 'dynamic');
  }

  /**
   * 主要的provider更新功能
   */
  async updateAllProviders(options: {
    timeout?: number;
    maxRetries?: number;
    skipBackup?: boolean;
    verbose?: boolean;
  } = {}): Promise<UpdateSummary> {
    const startTime = Date.now();
    console.log(chalk.cyan('🚀 Starting Provider Update Process...'));
    console.log(chalk.gray(`📁 Config directory: ${this.configBaseDir}`));
    console.log(chalk.gray(`📁 Dynamic config directory: ${this.dynamicConfigDir}`));

    // 确保dynamic目录存在
    await this.ensureDynamicDirectoryExists();

    // 扫描所有配置文件
    console.log(chalk.cyan('\n🔍 Scanning configuration files...'));
    const configFiles = await this.scanConfigurationFiles();
    
    if (configFiles.length === 0) {
      throw new Error('No configuration files found');
    }

    console.log(chalk.green(`✅ Found ${configFiles.length} configuration files`));
    configFiles.forEach(file => {
      console.log(chalk.gray(`   📄 ${file}`));
    });

    // 提取所有唯一的providers
    console.log(chalk.cyan('\n📋 Extracting providers...'));
    const allProviders = await this.extractAllProviders(configFiles);
    
    if (allProviders.size === 0) {
      throw new Error('No providers found in configuration files');
    }

    console.log(chalk.green(`✅ Found ${allProviders.size} unique providers`));
    Array.from(allProviders.keys()).forEach(providerId => {
      const provider = allProviders.get(providerId)!;
      console.log(chalk.gray(`   🔌 ${providerId} (${provider.type}): ${provider.endpoint}`));
    });

    // 初始化更新结果
    const summary: UpdateSummary = {
      totalProviders: allProviders.size,
      successfulUpdates: 0,
      totalModelsDiscovered: 0,
      totalAvailableModels: 0,
      configFilesGenerated: [],
      errors: [],
      recommendations: []
    };

    const results: ProviderUpdateResult[] = [];

    // 批量更新每个provider
    console.log(chalk.cyan('\n🔄 Starting provider discovery and testing...'));
    for (const [providerId, providerConfig] of allProviders) {
      try {
        console.log(chalk.yellow(`\n📡 Processing provider: ${providerId}`));
        
        const result = await this.updateSingleProvider(providerId, providerConfig, options);
        results.push(result);

        if (result.success) {
          summary.successfulUpdates++;
          summary.totalModelsDiscovered += result.totalModelsFound;
          summary.totalAvailableModels += result.availableModels.length;
          summary.configFilesGenerated.push(...Object.values(result.configFiles));
          
          console.log(chalk.green(`   ✅ ${providerId}: ${result.availableModels.length} models available`));
          if (result.availableModels.length > 0) {
            console.log(chalk.gray(`      Models: ${result.availableModels.slice(0, 3).join(', ')}${result.availableModels.length > 3 ? ` and ${result.availableModels.length - 3} more` : ''}`));
          }
        } else {
          console.log(chalk.red(`   ❌ ${providerId}: Failed`));
          result.errors.forEach(error => {
            console.log(chalk.red(`      Error: ${error}`));
          });
        }

        summary.errors.push(...result.errors);

      } catch (error) {
        const errorMessage = `Failed to update provider ${providerId}: ${error instanceof Error ? error.message : String(error)}`;
        summary.errors.push(errorMessage);
        console.log(chalk.red(`   ❌ ${providerId}: ${errorMessage}`));
      }

      // 提供商间延迟，避免API限制
      if (allProviders.size > 1) {
        await this.delay(2000);
      }
    }

    // 生成综合配置文件
    console.log(chalk.cyan('\n🔧 Generating comprehensive configurations...'));
    await this.generateComprehensiveConfigs(results, summary);

    // 生成建议
    this.generateRecommendations(summary, results);

    // 输出最终结果
    const duration = Date.now() - startTime;
    console.log(chalk.cyan('\n' + '='.repeat(60)));
    console.log(chalk.cyan('📊 PROVIDER UPDATE SUMMARY'));
    console.log(chalk.cyan('='.repeat(60)));
    
    console.log(`\n⏰ Duration: ${Math.round(duration / 1000)}s`);
    console.log(`📊 Total providers processed: ${summary.totalProviders}`);
    console.log(`✅ Successful updates: ${summary.successfulUpdates}`);
    console.log(`❌ Failed updates: ${summary.totalProviders - summary.successfulUpdates}`);
    console.log(`📋 Total models discovered: ${summary.totalModelsDiscovered}`);
    console.log(`🎯 Total available models: ${summary.totalAvailableModels}`);
    console.log(`📄 Config files generated: ${summary.configFilesGenerated.length}`);

    if (summary.configFilesGenerated.length > 0) {
      console.log(chalk.green('\n📁 Generated configuration files:'));
      summary.configFilesGenerated.forEach(file => {
        console.log(chalk.gray(`   📄 ${file}`));
      });
    }

    if (summary.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 Recommendations:'));
      summary.recommendations.forEach(rec => {
        console.log(chalk.yellow(`   • ${rec}`));
      });
    }

    if (summary.errors.length > 0) {
      console.log(chalk.red('\n⚠️ Errors encountered:'));
      summary.errors.slice(0, 5).forEach(error => {
        console.log(chalk.red(`   • ${error}`));
      });
      if (summary.errors.length > 5) {
        console.log(chalk.red(`   • ... and ${summary.errors.length - 5} more errors`));
      }
    }

    console.log(chalk.cyan('\n✅ Provider update completed!'));
    
    return summary;
  }

  /**
   * 更新单个provider
   */
  private async updateSingleProvider(
    providerId: string,
    providerConfig: ProviderConfig,
    options: any
  ): Promise<ProviderUpdateResult> {
    const result: ProviderUpdateResult = {
      providerId,
      totalModelsFound: 0,
      availableModels: [],
      unavailableModels: [],
      configFiles: {
        single: ''
      },
      averageResponseTime: 0,
      errors: [],
      success: false
    };

    try {
      // 创建动态模型发现实例
      const discoveryConfig = {
        provider: providerConfig,
        providerId,
        maxRetries: options.maxRetries || 3,
        retryDelay: 1000,
        requestTimeout: options.timeout || 30000,
        testPrompt: 'Hello',
        maxTokens: 10
      };

      const discovery = createDynamicModelDiscovery(discoveryConfig);
      
      // 执行模型发现
      const discoveryResult = await discovery.discoverModels();
      
      result.totalModelsFound = discoveryResult.totalModels;
      result.availableModels = discoveryResult.availableModels;
      result.unavailableModels = discoveryResult.unavailableModels;
      result.averageResponseTime = discoveryResult.averageResponseTime;
      result.errors = discoveryResult.errors;

      // 生成单个provider的配置文件
      if (result.availableModels.length > 0) {
        const singleConfigPath = await this.generateSingleProviderConfig(providerId, providerConfig, result);
        result.configFiles.single = singleConfigPath;
        result.success = true;
      } else {
        result.errors.push('No available models found');
      }

      return result;

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      return result;
    }
  }

  /**
   * 扫描配置文件
   */
  private async scanConfigurationFiles(): Promise<string[]> {
    const configFiles: string[] = [];
    
    // 扫描主配置目录
    const directories = [
      'single-provider',
      'load-balancing',
      'production-ready'
    ];

    for (const dir of directories) {
      const dirPath = join(this.configBaseDir, dir);
      if (existsSync(dirPath)) {
        const files = await readdir(dirPath);
        for (const file of files) {
          if (file.endsWith('.json') && !file.includes('.backup')) {
            configFiles.push(join(dirPath, file));
          }
        }
      }
    }

    return configFiles;
  }

  /**
   * 提取所有唯一的providers
   */
  private async extractAllProviders(configFiles: string[]): Promise<Map<string, ProviderConfig>> {
    const providersMap = new Map<string, ProviderConfig>();

    for (const configFile of configFiles) {
      try {
        const content = await readFile(configFile, 'utf-8');
        const config: RouterConfig = JSON.parse(content);

        if (config.providers) {
          for (const [providerId, providerConfig] of Object.entries(config.providers)) {
            if (!providersMap.has(providerId)) {
              providersMap.set(providerId, providerConfig);
            }
          }
        }
      } catch (error) {
        console.log(chalk.red(`⚠️ Failed to parse config file ${configFile}: ${error instanceof Error ? error.message : String(error)}`));
      }
    }

    return providersMap;
  }

  /**
   * 生成单个provider配置
   */
  private async generateSingleProviderConfig(
    providerId: string,
    providerConfig: ProviderConfig,
    result: ProviderUpdateResult
  ): Promise<string> {
    const configFileName = `config-${providerId}-dynamic.json`;
    const configPath = join(this.dynamicConfigDir, configFileName);

    // 构建配置对象
    const dynamicConfig = {
      name: `Dynamic ${providerId} Configuration`,
      description: `Auto-generated config for ${providerId} with ${result.availableModels.length} available models`,
      generatedAt: new Date().toISOString(),
      server: {
        port: 6690 + Math.floor(Math.random() * 100),
        host: "0.0.0.0"
      },
      providers: {
        [providerId]: {
          ...providerConfig,
          models: result.availableModels,
          defaultModel: result.availableModels[0] || null
        }
      },
      routing: {
        default: {
          provider: providerId,
          model: result.availableModels[0] || null
        }
      },
      loadBalancing: {
        enabled: false
      },
      failover: {
        enabled: false
      },
      debug: {
        enabled: true,
        logLevel: "info",
        traceRequests: true,
        saveRequests: false,
        logDir: join(homedir(), '.route-claude-code', 'logs')
      },
      hooks: []
    };

    await writeFile(configPath, JSON.stringify(dynamicConfig, null, 2));
    return configPath;
  }

  /**
   * 生成综合配置文件
   */
  private async generateComprehensiveConfigs(
    results: ProviderUpdateResult[],
    summary: UpdateSummary
  ): Promise<void> {
    const successfulResults = results.filter(r => r.success && r.availableModels.length > 0);
    
    if (successfulResults.length === 0) {
      return;
    }

    // 1. 生成负载均衡配置（所有provider）
    await this.generateLoadBalancingConfig(successfulResults, summary);

    // 2. 生成OpenAI兼容混合配置
    await this.generateOpenAIMixedConfig(successfulResults, summary);
  }

  /**
   * 生成负载均衡配置
   */
  private async generateLoadBalancingConfig(
    results: ProviderUpdateResult[],
    summary: UpdateSummary
  ): Promise<void> {
    const configPath = join(this.dynamicConfigDir, 'config-load-balancing-comprehensive.json');
    
    const providers: Record<string, any> = {};
    const routingProviders: any[] = [];

    for (const result of results) {
      // 查找原始provider配置
      const originalProvider = await this.findOriginalProviderConfig(result.providerId);
      if (!originalProvider) continue;

      providers[result.providerId] = {
        ...originalProvider,
        models: result.availableModels,
        defaultModel: result.availableModels[0]
      };

      routingProviders.push({
        provider: result.providerId,
        model: result.availableModels[0],
        weight: Math.max(1, Math.floor(result.availableModels.length / 2))
      });
    }

    const loadBalancingConfig = {
      name: "Comprehensive Load Balancing Configuration",
      description: `Auto-generated load balancing config with ${results.length} providers`,
      generatedAt: new Date().toISOString(),
      server: {
        port: 6690,
        host: "0.0.0.0"
      },
      providers,
      routing: {
        default: {
          providers: routingProviders,
          loadBalancing: {
            enabled: true,
            strategy: "health_based"
          },
          failover: {
            enabled: true,
            triggers: [
              {
                type: "http_status",
                codes: [429, 500, 502, 503, 504],
                blacklistDuration: 300
              }
            ]
          }
        }
      },
      loadBalancing: {
        enabled: true,
        strategy: "health_based_with_blacklist"
      },
      failover: {
        enabled: true,
        triggers: [
          {
            type: "http_status", 
            codes: [429, 500, 502, 503, 504],
            blacklistDuration: 300
          }
        ]
      },
      debug: {
        enabled: true,
        logLevel: "info",
        traceRequests: true,
        saveRequests: false,
        logDir: join(homedir(), '.route-claude-code', 'logs')
      },
      hooks: []
    };

    await writeFile(configPath, JSON.stringify(loadBalancingConfig, null, 2));
    summary.configFilesGenerated.push(configPath);
  }

  /**
   * 生成OpenAI兼容混合配置
   */
  private async generateOpenAIMixedConfig(
    results: ProviderUpdateResult[],
    summary: UpdateSummary
  ): Promise<void> {
    // 只选择OpenAI兼容的providers
    const openaiCompatibleResults = results.filter(result => {
      return result.providerId.includes('openai') || 
             result.providerId.includes('shuaihong') ||
             result.providerId.includes('lmstudio') ||
             result.providerId.includes('modelscope');
    });

    if (openaiCompatibleResults.length === 0) {
      return;
    }

    const configPath = join(this.dynamicConfigDir, 'config-openai-compatible-mixed.json');
    
    // 合并所有OpenAI兼容provider的模型
    const allModels: string[] = [];
    const maxTokensMap: Record<string, number> = {};
    let primaryProvider: any = null;

    for (const result of openaiCompatibleResults) {
      allModels.push(...result.availableModels);
      
      // 设置默认max_tokens
      result.availableModels.forEach(model => {
        maxTokensMap[model] = this.inferMaxTokens(model);
      });

      if (!primaryProvider) {
        primaryProvider = await this.findOriginalProviderConfig(result.providerId);
      }
    }

    // 去重模型
    const uniqueModels = Array.from(new Set(allModels));

    const mixedConfig = {
      name: "OpenAI Compatible Mixed Configuration",
      description: `Auto-generated OpenAI mixed config with ${uniqueModels.length} models from ${openaiCompatibleResults.length} providers`,
      generatedAt: new Date().toISOString(),
      server: {
        port: 6691,
        host: "0.0.0.0"
      },
      providers: {
        "openai-mixed": {
          ...primaryProvider,
          models: uniqueModels,
          defaultModel: uniqueModels[0],
          maxTokens: maxTokensMap
        }
      },
      routing: {
        default: {
          provider: "openai-mixed",
          model: uniqueModels[0]
        },
        background: {
          provider: "openai-mixed", 
          model: uniqueModels.find(m => m.includes('mini') || m.includes('flash')) || uniqueModels[0]
        },
        thinking: {
          provider: "openai-mixed",
          model: uniqueModels.find(m => m.includes('gpt-4') || m.includes('claude-3')) || uniqueModels[0]
        },
        longcontext: {
          provider: "openai-mixed",
          model: uniqueModels.find(m => m.includes('128k') || m.includes('long')) || uniqueModels[0]
        },
        search: {
          provider: "openai-mixed",
          model: uniqueModels.find(m => m.includes('search')) || uniqueModels[0]
        }
      },
      loadBalancing: {
        enabled: false
      },
      failover: {
        enabled: false
      },
      debug: {
        enabled: true,
        logLevel: "info",
        traceRequests: true,
        saveRequests: false,
        logDir: join(homedir(), '.route-claude-code', 'logs')
      },
      hooks: []
    };

    await writeFile(configPath, JSON.stringify(mixedConfig, null, 2));
    summary.configFilesGenerated.push(configPath);
  }

  /**
   * 查找原始provider配置
   */
  private async findOriginalProviderConfig(providerId: string): Promise<ProviderConfig | null> {
    const configFiles = await this.scanConfigurationFiles();
    
    for (const configFile of configFiles) {
      try {
        const content = await readFile(configFile, 'utf-8');
        const config: RouterConfig = JSON.parse(content);
        
        if (config.providers && config.providers[providerId]) {
          return config.providers[providerId];
        }
      } catch (error) {
        // 忽略解析错误
      }
    }
    
    return null;
  }

  /**
   * 推断模型最大token数
   */
  private inferMaxTokens(modelId: string): number {
    const lowerId = modelId.toLowerCase();
    
    if (lowerId.includes('128k') || lowerId.includes('long')) {
      return 131072;
    } else if (lowerId.includes('32k')) {
      return 32768;
    } else if (lowerId.includes('16k')) {
      return 16384;
    } else if (lowerId.includes('qwen') && lowerId.includes('coder')) {
      return 262144;
    } else if (lowerId.includes('deepseek')) {
      return 131072;
    } else if (lowerId.includes('gpt-4')) {
      return 131072;
    } else if (lowerId.includes('claude-3')) {
      return 262144;
    } else if (lowerId.includes('gemini')) {
      return 131072;
    }
    
    return 8192; // 默认值
  }

  /**
   * 生成建议
   */
  private generateRecommendations(summary: UpdateSummary, results: ProviderUpdateResult[]): void {
    // 成功率建议
    const successRate = summary.successfulUpdates / summary.totalProviders;
    if (successRate < 0.5) {
      summary.recommendations.push('Low success rate detected - check API keys and network connectivity');
    }

    // 模型数量建议
    const avgModelsPerProvider = summary.totalAvailableModels / summary.successfulUpdates;
    if (avgModelsPerProvider < 3) {
      summary.recommendations.push('Consider adding more models or providers for better load balancing');
    }

    // 性能建议
    const highResponseTimeProviders = results.filter(r => r.averageResponseTime > 5000);
    if (highResponseTimeProviders.length > 0) {
      summary.recommendations.push(`${highResponseTimeProviders.length} providers have high response times - consider optimization`);
    }

    // 错误分析建议
    const authErrors = summary.errors.filter(e => e.includes('401') || e.includes('403') || e.includes('unauthorized'));
    if (authErrors.length > 0) {
      summary.recommendations.push('Authentication errors detected - verify API keys and permissions');
    }

    const rateLimitErrors = summary.errors.filter(e => e.includes('429') || e.includes('rate limit'));
    if (rateLimitErrors.length > 0) {
      summary.recommendations.push('Rate limiting detected - consider implementing delays or multiple API keys');
    }
  }

  /**
   * 确保dynamic目录存在
   */
  private async ensureDynamicDirectoryExists(): Promise<void> {
    if (!existsSync(this.dynamicConfigDir)) {
      await mkdir(this.dynamicConfigDir, { recursive: true });
      console.log(chalk.green(`✅ Created dynamic config directory: ${this.dynamicConfigDir}`));
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 工厂函数
 */
export function createProviderManager(): ProviderManager {
  return new ProviderManager();
}