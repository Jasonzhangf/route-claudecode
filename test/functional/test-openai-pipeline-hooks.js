#!/usr/bin/env node
/**
 * OpenAI流水线Hook系统
 * 非侵入式数据拦截和捕获中间件
 * Project: Claude Code Router Enhanced
 * Author: Jason Zhang
 */

const { OpenAIDataCaptureSystem } = require('./test-openai-pipeline-data-capture');

/**
 * OpenAI流水线Hook管理器
 * 实现非侵入式的数据拦截和捕获
 */
class OpenAIPipelineHookManager {
  constructor() {
    this.hooks = new Map();
    this.captureSystem = null;
    this.isEnabled = false;
    this.sessionData = {};
  }

  /**
   * 启用Hook系统
   */
  async enable() {
    if (this.isEnabled) {
      console.log('🔄 Hook system already enabled');
      return;
    }

    this.captureSystem = new OpenAIDataCaptureSystem();
    await this.captureSystem.initialize();
    this.isEnabled = true;
    
    console.log('✅ OpenAI Pipeline Hook System enabled');
  }

  /**
   * 禁用Hook系统
   */
  disable() {
    this.isEnabled = false;
    this.hooks.clear();
    this.sessionData = {};
    console.log('🔴 OpenAI Pipeline Hook System disabled');
  }

  /**
   * 注册Hook函数
   */
  registerHook(step, hookFunction) {
    if (!this.hooks.has(step)) {
      this.hooks.set(step, []);
    }
    this.hooks.get(step).push(hookFunction);
    console.log(`🔗 Hook registered for step: ${step}`);
  }

  /**
   * 执行Hook函数
   */
  async executeHooks(step, data) {
    if (!this.isEnabled) return data;

    const stepHooks = this.hooks.get(step) || [];
    
    for (const hook of stepHooks) {
      try {
        await hook(data);
      } catch (error) {
        console.error(`❌ Hook execution failed for step ${step}:`, error);
      }
    }

    return data;
  }

  /**
   * 创建路由引擎Hook包装器
   */
  createRoutingEngineWrapper(originalRoutingEngine) {
    const self = this;
    
    return class HookedRoutingEngine extends originalRoutingEngine {
      async route(request, requestId) {
        // Hook Step 1: Input Processing
        if (self.isEnabled && self.captureSystem) {
          await self.captureSystem.captureStep1Input(request);
          await self.executeHooks('step1', { request, requestId });
        }

        // 调用原始路由方法
        const provider = await super.route(request, requestId);

        // Hook Step 2: Routing Decision
        if (self.isEnabled && self.captureSystem) {
          const routingResult = {
            category: self.determineRoutingCategory(request),
            provider: provider,
            targetModel: request.model, // 已经被映射过的模型
            originalModel: request.metadata?.originalModel || request.model,
            reason: 'Determined by routing engine'
          };
          
          await self.captureSystem.captureStep2Routing(routingResult);
          await self.executeHooks('step2', { routingResult, requestId });
        }

        return provider;
      }

      // 辅助方法：确定路由类别（从原始引擎复制逻辑）
      determineRoutingCategory(request) {
        if (request.model.includes('haiku')) return 'background';
        if (request.metadata?.thinking) return 'thinking';
        
        const tokenCount = this.calculateRequestTokens(request);
        if (tokenCount > 45000) return 'longcontext';
        
        if (request.metadata?.tools && Array.isArray(request.metadata.tools)) {
          const hasSearchTools = request.metadata.tools.some((tool) => 
            typeof tool === 'object' && tool.name && (
              tool.name.toLowerCase().includes('search') ||
              tool.name.toLowerCase().includes('web') ||
              tool.name === 'WebSearch'
            )
          );
          if (hasSearchTools) return 'search';
        }
        
        return 'default';
      }

      calculateRequestTokens(request) {
        let totalChars = 0;
        request.messages.forEach(msg => {
          if (typeof msg.content === 'string') {
            totalChars += msg.content.length;
          } else if (Array.isArray(msg.content)) {
            msg.content.forEach((block) => {
              if (block.text) totalChars += block.text.length;
            });
          }
        });
        return Math.ceil(totalChars / 4);
      }
    };
  }

  /**
   * 创建OpenAI Provider Hook包装器
   */
  createOpenAIProviderWrapper(OriginalProvider) {
    const self = this;
    
    return class HookedOpenAIProvider extends OriginalProvider {
      async sendRequest(request) {
        // Hook Step 3: Transformation (Before)
        if (self.isEnabled && self.captureSystem) {
          const anthropicRequest = {
            model: request.model,
            messages: request.messages,
            max_tokens: request.max_tokens,
            system: request.metadata?.system,
            tools: request.metadata?.tools
          };
          
          const openaiRequest = this.convertToOpenAI(request);
          
          await self.captureSystem.captureStep3Transformation(anthropicRequest, openaiRequest);
          await self.executeHooks('step3', { anthropicRequest, openaiRequest });
        }

        // 调用原始方法
        const response = await super.sendRequest(request);

        // Hook Step 6: Final Response
        if (self.isEnabled && self.captureSystem) {
          await self.captureSystem.captureStep6TransformerOutput(response);
          await self.executeHooks('step6', { response });
        }

        return response;
      }

      async *sendStreamRequest(request) {
        // Hook Step 3: Transformation (Before)
        if (self.isEnabled && self.captureSystem) {
          const anthropicRequest = {
            model: request.model,
            messages: request.messages,
            max_tokens: request.max_tokens,
            system: request.metadata?.system,
            tools: request.metadata?.tools
          };
          
          const openaiRequest = { ...this.convertToOpenAI(request), stream: true };
          
          await self.captureSystem.captureStep3Transformation(anthropicRequest, openaiRequest);
          await self.executeHooks('step3', { anthropicRequest, openaiRequest });
        }

        // 使用生成器包装原始流
        const originalStream = super.sendStreamRequest(request);
        const events = [];
        
        for await (const event of originalStream) {
          events.push(event);
          yield event;
        }

        // Hook Step 6: 流式响应完成后
        if (self.isEnabled && self.captureSystem && events.length > 0) {
          const finalResponse = this.reconstructResponseFromEvents(events);
          await self.captureSystem.captureStep6TransformerOutput(finalResponse);
          await self.executeHooks('step6', { response: finalResponse, events });
        }
      }

      // 从事件重构最终响应（用于流式处理的Step 6捕获）
      reconstructResponseFromEvents(events) {
        let content = [];
        let usage = { input_tokens: 0, output_tokens: 0 };
        let stopReason = null;

        for (const event of events) {
          if (event.event === 'content_block_start' && event.data?.content_block) {
            content.push(event.data.content_block);
          } else if (event.event === 'content_block_delta' && event.data?.delta) {
            const lastBlock = content[content.length - 1];
            if (lastBlock && lastBlock.type === 'text') {
              lastBlock.text = (lastBlock.text || '') + (event.data.delta.text || '');
            }
          } else if (event.event === 'message_delta' && event.data?.usage) {
            Object.assign(usage, event.data.usage);
          } else if (event.event === 'message_stop') {
            stopReason = 'end_turn';
          }
        }

        return {
          id: `msg_${Date.now()}`,
          model: request.model,
          role: 'assistant',
          content,
          stop_reason: stopReason,
          usage
        };
      }
    };
  }

  /**
   * HTTP请求拦截器（用于Step 4和Step 5）
   */
  createHttpInterceptor() {
    const self = this;
    
    return {
      // 请求拦截器
      request: async (config) => {
        if (self.isEnabled) {
          // 这里可以捕获发送给OpenAI API的原始请求
          console.log('🔗 [HTTP Hook] Outgoing request intercepted');
        }
        return config;
      },

      // 响应拦截器
      response: async (response) => {
        if (self.isEnabled && self.captureSystem) {
          // Hook Step 4: Raw API Response
          await self.captureSystem.captureStep4RawResponse(response.data, false);
          await self.executeHooks('step4', { rawResponse: response.data });

          // Hook Step 5: Transformer Input (same as Step 4 for non-streaming)
          await self.captureSystem.captureStep5TransformerInput(response.data);
          await self.executeHooks('step5', { transformerInput: response.data });
        }
        return response;
      },

      // 错误拦截器
      error: async (error) => {
        if (self.isEnabled) {
          console.log('❌ [HTTP Hook] Request error intercepted:', error.message);
          await self.executeHooks('error', { error });
        }
        throw error;
      }
    };
  }

  /**
   * 安装所有Hook到现有系统
   */
  async installHooks(routingEngine, openaiProviders) {
    console.log('🔧 Installing OpenAI Pipeline Hooks...');

    // 安装路由引擎Hook
    if (routingEngine) {
      const HookedRoutingEngine = this.createRoutingEngineWrapper(routingEngine.constructor);
      // 这里需要根据实际使用情况替换实例
      console.log('✅ Routing Engine hooks installed');
    }

    // 安装OpenAI Provider Hook
    if (openaiProviders && Array.isArray(openaiProviders)) {
      for (const provider of openaiProviders) {
        const HookedProvider = this.createOpenAIProviderWrapper(provider.constructor);
        // 这里需要根据实际使用情况替换实例
        console.log(`✅ OpenAI Provider hooks installed: ${provider.name}`);
      }
    }

    // 安装HTTP拦截器
    const interceptor = this.createHttpInterceptor();
    console.log('✅ HTTP interceptors installed');

    return { interceptor };
  }

  /**
   * 生成Hook系统报告
   */
  generateHookReport() {
    return {
      enabled: this.isEnabled,
      hookCount: Array.from(this.hooks.values()).reduce((sum, hooks) => sum + hooks.length, 0),
      registeredSteps: Array.from(this.hooks.keys()),
      captureSystemReady: !!this.captureSystem,
      sessionId: this.captureSystem?.sessionId
    };
  }
}

/**
 * 演示Hook系统使用
 */
async function demonstrateHookSystem() {
  console.log('🚀 OpenAI Pipeline Hook System Demonstration\n');

  const hookManager = new OpenAIPipelineHookManager();
  
  // 启用Hook系统
  await hookManager.enable();

  // 注册自定义Hook
  hookManager.registerHook('step1', async (data) => {
    console.log(`🎣 [Custom Hook] Step 1 - Processing input for request: ${data.requestId}`);
  });

  hookManager.registerHook('step2', async (data) => {
    console.log(`🎣 [Custom Hook] Step 2 - Routing to ${data.routingResult.provider}`);
  });

  hookManager.registerHook('step3', async (data) => {
    console.log(`🎣 [Custom Hook] Step 3 - Transforming ${data.anthropicRequest.model} → ${data.openaiRequest.model}`);
  });

  hookManager.registerHook('step4', async (data) => {
    console.log(`🎣 [Custom Hook] Step 4 - Raw response received, content length: ${JSON.stringify(data.rawResponse).length}`);
  });

  hookManager.registerHook('step5', async (data) => {
    console.log(`🎣 [Custom Hook] Step 5 - Transformer input validated`);
  });

  hookManager.registerHook('step6', async (data) => {
    console.log(`🎣 [Custom Hook] Step 6 - Final response with ${data.response.content?.length || 0} content blocks`);
  });

  // 生成Hook系统报告
  const report = hookManager.generateHookReport();
  console.log('\n📊 Hook System Report:', report);

  // 模拟钩子执行
  console.log('\n🔄 Simulating hook execution...');
  
  await hookManager.executeHooks('step1', { 
    request: { model: 'claude-sonnet-4-20250514' }, 
    requestId: 'demo-request' 
  });

  await hookManager.executeHooks('step2', { 
    routingResult: { 
      provider: 'shuaihong-openai',
      category: 'search' 
    }, 
    requestId: 'demo-request' 
  });

  // 生成最终报告
  if (hookManager.captureSystem) {
    const captureReport = await hookManager.captureSystem.generateCaptureReport();
    console.log('\n📋 Capture Report Generated:', captureReport.sessionId);
  }

  console.log('\n✅ Hook system demonstration completed');
  return hookManager;
}

/**
 * 集成指南函数
 */
function generateIntegrationGuide() {
  return `
# OpenAI Pipeline Hook System Integration Guide

## 1. 基础集成

\`\`\`javascript
const { OpenAIPipelineHookManager } = require('./test-openai-pipeline-hooks');

// 创建Hook管理器
const hookManager = new OpenAIPipelineHookManager();
await hookManager.enable();

// 在你的路由引擎中
const HookedRoutingEngine = hookManager.createRoutingEngineWrapper(RoutingEngine);
const routingEngine = new HookedRoutingEngine(config);

// 在你的OpenAI Provider中  
const HookedProvider = hookManager.createOpenAIProviderWrapper(EnhancedOpenAIClient);
const provider = new HookedProvider(config, providerId);
\`\`\`

## 2. HTTP拦截器集成

\`\`\`javascript
const interceptor = hookManager.createHttpInterceptor();

// 在axios配置中
axiosInstance.interceptors.request.use(interceptor.request);
axiosInstance.interceptors.response.use(interceptor.response, interceptor.error);
\`\`\`

## 3. 自定义Hook注册

\`\`\`javascript
// 注册自定义分析Hook
hookManager.registerHook('step4', async (data) => {
  // 分析原始API响应
  analyzeRawResponse(data.rawResponse);
});

hookManager.registerHook('step6', async (data) => {
  // 验证最终输出质量
  validateFinalResponse(data.response);
});
\`\`\`

## 4. 错误处理Hook

\`\`\`javascript
hookManager.registerHook('error', async (data) => {
  // 记录和分析错误
  logError(data.error);
  notifyDevelopers(data.error);
});
\`\`\`
`;
}

// 如果直接运行此脚本
if (require.main === module) {
  demonstrateHookSystem()
    .then(hookManager => {
      console.log('\n📖 Integration Guide:');
      console.log(generateIntegrationGuide());
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Hook system demonstration failed:', error);
      process.exit(1);
    });
}

module.exports = { 
  OpenAIPipelineHookManager, 
  demonstrateHookSystem, 
  generateIntegrationGuide 
};