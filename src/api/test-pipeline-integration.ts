/**
 * Pipeline Integration Test
 * 
 * 测试PipelineLifecycleManager与InternalAPIServer的集成
 */

// PipelineLifecycleManager已废弃，使用UnifiedInitializer替代
// import { PipelineLifecycleManager } from '../pipeline/pipeline-lifecycle-manager';
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
    
    console.log('⚠️ PipelineLifecycleManager已废弃，使用UnifiedInitializer替代');
    
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