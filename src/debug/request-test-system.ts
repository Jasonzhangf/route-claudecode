/**
 * 请求测试系统实现
 * 
 * 负责：
 * 1. 运行时请求测试 - 完整的请求处理流程测试
 * 2. 分层诊断 - 从Server Layer往上逐层诊断
 * 3. 路由测试 - 验证模型映射和流水线选择
 * 4. 响应验证 - 验证4层响应处理链路
 * 
 * @author RCC v4.0
 */

import { EventEmitter } from 'events';
import { PipelineManager } from '../pipeline/pipeline-manager';
import { RoutingTestResult, ExecutionTestResult } from './pipeline-debug-system';
import { secureLogger } from '../utils/secure-logger';
import { JQJsonHandler } from '../utils/jq-json-handler';

/**
 * 测试请求配置
 */
export interface TestRequestConfig {
  model?: string;
  messages?: any[];
  tools?: any[];
  thinking?: boolean;
  maxTokens?: number;
  temperature?: number;
}

/**
 * 响应验证结果
 */
export interface ResponseValidationResult {
  isValid: boolean;
  layerResults: {
    server: { isValid: boolean; errors: string[] };
    serverCompatibility: { isValid: boolean; errors: string[] };
    protocol: { isValid: boolean; errors: string[] };
    transformer: { isValid: boolean; errors: string[] };
  };
  errors: string[];
}

/**
 * 诊断结果
 */
export interface DiagnosisResult {
  pipelineId: string;
  failedLayer?: string;
  layerDiagnostics: {
    transformer: { isWorking: boolean; error?: string };
    protocol: { isWorking: boolean; error?: string };
    serverCompatibility: { isWorking: boolean; error?: string };
    server: { isWorking: boolean; error?: string };
  };
  recommendations: string[];
}

/**
 * 请求测试系统
 */
export class RequestTestSystem extends EventEmitter {
  private pipelineManager: PipelineManager;
  private pipelineRouter: any; // TODO: 类型定义
  private loadBalancer: any; // TODO: 类型定义

  constructor(
    pipelineManager: PipelineManager,
    pipelineRouter?: any,
    loadBalancer?: any
  ) {
    super();
    this.pipelineManager = pipelineManager;
    this.pipelineRouter = pipelineRouter;
    this.loadBalancer = loadBalancer;
  }

  /**
   * 执行完整的请求测试
   */
  async performRequestTest(testRequest: TestRequestConfig): Promise<{
    routingResult: RoutingTestResult;
    executionResult: ExecutionTestResult;
    responseValidation?: ResponseValidationResult;
    diagnosis?: DiagnosisResult;
  }> {
    secureLogger.info('🧪 === Request Test System ===');
    secureLogger.info('📥 Test request:', { 
      model: testRequest.model,
      hasMessages: !!testRequest.messages,
      hasTools: !!testRequest.tools,
      thinking: testRequest.thinking
    });
    
    try {
      // Step 1: 路由检查
      const routingResult = await this.testRouting(testRequest);
      
      // Step 2: 流水线执行检查
      const executionResult = await this.testPipelineExecution(
        routingResult.selectedPipelineId, 
        testRequest
      );
      
      const result = {
        routingResult,
        executionResult,
        responseValidation: undefined as ResponseValidationResult | undefined,
        diagnosis: undefined as DiagnosisResult | undefined
      };
      
      // Step 3: 根据执行结果进行响应验证或故障诊断
      if (executionResult.hasResponse) {
        result.responseValidation = await this.validateResponse(
          executionResult.response, 
          testRequest
        );
        
        secureLogger.info('✅ Request test completed successfully');
        
      } else {
        result.diagnosis = await this.diagnoseExecutionFailure(
          routingResult.selectedPipelineId, 
          testRequest
        );
        
        secureLogger.info('❌ Request test completed with diagnosis');
      }
      
      this.emit('requestTestCompleted', result);
      return result;
      
    } catch (error) {
      secureLogger.error('❌ Request test failed with error:', { error: error.message });
      
      const errorResult = {
        routingResult: {
          virtualModel: 'error',
          availablePipelines: [],
          selectedPipelineId: 'none',
          isRoutingValid: false
        },
        executionResult: {
          pipelineId: 'none',
          hasResponse: false,
          response: null,
          executionTime: Date.now(),
          error: error.message
        }
      };
      
      this.emit('requestTestFailed', { error: error.message, result: errorResult });
      return errorResult;
    }
  }

  /**
   * 测试路由逻辑
   */
  async testRouting(testRequest: TestRequestConfig): Promise<RoutingTestResult> {
    secureLogger.info('🛣️  Testing routing logic:');
    
    if (!this.pipelineRouter) {
      throw new Error('Pipeline router not configured for testing');
    }
    
    // 模型映射测试
    const inputModel = testRequest.model || 'claude-3-5-sonnet';
    const virtualModel = this.mapToVirtualModel(inputModel, testRequest);
    secureLogger.info(`  📍 Virtual model mapping: ${inputModel} → ${virtualModel}`);
    
    // 路由器测试
    const routingDecision = this.pipelineRouter.route(virtualModel);
    secureLogger.info(`  🎯 Available pipelines: ${routingDecision.availablePipelines?.join(', ') || 'none'}`);
    
    if (!routingDecision.availablePipelines || routingDecision.availablePipelines.length === 0) {
      throw new Error(`No available pipelines for virtual model: ${virtualModel}`);
    }
    
    // 负载均衡测试
    let selectedPipelineId: string;
    if (this.loadBalancer) {
      selectedPipelineId = this.loadBalancer.selectPipeline(routingDecision.availablePipelines);
      secureLogger.info(`  ⚖️  Selected pipeline: ${selectedPipelineId}`);
    } else {
      selectedPipelineId = routingDecision.availablePipelines[0];
      secureLogger.info(`  🎯 Selected pipeline (no load balancer): ${selectedPipelineId}`);
    }
    
    const result: RoutingTestResult = {
      virtualModel,
      availablePipelines: routingDecision.availablePipelines,
      selectedPipelineId,
      isRoutingValid: true
    };
    
    this.emit('routingTestCompleted', result);
    return result;
  }

  /**
   * 测试流水线执行
   */
  async testPipelineExecution(
    pipelineId: string, 
    testRequest: TestRequestConfig
  ): Promise<ExecutionTestResult> {
    secureLogger.info(`🏃 Testing pipeline execution: ${pipelineId}`);
    
    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }
    
    // 检查流水线状态
    const pipelineStatus = pipeline.status || pipeline.getStatus?.()?.status;
    if (pipelineStatus !== 'runtime' && pipelineStatus !== 'running') {
      throw new Error(`Pipeline not ready: ${pipelineId}, status: ${pipelineStatus}`);
    }
    
    const startTime = Date.now();
    
    try {
      // 构建标准的Anthropic格式请求
      const anthropicRequest = this.buildAnthropicRequest(testRequest);
      
      // 执行流水线
      const response = await pipeline.execute(anthropicRequest);
      const executionTime = Date.now() - startTime;
      
      secureLogger.info(`  ✅ Pipeline execution successful (${executionTime}ms)`);
      secureLogger.info(`  📤 Response preview:`, { 
        hasChoices: !!response?.choices,
        choicesCount: response?.choices?.length || 0,
        previewLength: JQJsonHandler.stringifyJson(response, true).substring(0, 200).length
      });
      
      const result: ExecutionTestResult = {
        pipelineId,
        hasResponse: true,
        response,
        executionTime,
        error: null
      };
      
      this.emit('pipelineExecutionTestCompleted', result);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      secureLogger.error(`  ❌ Pipeline execution failed (${executionTime}ms):`, { 
        error: error.message,
        pipelineId
      });
      
      const result: ExecutionTestResult = {
        pipelineId,
        hasResponse: false,
        response: null,
        executionTime,
        error: error.message
      };
      
      this.emit('pipelineExecutionTestFailed', result);
      return result;
    }
  }

  /**
   * 验证响应（从Server层向上验证）
   */
  async validateResponse(
    response: any, 
    originalRequest: TestRequestConfig
  ): Promise<ResponseValidationResult> {
    secureLogger.info('🔍 Validating response from server layer upwards:');
    
    const result: ResponseValidationResult = {
      isValid: true,
      layerResults: {
        server: { isValid: true, errors: [] },
        serverCompatibility: { isValid: true, errors: [] },
        protocol: { isValid: true, errors: [] },
        transformer: { isValid: true, errors: [] }
      },
      errors: []
    };
    
    // Layer 4: Server Response Validation
    secureLogger.info('  🌐 Layer 4 - Server Response:');
    if (!response) {
      result.layerResults.server.isValid = false;
      result.layerResults.server.errors.push('No response from server layer');
    } else if (!response.choices || !Array.isArray(response.choices)) {
      result.layerResults.server.isValid = false;
      result.layerResults.server.errors.push('Invalid server response format: missing choices array');
    } else {
      secureLogger.info('    ✅ Server response format valid');
    }
    
    // Layer 3: Server Compatibility Response
    secureLogger.info('  🔧 Layer 3 - Server Compatibility:');
    // 验证是否正确处理了特定Provider的格式
    if (response && response.choices && response.choices.length > 0) {
      const firstChoice = response.choices[0];
      if (!firstChoice.message) {
        result.layerResults.serverCompatibility.isValid = false;
        result.layerResults.serverCompatibility.errors.push('Missing message in choice');
      } else {
        secureLogger.info('    ✅ Server compatibility processing valid');
      }
    }
    
    // Layer 2: Protocol Response
    secureLogger.info('  🔌 Layer 2 - Protocol:');
    // 验证协议响应格式
    if (response && typeof response === 'object') {
      secureLogger.info('    ✅ Protocol response valid');
    } else {
      result.layerResults.protocol.isValid = false;
      result.layerResults.protocol.errors.push('Invalid protocol response format');
    }
    
    // Layer 1: Transformer Response
    secureLogger.info('  📝 Layer 1 - Transformer:');
    // 验证最终响应格式是否符合Anthropic标准
    if (response && response.choices && response.model) {
      secureLogger.info('    ✅ Transformer response valid');
    } else {
      result.layerResults.transformer.isValid = false;
      result.layerResults.transformer.errors.push('Invalid final response format');
    }
    
    // 汇总错误
    for (const layerResult of Object.values(result.layerResults)) {
      result.errors.push(...layerResult.errors);
    }
    
    result.isValid = result.errors.length === 0;
    
    if (result.isValid) {
      secureLogger.info('🎉 Response validation completed successfully');
    } else {
      secureLogger.error('❌ Response validation failed:', { errors: result.errors });
    }
    
    this.emit('responseValidationCompleted', result);
    return result;
  }

  /**
   * 诊断执行失败（从Server层向上诊断）
   */
  async diagnoseExecutionFailure(
    pipelineId: string, 
    testRequest: TestRequestConfig
  ): Promise<DiagnosisResult> {
    secureLogger.info('🩺 Diagnosing execution failure from server layer upwards:');
    
    const pipeline = this.pipelineManager.getPipeline(pipelineId);
    if (!pipeline) {
      return {
        pipelineId,
        failedLayer: 'pipeline',
        layerDiagnostics: {
          transformer: { isWorking: false, error: 'Pipeline not found' },
          protocol: { isWorking: false, error: 'Pipeline not found' },
          serverCompatibility: { isWorking: false, error: 'Pipeline not found' },
          server: { isWorking: false, error: 'Pipeline not found' }
        },
        recommendations: ['Check pipeline initialization', 'Verify pipeline ID']
      };
    }
    
    const result: DiagnosisResult = {
      pipelineId,
      layerDiagnostics: {
        transformer: { isWorking: true },
        protocol: { isWorking: true },
        serverCompatibility: { isWorking: true },
        server: { isWorking: true }
      },
      recommendations: []
    };
    
    // Layer 4: Server Request Diagnosis
    secureLogger.info('  🌐 Layer 4 - Server Layer:');
    try {
      const serverRequest = this.buildServerRequest(testRequest, pipeline);
      secureLogger.info('    📤 Server request built successfully');
      
      // 尝试调用Server
      if (pipeline.server && pipeline.server.process) {
        const serverResponse = await pipeline.server.process(serverRequest);
        secureLogger.info('    ✅ Server layer responds correctly');
      } else {
        throw new Error('Server layer not available');
      }
      
    } catch (error) {
      secureLogger.error(`    ❌ Server layer error: ${error.message}`);
      result.layerDiagnostics.server.isWorking = false;
      result.layerDiagnostics.server.error = error.message;
      result.failedLayer = 'server';
      result.recommendations.push(
        'Check API endpoint accessibility',
        'Verify API key validity',
        'Check model name correctness',
        'Validate request format'
      );
      
      this.emit('diagnosisCompleted', result);
      return result;
    }
    
    // Layer 3: Server Compatibility Diagnosis
    secureLogger.info('  🔧 Layer 3 - Server Compatibility:');
    try {
      if (pipeline.serverCompatibility && pipeline.serverCompatibility.process) {
        const compatRequest = await pipeline.serverCompatibility.process(testRequest);
        secureLogger.info('    ✅ Server compatibility adaptation successful');
      } else {
        throw new Error('Server compatibility layer not available');
      }
    } catch (error) {
      secureLogger.error(`    ❌ Server compatibility error: ${error.message}`);
      result.layerDiagnostics.serverCompatibility.isWorking = false;
      result.layerDiagnostics.serverCompatibility.error = error.message;
      result.failedLayer = 'serverCompatibility';
      result.recommendations.push(
        'Check server compatibility module',
        'Verify provider-specific adaptations'
      );
      
      this.emit('diagnosisCompleted', result);
      return result;
    }
    
    // Layer 2: Protocol Diagnosis
    secureLogger.info('  🔌 Layer 2 - Protocol:');
    try {
      if (pipeline.protocol && pipeline.protocol.process) {
        const protocolRequest = await pipeline.protocol.process(testRequest);
        secureLogger.info('    ✅ Protocol processing successful');
      } else {
        throw new Error('Protocol layer not available');
      }
    } catch (error) {
      secureLogger.error(`    ❌ Protocol error: ${error.message}`);
      result.layerDiagnostics.protocol.isWorking = false;
      result.layerDiagnostics.protocol.error = error.message;
      result.failedLayer = 'protocol';
      result.recommendations.push(
        'Check protocol handler configuration',
        'Verify API protocol compatibility'
      );
      
      this.emit('diagnosisCompleted', result);
      return result;
    }
    
    // Layer 1: Transformer Diagnosis
    secureLogger.info('  📝 Layer 1 - Transformer:');
    try {
      if (pipeline.transformer && pipeline.transformer.process) {
        const transformedRequest = await pipeline.transformer.process(testRequest);
        secureLogger.info('    ✅ Transformer processing successful');
      } else {
        throw new Error('Transformer layer not available');
      }
    } catch (error) {
      secureLogger.error(`    ❌ Transformer error: ${error.message}`);
      result.layerDiagnostics.transformer.isWorking = false;
      result.layerDiagnostics.transformer.error = error.message;
      result.failedLayer = 'transformer';
      result.recommendations.push(
        'Check transformer module',
        'Verify request format transformation'
      );
      
      this.emit('diagnosisCompleted', result);
      return result;
    }
    
    // 如果所有层都正常，可能是集成问题
    secureLogger.info('🤔 All layers seem functional individually - checking integration...');
    result.failedLayer = 'integration';
    result.recommendations.push(
      'Check layer integration and data flow',
      'Verify pipeline initialization sequence',
      'Check for timing or concurrency issues'
    );
    
    this.emit('diagnosisCompleted', result);
    return result;
  }

  // === Demo1风格模型映射系统 ===

  /**
   * Demo1风格的模型映射
   */
  private mapToVirtualModel(inputModel: string, request: TestRequestConfig): string {
    // 基于字符长度计算token数量估算
    const tokenCount = this.calculateTokenCount(request);
    
    // 1. 长上下文检测 (>60K tokens)
    if (tokenCount > 60000) {
      return 'longContext';
    }
    
    // 2. Claude 3.5 Haiku → 背景任务
    if (inputModel?.startsWith('claude-3-5-haiku')) {
      return 'background';
    }
    
    // 3. 推理模型检测 (包含thinking参数)
    if (request.thinking) {
      return 'reasoning';
    }
    
    // 4. Web搜索工具检测
    if (Array.isArray(request.tools) && request.tools.some(tool =>
      tool.type?.startsWith('web_search') || tool.name?.includes('search'))) {
      return 'webSearch';
    }
    
    // 5. 默认 - 包括Claude 3.5 Sonnet等所有其他情况
    return 'default';
  }

  /**
   * 计算请求的token数量估算
   */
  private calculateTokenCount(request: TestRequestConfig): number {
    let count = 0;
    
    if (request.messages && Array.isArray(request.messages)) {
      for (const message of request.messages) {
        if (typeof message.content === 'string') {
          count += message.content.length / 4; // 基于字符长度的token估算
        }
      }
    }
    
    return count;
  }

  /**
   * 构建标准Anthropic请求格式
   */
  private buildAnthropicRequest(testRequest: TestRequestConfig): any {
    return {
      model: testRequest.model || 'claude-3-5-sonnet',
      messages: testRequest.messages || [
        { role: 'user', content: 'Hello, this is a test request.' }
      ],
      max_tokens: testRequest.maxTokens || 1024,
      temperature: testRequest.temperature || 0.7,
      tools: testRequest.tools,
      thinking: testRequest.thinking
    };
  }

  /**
   * 构建Server层请求（根据Pipeline配置）
   */
  private buildServerRequest(testRequest: TestRequestConfig, pipeline: any): any {
    // 根据pipeline配置构建标准OpenAI格式请求
    return {
      model: pipeline.targetModel || 'llama-3.1-8b',
      messages: testRequest.messages || [
        { role: 'user', content: 'Hello, this is a test request.' }
      ],
      max_tokens: testRequest.maxTokens || 1024,
      temperature: testRequest.temperature || 0.7,
      stream: false
    };
  }
}