/**
 * 配置输出检查工具
 * 用于手动检查配置管理器输出是否符合预期
 */

import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as os from 'os';
import { secureLogger } from '../utils/secure-logger';

/**
 * 配置输出检查类
 */
export class ConfigOutputInspector {
  private userConfigPath: string;
  private configManager: UnifiedConfigManager;

  constructor() {
    this.userConfigPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');
    this.configManager = new UnifiedConfigManager();
  }

  /**
   * 执行配置输出检查
   */
  public async performInspection(): Promise<void> {
    try {
      // 加载统一配置
      const unifiedConfig = await this.configManager.loadConfiguration(this.userConfigPath);
      
      // 检查Provider配置
      this.inspectProviders(unifiedConfig);
      
      // 检查路由配置
      this.inspectRouting(unifiedConfig);
      
      // 检查ServerCompatibility配置
      this.inspectServerCompatibility(unifiedConfig);
      
      // 检查协议配置
      this.inspectProtocol(unifiedConfig);
      
      secureLogger.info('配置输出检查完成');
      
    } catch (error) {
      secureLogger.error('配置输出检查失败', { error: error.message });
      throw error;
    }
  }

  /**
   * 检查Provider配置
   */
  private inspectProviders(config: any): void {
    secureLogger.info('=== Provider配置检查 ===');
    
    if (config.provider && config.provider.providers) {
      secureLogger.info('Providers数量', { count: config.provider.providers.length });
      
      config.provider.providers.forEach((provider: any, index: number) => {
        secureLogger.info(`Provider ${index + 1}`, {
          name: provider.name,
          protocol: provider.protocol,
          api_base_url: provider.api_base_url || provider.baseURL,
          models: provider.models,
          hasServerCompatibility: !!provider.serverCompatibility,
          serverCompatibility: provider.serverCompatibility
        });
      });
    } else {
      secureLogger.warn('未找到Provider配置');
    }
  }

  /**
   * 检查路由配置
   */
  private inspectRouting(config: any): void {
    secureLogger.info('=== 路由配置检查 ===');
    
    if (config.router) {
      secureLogger.info('路由配置', {
        routingRulesCount: config.router.routingRules ? Object.keys(config.router.routingRules.modelMapping || {}).length : 0,
        defaultRoute: config.router.routingRules?.defaultRoute,
        routes: config.router.routes
      });
    } else {
      secureLogger.warn('未找到路由配置');
    }
  }

  /**
   * 检查ServerCompatibility配置
   */
  private inspectServerCompatibility(config: any): void {
    secureLogger.info('=== ServerCompatibility配置检查 ===');
    
    if (config.serverCompatibility) {
      secureLogger.info('ServerCompatibility配置', {
        providersCount: config.serverCompatibility.providers ? Object.keys(config.serverCompatibility.providers).length : 0,
        providers: Object.keys(config.serverCompatibility.providers || {})
      });
    } else {
      secureLogger.warn('未找到ServerCompatibility配置');
    }
  }

  /**
   * 检查协议配置
   */
  private inspectProtocol(config: any): void {
    secureLogger.info('=== 协议配置检查 ===');
    
    if (config.protocol) {
      secureLogger.info('协议配置', {
        adaptersCount: config.protocol.adapters ? Object.keys(config.protocol.adapters).length : 0,
        mappingsCount: config.protocol.mappings ? Object.keys(config.protocol.mappings).length : 0,
        modelMappingsCount: config.protocol.modelMappings ? Object.keys(config.protocol.modelMappings).length : 0
      });
    } else {
      secureLogger.warn('未找到协议配置');
    }
  }
}

/**
 * 执行配置输出检查
 */
export async function runConfigOutputInspection(): Promise<void> {
  try {
    const inspector = new ConfigOutputInspector();
    await inspector.performInspection();
  } catch (error) {
    secureLogger.error('配置输出检查执行失败', { error: error.message });
    throw error;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runConfigOutputInspection().catch(error => {
    secureLogger.error('配置输出检查失败', { error: error.message });
    process.exit(1);
  });
}