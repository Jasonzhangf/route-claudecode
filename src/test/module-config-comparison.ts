/**
 * 模块配置对比分析工具
 * 提取每条流水线中各模块的详细配置并进行对比分析
 */

import * as fs from 'fs';
import * as path from 'path';

// 确保输出目录存在
const outputDir = './test-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 异步函数执行
async function runModuleConfigComparisonAnalysis() {
  // 读取流水线组装器测试结果
  const assemblyResults = JSON.parse(
    fs.readFileSync(
      path.join(outputDir, 'pipeline-assembler-test-results.json'),
      'utf-8'
    )
  );
  
  // 提取模块配置并进行对比分析
  const comparisonResults = analyzeModuleConfigurations(assemblyResults);
  
  // 保存分析结果
  fs.writeFileSync(
    path.join(outputDir, 'module-config-comparison-analysis.json'),
    JSON.stringify(comparisonResults, null, 2)
  );
  
  // 生成详细报告
  generateDetailedComparisonReport(comparisonResults);
  
  // 生成摘要报告
  generateComparisonSummary(comparisonResults);
}

/**
 * 分析模块配置
 */
function analyzeModuleConfigurations(assemblyResults: any): any {
  const timestamp = new Date().toISOString();
  const pipelineAssemblies = assemblyResults.output.pipelineAssemblies;
  
  // 按模块类型分组的配置
  const moduleConfigurations: any = {};
  
  // 模块类型统计
  const moduleTypeStats: any = {};
  
  // 遍历每条流水线
  for (const assembly of pipelineAssemblies) {
    const pipelineId = assembly.pipelineId;
    
    // 遍历每个模块
    for (const module of assembly.modules) {
      const moduleType = module.type;
      const moduleId = module.id;
      
      // 初始化模块类型
      if (!moduleConfigurations[moduleType]) {
        moduleConfigurations[moduleType] = [];
        moduleTypeStats[moduleType] = {
          count: 0,
          implementations: new Set(),
          configs: []
        };
      }
      
      // 添加模块配置
      moduleConfigurations[moduleType].push({
        pipelineId,
        moduleId,
        implementation: module.implementation,
        config: module.config
      });
      
      // 更新统计信息
      moduleTypeStats[moduleType].count++;
      moduleTypeStats[moduleType].implementations.add(module.implementation);
      moduleTypeStats[moduleType].configs.push({
        pipelineId,
        config: module.config
      });
    }
  }
  
  // 分析配置差异
  const configDifferences = analyzeConfigDifferences(moduleTypeStats);
  
  return {
    timestamp,
    analysis: {
      totalPipelines: pipelineAssemblies.length,
      moduleConfigurations,
      configDifferences
    }
  };
}

/**
 * 分析配置差异
 */
function analyzeConfigDifferences(moduleTypeStats: any): any {
  const differences: any = {};
  
  // 遍历每种模块类型
  for (const [moduleType, stats] of Object.entries(moduleTypeStats)) {
    const configs: any[] = (stats as any).configs;
    
    if (configs.length > 1) {
      // 比较配置差异
      const firstConfig = configs[0].config;
      const variedConfigs = configs.filter((c: any) => 
        JSON.stringify(c.config) !== JSON.stringify(firstConfig)
      );
      
      differences[moduleType] = {
        totalInstances: configs.length,
        hasDifferences: variedConfigs.length > 0,
        differences: variedConfigs.map((c: any) => ({
          pipelineId: c.pipelineId,
          config: c.config
        })),
        commonConfig: firstConfig
      };
    } else {
      differences[moduleType] = {
        totalInstances: 1,
        hasDifferences: false,
        differences: [],
        commonConfig: configs[0].config
      };
    }
  }
  
  return differences;
}

/**
 * 生成详细对比报告
 */
function generateDetailedComparisonReport(comparisonResults: any) {
  const moduleConfigs = comparisonResults.analysis.moduleConfigurations;
  
  let report = `模块配置详细对比报告
====================

报告生成时间: ${comparisonResults.timestamp}

`;
  
  // 按模块类型生成详细报告
  for (const [moduleType, configs] of Object.entries(moduleConfigs)) {
    report += `📁 模块类型: ${moduleType}\n`;
    report += `------------------------------\n`;
    
    const moduleList: any[] = configs as any[];
    for (const module of moduleList) {
      report += `  流水线: ${module.pipelineId}\n`;
      report += `    模块ID: ${module.moduleId}\n`;
      report += `    实现: ${module.implementation}\n`;
      report += `    配置: ${JSON.stringify(module.config, null, 2)}\n`;
      report += `\n`;
    }
    report += `\n`;
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'module-config-detailed-report.txt'),
    report
  );
}

/**
 * 生成对比摘要
 */
function generateComparisonSummary(comparisonResults: any) {
  const differences = comparisonResults.analysis.configDifferences;
  
  let summary = `模块配置对比分析摘要
====================

分析时间: ${comparisonResults.timestamp}
分析的流水线数量: ${comparisonResults.analysis.totalPipelines}

配置差异分析结果:
`;
  
  for (const [moduleType, diffInfo] of Object.entries(differences)) {
    const info: any = diffInfo as any;
    summary += `\n${moduleType}:
  - 实例总数: ${info.totalInstances}
  - 存在配置差异: ${info.hasDifferences ? '是' : '否'}
  - 差异数量: ${info.differences.length}
`;
  }
  
  summary += `
详细报告已保存到: module-config-detailed-report.txt
完整分析结果已保存到: module-config-comparison-analysis.json
`;
  
  fs.writeFileSync(
    path.join(outputDir, 'module-config-comparison-summary.txt'),
    summary
  );
  
  console.log(summary);
}

// 执行模块配置对比分析
runModuleConfigComparisonAnalysis();