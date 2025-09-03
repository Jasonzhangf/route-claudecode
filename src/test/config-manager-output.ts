import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as os from 'os';
import { secureLogger } from '../utils/secure-logger';

async function runConfigManagerTest() {
  try {
    const configManager = new UnifiedConfigManager();
    const configPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');
    
    secureLogger.info('正在加载配置文件', { configPath });
    
    const config = await configManager.loadConfiguration(configPath);
    
    secureLogger.info('配置管理器输出结果');
    
    // 输出Provider信息
    secureLogger.info('Provider配置', {
      providerCount: config.provider.providers.length
    });
    
    config.provider.providers.forEach((provider: any, index: number) => {
      secureLogger.info(`Provider ${index + 1}`, {
        name: provider.name,
        protocol: provider.protocol,
        baseUrl: provider.api_base_url || provider.baseURL,
        apiKeyType: Array.isArray(provider.api_key || provider.apiKey) ? 'multiple-keys' : 'single-key',
        modelCount: provider.models.length,
        serverCompatibility: provider.serverCompatibility?.use || 'none'
      });
    });
    
    // 输出路由信息
    secureLogger.info('路由配置', {
      routingRulesCount: Object.keys(config.router.routingRules.modelMapping).length,
      defaultRoute: config.router.routingRules.defaultRoute
    });
    
    Object.entries(config.router.routingRules.modelMapping).forEach(([key, value]: [string, any]) => {
      secureLogger.info('路由规则', { key, value });
    });
    
    // 输出Server配置
    secureLogger.info('服务器配置', {
      port: config.server.port,
      host: config.server.host,
      debug: config.server.debug
    });
    
    // 输出ServerCompatibility配置
    secureLogger.info('ServerCompatibility配置', {
      serverCompatibilityProvidersCount: Object.keys(config.serverCompatibility.providers).length
    });
    
    Object.entries(config.serverCompatibility.providers).forEach(([name, provider]: [string, any]) => {
      secureLogger.info('ServerCompatibility Provider', { 
        name, 
        type: provider.type 
      });
    });
    
    secureLogger.info('配置管理器测试完成');
    
  } catch (error) {
    secureLogger.error('配置管理器测试失败', { 
      error: error.message,
      stack: error.stack
    });
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runConfigManagerTest().catch(error => {
    secureLogger.error('配置管理器测试执行失败', { error: error.message });
    process.exit(1);
  });
}

export { runConfigManagerTest };