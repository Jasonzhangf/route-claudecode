/**
 * 修正后的流水线组装器单元测试
 * 正确处理路由器提供的模块配置
 */

import * as fs from 'fs';
import * as path from 'path';

// 确保输出目录存在
const outputDir = './test-output';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 异步函数执行
async function runPipelineAssemblerUnitTest() {
  // 读取路由器单元测试结果作为输入
  const routerTestResults = JSON.parse(
    fs.readFileSync(
      path.join(outputDir, 'router-unit-test-results.json'),
      'utf-8'
    )
  );
  
  // 生成流水线组装配置
  const pipelineAssemblyResults = generatePipelineAssemblyConfigurations(routerTestResults);
  
  // 保存测试结果
  fs.writeFileSync(
    path.join(outputDir, 'pipeline-assembler-test-results.json'),
    JSON.stringify(pipelineAssemblyResults, null, 2)
  );
  
  // 生成摘要报告
  generateAssemblySummary(pipelineAssemblyResults);
}

/**
 * 生成流水线组装配置
 */
function generatePipelineAssemblyConfigurations(routerTestResults: any): any {
  const timestamp = new Date().toISOString();
  const moduleInstances = routerTestResults.output.moduleInstances;
  
  // 流水线组装配置
  const pipelineAssemblies: any[] = [];
  
  // 流水线连接验证
  const connectionValidations: any[] = [];
  
  // 遍历每条流水线
  for (const [pipelineId, modulesData] of Object.entries(moduleInstances)) {
    const modules: any[] = (modulesData as any).modules;
    
    // 创建流水线组装配置 - 保持路由器提供的完整配置
    const assemblyConfig = {
      pipelineId,
      modules: modules.map(module => ({
        id: module.id,
        type: module.type,
        implementation: module.implementation,
        config: module.config  // 直接使用路由器提供的配置，不再使用默认空对象
      })),
      assembly: {
        // 模块连接关系
        connections: generateModuleConnections(modules),
        // 数据流验证
        dataFlow: validateDataFlow(modules),
        // 接口兼容性检查
        interfaceCompatibility: checkInterfaceCompatibility(modules)
      }
    };
    
    pipelineAssemblies.push(assemblyConfig);
    
    // 验证模块连接
    const connectionValidation = validateModuleConnections(pipelineId, modules);
    connectionValidations.push(connectionValidation);
  }
  
  return {
    timestamp,
    testType: 'pipeline-assembler-unit-test',
    input: {
      pipelineCount: Object.keys(moduleInstances).length
    },
    output: {
      pipelineAssemblies,
      connectionValidations
    },
    summary: {
      totalPipelines: pipelineAssemblies.length,
      validationResults: connectionValidations.reduce((acc, validation) => {
        acc.passed += validation.passed ? 1 : 0;
        acc.failed += validation.passed ? 0 : 1;
        return acc;
      }, { passed: 0, failed: 0 })
    }
  };
}

/**
 * 生成模块连接关系
 */
function generateModuleConnections(modules: any[]): any[] {
  const connections: any[] = [];
  
  // 按顺序连接模块
  for (let i = 0; i < modules.length - 1; i++) {
    const currentModule = modules[i];
    const nextModule = modules[i + 1];
    
    connections.push({
      from: {
        moduleId: currentModule.id,
        outputs: currentModule.outputs
      },
      to: {
        moduleId: nextModule.id,
        inputs: nextModule.inputs
      },
      connectionType: 'sequential'
    });
  }
  
  return connections;
}

/**
 * 验证数据流
 */
function validateDataFlow(modules: any[]): any {
  let isValid = true;
  const issues: string[] = [];
  
  // 检查相邻模块的输出和输入是否匹配
  for (let i = 0; i < modules.length - 1; i++) {
    const currentModule = modules[i];
    const nextModule = modules[i + 1];
    
    // 简单检查：确保有输出和输入
    if (!currentModule.outputs || currentModule.outputs.length === 0) {
      isValid = false;
      issues.push(`模块 ${currentModule.id} 没有输出`);
    }
    
    if (!nextModule.inputs || nextModule.inputs.length === 0) {
      isValid = false;
      issues.push(`模块 ${nextModule.id} 没有输入`);
    }
  }
  
  return {
    isValid,
    issues
  };
}

/**
 * 检查接口兼容性
 */
function checkInterfaceCompatibility(modules: any[]): any {
  let isCompatible = true;
  const compatibilityIssues: string[] = [];
  
  // 检查特定模块组合的兼容性
  for (const module of modules) {
    switch (module.type) {
      case 'ServerCompatibilityModule':
        // 检查ServerCompatibility模块与提供商的匹配
        if (module.implementation === 'IFlowServerCompatibility') {
          // IFlow兼容性检查
          if (!module.config || !module.config.use || module.config.use !== 'iflow') {
            isCompatible = false;
            compatibilityIssues.push(`IFlow兼容性模块配置不正确: ${module.id}`);
          }
        } else if (module.implementation === 'QwenServerCompatibility') {
          // Qwen兼容性检查
          if (!module.config || !module.config.use || module.config.use !== 'qwen') {
            isCompatible = false;
            compatibilityIssues.push(`Qwen兼容性模块配置不正确: ${module.id}`);
          }
        }
        break;
        
      case 'ServerModule':
        // 检查服务器模块配置
        if (!module.config || !module.config.baseUrl || !module.config.apiKey) {
          isCompatible = false;
          compatibilityIssues.push(`服务器模块配置不完整: ${module.id}`);
        }
        break;
    }
  }
  
  return {
    isCompatible,
    issues: compatibilityIssues
  };
}

/**
 * 验证模块连接
 */
function validateModuleConnections(pipelineId: string, modules: any[]): any {
  let passed = true;
  const validationDetails: any[] = [];
  
  // 验证模块顺序和连接
  for (let i = 0; i < modules.length - 1; i++) {
    const currentModule = modules[i];
    const nextModule = modules[i + 1];
    
    const connectionValid = validateConnection(currentModule, nextModule);
    validationDetails.push({
      connection: `${currentModule.id} -> ${nextModule.id}`,
      valid: connectionValid,
      details: `输出: [${currentModule.outputs.join(', ')}] -> 输入: [${nextModule.inputs.join(', ')}]`
    });
    
    if (!connectionValid) {
      passed = false;
    }
  }
  
  return {
    pipelineId,
    passed,
    validationDetails
  };
}

/**
 * 验证两个模块之间的连接
 */
function validateConnection(currentModule: any, nextModule: any): boolean {
  // 简单验证：确保都有输出和输入
  return (
    currentModule.outputs && 
    currentModule.outputs.length > 0 && 
    nextModule.inputs && 
    nextModule.inputs.length > 0
  );
}

/**
 * 生成组装摘要
 */
function generateAssemblySummary(assemblyResults: any) {
  const summary = `
流水线组装器单元测试报告
========================

测试时间: ${assemblyResults.timestamp}
输入数据:
  - 流水线数量: ${assemblyResults.input.pipelineCount}

输出结果:
  - 组装配置数: ${assemblyResults.summary.totalPipelines}
  - 验证通过: ${assemblyResults.summary.validationResults.passed}
  - 验证失败: ${assemblyResults.summary.validationResults.failed}

详细结果已保存到: pipeline-assembler-test-results.json
  `;
  
  fs.writeFileSync(
    path.join(outputDir, 'pipeline-assembler-test-summary.txt'),
    summary.trim()
  );
}

// 执行流水线组装器单元测试
runPipelineAssemblerUnitTest();