/**
 * 路由器输入验证工具
 * 验证配置管理器输出是否符合路由器输入要求
 */

import { UnifiedConfigManager } from '../config/unified-config-manager';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// 确保输出目录存在
const outputDir = './test-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 加载统一配置
const configManager = new UnifiedConfigManager();
const configPath = path.join(os.homedir(), '.route-claudecode/config/v4/single-provider/qwen-iflow-mixed-v4-5511.json');

// 异步函数执行
async function executeValidation() {
  const config = await configManager.loadConfiguration(configPath);
  
  // 验证提供商配置
  const providerValidation = {
    timestamp: new Date().toISOString(),
    validationType: 'provider-config',
    providers: config.provider.providers.map((provider: any) => ({
      name: provider.name,
      protocol: provider.protocol,
      hasBaseUrl: !!(provider.api_base_url || provider.baseURL || provider.apiBaseUrl),
      modelCount: provider.models.length,
      hasServerCompatibility: !!provider.serverCompatibility,
      serverCompatibilityType: provider.serverCompatibility
    })),
    isValid: Array.isArray(config.provider.providers) && config.provider.providers.length > 0
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-provider-validation.json'),
    JSON.stringify(providerValidation, null, 2)
  );

  // 验证路由配置
  const routingValidation = {
    timestamp: new Date().toISOString(),
    validationType: 'routing-config',
    routingRules: Object.keys(config.router.routingRules.modelMapping).length,
    rules: Object.entries(config.router.routingRules.modelMapping).map(([key, value]) => ({
      category: key,
      route: value
    })),
    isValid: !!config.router.routingRules.modelMapping
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-routing-validation.json'),
    JSON.stringify(routingValidation, null, 2)
  );

  // 生成综合报告
  const comprehensiveReport = {
    timestamp: new Date().toISOString(),
    configSource: configPath,
    validations: {
      provider: providerValidation.isValid,
      routing: routingValidation.isValid
    },
    details: {
      providerCount: providerValidation.providers.length,
      routingRuleCount: routingValidation.routingRules,
      providerNames: providerValidation.providers.map(p => p.name)
    }
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-input-comprehensive-report.json'),
    JSON.stringify(comprehensiveReport, null, 2)
  );

  // 生成摘要
  let summary = `路由器输入验证摘要\n`;
  summary += `==================\n`;
  summary += `验证时间: ${comprehensiveReport.timestamp}\n`;
  summary += `配置文件: ${comprehensiveReport.configSource}\n\n`;

  summary += `验证结果:\n`;
  summary += `---------\n`;
  summary += `Provider配置: ${providerValidation.isValid ? '✅ 通过' : '❌ 失败'}\n`;
  summary += `路由配置: ${routingValidation.isValid ? '✅ 通过' : '❌ 失败'}\n\n`;

  summary += `详细信息:\n`;
  summary += `---------\n`;
  summary += `Provider数量: ${comprehensiveReport.details.providerCount}\n`;
  summary += `路由规则数量: ${comprehensiveReport.details.routingRuleCount}\n`;
  summary += `Provider名称: ${comprehensiveReport.details.providerNames.join(', ')}\n`;

  fs.writeFileSync(
    path.join(outputDir, 'router-input-validation-summary.txt'),
    summary
  );
}

// 执行验证
executeValidation();