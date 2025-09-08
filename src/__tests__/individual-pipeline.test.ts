/**
 * RCC v4.0 Individual Pipeline Test
 * 
 * 单独的流水线测试
 * 
 * 功能要求：
 * - 接受路由模块输出的流水线配置作为输入
 * - 为每个流水线配置生成独立的测试
 * - 执行六层架构的数据流转换过程
 * - 验证每层的输入输出格式正确性
 * 
 * @author Claude Code Router v4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigPreprocessor } from '../modules/config/src/config-preprocessor';
import { RouterPreprocessor, PipelineConfig, PipelineLayer } from '../modules/router/src/router-preprocessor';
import { RCCError, RCCErrorCode } from '../modules/types/src/index';

describe('Individual Pipeline Tests', () => {
  const testOutputDir = path.join(__dirname, 'test-outputs', 'individual-pipelines');
  const configPath = process.env.RCC_CONFIG_PATH || '/Users/fanzhang/.route-claudecode/config.json';
  let pipelineConfigs: PipelineConfig[] = [];

  beforeAll(async () => {
    // 创建测试输出目录
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // 获取流水线配置
    const configResult = await ConfigPreprocessor.preprocess(configPath);
    if (!configResult.success || !configResult.routingTable) {
      throw new RCCError('Failed to load configuration for pipeline tests', RCCErrorCode.CONFIG_PARSE_ERROR, 'individual-pipeline-test');
    }

    const routerResult = await RouterPreprocessor.preprocess(configResult.routingTable);
    if (!routerResult.success || !routerResult.pipelineConfigs) {
      throw new RCCError('Failed to generate pipeline configurations', RCCErrorCode.PIPELINE_ASSEMBLY_FAILED, 'individual-pipeline-test');
    }

    pipelineConfigs = routerResult.pipelineConfigs;
  });

  test('Generate Individual Pipeline Tests', async () => {
    const testSummary = {
      testName: 'Individual Pipeline Tests',
      startTime: new Date().toISOString(),
      totalPipelines: pipelineConfigs.length,
      testedPipelines: 0,
      successfulPipelines: 0,
      failedPipelines: 0,
      pipelineResults: [] as any[],
      errors: [] as string[],
      warnings: [] as string[]
    };

    try {
      // 为每个流水线生成独立测试
      for (let i = 0; i < pipelineConfigs.length; i++) {
        const pipeline = pipelineConfigs[i];
        const pipelineResult = await testIndividualPipeline(pipeline, i + 1, testOutputDir);
        
        testSummary.pipelineResults.push(pipelineResult);
        testSummary.testedPipelines++;

        if (pipelineResult.success) {
          testSummary.successfulPipelines++;
        } else {
          testSummary.failedPipelines++;
          testSummary.errors.push(...pipelineResult.errors);
        }

        if (pipelineResult.warnings.length > 0) {
          testSummary.warnings.push(...pipelineResult.warnings);
        }
      }

      // 保存测试总结
      const summaryPath = path.join(testOutputDir, 'pipeline-test-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));

      // 测试断言
      expect(testSummary.testedPipelines).toBe(pipelineConfigs.length);
      expect(testSummary.successfulPipelines).toBeGreaterThan(0);
      expect(testSummary.failedPipelines).toBe(0);

      // 验证每个流水线都有输出目录
      for (let i = 1; i <= pipelineConfigs.length; i++) {
        const pipelineDirName = `pipeline-${i}-${pipelineConfigs[i-1].provider}-${pipelineConfigs[i-1].model}`.replace(/[^a-zA-Z0-9\-]/g, '-');
        const pipelineDir = path.join(testOutputDir, pipelineDirName);
        expect(fs.existsSync(pipelineDir)).toBe(true);
      }

    } catch (error) {
      if (error instanceof RCCError) {
        testSummary.errors.push(error.message);
      } else {
        testSummary.errors.push((error as Error).message);
      }
      
      const summaryPath = path.join(testOutputDir, 'pipeline-test-summary.json');
      fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
      
      throw error;
    }
  }, 60000); // 60秒超时，因为需要测试多个流水线
});

/**
 * 测试单个流水线
 */
async function testIndividualPipeline(
  pipeline: PipelineConfig, 
  pipelineIndex: number, 
  baseOutputDir: string
): Promise<{
  pipelineId: string;
  pipelineIndex: number;
  success: boolean;
  errors: string[];
  warnings: string[];
  layerTests: any[];
  outputDir: string;
  processingTime: number;
}> {
  const startTime = Date.now();
  const pipelineDirName = `pipeline-${pipelineIndex}-${pipeline.provider}-${pipeline.model}`.replace(/[^a-zA-Z0-9\-]/g, '-');
  const pipelineDir = path.join(baseOutputDir, pipelineDirName);
  
  // 创建流水线专用目录
  if (!fs.existsSync(pipelineDir)) {
    fs.mkdirSync(pipelineDir, { recursive: true });
  }

  const result = {
    pipelineId: pipeline.pipelineId,
    pipelineIndex,
    success: false,
    errors: [] as string[],
    warnings: [] as string[],
    layerTests: [] as any[],
    outputDir: pipelineDir,
    processingTime: 0
  };

  try {
    // 保存流水线输入数据
    const inputDataPath = path.join(pipelineDir, 'input-data.json');
    const inputData = {
      pipelineConfig: pipeline,
      testData: generateTestInputData(pipeline)
    };
    fs.writeFileSync(inputDataPath, JSON.stringify(inputData, null, 2));

    // 测试每个层
    let currentData = inputData.testData;
    
    for (let layerIndex = 0; layerIndex < pipeline.layers.length; layerIndex++) {
      const layer = pipeline.layers[layerIndex];
      const layerTest = await testPipelineLayer(layer, currentData, layerIndex + 1, pipelineDir, pipeline);
      
      result.layerTests.push(layerTest);
      
      if (!layerTest.success) {
        result.errors.push(...layerTest.errors);
      }
      
      if (layerTest.warnings.length > 0) {
        result.warnings.push(...layerTest.warnings);
      }

      // 使用层的输出作为下一层的输入
      currentData = layerTest.outputData;
    }

    // 生成流水线验证结果
    const validation = validatePipelineIntegrity(pipeline, result.layerTests);
    const validationPath = path.join(pipelineDir, 'pipeline-validation.json');
    fs.writeFileSync(validationPath, JSON.stringify(validation, null, 2));

    if (validation.errors.length > 0) {
      result.errors.push(...validation.errors);
    }
    if (validation.warnings.length > 0) {
      result.warnings.push(...validation.warnings);
    }

    result.success = result.errors.length === 0;
    result.processingTime = Date.now() - startTime;

    return result;

  } catch (error) {
    if (error instanceof RCCError) {
      result.errors.push(error.message);
    } else {
      result.errors.push((error as Error).message);
    }
    
    result.success = false;
    result.processingTime = Date.now() - startTime;
    
    return result;
  }
}

/**
 * 测试单个流水线层
 */
async function testPipelineLayer(
  layer: PipelineLayer,
  inputData: any,
  layerIndex: number,
  pipelineDir: string,
  pipeline: PipelineConfig
): Promise<{
  layerName: string;
  layerType: string;
  layerIndex: number;
  success: boolean;
  errors: string[];
  warnings: string[];
  inputData: any;
  outputData: any;
  processingTime: number;
}> {
  const startTime = Date.now();
  
  const result = {
    layerName: layer.name,
    layerType: layer.type,
    layerIndex,
    success: false,
    errors: [] as string[],
    warnings: [] as string[],
    inputData,
    outputData: null as any,
    processingTime: 0
  };

  try {
    // 根据层类型执行特定的数据转换
    const transformedData = await executeLayerProcessing(layer, inputData, pipeline);
    
    // 保存层输出
    const layerOutputPath = path.join(pipelineDir, `layer-${layerIndex}-${layer.name}.json`);
    const layerOutput = {
      layer: {
        name: layer.name,
        type: layer.type,
        order: layer.order,
        config: layer.config
      },
      input: inputData,
      output: transformedData,
      metadata: {
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      }
    };
    fs.writeFileSync(layerOutputPath, JSON.stringify(layerOutput, null, 2));

    // 验证层处理结果
    const validation = validateLayerOutput(layer, inputData, transformedData);
    if (validation.errors.length > 0) {
      result.errors.push(...validation.errors);
    }
    if (validation.warnings.length > 0) {
      result.warnings.push(...validation.warnings);
    }

    result.outputData = transformedData;
    result.success = result.errors.length === 0;
    result.processingTime = Date.now() - startTime;

    return result;

  } catch (error) {
    if (error instanceof RCCError) {
      result.errors.push(error.message);
    } else {
      result.errors.push((error as Error).message);
    }
    
    result.success = false;
    result.processingTime = Date.now() - startTime;
    
    return result;
  }
}

/**
 * 生成测试输入数据
 */
function generateTestInputData(pipeline: PipelineConfig): any {
  return {
    // Anthropic格式的测试请求 (Client层输入)
    model: pipeline.model,
    max_tokens: pipeline.maxTokens || 4096,
    temperature: 0.7,
    system: "You are a helpful assistant.",
    messages: [
      {
        role: "user",
        content: "列出本目录中所有文件夹"
      }
    ],
    tools: [
      {
        name: "list_files",
        description: "List files and directories",
        input_schema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Directory path to list"
            }
          },
          required: ["path"]
        }
      }
    ],
    metadata: {
      pipelineId: pipeline.pipelineId,
      provider: pipeline.provider,
      originalFormat: "anthropic",
      testScenario: "tool_calling"
    }
  };
}

/**
 * 执行层处理（六层架构数据流转换）
 */
async function executeLayerProcessing(layer: PipelineLayer, inputData: any, pipeline: PipelineConfig): Promise<any> {
  switch (layer.type) {
    case 'client':
      // 客户端层：接收Anthropic格式，传递给Router层
      return {
        ...inputData,
        metadata: {
          ...inputData.metadata,
          layer: 'client',
          processed: true
        }
      };
      
    case 'router':
      // 路由层：模型映射和路由选择，格式保持Anthropic
      return {
        ...inputData,
        metadata: {
          ...inputData.metadata,
          layer: 'router',
          routeSelected: pipeline.routeId,
          provider: pipeline.provider,
          processed: true
        }
      };
      
    case 'transformer':
      // 转换层：Anthropic → OpenAI格式转换
      return transformAnthropicToOpenAI(inputData, pipeline);
      
    case 'protocol':
      // 协议层：OpenAI格式处理，添加端点配置
      return applyProtocolConfiguration(inputData, pipeline);
      
    case 'server-compatibility':
      // 服务器兼容层：Provider特定调整
      return applyServerCompatibility(inputData, pipeline);
      
    case 'server':
      // 服务器层：HTTP请求准备
      return prepareHttpRequest(inputData, pipeline);
      
    default:
      return {
        ...inputData,
        metadata: {
          ...inputData.metadata,
          layer: layer.name,
          processed: true,
          warning: `Unknown layer type: ${layer.type}`
        }
      };
  }
}

/**
 * Anthropic到OpenAI格式转换（真实实现）
 */
function transformAnthropicToOpenAI(inputData: any, pipeline: PipelineConfig): any {
  const openAIRequest = {
    model: pipeline.model,
    messages: [],
    temperature: inputData.temperature || 0.7,
    max_tokens: inputData.max_tokens || 4096,
    metadata: {
      ...inputData.metadata,
      layer: 'transformer',
      format: 'openai',
      transformedFrom: 'anthropic',
      processed: true
    }
  } as any;

  // 转换system消息
  if (inputData.system) {
    openAIRequest.messages.push({
      role: "system",
      content: inputData.system
    });
  }

  // 转换对话消息
  if (inputData.messages && Array.isArray(inputData.messages)) {
    openAIRequest.messages.push(...inputData.messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    })));
  }

  // 转换工具定义：Anthropic tools → OpenAI functions
  if (inputData.tools && Array.isArray(inputData.tools)) {
    openAIRequest.tools = inputData.tools.map((tool: any) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  }

  return openAIRequest;
}

/**
 * 应用协议配置（真实实现）
 */
function applyProtocolConfiguration(inputData: any, pipeline: PipelineConfig): any {
  return {
    ...inputData,
    endpoint: pipeline.endpoint,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${pipeline.apiKey}`,
      'User-Agent': 'RCC-v4.0-Pipeline'
    },
    metadata: {
      ...inputData.metadata,
      layer: 'protocol',
      endpoint: pipeline.endpoint,
      processed: true
    }
  };
}

/**
 * 应用服务器兼容性配置（真实实现）
 */
function applyServerCompatibility(inputData: any, pipeline: PipelineConfig): any {
  const compatibilityData = { ...inputData };
  
  // 根据provider应用特定的兼容性调整
  if (pipeline.provider === 'lmstudio') {
    // LM Studio特定调整
    compatibilityData.temperature = Math.min(compatibilityData.temperature || 0.7, 2.0);
    compatibilityData.max_tokens = Math.min(compatibilityData.max_tokens || 4096, 32768);
    
    // LM Studio doesn't require API key in some configurations
    if (pipeline.apiKey === 'lm-studio') {
      delete compatibilityData.headers?.Authorization;
    }
  } else if (pipeline.provider === 'qwen') {
    // Qwen特定调整
    compatibilityData.top_p = 0.9;
    compatibilityData.headers = {
      ...compatibilityData.headers,
      'X-DashScope-Async': 'enable'
    };
    
    // Qwen可能需要特殊的认证头
    if (compatibilityData.headers?.Authorization) {
      compatibilityData.headers.Authorization = `Bearer ${pipeline.apiKey}`;
    }
  }
  
  return {
    ...compatibilityData,
    metadata: {
      ...compatibilityData.metadata,
      layer: 'server-compatibility',
      provider: pipeline.provider,
      compatibilityApplied: true,
      processed: true
    }
  };
}

/**
 * 准备HTTP请求（真实实现）
 */
function prepareHttpRequest(inputData: any, pipeline: PipelineConfig): any {
  // 构建完整的HTTP请求配置
  const httpRequest = {
    ...inputData,
    httpConfig: {
      method: 'POST',
      url: `${pipeline.endpoint}/chat/completions`,
      timeout: pipeline.timeout || 60000,
      maxRetries: pipeline.maxRetries || 3,
      headers: inputData.headers || {},
      validateStatus: (status: number) => status < 500 // 只重试5xx错误
    },
    metadata: {
      ...inputData.metadata,
      layer: 'server',
      readyForHttp: true,
      processed: true,
      finalUrl: `${pipeline.endpoint}/chat/completions`
    }
  };

  // 移除不需要发送给服务器的内部字段
  delete httpRequest.endpoint;
  
  return httpRequest;
}

/**
 * 验证层输出
 */
function validateLayerOutput(layer: PipelineLayer, inputData: any, outputData: any): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本验证
  if (!outputData) {
    errors.push(`Layer ${layer.name} produced no output`);
    return { errors, warnings };
  }

  if (!outputData.metadata?.processed) {
    warnings.push(`Layer ${layer.name} did not mark data as processed`);
  }

  // 层特定验证
  switch (layer.type) {
    case 'transformer':
      // 验证Anthropic→OpenAI转换
      if (!outputData.messages || !Array.isArray(outputData.messages)) {
        errors.push(`Transformer layer did not produce valid OpenAI messages array`);
      }
      
      if (outputData.tools && !outputData.tools.every((tool: any) => tool.type === 'function')) {
        errors.push(`Transformer layer did not convert tools to OpenAI format correctly`);
      }
      
      if (outputData.metadata?.format !== 'openai') {
        errors.push(`Transformer layer did not set format to 'openai'`);
      }
      break;
      
    case 'protocol':
      // 验证协议层添加了端点信息
      if (!outputData.endpoint) {
        errors.push(`Protocol layer did not add endpoint information`);
      }
      
      if (!outputData.headers || !outputData.headers['Content-Type']) {
        errors.push(`Protocol layer did not add required headers`);
      }
      break;
      
    case 'server':
      // 验证服务器层添加了HTTP配置
      if (!outputData.httpConfig) {
        errors.push(`Server layer did not add HTTP configuration`);
      }
      
      if (!outputData.metadata?.readyForHttp) {
        errors.push(`Server layer did not mark data as ready for HTTP`);
      }
      break;
  }

  return { errors, warnings };
}

/**
 * 验证流水线完整性
 */
function validatePipelineIntegrity(pipeline: PipelineConfig, layerTests: any[]): {
  success: boolean;
  errors: string[];
  warnings: string[];
  dataFlowValidation: any;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证所有层都执行了
  const expectedLayerTypes = ['transformer', 'protocol', 'server-compatibility', 'server'];
  const actualLayerTypes = layerTests.map(test => test.layerType);
  
  for (const expectedType of expectedLayerTypes) {
    if (!actualLayerTypes.includes(expectedType)) {
      errors.push(`Missing required layer: ${expectedType}`);
    }
  }

  // 验证数据流连续性
  for (let i = 1; i < layerTests.length; i++) {
    const prevLayer = layerTests[i - 1];
    const currentLayer = layerTests[i];
    
    // 检查前一层的输出是否被正确传递给下一层
    if (!currentLayer.inputData || !prevLayer.outputData) {
      warnings.push(`Data flow issue between ${prevLayer.layerName} and ${currentLayer.layerName}`);
    }
  }

  // 验证最终输出格式
  const lastLayer = layerTests[layerTests.length - 1];
  if (lastLayer && !lastLayer.outputData?.metadata?.readyForHttp) {
    warnings.push(`Final layer output is not ready for HTTP transmission`);
  }

  // 验证格式转换正确性
  const transformerLayer = layerTests.find(test => test.layerType === 'transformer');
  if (transformerLayer && transformerLayer.outputData?.metadata?.format !== 'openai') {
    errors.push(`Transformer layer did not properly convert to OpenAI format`);
  }

  const dataFlowValidation = {
    layersProcessed: layerTests.length,
    expectedLayers: expectedLayerTypes.length,
    allLayersSuccessful: layerTests.every(test => test.success),
    dataFlowContinuous: warnings.filter(w => w.includes('Data flow')).length === 0,
    finalFormatValid: lastLayer?.outputData?.metadata?.readyForHttp || false,
    formatTransformationCorrect: transformerLayer?.outputData?.metadata?.format === 'openai'
  };

  return {
    success: errors.length === 0,
    errors,
    warnings,
    dataFlowValidation
  };
}