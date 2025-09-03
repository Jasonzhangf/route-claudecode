/**
 * 模块初始化配置一致性验证工具
 * 对比路由器提供的配置与模块实际初始化后的配置是否一致
 */

import * as fs from 'fs';
import * as path from 'path';

// 确保输出目录存在
const outputDir = './test-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 异步函数执行
async function runModuleInitializationConsistencyCheck() {
  // 读取路由器单元测试结果（输入配置）
  const routerTestResults = JSON.parse(
    fs.readFileSync(
      path.join(outputDir, 'router-unit-test-results.json'),
      'utf-8'
    )
  );
  
  // 读取流水线组装器测试结果（实际配置）
  const assemblyResults = JSON.parse(
    fs.readFileSync(
      path.join(outputDir, 'pipeline-assembler-test-results.json'),
      'utf-8'
    )
  );
  
  // 验证配置一致性
  const consistencyResults = verifyConfigurationConsistency(routerTestResults, assemblyResults);
  
  // 保存验证结果
  fs.writeFileSync(
    path.join(outputDir, 'module-config-consistency-results.json'),
    JSON.stringify(consistencyResults, null, 2)
  );
  
  // 生成详细报告
  generateConsistencyReport(consistencyResults);
  
  // 生成摘要
  generateConsistencySummary(consistencyResults);
}

/**
 * 验证配置一致性
 */
function verifyConfigurationConsistency(routerResults: any, assemblyResults: any): any {
  const timestamp = new Date().toISOString();
  
  // 获取路由器提供的模块配置
  const routerModuleConfigs = extractRouterModuleConfigurations(routerResults);
  
  // 获取组装器实际使用的模块配置
  const assemblyModuleConfigs = extractAssemblyModuleConfigurations(assemblyResults);
  
  // 对比配置一致性
  const consistencyChecks = compareConfigurations(routerModuleConfigs, assemblyModuleConfigs);
  
  return {
    timestamp,
    input: {
      routerPipelines: Object.keys(routerModuleConfigs).length,
      assemblyPipelines: Object.keys(assemblyModuleConfigs).length
    },
    analysis: {
      routerModuleConfigs,
      assemblyModuleConfigs,
      consistencyChecks
    },
    summary: {
      totalChecks: consistencyChecks.length,
      passed: consistencyChecks.filter((check: any) => check.passed).length,
      failed: consistencyChecks.filter((check: any) => !check.passed).length
    }
  };
}

/**
 * 提取路由器模块配置
 */
function extractRouterModuleConfigurations(routerResults: any): any {
  const moduleConfigs: any = {};
  
  // 从pipelineConfigs提取模块配置
  for (const pipelineConfig of routerResults.output.pipelineConfigs) {
    const pipelineId = pipelineConfig.pipelineId;
    moduleConfigs[pipelineId] = {};
    
    // 提取每个模块的配置
    for (const [moduleKey, moduleConfig] of Object.entries(pipelineConfig.modules)) {
      // 转换模块键名为模块类型
      const moduleType = getModuleTypeFromKey(moduleKey);
      moduleConfigs[pipelineId][moduleType] = moduleConfig;
    }
  }
  
  return moduleConfigs;
}

/**
 * 从模块键名获取模块类型
 */
function getModuleTypeFromKey(moduleKey: string): string {
  const keyToTypeMap: { [key: string]: string } = {
    'client': 'ClientModule',
    'router': 'RouterModule',
    'transformer': 'TransformerModule',
    'protocol': 'ProtocolModule',
    'serverCompatibility': 'ServerCompatibilityModule',
    'server': 'ServerModule',
    'responseTransformer': 'ResponseTransformerModule'
  };
  
  return keyToTypeMap[moduleKey] || moduleKey;
}

/**
 * 提取组装器模块配置
 */
function extractAssemblyModuleConfigurations(assemblyResults: any): any {
  const moduleConfigs: any = {};
  
  // 从pipelineAssemblies提取模块配置
  for (const assembly of assemblyResults.output.pipelineAssemblies) {
    const pipelineId = assembly.pipelineId;
    moduleConfigs[pipelineId] = {};
    
    // 提取每个模块的配置
    for (const module of assembly.modules) {
      const moduleType = module.type;
      moduleConfigs[pipelineId][moduleType] = {
        type: moduleType,
        implementation: module.implementation,
        config: module.config
      };
    }
  }
  
  return moduleConfigs;
}

/**
 * 对比配置一致性
 */
function compareConfigurations(routerConfigs: any, assemblyConfigs: any): any[] {
  const checks: any[] = [];
  
  // 遍历每条流水线
  for (const pipelineId of Object.keys(routerConfigs)) {
    const routerPipeline = routerConfigs[pipelineId];
    const assemblyPipeline = assemblyConfigs[pipelineId];
    
    if (!assemblyPipeline) {
      checks.push({
        pipelineId,
        moduleType: 'ALL',
        checkType: 'pipeline_existence',
        passed: false,
        details: '流水线在组装器中不存在',
        routerConfig: routerPipeline,
        assemblyConfig: null
      });
      continue;
    }
    
    // 遍历每个模块类型
    for (const moduleType of Object.keys(routerPipeline)) {
      const routerModule = routerPipeline[moduleType];
      const assemblyModule = assemblyPipeline[moduleType];
      
      if (!assemblyModule) {
        checks.push({
          pipelineId,
          moduleType,
          checkType: 'module_existence',
          passed: false,
          details: '模块在组装器中不存在',
          routerConfig: routerModule,
          assemblyConfig: null
        });
        continue;
      }
      
      // 对比模块配置
      const configMatch = compareModuleConfigurations(routerModule, assemblyModule);
      
      checks.push({
        pipelineId,
        moduleType,
        checkType: 'config_consistency',
        passed: configMatch.match,
        details: configMatch.differences,
        routerConfig: routerModule,
        assemblyConfig: assemblyModule
      });
    }
  }
  
  return checks;
}

/**
 * 对比模块配置
 */
function compareModuleConfigurations(routerModule: any, assemblyModule: any): any {
  // 对比模块类型
  if (routerModule.type && assemblyModule.type && routerModule.type !== assemblyModule.type) {
    return {
      match: false,
      differences: [`模块类型不匹配: 路由器=${routerModule.type}, 组装器=${assemblyModule.type}`]
    };
  }
  
  // 对比实现类型（只对特定模块类型检查）
  const implementationCheckModules = ['ServerCompatibilityModule'];
  if (implementationCheckModules.includes(routerModule.type)) {
    const expectedImplementation = routerModule.type.replace('Module', '');
    // 注意：这里路由器配置中没有implementation字段，所以这个检查可能不适用
  }
  
  // 对比配置
  const configDifferences = compareConfigs(routerModule.config || {}, assemblyModule.config || {});
  
  return {
    match: configDifferences.length === 0,
    differences: configDifferences
  };
}

/**
 * 对比配置对象
 */
function compareConfigs(routerConfig: any, assemblyConfig: any): string[] {
  const differences: string[] = [];
  
  // 对比配置字段
  const allKeys = new Set([
    ...Object.keys(routerConfig),
    ...Object.keys(assemblyConfig)
  ]);
  
  for (const key of Array.from(allKeys)) {
    const routerValue = routerConfig[key];
    const assemblyValue = assemblyConfig[key];
    
    if (routerValue === undefined && assemblyValue !== undefined) {
      differences.push(`配置字段 '${key}' 在路由器中不存在但在组装器中存在`);
    } else if (routerValue !== undefined && assemblyValue === undefined) {
      differences.push(`配置字段 '${key}' 在路由器中存在但在组装器中不存在`);
    } else if (JSON.stringify(routerValue) !== JSON.stringify(assemblyValue)) {
      differences.push(`配置字段 '${key}' 值不匹配: 路由器=${JSON.stringify(routerValue)}, 组装器=${JSON.stringify(assemblyValue)}`);
    }
  }
  
  return differences;
}

/**
 * 生成一致性报告
 */
function generateConsistencyReport(consistencyResults: any) {
  const checks = consistencyResults.analysis.consistencyChecks;
  
  let report = `模块初始化配置一致性验证报告
============================

报告生成时间: ${consistencyResults.timestamp}
输入数据:
  - 路由器流水线数: ${consistencyResults.input.routerPipelines}
  - 组装器流水线数: ${consistencyResults.input.assemblyPipelines}

详细验证结果:
`;
  
  for (const check of checks) {
    report += `\n流水线: ${check.pipelineId}\n`;
    report += `模块类型: ${check.moduleType}\n`;
    report += `检查类型: ${check.checkType}\n`;
    report += `结果: ${check.passed ? '✅ 通过' : '❌ 失败'}\n`;
    
    if (check.details && Array.isArray(check.details) && check.details.length > 0) {
      report += `差异详情:\n`;
      for (const detail of check.details) {
        report += `  - ${detail}\n`;
      }
    } else if (typeof check.details === 'string') {
      report += `详情: ${check.details}\n`;
    }
    
    // 显示配置对比
    if (check.routerConfig) {
      report += `路由器配置: ${JSON.stringify(check.routerConfig, null, 2)}\n`;
    }
    if (check.assemblyConfig) {
      report += `组装器配置: ${JSON.stringify(check.assemblyConfig, null, 2)}\n`;
    }
    
    report += `\n`;
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'module-config-consistency-detailed-report.txt'),
    report
  );
}

/**
 * 生成一致性摘要
 */
function generateConsistencySummary(consistencyResults: any) {
  const summary = `
模块初始化配置一致性验证摘要
============================

验证时间: ${consistencyResults.timestamp}
输入数据:
  - 路由器流水线数: ${consistencyResults.input.routerPipelines}
  - 组装器流水线数: ${consistencyResults.input.assemblyPipelines}

验证结果:
  - 总检查数: ${consistencyResults.summary.totalChecks}
  - 通过: ${consistencyResults.summary.passed}
  - 失败: ${consistencyResults.summary.failed}

${consistencyResults.summary.failed === 0 ? '🎉 所有配置一致性检查通过！' : '⚠️  存在配置不一致，请查看详细报告'}

详细报告已保存到: module-config-consistency-detailed-report.txt
完整结果已保存到: module-config-consistency-results.json
`;
  
  fs.writeFileSync(
    path.join(outputDir, 'module-config-consistency-summary.txt'),
    summary
  );
  
  console.log(summary);
}

// 执行配置一致性验证
runModuleInitializationConsistencyCheck();