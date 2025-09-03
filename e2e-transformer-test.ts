import { PipelineLayersProcessor } from './src/pipeline/modules/pipeline-layers';
import { HttpRequestHandler, HttpRequestOptions, HttpResponse } from './src/pipeline/modules/http-request-handler';
import { JQJsonHandler } from './src/utils/jq-json-handler';

// 模拟配置
const mockConfig: any = {
  Providers: [
    {
      name: 'sh',
      protocol: 'openai',
      baseURL: 'http://ai.shuaihong.xyz:3939',
      apiKey: 'test-key',
      models: ['claude-3-5-sonnet', 'gemini-2.5-pro'],
      serverCompatibility: {
        use: 'openai',
        options: {
          maxTokens: 131072,
          enhanceTool: true
        }
      }
    }
  ],
  Router: {
    'claude-3-5-sonnet': 'sh,gemini-2.5-pro'
  }
};

// 模拟HTTP请求处理器
class MockHttpRequestHandler extends HttpRequestHandler {
  async makeHttpRequest(endpoint: string, options: HttpRequestOptions): Promise<HttpResponse> {
    console.log('🔍 [E2E-TEST] 模拟HTTP请求:', endpoint);
    console.log('🔍 [E2E-TEST] 请求选项:', JQJsonHandler.stringifyJson(options, false));
    
    // 模拟服务器响应
    const mockResponse: HttpResponse = {
      status: 200,
      body: JQJsonHandler.stringifyJson({
        id: 'test-response',
        choices: [{ message: { role: 'assistant', content: '测试响应' } }]
      }),
      headers: {}
    };
    
    return mockResponse;
  }
  
  checkResponseStatusAndThrow(response: HttpResponse, context?: { requestId?: string; endpoint?: string }): void {
    // 简单实现，不抛出错误
  }
  
  shouldRetryError(error: Error, statusCode?: number): boolean {
    return false;
  }
  
  createApiErrorResponse(
    error: any, 
    statusCode?: number, 
    requestId?: string, 
    context?: { provider?: string; model?: string; endpoint?: string }
  ): any {
    return {
      type: "error",
      error: {
        type: "test_error",
        message: error.message || "Test error"
      }
    };
  }
}

async function runEndToEndTest() {
  console.log('🚀 开始端到端测试...');
  
  // 创建处理器实例
  const mockHttpRequestHandler = new MockHttpRequestHandler();
  const processor = new PipelineLayersProcessor(mockConfig, mockHttpRequestHandler);
  
  // 测试数据
  const anthropicRequest = {
    model: 'claude-3-5-sonnet',
    messages: [
      {
        role: 'user',
        content: '列出本地文件'
      }
    ],
    tools: [
      {
        name: 'list_files',
        description: 'List files in directory',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string'
            }
          },
          required: ['path']
        }
      }
    ],
    max_tokens: 100
  };
  
  console.log('📥 输入数据:', JQJsonHandler.stringifyJson(anthropicRequest, false));
  
  // 创建上下文
  const context: any = {
    requestId: 'test-request-' + Date.now(),
    startTime: new Date(),
    layerTimings: {},
    transformations: [],
    errors: [],
    metadata: {}
  };
  
  try {
    // 1. Router层处理
    console.log('\n=== Router层处理 ===');
    const routingDecision = await processor.processRouterLayer(anthropicRequest, context);
    console.log('✅ Router层结果:', JSON.stringify(routingDecision, null, 2));
    
    // 2. Transformer层处理
    console.log('\n=== Transformer层处理 ===');
    const transformedRequest = await processor.processTransformerLayer(anthropicRequest, routingDecision, context);
    console.log('✅ Transformer层结果:', JSON.stringify(transformedRequest, null, 2));
    console.log('✅ 结果类型:', typeof transformedRequest);
    console.log('✅ 结果是否为空对象:', transformedRequest && typeof transformedRequest === 'object' && Object.keys(transformedRequest).length === 0);
    console.log('✅ 结果键数量:', transformedRequest ? Object.keys(transformedRequest).length : 0);
    
    // 验证转换结果
    if (!transformedRequest || typeof transformedRequest !== 'object') {
      console.error('❌ 转换结果无效');
      return;
    }
    
    if (Object.keys(transformedRequest).length === 0) {
      console.error('❌ 转换结果为空对象');
      return;
    }
    
    // 检查关键字段
    if (!transformedRequest.model) {
      console.error('❌ 转换结果缺少model字段');
    }
    if (!transformedRequest.messages) {
      console.error('❌ 转换结果缺少messages字段');
    }
    if (!transformedRequest.tools) {
      console.error('❌ 转换结果缺少tools字段');
    }
    
    // 3. Protocol层处理
    console.log('\n=== Protocol层处理 ===');
    const protocolRequest = await processor.processProtocolLayer(transformedRequest, routingDecision, context);
    console.log('✅ Protocol层结果:', JSON.stringify(protocolRequest, null, 2));
    
    // 4. Server层处理
    console.log('\n=== Server层处理 ===');
    const serverResponse = await processor.processServerLayer(protocolRequest, routingDecision, context);
    console.log('✅ Server层结果:', JSON.stringify(serverResponse, null, 2));
    
    console.log('\n🎉 端到端测试完成');
    
  } catch (error) {
    console.error('❌ 端到端测试失败:', error);
    console.error('❌ 错误堆栈:', error.stack);
  }
}

// 运行测试
runEndToEndTest().then(() => {
  console.log('\n✅ 测试脚本执行完成');
}).catch(error => {
  console.error('❌ 测试脚本执行失败:', error);
});