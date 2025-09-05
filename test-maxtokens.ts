import { ConfigPreprocessor } from './src/config/config-preprocessor';
import { RouterPreprocessor } from './src/router/router-preprocessor';
import { ModelInfo } from './src/config/routing-table-types';
import * as fs from 'fs';

// 测试配置预处理器
console.log('=== 测试配置预处理器 ===');
const configPath = './test-config-maxtokens.json';
const result = ConfigPreprocessor.preprocess(configPath);

if (result.success && result.routingTable) {
  console.log('✅ 配置预处理成功');
  console.log('Providers数量:', result.routingTable.providers.length);
  
  // 打印每个Provider的信息
  for (const provider of result.routingTable.providers) {
    console.log(`Provider: ${provider.name}`);
    console.log(`  maxTokens: ${provider.maxTokens}`);
    console.log(`  模型数量: ${provider.models.length}`);
    
    for (const model of provider.models) {
      if (typeof model === 'object') {
        const modelInfo = model as ModelInfo;
        console.log(`    模型: ${modelInfo.name}, maxTokens: ${modelInfo.maxTokens}`);
      } else {
        console.log(`    模型: ${model}`);
      }
    }
  }
  
  // 测试路由预处理器
  console.log('\n=== 测试路由预处理器 ===');
  RouterPreprocessor.preprocess(result.routingTable).then(routerResult => {
    if (routerResult.success) {
      console.log('✅ 路由预处理成功');
      console.log('路由数量:', Object.keys(routerResult.routingTable?.routes || {}).length);
      console.log('流水线配置数量:', routerResult.pipelineConfigs?.length);
      
      // 检查maxTokens是否正确传递
      if (routerResult.pipelineConfigs && routerResult.pipelineConfigs.length > 0) {
        const firstPipeline = routerResult.pipelineConfigs[0];
        console.log(`\n第一个流水线: ${firstPipeline.pipelineId}`);
        
        // 检查server-compatibility层的maxTokens
        const serverCompatibilityLayer = firstPipeline.layers.find(layer => layer.type === 'server-compatibility');
        if (serverCompatibilityLayer) {
          console.log(`  Server-compatibility层 maxTokens: ${serverCompatibilityLayer.config.maxTokens}`);
        }
        
        // 检查server层的maxTokens
        const serverLayer = firstPipeline.layers.find(layer => layer.type === 'server');
        if (serverLayer) {
          console.log(`  Server层 maxTokens: ${serverLayer.config.maxTokens}`);
        }
      }
    } else {
      console.log('❌ 路由预处理失败:', routerResult.errors);
    }
  });
} else {
  console.log('❌ 配置预处理失败:', result.error?.message);
}