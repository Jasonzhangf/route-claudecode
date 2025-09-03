import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as os from 'os';
import { secureLogger } from '../utils/secure-logger';

class ConfigOutputAnalyzer {
  private configManager: UnifiedConfigManager;
  private configPath: string;

  constructor() {
    this.configManager = new UnifiedConfigManager();
    this.configPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');
  }

  async analyzeConfiguration() {
    try {
      secureLogger.info('开始分析配置管理器输出');
      
      const config = await this.configManager.loadConfiguration(this.configPath);
      
      // 分析Provider配置
      this.analyzeProviders(config);
      
      // 分析路由配置
      this.analyzeRouting(config);
      
      // 分析服务器配置
      this.analyzeServer(config);
      
      // 分析ServerCompatibility配置
      this.analyzeServerCompatibility(config);
      
      secureLogger.info('配置管理器输出分析完成');
      
    } catch (error) {
      secureLogger.error('配置分析失败', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  private analyzeProviders(config: any) {
    secureLogger.info('Provider配置分析', {
      providerCount: config.provider.providers.length
    });

    config.provider.providers.forEach((provider: any, index: number) => {
      secureLogger.info(`Provider ${index + 1} 详细信息`, {
        name: provider.name,
        protocol: provider.protocol,
        baseUrl: provider.api_base_url || provider.baseURL,
        apiKeyType: Array.isArray(provider.api_key || provider.apiKey) ? 'multiple' : 'single',
        modelCount: provider.models.length,
        hasServerCompatibility: !!provider.serverCompatibility,
        serverCompatibilityType: provider.serverCompatibility?.use || null
      });
    });
  }

  private analyzeRouting(config: any) {
    secureLogger.info('路由配置分析', {
      ruleCount: Object.keys(config.router.routingRules.modelMapping).length,
      defaultRoute: config.router.routingRules.defaultRoute
    });

    Object.entries(config.router.routingRules.modelMapping).forEach(([key, value]: [string, any]) => {
      secureLogger.info('路由规则详情', { key, value });
    });
  }

  private analyzeServer(config: any) {
    secureLogger.info('服务器配置分析', {
      port: config.server.port,
      host: config.server.host,
      debug: config.server.debug
    });
  }

  private analyzeServerCompatibility(config: any) {
    secureLogger.info('ServerCompatibility配置分析', {
      providerCount: Object.keys(config.serverCompatibility.providers).length,
      providers: Object.keys(config.serverCompatibility.providers)
    });
  }
}

async function runAnalysis() {
  const analyzer = new ConfigOutputAnalyzer();
  await analyzer.analyzeConfiguration();
}

// 如果直接运行此文件
if (require.main === module) {
  runAnalysis().catch(error => {
    secureLogger.error('分析执行失败', { error: error.message });
    process.exit(1);
  });
}

export { ConfigOutputAnalyzer, runAnalysis };