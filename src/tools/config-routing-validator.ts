/**
 * 配置路由验证工具
 * 
 * 系统性验证：
 * 1. 配置文件输入输出匹配性
 * 2. maxTokens字段准确性
 * 3. 路由器正确解读Provider和Models
 * 4. Pipeline Manager流水线表生成对比
 * 
 * @author RCC v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { JQJsonHandler } from '../utils/jq-json-handler';
import { secureLogger } from '../utils/secure-logger';
import { ProviderExpander } from '../config/provider-expander';

export interface ConfigValidationResult {
  configFile: {
    valid: boolean;
    errors: string[];
    providersCount: number;
    modelsTotal: number;
  };
  maxTokens: {
    valid: boolean;
    errors: string[];
    modelsMissingMaxTokens: string[];
    modelsWithInvalidMaxTokens: string[];
  };
  routing: {
    valid: boolean;
    errors: string[];
    routingStringsParsed: number;
    compoundNamesFound: string[];
    unmatchedModels: string[];
  };
  pipelineTable: {
    valid: boolean;
    errors: string[];
    expectedPipelines: number;
    actualPipelines: number;
    missingPipelines: string[];
  };
  overall: {
    passed: boolean;
    score: number;
    summary: string;
  };
}

export class ConfigRoutingValidator {
  private configPath: string;
  private config: any;

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * 执行完整的配置验证
   */
  async validate(): Promise<ConfigValidationResult> {
    const result: ConfigValidationResult = {
      configFile: { valid: true, errors: [], providersCount: 0, modelsTotal: 0 },
      maxTokens: { valid: true, errors: [], modelsMissingMaxTokens: [], modelsWithInvalidMaxTokens: [] },
      routing: { valid: true, errors: [], routingStringsParsed: 0, compoundNamesFound: [], unmatchedModels: [] },
      pipelineTable: { valid: true, errors: [], expectedPipelines: 0, actualPipelines: 0, missingPipelines: [] },
      overall: { passed: true, score: 100, summary: '' }
    };

    try {
      // 1. 加载和验证配置文件
      await this.validateConfigFile(result);
      
      // 2. 验证maxTokens字段
      await this.validateMaxTokens(result);
      
      // 3. 验证路由系统
      await this.validateRouting(result);
      
      // 4. 验证流水线表生成
      await this.validatePipelineTable(result);
      
      // 5. 计算总体结果
      this.calculateOverallResult(result);
      
    } catch (error) {
      result.overall.passed = false;
      result.overall.score = 0;
      result.overall.summary = `Validation failed: ${error.message}`;
      secureLogger.error('Config validation failed', { error: error.message });
    }

    return result;
  }

  /**
   * 验证配置文件基本格式和完整性
   */
  private async validateConfigFile(result: ConfigValidationResult): Promise<void> {
    secureLogger.info('验证配置文件格式');
    
    try {
      // 读取配置文件
      if (!fs.existsSync(this.configPath)) {
        result.configFile.valid = false;
        result.configFile.errors.push('配置文件不存在');
        return;
      }

      const configContent = fs.readFileSync(this.configPath, 'utf8');
      this.config = JQJsonHandler.parseJsonString(configContent);

      // 验证基本结构
      if (!this.config.Providers || !Array.isArray(this.config.Providers)) {
        result.configFile.valid = false;
        result.configFile.errors.push('配置文件缺少Providers数组');
        return;
      }

      if (!this.config.router || typeof this.config.router !== 'object') {
        result.configFile.valid = false;
        result.configFile.errors.push('配置文件缺少router配置');
        return;
      }

      result.configFile.providersCount = this.config.Providers.length;
      result.configFile.modelsTotal = this.config.Providers.reduce((total: number, provider: any) => {
        return total + (Array.isArray(provider.models) ? provider.models.length : 0);
      }, 0);

      secureLogger.info('配置文件格式验证通过', {
        providersCount: result.configFile.providersCount,
        modelsTotal: result.configFile.modelsTotal
      });

    } catch (error) {
      result.configFile.valid = false;
      result.configFile.errors.push(`配置文件解析失败: ${error.message}`);
      secureLogger.error('配置文件解析失败', { error: error.message });
    }
  }

  /**
   * 验证maxTokens字段准确性
   */
  private async validateMaxTokens(result: ConfigValidationResult): Promise<void> {
    secureLogger.info('验证maxTokens字段准确性');
    
    if (!this.config || !this.config.Providers) {
      return;
    }

    for (const provider of this.config.Providers) {
      if (!Array.isArray(provider.models)) {
        continue;
      }

      for (const model of provider.models) {
        const modelId = `${provider.name}:${model.name || model}`;
        
        if (typeof model === 'string') {
          // 字符串格式模型缺少maxTokens
          result.maxTokens.modelsMissingMaxTokens.push(modelId);
          result.maxTokens.valid = false;
          result.maxTokens.errors.push(`模型 ${modelId} 缺少maxTokens字段`);
        } else if (typeof model === 'object') {
          if (!model.maxTokens || typeof model.maxTokens !== 'number') {
            result.maxTokens.modelsMissingMaxTokens.push(modelId);
            result.maxTokens.valid = false;
            result.maxTokens.errors.push(`模型 ${modelId} maxTokens字段无效`);
          } else if (model.maxTokens < 1000 || model.maxTokens > 20000000) {
            result.maxTokens.modelsWithInvalidMaxTokens.push(modelId);
            result.maxTokens.valid = false;
            result.maxTokens.errors.push(`模型 ${modelId} maxTokens值异常: ${model.maxTokens}`);
          }
        }
      }
    }

    secureLogger.info('maxTokens验证完成', {
      missingCount: result.maxTokens.modelsMissingMaxTokens.length,
      invalidCount: result.maxTokens.modelsWithInvalidMaxTokens.length
    });
  }

  /**
   * 验证路由系统正确性
   */
  private async validateRouting(result: ConfigValidationResult): Promise<void> {
    secureLogger.info('验证路由系统解析');
    
    if (!this.config || !this.config.router) {
      return;
    }

    try {
      // 使用ProviderExpander测试路由解析
      const expandedConfig = ProviderExpander.expandRouting(
        this.config.router,
        this.config.security,
        this.config.Providers
      );
      
      secureLogger.info('检查路由字符串解析');
      
      // 检查每个路由字符串
      const routerKeys = Object.keys(this.config.router);
      for (const key of routerKeys) {
        if (typeof this.config.router[key] !== 'string') {
          continue;
        }
        
        const routeString = this.config.router[key];
        secureLogger.debug('解析路由', { key, routeString });
        
        result.routing.routingStringsParsed++;
        
        // 检查是否包含复合名称（如 "qwen3-coder-plus;modelscope"）
        if (this.hasCompoundModelName(routeString)) {
          result.routing.compoundNamesFound.push(`${key}: ${routeString}`);
          result.routing.valid = false;
          result.routing.errors.push(`路由 ${key} 包含复合模型名称: ${routeString}`);
        }
        
        // 验证路由中引用的模型是否存在
        const unmatchedModels = this.findUnmatchedModels(routeString);
        if (unmatchedModels.length > 0) {
          result.routing.unmatchedModels.push(...unmatchedModels.map(m => `${key}:${m}`));
          result.routing.valid = false;
          result.routing.errors.push(`路由 ${key} 引用不存在的模型: ${unmatchedModels.join(', ')}`);
        }
      }

      // 检查security路由
      if (this.config.security && typeof this.config.security === 'object') {
        const securityKeys = Object.keys(this.config.security);
        for (const key of securityKeys) {
          if (typeof this.config.security[key] !== 'string') {
            continue;
          }
          
          const routeString = this.config.security[key];
          secureLogger.debug('解析security路由', { key, routeString });
          
          result.routing.routingStringsParsed++;
          
          const unmatchedModels = this.findUnmatchedModels(routeString);
          if (unmatchedModels.length > 0) {
            result.routing.unmatchedModels.push(...unmatchedModels.map(m => `security.${key}:${m}`));
            result.routing.valid = false;
            result.routing.errors.push(`Security路由 ${key} 引用不存在的模型: ${unmatchedModels.join(', ')}`);
          }
        }
      }

      secureLogger.info('路由解析验证完成', {
        routingStringsParsed: result.routing.routingStringsParsed,
        compoundNamesFound: result.routing.compoundNamesFound.length,
        unmatchedModels: result.routing.unmatchedModels.length
      });

    } catch (error) {
      result.routing.valid = false;
      result.routing.errors.push(`路由系统验证失败: ${error.message}`);
      secureLogger.error('路由系统验证失败', { error: error.message });
    }
  }

  /**
   * 验证流水线表生成正确性
   */
  private async validatePipelineTable(result: ConfigValidationResult): Promise<void> {
    secureLogger.info('验证流水线表生成');
    
    try {
      // 计算期望的流水线数量
      result.pipelineTable.expectedPipelines = this.calculateExpectedPipelines();
      
      // 检查generated目录是否存在流水线表
      const configName = path.basename(this.configPath, '.json');
      const generatedDir = path.join(os.homedir(), '.route-claudecode', 'config', 'generated');
      const pipelineTablePath = path.join(generatedDir, `${configName}-pipeline-table.json`);
      
      if (!fs.existsSync(pipelineTablePath)) {
        result.pipelineTable.valid = false;
        result.pipelineTable.errors.push(`流水线表文件不存在: ${pipelineTablePath}`);
        return;
      }

      // 读取并分析流水线表
      const pipelineTableContent = fs.readFileSync(pipelineTablePath, 'utf8');
      const pipelineTable = JQJsonHandler.parseJsonString(pipelineTableContent);
      
      if (!pipelineTable.allPipelines || !Array.isArray(pipelineTable.allPipelines)) {
        result.pipelineTable.valid = false;
        result.pipelineTable.errors.push('流水线表格式无效');
        return;
      }

      result.pipelineTable.actualPipelines = pipelineTable.allPipelines.length;
      
      // 检查缺少的流水线
      const missingPipelines = this.findMissingPipelines(pipelineTable);
      result.pipelineTable.missingPipelines = missingPipelines;
      
      if (missingPipelines.length > 0) {
        result.pipelineTable.valid = false;
        result.pipelineTable.errors.push(`缺少流水线: ${missingPipelines.join(', ')}`);
      }

      secureLogger.info('流水线表验证完成', {
        expectedPipelines: result.pipelineTable.expectedPipelines,
        actualPipelines: result.pipelineTable.actualPipelines,
        missingPipelines: result.pipelineTable.missingPipelines.length
      });

    } catch (error) {
      result.pipelineTable.valid = false;
      result.pipelineTable.errors.push(`流水线表验证失败: ${error.message}`);
      secureLogger.error('流水线表验证失败', { error: error.message });
    }
  }

  /**
   * 检查路由字符串是否包含复合模型名称
   */
  private hasCompoundModelName(routeString: string): boolean {
    // 检查是否包含类似 "qwen3-coder-plus;modelscope" 的模式
    const parts = routeString.split(';');
    for (const part of parts) {
      const [provider, model] = part.split(',');
      if (model && model.includes(';')) {
        return true;
      }
    }
    return false;
  }

  /**
   * 查找路由中引用但不存在的模型
   */
  private findUnmatchedModels(routeString: string): string[] {
    const unmatched: string[] = [];
    const parts = routeString.split(';');
    
    for (const part of parts) {
      const [providerName, modelName] = part.split(',');
      if (!providerName || !modelName) {
        continue;
      }

      // 查找对应的provider
      const provider = this.config.Providers?.find((p: any) => p.name === providerName.trim());
      if (!provider) {
        unmatched.push(`${providerName} (provider not found)`);
        continue;
      }

      // 查找对应的model
      if (!Array.isArray(provider.models)) {
        unmatched.push(`${providerName}:${modelName} (no models array)`);
        continue;
      }

      const modelExists = provider.models.some((model: any) => {
        if (typeof model === 'string') {
          return model === modelName.trim();
        } else if (typeof model === 'object' && model.name) {
          return model.name === modelName.trim();
        }
        return false;
      });

      if (!modelExists) {
        unmatched.push(`${providerName}:${modelName}`);
      }
    }

    return unmatched;
  }

  /**
   * 计算期望的流水线数量
   */
  private calculateExpectedPipelines(): number {
    if (!this.config || !this.config.Providers) {
      return 0;
    }

    return this.config.Providers.reduce((total: number, provider: any) => {
      return total + (Array.isArray(provider.models) ? provider.models.length : 0);
    }, 0);
  }

  /**
   * 查找缺少的流水线
   */
  private findMissingPipelines(pipelineTable: any): string[] {
    const missing: string[] = [];
    const existingPipelines = new Set(
      pipelineTable.allPipelines?.map((p: any) => `${p.provider}:${p.targetModel}`) || []
    );

    if (!this.config || !this.config.Providers) {
      return missing;
    }

    for (const provider of this.config.Providers) {
      if (!Array.isArray(provider.models)) {
        continue;
      }

      for (const model of provider.models) {
        const modelName = typeof model === 'string' ? model : model.name;
        const pipelineId = `${provider.name}:${modelName}`;
        
        if (!existingPipelines.has(pipelineId)) {
          missing.push(pipelineId);
        }
      }
    }

    return missing;
  }

  /**
   * 计算总体验证结果
   */
  private calculateOverallResult(result: ConfigValidationResult): void {
    const checks = [
      result.configFile.valid,
      result.maxTokens.valid,
      result.routing.valid,
      result.pipelineTable.valid
    ];
    
    const passedChecks = checks.filter(Boolean).length;
    result.overall.score = Math.round((passedChecks / checks.length) * 100);
    result.overall.passed = passedChecks === checks.length;
    
    const allErrors = [
      ...result.configFile.errors,
      ...result.maxTokens.errors,
      ...result.routing.errors,
      ...result.pipelineTable.errors
    ];
    
    if (result.overall.passed) {
      result.overall.summary = '✅ 所有配置验证检查通过';
    } else {
      result.overall.summary = `❌ ${allErrors.length} 个验证错误，通过率 ${result.overall.score}%`;
    }
  }

  /**
   * 静态方法：验证指定配置文件
   */
  static async validateConfig(configPath: string): Promise<ConfigValidationResult> {
    const validator = new ConfigRoutingValidator(configPath);
    return await validator.validate();
  }

  /**
   * 静态方法：打印验证结果
   */
  static printValidationResult(result: ConfigValidationResult): void {
    secureLogger.info('===== 配置验证报告 =====');
    secureLogger.info('总体结果', { 
      summary: result.overall.summary,
      score: result.overall.score 
    });
    
    // 配置文件验证
    secureLogger.info('配置文件验证', {
      valid: result.configFile.valid,
      providersCount: result.configFile.providersCount,
      modelsTotal: result.configFile.modelsTotal,
      errors: result.configFile.errors
    });
    
    // MaxTokens验证
    secureLogger.info('MaxTokens验证', {
      valid: result.maxTokens.valid,
      missingCount: result.maxTokens.modelsMissingMaxTokens.length,
      invalidCount: result.maxTokens.modelsWithInvalidMaxTokens.length,
      errorCount: result.maxTokens.errors.length
    });
    
    // 路由验证
    secureLogger.info('路由系统验证', {
      valid: result.routing.valid,
      routingStringsParsed: result.routing.routingStringsParsed,
      compoundNamesFound: result.routing.compoundNamesFound.length,
      unmatchedModels: result.routing.unmatchedModels.length,
      compoundNames: result.routing.compoundNamesFound,
      unmatchedModelsList: result.routing.unmatchedModels.slice(0, 10)
    });
    
    // 流水线表验证
    secureLogger.info('流水线表验证', {
      valid: result.pipelineTable.valid,
      expectedPipelines: result.pipelineTable.expectedPipelines,
      actualPipelines: result.pipelineTable.actualPipelines,
      missingPipelines: result.pipelineTable.missingPipelines.length,
      missingPipelinesList: result.pipelineTable.missingPipelines.slice(0, 10)
    });
    
    secureLogger.info('===== 验证报告结束 =====');
  }
}