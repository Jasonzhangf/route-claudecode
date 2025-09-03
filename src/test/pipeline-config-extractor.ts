/**
 * 流水线配置提取工具
 * 提取并展示每条流水线初始化时的完整配置
 */

import * as fs from 'fs';
import * as path from 'path';

// 读取路由器单元测试结果
const routerTestResults = JSON.parse(
  fs.readFileSync(
    path.join('./test-output', 'router-unit-test-results.json'),
    'utf-8'
  )
);

// 提取流水线配置
const pipelineConfigs = routerTestResults.output.pipelineConfigs;
const moduleInstances = routerTestResults.output.moduleInstances;

console.log('🚀 流水线初始化配置概览');
console.log('========================');

console.log(`\n📊 总计 ${pipelineConfigs.length} 条流水线:`);
pipelineConfigs.forEach((config: any, index: number) => {
  console.log(`${index + 1}. ${config.pipelineId}`);
  console.log(`   提供商: ${config.provider}`);
  console.log(`   模型: ${config.model}`);
  console.log(`   API密钥索引: ${config.apiKeyIndex}`);
});

console.log('\n🔧 每条流水线的模块实例配置:');
Object.entries(moduleInstances).forEach(([pipelineId, modules]: [string, any]) => {
  console.log(`\n📋 流水线: ${pipelineId}`);
  console.log('   模块实例:');
  modules.modules.forEach((module: any) => {
    console.log(`     - ${module.id}`);
    console.log(`       类型: ${module.type}`);
    console.log(`       实现: ${module.implementation}`);
    console.log(`       输入: [${module.inputs.join(', ')}]`);
    console.log(`       输出: [${module.outputs.join(', ')}]`);
    if (module.config) {
      console.log(`       配置: ${JSON.stringify(module.config)}`);
    }
  });
});