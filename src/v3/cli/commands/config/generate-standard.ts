/**
 * 标准配置生成器 CLI命令
 * 
 * 生成v3.1.0标准化配置文件
 * 支持从现有配置迁移和全新创建
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

import { Command } from 'commander';
import { 
  StandardRouterConfig, 
  StandardConfigValidator,
  ConfigurationMigrator
} from '../../../config/standard-config-schema.js';
import { createStandardConfigExample } from '../../../server/standard-router-server.js';
import { loadConfig, saveConfig } from '../../utils/config-loader.js';
import fs from 'fs';
import path from 'path';

export function createGenerateStandardCommand(): Command {
  return new Command('generate-standard')
    .argument('[input]', 'Input configuration file to migrate (optional)')
    .option('-o, --output <file>', 'Output configuration file path')
    .option('--example', 'Generate example configuration')
    .option('--validate-only', 'Only validate existing configuration')
    .option('--force', 'Overwrite existing output file')
    .option('--provider <name>', 'Provider name for example config')
    .option('--endpoint <url>', 'Provider endpoint for example config') 
    .option('--api-key <key>', 'API key for example config')
    .option('--models <models>', 'Comma-separated model list for example config')
    .option('--port <port>', 'Server port for example config', '5555')
    .description('Generate or migrate to v3.1.0 standard configuration format')
    .action(async (input: string | undefined, options: any) => {
      try {
        console.log('🔧 Standard Configuration Generator v3.1.0');
        console.log('=====================================');
        
        let standardConfig: StandardRouterConfig;
        
        if (options.example) {
          // 生成示例配置
          console.log('📋 Generating example configuration...');
          standardConfig = generateExampleConfig(options);
          
        } else if (input) {
          // 迁移现有配置
          console.log(`📥 Loading configuration from: ${input}`);
          
          if (!fs.existsSync(input)) {
            console.error(`❌ Input file not found: ${input}`);
            process.exit(1);
          }
          
          const inputConfig = loadConfig(input, { validateProviders: false });
          
          if (options.validateOnly) {
            console.log('🔍 Validating configuration...');
            try {
              StandardConfigValidator.validate(inputConfig);
              console.log('✅ Configuration is valid v3.1.0 format');
              return;
            } catch (error) {
              console.log('⚠️ Configuration validation failed:');
              console.error(error instanceof Error ? error.message : String(error));
              console.log('💡 Use migration mode to fix issues');
              process.exit(1);
            }
          }
          
          console.log('🔄 Migrating configuration to v3.1.0 format...');
          standardConfig = migrateConfiguration(inputConfig);
          
        } else {
          console.error('❌ Please provide input file or use --example flag');
          process.exit(1);
        }
        
        // 保存配置
        const outputPath = options.output || generateOutputPath(input, options.example);
        
        if (fs.existsSync(outputPath) && !options.force) {
          console.error(`❌ Output file already exists: ${outputPath}`);
          console.log('💡 Use --force to overwrite');
          process.exit(1);
        }
        
        console.log(`💾 Saving configuration to: ${outputPath}`);
        saveConfig(outputPath, standardConfig);
        
        // 显示配置摘要
        displayConfigurationSummary(standardConfig);
        
        console.log('✅ Standard configuration generated successfully!');
        console.log('');
        console.log('🚀 To start the server with this configuration:');
        console.log(`   rcc3 start ${outputPath} --standard`);
        
      } catch (error) {
        console.error('❌ Configuration generation failed:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}

/**
 * 生成示例配置
 */
function generateExampleConfig(options: any): StandardRouterConfig {
  const config = createStandardConfigExample();
  
  // 应用用户自定义选项
  if (options.port) {
    config.server.port = parseInt(options.port);
    config.server.name = `standard-router-${options.port}`;
  }
  
  if (options.provider || options.endpoint || options.apiKey || options.models) {
    const providerId = options.provider || 'example-provider';
    
    config.providers[providerId] = {
      type: 'openai',
      endpoint: options.endpoint || 'https://api.example.com/v1/chat/completions',
      authentication: {
        type: 'bearer',
        credentials: {
          apiKeys: options.apiKey ? [options.apiKey] : ['sk-example-key']
        }
      },
      models: options.models ? options.models.split(',').map((m: string) => m.trim()) : ['example-model'],
      defaultModel: options.models ? options.models.split(',')[0].trim() : 'example-model',
      maxTokens: {},
      timeout: 120000,
      retry: {
        maxRetries: 3,
        delayMs: 2000
      },
      healthCheck: {
        enabled: true,
        model: options.models ? options.models.split(',')[0].trim() : 'example-model',
        timeout: 15000
      },
      description: `${options.provider || 'Example'} Provider`,
      priority: 1
    };
    
    // 自动设置maxTokens
    const models = config.providers[providerId].models;
    for (const model of models) {
      config.providers[providerId].maxTokens[model] = 131072; // 128K default
    }
    
    // 更新路由表
    const defaultModel = config.providers[providerId].defaultModel!;
    for (const category of Object.keys(config.routing.categories)) {
      (config.routing.categories as any)[category].primary = {
        provider: providerId,
        model: defaultModel
      };
    }
  }
  
  return config;
}

/**
 * 迁移现有配置
 */
function migrateConfiguration(inputConfig: any): StandardRouterConfig {
  try {
    // 检查配置版本并选择适当的迁移策略
    if (!inputConfig.configVersion || inputConfig.configVersion.startsWith('v3.0')) {
      console.log('📦 Detected v3.0.x configuration, applying migration...');
      return ConfigurationMigrator.migrateFromV3_0(inputConfig);
    } else if (inputConfig.configVersion === 'v3.1.0') {
      console.log('🔍 Configuration is already v3.1.0, validating...');
      return StandardConfigValidator.validate(inputConfig);
    } else {
      throw new Error(`Unsupported configuration version: ${inputConfig.configVersion}`);
    }
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * 生成输出路径
 */
function generateOutputPath(inputPath: string | undefined, isExample: boolean): string {
  if (isExample) {
    return path.join(process.cwd(), `standard-config-example-${Date.now()}.json`);
  }
  
  if (inputPath) {
    const parsed = path.parse(inputPath);
    return path.join(parsed.dir, `${parsed.name}-v3.1${parsed.ext}`);
  }
  
  return path.join(process.cwd(), `standard-config-${Date.now()}.json`);
}

/**
 * 显示配置摘要
 */
function displayConfigurationSummary(config: StandardRouterConfig): void {
  console.log('');
  console.log('📊 Configuration Summary:');
  console.log('========================');
  console.log(`🏷️  Version: ${config.configVersion}`);
  console.log(`🏗️  Architecture: ${config.architecture}`);
  console.log(`🌐 Server: ${config.server.host}:${config.server.port}`);
  console.log(`📋 Providers: ${Object.keys(config.providers).length}`);
  console.log(`🎯 Categories: ${Object.keys(config.routing.categories).length}`);
  
  console.log('');
  console.log('📋 Provider Details:');
  for (const [providerId, provider] of Object.entries(config.providers)) {
    const keyCount = provider.authentication.credentials.apiKeys?.length || 1;
    console.log(`   📦 ${providerId}: ${provider.type} (${provider.models.length} models, ${keyCount} keys)`);
    console.log(`      🔗 ${provider.endpoint}`);
    console.log(`      🎯 Models: ${provider.models.join(', ')}`);
  }
  
  console.log('');
  console.log('🎯 Routing Categories:');
  for (const [category, categoryConfig] of Object.entries(config.routing.categories)) {
    const primary = categoryConfig.primary;
    const backups = categoryConfig.backups?.length || 0;
    console.log(`   📂 ${category}: ${primary.provider}.${primary.model}` + 
                (backups > 0 ? ` (+${backups} backups)` : ''));
  }
  
  console.log('');
  console.log('🔧 Expected Pipeline Instances:');
  const requiredPipelines = analyzeRequiredPipelines(config);
  for (const pipeline of requiredPipelines) {
    console.log(`   🔄 ${pipeline.providerId}.${pipeline.model}`);
  }
  console.log(`   📊 Total Pipelines: ${requiredPipelines.length}`);
}

/**
 * 分析需要的流水线（用于显示摘要）
 */
function analyzeRequiredPipelines(config: StandardRouterConfig): Array<{providerId: string, model: string}> {
  const requiredPipelines = new Set<string>();
  
  for (const categoryConfig of Object.values(config.routing.categories)) {
    // 添加主要路由目标
    const primaryKey = `${categoryConfig.primary.provider}.${categoryConfig.primary.model}`;
    requiredPipelines.add(primaryKey);
    
    // 添加备份路由目标
    if (categoryConfig.backups) {
      for (const backup of categoryConfig.backups) {
        const backupKey = `${backup.provider}.${backup.model}`;
        requiredPipelines.add(backupKey);
      }
    }
  }
  
  return Array.from(requiredPipelines).map(key => {
    const [providerId, model] = key.split('.');
    return { providerId, model };
  });
}

/**
 * 验证配置文件命令
 */
export function createValidateStandardCommand(): Command {
  return new Command('validate-standard')
    .argument('<config>', 'Configuration file to validate')
    .option('--verbose', 'Show detailed validation results')
    .option('--fix-suggestions', 'Show suggestions for fixing issues')
    .description('Validate v3.1.0 standard configuration format')
    .action(async (configPath: string, options: any) => {
      try {
        console.log('🔍 Validating Standard Configuration');
        console.log('===================================');
        console.log(`📁 File: ${configPath}`);
        
        if (!fs.existsSync(configPath)) {
          console.error(`❌ Configuration file not found: ${configPath}`);
          process.exit(1);
        }
        
        const config = loadConfig(configPath, { validateProviders: false });
        
        console.log('🔧 Running validation...');
        const validatedConfig = StandardConfigValidator.validate(config);
        
        console.log('✅ Configuration is valid!');
        
        if (options.verbose) {
          displayConfigurationSummary(validatedConfig);
        }
        
        // 检查是否有自动修复的内容
        const hasAutoFixedTokens = checkForAutoFixedTokens(config, validatedConfig);
        if (hasAutoFixedTokens) {
          console.log('');
          console.log('🔧 Auto-fixed issues:');
          console.log('   ✅ Added default maxTokens (128K) for models without token limits');
          console.log('   💡 Consider updating the configuration file with these fixes');
        }
        
        // 检查多密钥扩展
        const hasMultiKeyExpansion = checkForMultiKeyExpansion(config, validatedConfig);
        if (hasMultiKeyExpansion) {
          console.log('');
          console.log('🔄 Multi-key expansion detected:');
          console.log('   ✅ Multiple API keys will be expanded to separate provider instances');
          console.log('   💡 This enables automatic load balancing and failover');
        }
        
      } catch (error) {
        console.error('❌ Validation failed:');
        console.error(error instanceof Error ? error.message : String(error));
        
        if (options.fixSuggestions) {
          console.log('');
          console.log('💡 Fix suggestions:');
          console.log('   1. Check that all required fields are present');
          console.log('   2. Ensure provider types are valid (openai, anthropic, gemini, codewhisperer)');
          console.log('   3. Verify that routing table references existing providers and models');
          console.log('   4. Use --example to generate a valid example configuration');
          console.log('   5. Use migration command if upgrading from v3.0.x');
        }
        
        process.exit(1);
      }
    });
}

/**
 * 检查是否有自动修复的maxTokens
 */
function checkForAutoFixedTokens(original: any, validated: StandardRouterConfig): boolean {
  for (const [providerId, provider] of Object.entries(validated.providers)) {
    const originalProvider = original.providers?.[providerId];
    if (!originalProvider?.maxTokens || Object.keys(originalProvider.maxTokens).length === 0) {
      if (Object.keys(provider.maxTokens).length > 0) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 检查是否有多密钥扩展
 */
function checkForMultiKeyExpansion(original: any, validated: StandardRouterConfig): boolean {
  const originalProviderCount = Object.keys(original.providers || {}).length;
  const validatedProviderCount = Object.keys(validated.providers).length;
  return validatedProviderCount > originalProviderCount;
}