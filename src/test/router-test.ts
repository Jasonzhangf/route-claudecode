/**
 * 路由器测试工具
 * 用于检查路由器功能是否符合预期
 */

import { ConfigReader } from '../config/config-reader';
import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as os from 'os';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * 配置验证检查类
 */
export class RouterTester {
  private userConfigPath: string;
  private systemConfigPath: string;
  private configManager: UnifiedConfigManager;

  constructor() {
    this.userConfigPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');
    this.systemConfigPath = path.join(__dirname, '../../config/system-config.json');
    this.configManager = new UnifiedConfigManager();
  }

  /**
   * 执行完整的配置验证检查
   */
  public async performValidation(): Promise<ConfigValidationReport> {
    try {
      // 直接使用ConfigReader加载配置进行检查
      const rawConfig = ConfigReader.loadConfig(this.userConfigPath, this.systemConfigPath);
      
      // 执行各项检查
      const providerCheck = this.validateProviders(rawConfig);
      const systemConfigCheck = this.validateSystemConfig(rawConfig);
      const routingCheck = this.validateRouting(rawConfig);
      const serverCompatibilityCheck = this.validateServerCompatibility(rawConfig);

      return {
        timestamp: new Date().toISOString(),
        configPath: this.userConfigPath,
        validationResults: {
          providers: providerCheck,
          systemConfig: systemConfigCheck,
          routing: routingCheck,
          serverCompatibility: serverCompatibilityCheck
        },
        overallStatus: providerCheck.isValid && systemConfigCheck.isValid && routingCheck.isValid && serverCompatibilityCheck.isValid
      };
    } catch (error) {
      secureLogger.error('配置验证检查失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 验证Provider配置
   */
  private validateProviders(config: any): ValidationResult {
    try {
      if (!config.providers || !Array.isArray(config.providers)) {
        return {
          isValid: false,
          errors: ['Providers必须是数组'],
          warnings: [],
          details: {}
        };
      }

      if (config.providers.length === 0) {
        return {
          isValid: false,
          errors: ['Providers数组不能为空'],
          warnings: [],
          details: {}
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      const providerDetails: Record<string, any> = {};

      config.providers.forEach((provider: any, index: number) => {
        // 检查必需字段
        if (!provider.name) {
          errors.push(`Provider ${index} 缺少name字段`);
        }
        // 检查api_base_url字段(支持多种命名方式)
        const baseUrl = provider.api_base_url || provider.baseURL || provider.apiBaseUrl;
        if (!baseUrl) {
          errors.push(`Provider ${index} (${provider.name}) 缺少api_base_url字段`);
        }
        if (!provider.models || !Array.isArray(provider.models)) {
          errors.push(`Provider ${index} (${provider.name}) models字段无效`);
        }

        // 记录详细信息
        providerDetails[provider.name || `provider-${index}`] = {
          hasName: !!provider.name,
          hasBaseUrl: !!(provider.api_base_url || provider.baseURL || provider.apiBaseUrl),
          modelCount: provider.models?.length || 0,
          hasServerCompatibility: !!provider.serverCompatibility,
          serverCompatibilityUse: provider.serverCompatibility?.use
        };
      });

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        details: providerDetails
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Provider验证失败: ${error.message}`],
        warnings: [],
        details: {}
      };
    }
  }

  /**
   * 验证系统配置
   */
  private validateSystemConfig(config: any): ValidationResult {
    try {
      const systemConfig = config.systemConfig;
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!systemConfig) {
        return {
          isValid: false,
          errors: ['缺少systemConfig'],
          warnings: [],
          details: {}
        };
      }

      if (!systemConfig.providerTypes || typeof systemConfig.providerTypes !== 'object') {
        errors.push('systemConfig.providerTypes必须是对象');
      } else {
        // 检查关键provider类型是否存在
        const requiredProviders = ['iflow', 'qwen'];
        requiredProviders.forEach(provider => {
          if (!systemConfig.providerTypes[provider]) {
            warnings.push(`系统配置中缺少${provider} provider类型`);
          }
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        details: {
          providerTypesCount: Object.keys(systemConfig.providerTypes || {}).length,
          hasIFlowType: !!systemConfig.providerTypes?.iflow,
          hasQwenType: !!systemConfig.providerTypes?.qwen
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`系统配置验证失败: ${error.message}`],
        warnings: [],
        details: {}
      };
    }
  }

  /**
   * 验证路由配置
   */
  private validateRouting(config: any): ValidationResult {
    try {
      const router = config.router;
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!router || typeof router !== 'object') {
        warnings.push('缺少路由配置(router)');
      } else {
        const ruleCount = Object.keys(router).length;
        if (ruleCount === 0) {
          warnings.push('路由规则为空');
        }
      }

      return {
        isValid: true, // 路由配置不是必需的
        errors,
        warnings,
        details: {
          routerRulesCount: router ? Object.keys(router).length : 0
        }
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`路由配置验证失败: ${error.message}`],
        warnings: [],
        details: {}
      };
    }
  }

  /**
   * 验证ServerCompatibility配置
   */
  private validateServerCompatibility(config: any): ValidationResult {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];
      const compatibilityDetails: Record<string, any> = {};

      if (config.providers && Array.isArray(config.providers)) {
        config.providers.forEach((provider: any) => {
          const providerName = provider.name;
          const userServerCompatibility = provider.serverCompatibility?.use;
          const systemServerCompatibility = config.systemConfig?.providerTypes?.[providerName]?.serverCompatibility;

          compatibilityDetails[providerName] = {
            userConfig: userServerCompatibility,
            systemConfig: systemServerCompatibility,
            finalSelection: userServerCompatibility || systemServerCompatibility || 'passthrough'
          };

          // 验证期望的配置
          if (providerName === 'iflow') {
            const expectedCompatibility = 'iflow';
            if (userServerCompatibility !== expectedCompatibility && systemServerCompatibility !== expectedCompatibility) {
              warnings.push(`IFlow provider未正确配置serverCompatibility (期望: ${expectedCompatibility})`);
            }
          } else if (providerName === 'qwen') {
            const expectedCompatibility = 'qwen';
            if (userServerCompatibility !== expectedCompatibility && systemServerCompatibility !== expectedCompatibility) {
              warnings.push(`Qwen provider未正确配置serverCompatibility (期望: ${expectedCompatibility})`);
            }
          }
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        details: compatibilityDetails
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`ServerCompatibility验证失败: ${error.message}`],
        warnings: [],
        details: {}
      };
    }
  }
}

/**
 * 验证结果接口
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: Record<string, any>;
}

/**
 * 配置验证报告接口
 */
interface ConfigValidationReport {
  timestamp: string;
  configPath: string;
  validationResults: {
    providers: ValidationResult;
    systemConfig: ValidationResult;
    routing: ValidationResult;
    serverCompatibility: ValidationResult;
  };
  overallStatus: boolean;
}

/**
 * 执行配置验证检查
 */
export async function runConfigValidationInspection(): Promise<void> {
  try {
    const inspector = new RouterTester();
    const report = await inspector.performValidation();

    secureLogger.info('配置验证检查完成', {
      overallStatus: report.overallStatus,
      providersValid: report.validationResults.providers.isValid,
      systemConfigValid: report.validationResults.systemConfig.isValid,
      serverCompatibilityValid: report.validationResults.serverCompatibility.isValid
    });

    // 输出详细结果
    if (!report.validationResults.providers.isValid) {
      secureLogger.error('Provider配置验证失败', {
        errors: report.validationResults.providers.errors
      });
    }

    if (!report.validationResults.systemConfig.isValid) {
      secureLogger.error('系统配置验证失败', {
        errors: report.validationResults.systemConfig.errors
      });
    }

    if (report.validationResults.serverCompatibility.warnings.length > 0) {
      secureLogger.warn('ServerCompatibility配置警告', {
        warnings: report.validationResults.serverCompatibility.warnings
      });
    }

    // 记录详细信息
    secureLogger.info('ServerCompatibility详细信息', {
      details: report.validationResults.serverCompatibility.details
    });

    // 手动检查配置文件内容
    await inspectRawConfigFile(inspector['userConfigPath']);

  } catch (error) {
    secureLogger.error('配置验证检查执行失败', { error: error.message });
    throw error;
  }
}

/**
 * 检查原始配置文件内容
 */
async function inspectRawConfigFile(configPath: string): Promise<void> {
  try {
    const rawConfig = JQJsonHandler.parseJsonFile<any>(configPath);
    
    secureLogger.info('原始配置文件内容检查', {
      providerCount: rawConfig.providers?.length || 0
    });

    if (rawConfig.providers && Array.isArray(rawConfig.providers)) {
      rawConfig.providers.forEach((provider: any, index: number) => {
        secureLogger.info(`Provider ${index + 1} 配置`, {
          name: provider.name,
          serverCompatibility: provider.serverCompatibility,
          hasUseField: !!provider.serverCompatibility?.use,
          useValue: provider.serverCompatibility?.use
        });
      });
    }
  } catch (error) {
    secureLogger.error('原始配置文件检查失败', { error: error.message });
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runConfigValidationInspection().catch(error => {
    secureLogger.error('配置验证检查失败', { error: error.message });
    process.exit(1);
  });
}