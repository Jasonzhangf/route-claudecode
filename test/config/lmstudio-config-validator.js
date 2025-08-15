/**
 * LM Studio配置验证和生成工具
 * 验证现有配置的完整性并生成标准配置
 * 
 * @author Jason Zhang
 * @version v3.1.0
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

class LMStudioConfigValidator {
  constructor() {
    this.configPath = path.join(os.homedir(), '.route-claudecode', 'config', 'v3', 'single-provider', 'config-lmstudio-v3-5506.json');
    this.validationResults = [];
    this.errors = [];
    this.warnings = [];
  }

  /**
   * 加载现有配置
   */
  loadExistingConfig() {
    try {
      const configContent = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configContent);
    } catch (error) {
      this.addError(`无法加载配置文件: ${error.message}`);
      return null;
    }
  }

  /**
   * 验证配置字段完整性
   */
  validateConfigFields(config) {
    console.log('🔍 开始验证LM Studio配置字段...\n');

    // 验证server部分
    this.validateServerSection(config.server);
    
    // 验证providers部分
    this.validateProvidersSection(config.providers);
    
    // 验证routing部分
    this.validateRoutingSection(config.routing);
    
    // 验证debug部分
    this.validateDebugSection(config.debug);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      validationResults: this.validationResults
    };
  }

  /**
   * 验证server部分
   */
  validateServerSection(server) {
    console.log('📋 验证Server配置...');
    
    const requiredFields = ['port', 'host', 'architecture', 'environment'];
    const missingFields = requiredFields.filter(field => !server[field]);
    
    if (missingFields.length > 0) {
      this.addError(`Server配置缺少必需字段: ${missingFields.join(', ')}`);
    } else {
      this.addValidation('Server配置', '✅ 所有必需字段存在');
    }

    // 验证端口号
    if (server.port && (server.port < 1024 || server.port > 65535)) {
      this.addWarning(`端口号 ${server.port} 可能不在推荐范围内 (1024-65535)`);
    }

    // 验证架构版本
    if (server.architecture && !server.architecture.includes('v3')) {
      this.addWarning(`架构版本 ${server.architecture} 可能不是最新的v3版本`);
    }

    console.log(`   端口: ${server.port}`);
    console.log(`   主机: ${server.host}`);
    console.log(`   架构: ${server.architecture}`);
    console.log(`   环境: ${server.environment}\n`);
  }

  /**
   * 验证providers部分
   */
  validateProvidersSection(providers) {
    console.log('📋 验证Providers配置...');
    
    if (!providers || Object.keys(providers).length === 0) {
      this.addError('Providers配置为空');
      return;
    }

    Object.entries(providers).forEach(([providerName, providerConfig]) => {
      console.log(`   🔹 验证Provider: ${providerName}`);
      
      // 验证必需字段
      const requiredFields = ['type', 'endpoint'];
      const missingFields = requiredFields.filter(field => !providerConfig[field]);
      
      if (missingFields.length > 0) {
        this.addError(`Provider ${providerName} 缺少必需字段: ${missingFields.join(', ')}`);
      }

      // 验证models数组
      if (!providerConfig.models || !Array.isArray(providerConfig.models)) {
        this.addError(`Provider ${providerName} 缺少models数组`);
      } else {
        console.log(`     模型数量: ${providerConfig.models.length}`);
        this.addValidation(`Provider ${providerName} 模型配置`, `✅ ${providerConfig.models.length}个模型`);
      }

      // 验证maxTokens配置
      if (!providerConfig.maxTokens) {
        this.addWarning(`Provider ${providerName} 缺少maxTokens配置`);
      } else {
        const maxTokensCount = Object.keys(providerConfig.maxTokens).length;
        console.log(`     maxTokens配置: ${maxTokensCount}个模型`);
        this.addValidation(`Provider ${providerName} maxTokens`, `✅ ${maxTokensCount}个模型配置`);
      }

      // 验证capabilities
      if (providerConfig.capabilities) {
        const capabilities = providerConfig.capabilities;
        console.log(`     能力: 聊天=${capabilities.chat}, 工具调用=${capabilities.toolCalling}, 流式=${capabilities.streaming}`);
        this.addValidation(`Provider ${providerName} 能力配置`, '✅ 能力配置完整');
      }

      // 验证fetchStats
      if (providerConfig.fetchStats) {
        const stats = providerConfig.fetchStats;
        console.log(`     统计: 总模型=${stats.totalModels}, 测试模型=${stats.testedModels}`);
        this.addValidation(`Provider ${providerName} 统计信息`, '✅ 统计信息完整');
      }

      console.log(`     端点: ${providerConfig.endpoint}`);
      console.log(`     类型: ${providerConfig.type}\n`);
    });
  }

  /**
   * 验证routing部分
   */
  validateRoutingSection(routing) {
    console.log('📋 验证Routing配置...');
    
    if (!routing || !routing.categories) {
      this.addError('Routing配置缺少categories部分');
      return;
    }

    const requiredCategories = ['default', 'longcontext', 'background', 'thinking', 'search'];
    const missingCategories = requiredCategories.filter(cat => !routing.categories[cat]);
    
    if (missingCategories.length > 0) {
      this.addWarning(`缺少推荐的路由类别: ${missingCategories.join(', ')}`);
    }

    Object.entries(routing.categories).forEach(([category, config]) => {
      if (!config.provider || !config.model) {
        this.addError(`路由类别 ${category} 缺少provider或model配置`);
      } else {
        console.log(`   🔹 ${category}: ${config.provider} -> ${config.model}`);
        this.addValidation(`路由类别 ${category}`, '✅ 配置完整');
      }
    });

    console.log(`   策略: ${routing.strategy}\n`);
  }

  /**
   * 验证debug部分
   */
  validateDebugSection(debug) {
    console.log('📋 验证Debug配置...');
    
    if (!debug) {
      this.addWarning('缺少debug配置部分');
      return;
    }

    const debugFields = ['enabled', 'logLevel', 'traceRequests', 'saveRequests'];
    debugFields.forEach(field => {
      if (debug[field] !== undefined) {
        console.log(`   🔹 ${field}: ${debug[field]}`);
      }
    });

    this.addValidation('Debug配置', '✅ Debug配置存在');
    console.log();
  }

  /**
   * 生成标准化配置
   */
  generateStandardConfig(existingConfig) {
    console.log('🚀 生成标准化LM Studio配置...\n');

    const standardConfig = {
      $schema: "https://route-claudecode.schemas.json/v3.1.0/standard-config.json",
      version: "3.1.0",
      server: {
        port: existingConfig.server?.port || 5506,
        host: existingConfig.server?.host || "localhost",
        architecture: "v3.1.0-standard-routing",
        environment: "single-provider",
        enableLogging: true,
        enableMetrics: true
      },
      providers: {},
      routing: {
        strategy: "category-driven-standard",
        categories: {},
        fallback: {
          enabled: true,
          strategy: "round-robin"
        }
      },
      logging: {
        enabled: true,
        level: "info",
        structured: true,
        portBased: true,
        requestTracing: true,
        outputs: ["console", "file", "structured-json"]
      },
      debugging: {
        enabled: true,
        traceRequests: true,
        saveRequests: true,
        pipelineVisualization: true,
        requestIdTracking: true
      },
      validation: {
        strictMode: true,
        validateRequests: true,
        validateResponses: true,
        typeChecking: true
      },
      performance: {
        timeout: 240000,
        maxRetries: 3,
        retryDelay: 1000,
        concurrency: 10
      }
    };

    // 转换现有的providers配置
    if (existingConfig.providers) {
      Object.entries(existingConfig.providers).forEach(([name, config]) => {
        standardConfig.providers[name] = this.convertProviderToStandard(config);
      });
    }

    // 转换routing配置
    if (existingConfig.routing?.categories) {
      Object.entries(existingConfig.routing.categories).forEach(([category, config]) => {
        standardConfig.routing.categories[category] = {
          provider: config.provider,
          model: config.model,
          priority: 1,
          enabled: true,
          fallbacks: []
        };
      });
    }

    return standardConfig;
  }

  /**
   * 转换Provider配置到标准格式
   */
  convertProviderToStandard(providerConfig) {
    return {
      type: providerConfig.type,
      endpoint: providerConfig.endpoint,
      authentication: providerConfig.authentication || { type: "none" },
      models: providerConfig.models || [],
      capabilities: {
        chat: providerConfig.capabilities?.chat ?? true,
        streaming: providerConfig.capabilities?.streaming ?? false,
        toolCalling: providerConfig.capabilities?.toolCalling ?? true,
        embeddings: providerConfig.capabilities?.embeddings ?? false,
        multimodal: providerConfig.capabilities?.multimodal ?? false
      },
      maxTokens: providerConfig.maxTokens || {},
      timeout: providerConfig.timeout || 240000,
      maxRetries: providerConfig.maxRetries || 3,
      retryDelay: providerConfig.retryDelay || 1000,
      healthCheck: {
        enabled: true,
        interval: 300000,
        endpoint: "/health"
      },
      rateLimit: {
        enabled: false,
        requestsPerMinute: 60
      },
      blacklist: providerConfig.blacklist || [],
      metadata: {
        lastFetched: providerConfig.lastFetched,
        fetchStats: providerConfig.fetchStats
      }
    };
  }

  /**
   * 保存标准化配置
   */
  saveStandardConfig(config, filename = 'config-lmstudio-v3.1.0-standard.json') {
    const outputPath = path.join(os.homedir(), '.route-claudecode', 'config', 'v3', 'standard', filename);
    
    // 确保目录存在
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
      fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
      console.log(`✅ 标准化配置已保存到: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.addError(`保存配置失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 运行完整验证和生成流程
   */
  async runValidationAndGeneration() {
    console.log('🎯 LM Studio配置验证和生成工具 v3.1.0\n');
    
    // 1. 加载现有配置
    const existingConfig = this.loadExistingConfig();
    if (!existingConfig) {
      return false;
    }

    // 2. 验证配置字段
    const validationResult = this.validateConfigFields(existingConfig);
    
    // 3. 生成标准化配置
    const standardConfig = this.generateStandardConfig(existingConfig);
    
    // 4. 保存标准化配置
    const outputPath = this.saveStandardConfig(standardConfig);
    
    // 5. 显示验证报告
    this.printValidationReport(validationResult);
    
    return validationResult.isValid && outputPath;
  }

  /**
   * 打印验证报告
   */
  printValidationReport(result) {
    console.log('\n📊 配置验证报告:');
    console.log(`状态: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
    console.log(`错误: ${result.errors.length}`);
    console.log(`警告: ${result.warnings.length}`);
    console.log(`验证项目: ${result.validationResults.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ 错误:');
      result.errors.forEach(error => console.log(`  - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      result.warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    console.log('\n✅ 验证通过的项目:');
    result.validationResults.forEach(item => {
      console.log(`  - ${item.category}: ${item.result}`);
    });
  }

  // 辅助方法
  addError(message) {
    this.errors.push(message);
  }

  addWarning(message) {
    this.warnings.push(message);
  }

  addValidation(category, result) {
    this.validationResults.push({ category, result });
  }
}

// 如果直接运行此文件，执行验证和生成
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new LMStudioConfigValidator();
  validator.runValidationAndGeneration().then(success => {
    console.log(`\n🎯 配置验证和生成${success ? '成功' : '失败'}`);
    process.exit(success ? 0 : 1);
  });
}

export { LMStudioConfigValidator };