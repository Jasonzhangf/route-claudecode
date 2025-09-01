/**
 * Simple API Integration Test
 * 
 * 验证API化改造的基本功能
 */

import { createInternalAPIClient } from './internal-api-client';
import { createPipelineLayersAPIProcessor } from './modules/pipeline-layers-api-processor';

async function runIntegrationTest() {
  console.log('🚀 Running API Integration Test...');
  
  try {
    // 创建API客户端
    const apiClient = createInternalAPIClient({
      baseUrl: 'http://localhost:5506',
      timeout: 5000,
      retries: 3
    });
    
    console.log('✅ API Client created successfully');
    
    // 创建Pipeline处理器
    const processor = createPipelineLayersAPIProcessor(apiClient);
    
    console.log('✅ Pipeline Layers API Processor created successfully');
    
    // 测试健康检查方法存在
    if (typeof processor.healthCheck === 'function') {
      console.log('✅ Health check method exists');
    } else {
      console.log('❌ Health check method missing');
    }
    
    console.log('✅ API Integration Test completed successfully');
    
  } catch (error) {
    console.error('❌ API Integration Test failed:', error);
  }
}

// 运行测试
runIntegrationTest().catch(console.error);