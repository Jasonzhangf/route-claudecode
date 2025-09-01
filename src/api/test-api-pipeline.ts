/**
 * API化调用测试
 * 
 * 测试PipelineRequestProcessor是否正确使用API调用各层处理
 */

import { PipelineRequestProcessor } from '../pipeline/pipeline-request-processor';
import { readFileSync } from 'fs';
import { join } from 'path';

async function testAPIPipelineProcessing() {
  console.log('🚀 Starting API Pipeline Processing Test...');
  
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
    
    // 创建PipelineRequestProcessor实例
    const processor = new PipelineRequestProcessor(config as any, true);
    
    console.log('✅ PipelineRequestProcessor created successfully');
    
    // 检查是否正确创建了API处理器
    if ((processor as any).pipelineLayersAPIProcessor) {
      console.log('✅ PipelineLayersAPIProcessor created successfully');
    } else {
      console.log('❌ PipelineLayersAPIProcessor not created');
      return;
    }
    
    console.log('✅ API Pipeline Processing Test completed successfully');
    
  } catch (error) {
    console.error('❌ API Pipeline Processing Test failed:', error);
  }
}

// 运行测试
if (require.main === module) {
  testAPIPipelineProcessing().catch(console.error);
}