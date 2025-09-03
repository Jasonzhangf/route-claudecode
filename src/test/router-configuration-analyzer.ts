/**
 * 路由器配置分析器
 * 分析配置管理器输出并生成路由器模块需要的数据结构
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
async function analyzeRouterConfiguration() {
  const config = await configManager.loadConfiguration(configPath);
  
  // 生成路由器输入验证数据
  const routerInputValidation = {
    timestamp: new Date().toISOString(),
    module: 'router',
    validationData: {
      providers: config.provider.providers.map((provider: any) => ({
        name: provider.name,
        protocol: provider.protocol,
        baseUrlAvailable: !!(provider.api_base_url || provider.baseURL || provider.apiBaseUrl),
        models: provider.models.length,
        serverCompatibilityConfigured: !!provider.serverCompatibility,
        serverCompatibilityType: provider.serverCompatibility?.use || 'none'
      })),
      routing: {
        ruleCount: Object.keys(config.router.routingRules.modelMapping).length,
        rules: Object.entries(config.router.routingRules.modelMapping).map(([category, rule]) => ({
          category,
          mapping: rule
        }))
      }
    },
    isValid: true
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-input-validation.json'),
    JSON.stringify(routerInputValidation, null, 2)
  );

  // 生成路由决策映射数据
  const routingDecisionMap = {
    timestamp: new Date().toISOString(),
    module: 'router',
    decisionMap: Object.entries(config.router.routingRules.modelMapping).map(([input, output]) => ({
      inputCategory: input,
      outputMapping: output,
      pipelineRequirements: parseRouteMapping(output, config)
    }))
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-decision-mapping.json'),
    JSON.stringify(routingDecisionMap, null, 2)
  );

  // 生成流水线配置数据
  const pipelineConfiguration = {
    timestamp: new Date().toISOString(),
    module: 'router',
    pipelineSetup: generatePipelineSetup(config)
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-pipeline-configuration.json'),
    JSON.stringify(pipelineConfiguration, null, 2)
  );

  // 生成模块接口数据
  const moduleInterfaceData = {
    timestamp: new Date().toISOString(),
    module: 'router',
    interfaceRequirements: {
      inputFormat: 'UnifiedConfigOutputs.router',
      expectedStructure: {
        routingRules: 'modelMapping object',
        providers: 'array of provider configurations',
        server: 'server configuration object'
      },
      outputFormat: 'RoutingTable interface compliant'
    }
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-module-interface.json'),
    JSON.stringify(moduleInterfaceData, null, 2)
  );

  // 生成综合分析报告
  const analysisReport = {
    timestamp: new Date().toISOString(),
    configSource: configPath,
    modules: {
      inputValidation: 'router-input-validation.json',
      decisionMapping: 'router-decision-mapping.json',
      pipelineConfiguration: 'router-pipeline-configuration.json',
      interfaceData: 'router-module-interface.json'
    },
    summary: {
      providerCount: config.provider.providers.length,
      routingRuleCount: Object.keys(config.router.routingRules.modelMapping).length,
      pipelineSetupCount: pipelineConfiguration.pipelineSetup.categories.length
    }
  };

  fs.writeFileSync(
    path.join(outputDir, 'router-configuration-analysis.json'),
    JSON.stringify(analysisReport, null, 2)
  );

  // 生成摘要
  let summary = `路由器配置分析报告\n`;
  summary += `==================\n`;
  summary += `分析时间: ${analysisReport.timestamp}\n`;
  summary += `配置源: ${analysisReport.configSource}\n\n`;

  summary += `配置概要:\n`;
  summary += `--------\n`;
  summary += `提供商数量: ${analysisReport.summary.providerCount}\n`;
  summary += `路由规则数: ${analysisReport.summary.routingRuleCount}\n`;
  summary += `流水线类别数: ${analysisReport.summary.pipelineSetupCount}\n\n`;

  summary += `生成文件:\n`;
  summary += `--------\n`;
  for (const [name, file] of Object.entries(analysisReport.modules)) {
    summary += `${name}: ${file}\n`;
  }

  fs.writeFileSync(
    path.join(outputDir, 'router-configuration-summary.txt'),
    summary
  );
}

/**
 * 解析路由映射并生成流水线需求
 */
function parseRouteMapping(mapping: string, config: any): any[] {
  const requirements: any[] = [];
  const pairs = mapping.split(';');
  
  for (const pair of pairs) {
    const [provider, model] = pair.split(',');
    if (provider && model) {
      const providerConfig = config.provider.providers.find((p: any) => p.name === provider);
      if (providerConfig) {
        let apiKeyCount = 1;
        const apiKey = providerConfig.api_key || providerConfig.apiKey;
        if (Array.isArray(apiKey)) {
          apiKeyCount = apiKey.length;
        }
        
        requirements.push({
          provider,
          model,
          apiKeyCount,
          pipelineIds: Array.from({length: apiKeyCount}, (_, i) => `${provider}-${model}-key${i}`)
        });
      }
    }
  }
  
  return requirements;
}

/**
 * 生成流水线设置数据
 */
function generatePipelineSetup(config: any): any {
  const categories: any[] = [];
  const routingRules = config.router.routingRules.modelMapping;
  
  for (const [category, rule] of Object.entries(routingRules)) {
    const ruleStr = rule as string;
    const pairs = ruleStr.split(';');
    const pipelines: string[] = [];
    
    for (const pair of pairs) {
      const [provider, model] = pair.split(',');
      if (provider && model) {
        const providerConfig = config.provider.providers.find((p: any) => p.name === provider);
        if (providerConfig) {
          let apiKeyCount = 1;
          const apiKey = providerConfig.api_key || providerConfig.apiKey;
          if (Array.isArray(apiKey)) {
            apiKeyCount = apiKey.length;
          }
          
          for (let i = 0; i < apiKeyCount; i++) {
            pipelines.push(`${provider}-${model}-key${i}`);
          }
        }
      }
    }
    
    categories.push({
      categoryName: category,
      pipelineCount: pipelines.length,
      pipelines: pipelines
    });
  }
  
  return {
    categories,
    defaultCategory: 'default',
    totalPipelines: categories.reduce((sum, cat) => sum + cat.pipelineCount, 0)
  };
}

// 执行配置分析
analyzeRouterConfiguration();