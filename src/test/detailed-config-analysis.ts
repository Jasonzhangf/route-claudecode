import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as os from 'os';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

async function runDetailedAnalysis() {
  const outputDir = './test-output';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  const configManager = new UnifiedConfigManager();
  const configPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');
  
  const config = await configManager.loadConfiguration(configPath);
  
  // 详细分析Provider配置
  const providerAnalysis = config.provider.providers.map((provider: any) => ({
    name: provider.name,
    protocol: provider.protocol,
    baseUrl: provider.api_base_url || provider.baseURL,
    hasApiKey: !!provider.api_key || !!provider.apiKey,
    apiKeyType: Array.isArray(provider.api_key || provider.apiKey) ? 'array' : 'string',
    modelCount: provider.models.length,
    hasServerCompatibility: !!provider.serverCompatibility,
    serverCompatibilityType: provider.serverCompatibility?.use
  }));
  
  // 详细分析路由配置
  const routingAnalysis = {
    ruleCount: Object.keys(config.router.routingRules.modelMapping).length,
    rules: Object.entries(config.router.routingRules.modelMapping).map(([key, value]) => ({
      category: key,
      route: value
    }))
  };
  
  // 详细分析服务器配置
  const serverAnalysis = {
    port: config.server.port,
    host: config.server.host,
    debug: config.server.debug
  };
  
  const detailedOutput = {
    timestamp: new Date().toISOString(),
    providerAnalysis,
    routingAnalysis,
    serverAnalysis
  };
  
  writeFileSync('./test-output/detailed-config-analysis.json', JSON.stringify(detailedOutput, null, 2));
  
  // 创建人类可读的文本报告
  let report = `配置管理器详细分析报告\n`;
  report += `========================\n`;
  report += `生成时间: ${detailedOutput.timestamp}\n\n`;
  
  report += `Provider分析:\n`;
  report += `-------------\n`;
  detailedOutput.providerAnalysis.forEach((provider, index) => {
    report += `${index + 1}. ${provider.name}\n`;
    report += `   协议: ${provider.protocol}\n`;
    report += `   基础URL: ${provider.baseUrl}\n`;
    report += `   API密钥: ${provider.hasApiKey ? '存在' : '不存在'} (${provider.apiKeyType})\n`;
    report += `   模型数量: ${provider.modelCount}\n`;
    report += `   ServerCompatibility: ${provider.hasServerCompatibility ? provider.serverCompatibilityType : '无'}\n\n`;
  });
  
  report += `路由分析:\n`;
  report += `---------\n`;
  report += `规则总数: ${detailedOutput.routingAnalysis.ruleCount}\n`;
  detailedOutput.routingAnalysis.rules.forEach(rule => {
    report += `${rule.category}: ${rule.route}\n`;
  });
  
  report += `\n服务器分析:\n`;
  report += `-----------\n`;
  report += `端口: ${detailedOutput.serverAnalysis.port}\n`;
  report += `主机: ${detailedOutput.serverAnalysis.host}\n`;
  report += `调试模式: ${detailedOutput.serverAnalysis.debug}\n`;
  
  writeFileSync('./test-output/detailed-config-report.txt', report);
}

runDetailedAnalysis();