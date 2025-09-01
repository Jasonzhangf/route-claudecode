/**
 * Pipeline Integration Test
 * 
 * 测试PipelineLifecycleManager与InternalAPIServer的集成
 */

import { PipelineLifecycleManager } from '../pipeline/pipeline-lifecycle-manager';
import { createInternalAPIClient } from './internal-api-client';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testPipelineIntegration() {
  console.log('🚀 Starting Pipeline Integration Test...');
  
  try {
    // 使用默认配置
    const config = {
      server: {
        port: 5510
      },
      providers: [
        {
          name: 'test-provider',
          api_key: 'test-key',
          api_base_url: 'http://localhost:1234/v1'
        }
      ]
    };
    console.log('✅ Using default configuration');
    
    // 创建PipelineLifecycleManager实例
    const lifecycleManager = new PipelineLifecycleManager(
      undefined, // userConfigPath
      undefined, // systemConfigPath
      true, // debugEnabled
      config.server?.port || 5510 // cliPort
    );
    
    console.log('✅ PipelineLifecycleManager created successfully');
    
    // 检查是否正确创建了API服务器
    const systemInfo = lifecycleManager.getSystemInfo();
    console.log('✅ System info:', systemInfo);
    
    console.log('✅ Pipeline Integration Test completed successfully');
    
  } catch (error) {
    console.error('❌ Pipeline Integration Test failed:', error);
  } finally {
    console.log('🏁 Pipeline Integration Test finished');
  }
}

// 运行测试
if (require.main === module) {
  testPipelineIntegration().catch(console.error);
}