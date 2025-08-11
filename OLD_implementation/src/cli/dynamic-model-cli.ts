#!/usr/bin/env node

/**
 * 动态模型配置发现和验证工具
 * CLI工具用于测试和管理动态模型配置系统
 */

import { Command } from 'commander';
import { createDynamicModelConfigManager, DEFAULT_MODEL_CONFIG_MANAGER_CONFIG } from '@/utils/dynamic-model-config-manager';
import { getConfigPaths } from '@/utils/config-paths';
import { logger } from '@/utils/logger';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('dynamic-model-cli')
  .description('Claude Code Router - Dynamic Model Configuration CLI')
  .version('1.0.0');

/**
 * 加载路由器配置
 */
async function loadRouterConfig(configPath?: string): Promise<any> {
  try {
    if (configPath) {
      const configData = readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
    
    // 使用默认配置路径
    const configPaths = getConfigPaths();
    const configData = readFileSync(configPaths.configDir + '/config.json', 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Failed to load router configuration:', (error as Error).message);
    process.exit(1);
  }
}

/**
 * 发现和验证所有提供商的模型
 */
program
  .command('discover-all')
  .description('Discover and validate models for all providers')
  .option('-c, --config <path>', 'Router configuration file path')
  .option('-o, --output <path>', 'Output file path for results')
  .option('--max-models <number>', 'Maximum models per provider', '10')
  .option('--timeout <number>', 'Test timeout in milliseconds', '30000')
  .action(async (options) => {
    console.log('🔍 Starting comprehensive model discovery...');
    
    const config = await loadRouterConfig(options.config);
    const manager = createDynamicModelConfigManager({
      ...DEFAULT_MODEL_CONFIG_MANAGER_CONFIG,
      maxModelsPerProvider: parseInt(options.maxModels),
      testTimeout: parseInt(options.timeout)
    });
    
    const results: any = {
      timestamp: new Date().toISOString(),
      providers: {},
      summary: {
        totalProviders: 0,
        totalModels: 0,
        availableModels: 0,
        averageResponseTime: 0
      }
    };
    
    try {
      // 注册所有提供商
      for (const [providerId, providerConfig] of Object.entries(config.providers)) {
        console.log(`\n📋 Registering provider: ${providerId}`);
        await manager.registerProvider(providerId, providerConfig as any);
        results.summary.totalProviders++;
      }
      
      // 为每个提供商发现模型
      for (const providerId of Object.keys(config.providers)) {
        console.log(`\n🔍 Discovering models for provider: ${providerId}`);
        
        try {
          const discoveryResult = await manager.discoverProviderModels(providerId);
          
          results.providers[providerId] = discoveryResult;
          results.summary.totalModels += discoveryResult.totalModels;
          results.summary.availableModels += discoveryResult.availableModels.length;
          
          console.log(`   ✅ Total models: ${discoveryResult.totalModels}`);
          console.log(`   ✅ Available models: ${discoveryResult.availableModels.length}`);
          console.log(`   ✅ Unavailable models: ${discoveryResult.unavailableModels.length}`);
          console.log(`   ⏱️  Average response time: ${discoveryResult.averageResponseTime}ms`);
          
          if (discoveryResult.availableModels.length > 0) {
            console.log(`   📝 Available models: ${discoveryResult.availableModels.slice(0, 5).join(', ')}`);
            if (discoveryResult.availableModels.length > 5) {
              console.log(`       ... and ${discoveryResult.availableModels.length - 5} more`);
            }
          }
          
          if (discoveryResult.errors.length > 0) {
            console.log(`   ⚠️  Errors: ${discoveryResult.errors.join('; ')}`);
          }
          
        } catch (error) {
          console.error(`   ❌ Failed to discover models for ${providerId}: ${(error as Error).message}`);
          results.providers[providerId] = {
            error: (error as Error).message,
            totalModels: 0,
            availableModels: [],
            unavailableModels: []
          };
        }
      }
      
      // 计算总体平均响应时间
      const totalResponseTime = Object.values(results.providers)
        .filter((p: any) => p.averageResponseTime)
        .reduce((sum: number, p: any) => sum + p.averageResponseTime, 0);
      const validProviders = Object.values(results.providers)
        .filter((p: any) => p.averageResponseTime)
        .length;
      
      results.summary.averageResponseTime = validProviders > 0 ? totalResponseTime / validProviders : 0;
      
      // 输出结果摘要
      console.log('\n🎯 Discovery Summary:');
      console.log(`   📊 Total providers: ${results.summary.totalProviders}`);
      console.log(`   📊 Total models discovered: ${results.summary.totalModels}`);
      console.log(`   ✅ Available models: ${results.summary.availableModels}`);
      console.log(`   ❌ Unavailable models: ${results.summary.totalModels - results.summary.availableModels}`);
      console.log(`   ⏱️  Average response time: ${Math.round(results.summary.averageResponseTime)}ms`);
      
      // 保存结果到文件
      if (options.output) {
        writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(`\n💾 Results saved to: ${options.output}`);
      }
      
      console.log('\n✅ Model discovery completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Model discovery failed:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * 测试特定提供商的模型可用性
 */
program
  .command('test-provider')
  .description('Test model availability for a specific provider')
  .argument('<provider-id>', 'Provider ID to test')
  .option('-c, --config <path>', 'Router configuration file path')
  .option('--model <model>', 'Specific model to test (optional)')
  .option('--retries <number>', 'Number of test retries', '3')
  .action(async (providerId, options) => {
    console.log(`🔍 Testing provider: ${providerId}`);
    
    const config = await loadRouterConfig(options.config);
    const providerConfig = config.providers[providerId];
    
    if (!providerConfig) {
      console.error(`❌ Provider ${providerId} not found in configuration`);
      process.exit(1);
    }
    
    const manager = createDynamicModelConfigManager({
      ...DEFAULT_MODEL_CONFIG_MANAGER_CONFIG,
      testRetries: parseInt(options.retries)
    });
    
    try {
      await manager.registerProvider(providerId, providerConfig);
      
      if (options.model) {
        // 测试特定模型
        console.log(`\n🧪 Testing model: ${options.model}`);
        const isAvailable = await manager.testModelAvailability(providerId, options.model);
        
        console.log(`   ${isAvailable ? '✅' : '❌'} Model ${options.model} is ${isAvailable ? 'available' : 'unavailable'}`);
        
        // 获取模型详细信息
        const modelConfig = manager.getModelConfig(providerId, options.model);
        if (modelConfig) {
          console.log(`   📊 Response time: ${modelConfig.responseTime}ms`);
          console.log(`   🏷️  Category: ${modelConfig.category}`);
          console.log(`   🎯 Priority: ${modelConfig.priority}`);
          console.log(`   🔧 Capabilities: ${JSON.stringify(modelConfig.capabilities)}`);
        }
      } else {
        // 测试所有模型
        console.log('\n🔍 Discovering models...');
        const result = await manager.discoverProviderModels(providerId);
        
        console.log(`\n📊 Test Results for ${providerId}:`);
        console.log(`   📝 Total models: ${result.totalModels}`);
        console.log(`   ✅ Available models: ${result.availableModels.length}`);
        console.log(`   ❌ Unavailable models: ${result.unavailableModels.length}`);
        console.log(`   ⏱️  Average response time: ${result.averageResponseTime}ms`);
        
        if (result.availableModels.length > 0) {
          console.log(`\n✅ Available models:`);
          result.availableModels.forEach((modelId, index) => {
            const modelConfig = manager.getModelConfig(providerId, modelId);
            if (modelConfig) {
              console.log(`   ${index + 1}. ${modelId} (${modelConfig.responseTime}ms, ${modelConfig.category})`);
            }
          });
        }
        
        if (result.unavailableModels.length > 0) {
          console.log(`\n❌ Unavailable models:`);
          result.unavailableModels.forEach((modelId, index) => {
            console.log(`   ${index + 1}. ${modelId}`);
          });
        }
      }
      
      console.log('\n✅ Provider test completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Provider test failed:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * 启动自动发现监控
 */
program
  .command('monitor')
  .description('Start auto-discovery monitoring with real-time updates')
  .argument('<duration>', 'Monitoring duration in minutes')
  .option('-c, --config <path>', 'Router configuration file path')
  .option('--interval <number>', 'Discovery interval in minutes', '5')
  .action(async (duration, options) => {
    console.log(`🔍 Starting auto-discovery monitoring for ${duration} minutes...`);
    
    const config = await loadRouterConfig(options.config);
    const manager = createDynamicModelConfigManager({
      ...DEFAULT_MODEL_CONFIG_MANAGER_CONFIG,
      discoveryInterval: parseInt(options.interval)
    });
    
    // 添加模型更新监听器
    manager.addModelUpdateListener((event) => {
      const timestamp = new Date(event.timestamp).toLocaleTimeString();
      console.log(`[${timestamp}] 🔄 ${event.type}: ${event.providerId}/${event.modelId}`);
      
      if (event.details?.result) {
        const result = event.details.result;
        console.log(`   📊 Available: ${result.availableModels.length}, Response time: ${Math.round(result.averageResponseTime)}ms`);
      }
    });
    
    try {
      // 注册所有提供商
      for (const [providerId, providerConfig] of Object.entries(config.providers)) {
        console.log(`📋 Registering provider: ${providerId}`);
        await manager.registerProvider(providerId, providerConfig as any);
      }
      
      console.log('\n🚀 Starting monitoring...');
      console.log(`   ⏱️  Interval: ${options.interval} minutes`);
      console.log(`   ⏱️  Duration: ${duration} minutes`);
      console.log('   🔄 Press Ctrl+C to stop monitoring');
      console.log('');
      
      // 启动自动发现
      manager.startAutoDiscovery();
      
      // 监控指定时长
      const endTime = Date.now() + (parseInt(duration) * 60 * 1000);
      
      const statusInterval = setInterval(() => {
        const status = manager.getStatus();
        console.log(`[STATUS] 📊 Providers: ${status.registeredProviders.length}, Models: ${status.totalModels}, Available: ${status.availableModels}`);
      }, 60000); // 每分钟输出状态
      
      // 等待指定时长
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (Date.now() >= endTime) {
            clearInterval(checkInterval);
            clearInterval(statusInterval);
            resolve(undefined);
          }
        }, 1000);
      });
      
      // 停止监控
      manager.stopAutoDiscovery();
      
      // 输出最终状态
      const finalStatus = manager.getStatus();
      console.log('\n🎯 Final Status:');
      console.log(`   📊 Registered providers: ${finalStatus.registeredProviders.length}`);
      console.log(`   📊 Total models: ${finalStatus.totalModels}`);
      console.log(`   ✅ Available models: ${finalStatus.availableModels}`);
      console.log(`   🔄 Auto discovery: ${finalStatus.isAutoDiscoveryRunning ? 'running' : 'stopped'}`);
      
      console.log('\n✅ Monitoring completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Monitoring failed:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * 显示系统状态
 */
program
  .command('status')
  .description('Show dynamic model configuration system status')
  .option('-c, --config <path>', 'Router configuration file path')
  .action(async (options) => {
    console.log('📊 Dynamic Model Configuration System Status');
    
    try {
      const config = await loadRouterConfig(options.config);
      const manager = createDynamicModelConfigManager(DEFAULT_MODEL_CONFIG_MANAGER_CONFIG);
      
      console.log('\n📋 Configuration Providers:');
      Object.keys(config.providers).forEach(providerId => {
        console.log(`   📝 ${providerId}`);
      });
      
      console.log('\n🔧 System Configuration:');
      console.log(`   🔄 Auto discovery: ${DEFAULT_MODEL_CONFIG_MANAGER_CONFIG.autoDiscovery ? 'enabled' : 'disabled'}`);
      console.log(`   ⏱️  Discovery interval: ${DEFAULT_MODEL_CONFIG_MANAGER_CONFIG.discoveryInterval} minutes`);
      console.log(`   📊 Max models per provider: ${DEFAULT_MODEL_CONFIG_MANAGER_CONFIG.maxModelsPerProvider}`);
      console.log(`   🧪 Test retries: ${DEFAULT_MODEL_CONFIG_MANAGER_CONFIG.testRetries}`);
      console.log(`   ⏱️  Test timeout: ${DEFAULT_MODEL_CONFIG_MANAGER_CONFIG.testTimeout}ms`);
      console.log(`   💾 Cache enabled: ${DEFAULT_MODEL_CONFIG_MANAGER_CONFIG.enableCaching}`);
      console.log(`   ⏰ Cache expiry: ${DEFAULT_MODEL_CONFIG_MANAGER_CONFIG.cacheExpiry} minutes`);
      
      console.log('\n✅ System is ready for model discovery!');
      
    } catch (error) {
      console.error('\n❌ Failed to get system status:', (error as Error).message);
      process.exit(1);
    }
  });

/**
 * 清除所有缓存
 */
program
  .command('clear-cache')
  .description('Clear all model discovery caches')
  .action(async () => {
    console.log('🧹 Clearing all model discovery caches...');
    
    try {
      const manager = createDynamicModelConfigManager(DEFAULT_MODEL_CONFIG_MANAGER_CONFIG);
      manager.clearAllCaches();
      
      console.log('✅ All caches cleared successfully!');
      
    } catch (error) {
      console.error('\n❌ Failed to clear caches:', (error as Error).message);
      process.exit(1);
    }
  });

// 解析命令行参数
program.parse();