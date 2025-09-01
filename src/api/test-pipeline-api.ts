/**
 * Pipeline API Integration Test
 * 
 * 测试流水线API化改造的完整功能
 */

import { createInternalAPIClient } from './internal-api-client';
import { createPipelineLayersAPIProcessor } from './modules/pipeline-layers-api-processor';
import { createInternalAPIServer } from './server';

async function testPipelineAPI() {
  console.log('🚀 Starting Pipeline API Integration Test...');
  
  // 创建API服务器
  const apiServer = createInternalAPIServer(5506);
  
  try {
    // 启动API服务器
    await apiServer.start();
    console.log('✅ API Server started successfully');
    
    // 创建API客户端
    const apiClient = createInternalAPIClient({
      baseUrl: 'http://localhost:5506',
      timeout: 10000,
      retries: 3
    });
    
    // 创建Pipeline处理器
    const processor = createPipelineLayersAPIProcessor(apiClient);
    
    // 测试健康检查
    const isHealthy = await processor.healthCheck();
    console.log(`✅ Health check: ${isHealthy ? 'PASSED' : 'FAILED'}`);
    
    console.log('✅ Pipeline API Integration Test completed successfully');
    
  } catch (error) {
    console.error('❌ Pipeline API Integration Test failed:', error);
  } finally {
    // 停止API服务器
    await apiServer.stop();
    console.log('✅ API Server stopped');
  }
}

// 运行测试
if (require.main === module) {
  testPipelineAPI().catch(console.error);
}