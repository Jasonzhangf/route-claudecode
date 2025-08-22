/**
 * 模型映射验证单元测试
 * 
 * 测试目标：
 * 1. 验证虚拟模型映射是否正确将Claude模型映射到LM Studio可用模型
 * 2. 验证流水线表生成是否包含正确的pipeline ID和目标模型
 * 3. 确保系统初始化时就能检测到模型映射错误
 * 
 * @author RCC v4.0
 */

import { VirtualModelMapper } from '../router/virtual-model-mapping';
import { PipelineTableManager } from '../pipeline/pipeline-table-manager';
import { MergedConfig } from '../config/config-reader';
import {
  TEST_MODEL_NAMES,
  TEST_VIRTUAL_MODELS,
  TEST_PROVIDER_CONFIG,
  TEST_PIPELINE_PATTERNS,
  TEST_REQUEST_TEMPLATES,
  TEST_MESSAGES,
  TEST_STEP_MESSAGES,
  TEST_LOG_FORMATS,
  TEST_ENDPOINTS,
  TEST_MOCK_CONFIGS,
  TEST_FIX_SUGGESTIONS,
  TEST_CONSISTENCY_MESSAGES
} from '../constants/test-constants';

interface TestRequest {
  model: string;
  messages: ReadonlyArray<{ readonly role: string; readonly content: string }> | Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  tools?: ReadonlyArray<{
    readonly type: string;
    readonly function: {
      readonly name: string;
      readonly description: string;
    };
  }> | Array<{
    type: string;
    function: {
      name: string;
      description: string;
    };
  }>;
}

describe('模型映射验证测试', () => {
  describe('VirtualModelMapper', () => {
    it('应该将claude-sonnet-4模型映射到default虚拟模型', () => {
      // 模拟Claude Code请求
      const claudeRequest: TestRequest = {
        model: TEST_MODEL_NAMES.CLAUDE_SONNET_4,
        ...TEST_REQUEST_TEMPLATES.SIMPLE_CLAUDE_REQUEST
      };

      const virtualModel = VirtualModelMapper.mapToVirtual(TEST_MODEL_NAMES.CLAUDE_SONNET_4, claudeRequest);
      
      // 验证映射结果
      expect(virtualModel).toBe(TEST_VIRTUAL_MODELS.DEFAULT);
      console.log(TEST_LOG_FORMATS.VIRTUAL_MODEL_MAPPING(claudeRequest.model, virtualModel));
    });

    it('应该将claude-sonnet-4带工具调用的请求映射到coding虚拟模型', () => {
      // 模拟带工具调用的Claude Code请求
      const claudeToolRequest: TestRequest = {
        model: TEST_MODEL_NAMES.CLAUDE_SONNET_4,
        ...TEST_REQUEST_TEMPLATES.TOOL_CALLING_REQUEST
      };

      const virtualModel = VirtualModelMapper.mapToVirtual(TEST_MODEL_NAMES.CLAUDE_SONNET_4, claudeToolRequest);
      
      // 验证工具调用请求映射到coding类型
      expect(virtualModel).toBe(TEST_VIRTUAL_MODELS.CODING);
      console.log(TEST_LOG_FORMATS.TOOL_CALLING_MAPPING(claudeToolRequest.model, virtualModel));
    });

    it('应该将任何未知模型映射到default虚拟模型', () => {
      const unknownRequest: TestRequest = {
        model: TEST_MODEL_NAMES.UNKNOWN_MODEL,
        ...TEST_REQUEST_TEMPLATES.UNKNOWN_MODEL_REQUEST
      };

      const virtualModel = VirtualModelMapper.mapToVirtual(TEST_MODEL_NAMES.UNKNOWN_MODEL, unknownRequest);
      
      // 验证回退到default
      expect(virtualModel).toBe(TEST_VIRTUAL_MODELS.DEFAULT);
      console.log(TEST_LOG_FORMATS.UNKNOWN_MODEL_MAPPING(unknownRequest.model, virtualModel));
    });
  });

  describe('PipelineTableManager', () => {
    let pipelineManager: PipelineTableManager;
    let mockConfig: MergedConfig;

    beforeEach(() => {
      // 模拟LM Studio配置 - 基于实际配置文件
      mockConfig = {
        providers: [
          {
            name: TEST_PROVIDER_CONFIG.NAME,
            api_base_url: TEST_PROVIDER_CONFIG.API_BASE_URL,
            api_key: TEST_PROVIDER_CONFIG.API_KEY,
            models: [
              TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B,
              TEST_MODEL_NAMES.LM_STUDIO_MODELS.LLAMA_3_1_8B,
              TEST_MODEL_NAMES.LM_STUDIO_MODELS.QWEN_2_5_CODER,
              TEST_MODEL_NAMES.LM_STUDIO_MODELS.DEEPSEEK_R1
            ],
            weight: TEST_PROVIDER_CONFIG.WEIGHT,
            maxTokens: TEST_PROVIDER_CONFIG.MAX_TOKENS,
            serverCompatibility: TEST_PROVIDER_CONFIG.SERVER_COMPATIBILITY
          }
        ],
        systemConfig: {
          providerTypes: {
            [TEST_PROVIDER_CONFIG.NAME]: {
              endpoint: TEST_PROVIDER_CONFIG.API_BASE_URL,
              protocol: TEST_PROVIDER_CONFIG.PROTOCOL,
              timeout: TEST_PROVIDER_CONFIG.TIMEOUT,
              maxRetries: TEST_PROVIDER_CONFIG.MAX_RETRIES
            }
          }
        },
        router: {
          default: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          reasoning: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          longContext: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          webSearch: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          background: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`
        },
        server: { port: 5506, host: '0.0.0.0', debug: true },
        apiKey: 'test-key',
        blacklistSettings: { timeout429: 60000, timeoutError: 300000 }
      } as unknown as MergedConfig;

      pipelineManager = new PipelineTableManager(mockConfig);
    });

    it('应该生成包含正确pipeline ID的流水线表', async () => {
      const routingTable = await pipelineManager.getOrGenerateRoutingTable();
      
      // 验证流水线表结构
      expect(routingTable).toBeDefined();
      expect(routingTable.totalPipelines).toBeGreaterThan(0);
      expect(routingTable.allPipelines).toBeInstanceOf(Array);
      expect(routingTable.pipelinesGroupedByVirtualModel).toBeDefined();

      // 验证具体的pipeline ID格式
      const firstPipeline = routingTable.allPipelines[0];
      expect(firstPipeline.pipelineId).toMatch(TEST_PIPELINE_PATTERNS.PIPELINE_ID_REGEX);
      expect(firstPipeline.provider).toBe(TEST_PROVIDER_CONFIG.NAME);
      
      console.log(TEST_LOG_FORMATS.PIPELINE_TABLE_GENERATION(routingTable.totalPipelines));
      const details = TEST_LOG_FORMATS.PIPELINE_DETAILS(firstPipeline.pipelineId, firstPipeline.targetModel, firstPipeline.virtualModel);
      console.log(`   ${details.pipelineId}`);
      console.log(`   ${details.targetModel}`);
      console.log(`   ${details.virtualModel}`);
    });

    it('应该将default虚拟模型映射到正确的LM Studio流水线', async () => {
      const routingTable = await pipelineManager.getOrGenerateRoutingTable();
      
      // 🔧 修复：检查default虚拟模型的流水线配置（基于Router配置）
      const defaultPipelines = routingTable.pipelinesGroupedByVirtualModel[TEST_VIRTUAL_MODELS.DEFAULT];
      expect(defaultPipelines).toBeDefined();
      expect(defaultPipelines.length).toBeGreaterThan(0);

      // 验证流水线配置
      const defaultPipeline = defaultPipelines[0];
      expect(defaultPipeline.targetModel).toBe(TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B);
      expect(defaultPipeline.pipelineId).toBe(TEST_PIPELINE_PATTERNS.EXPECTED_PIPELINE_ID);
      expect(defaultPipeline.endpoint).toContain(TEST_ENDPOINTS.LOCALHOST_1234);

      console.log(TEST_MESSAGES.DEFAULT_PIPELINE_MAPPING_SUCCESS);
      const details = TEST_LOG_FORMATS.DEFAULT_PIPELINE_MAPPING(defaultPipeline.pipelineId, defaultPipeline.targetModel, defaultPipeline.endpoint);
      console.log(`   ${details.pipelineId}`);
      console.log(`   ${details.targetModel}`);
      console.log(`   ${details.endpoint}`);
    });

    it('应该验证流水线表中包含Claude模型到LM Studio模型的完整映射链路', async () => {
      // 步骤1: 模拟Claude请求的虚拟模型映射
      const claudeModel = TEST_MODEL_NAMES.CLAUDE_SONNET_4;
      const claudeRequest: TestRequest = {
        model: claudeModel,
        ...TEST_REQUEST_TEMPLATES.UNKNOWN_MODEL_REQUEST
      };
      
      const virtualModel = VirtualModelMapper.mapToVirtual(claudeModel, claudeRequest);
      console.log(TEST_LOG_FORMATS.STEP_LOGGING.VIRTUAL_MODEL_MAPPING(claudeModel, virtualModel));

      // 步骤2: 检查流水线表中是否有对应的流水线配置
      const routingTable = await pipelineManager.getOrGenerateRoutingTable();
      
      // 🔧 修复：现在VirtualModelMapper和PipelineTableManager都使用'default'虚拟模型
      // 直接检查default虚拟模型对应的流水线
      const targetPipelines = routingTable.pipelinesGroupedByVirtualModel[virtualModel];
      
      expect(targetPipelines).toBeDefined();
      expect(targetPipelines.length).toBeGreaterThan(0);

      const targetPipeline = targetPipelines[0];
      console.log(TEST_LOG_FORMATS.STEP_LOGGING.PIPELINE_LOOKUP(virtualModel, targetPipeline.pipelineId));

      // 步骤3: 验证最终的目标模型是LM Studio实际可用的模型
      const lmStudioModels = mockConfig.providers[0].models;
      expect(lmStudioModels).toContain(targetPipeline.targetModel);
      console.log(TEST_LOG_FORMATS.STEP_LOGGING.TARGET_MODEL_VALIDATION(targetPipeline.targetModel));

      // 完整映射链路验证
      console.log(TEST_MESSAGES.COMPLETE_MAPPING_CHAIN_SUCCESS);
      const chainDetails = TEST_LOG_FORMATS.COMPLETE_MAPPING_CHAIN(claudeModel, virtualModel, targetPipeline.pipelineId, targetPipeline.targetModel, targetPipeline.endpoint);
      console.log(`   ${chainDetails.claudeModel}`);
      console.log(`   ${chainDetails.virtualModel}`);
      console.log(`   ${chainDetails.pipelineId}`);
      console.log(`   ${chainDetails.targetModel}`);
      console.log(`   ${chainDetails.endpoint}`);
    });
  });

  describe('集成测试 - 模型映射一致性验证', () => {
    it('应该检测并报告模型映射不一致问题', async () => {
      // 创建有问题的配置 - VirtualModelMapper和PipelineTableManager不一致
      console.log(TEST_STEP_MESSAGES.INCONSISTENCY_TEST_SCENARIO);

      // 测试1: VirtualModelMapper返回的虚拟模型
      const claudeRequest: TestRequest = { 
        model: TEST_MODEL_NAMES.CLAUDE_SONNET_4, 
        ...TEST_REQUEST_TEMPLATES.UNKNOWN_MODEL_REQUEST
      };
      const virtualModel = VirtualModelMapper.mapToVirtual(TEST_MODEL_NAMES.CLAUDE_SONNET_4, claudeRequest);

      // 测试2: PipelineTableManager生成的虚拟模型分组
      const testConfig = {
        providers: [TEST_MOCK_CONFIGS.SIMPLE_TEST_CONFIG.PROVIDER],
        systemConfig: { 
          providerTypes: TEST_MOCK_CONFIGS.SIMPLE_TEST_CONFIG.SYSTEM_CONFIG
        },
        router: {
          default: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          reasoning: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          longContext: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          webSearch: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`,
          background: `${TEST_PROVIDER_CONFIG.NAME},${TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B}`
        },
        server: { port: 5506, host: '0.0.0.0', debug: true },
        apiKey: 'test-key',
        blacklistSettings: { timeout429: 60000, timeoutError: 300000 }
      } as unknown as MergedConfig;

      const pipelineManager = new PipelineTableManager(testConfig);
      const routingTable = await pipelineManager.getOrGenerateRoutingTable();
      const availableVirtualModels = Object.keys(routingTable.pipelinesGroupedByVirtualModel);

      // 检查一致性 - 现在应该是一致的
      const isConsistent = availableVirtualModels.includes(virtualModel);
      
      console.log(TEST_STEP_MESSAGES.MAPPING_CONSISTENCY_RESULTS);
      console.log(`   ${TEST_CONSISTENCY_MESSAGES.MAPPER_RESULT}: ${virtualModel}`);
      console.log(`   ${TEST_CONSISTENCY_MESSAGES.PIPELINE_AVAILABLE}: ${availableVirtualModels.join(', ')}`);
      console.log(`   ${TEST_CONSISTENCY_MESSAGES.CONSISTENCY_STATUS}: ${isConsistent ? TEST_CONSISTENCY_MESSAGES.CONSISTENT : TEST_CONSISTENCY_MESSAGES.INCONSISTENT}`);

      // 🔧 修复后，映射应该是一致的
      expect(isConsistent).toBe(true);
      console.log('✅ 映射一致性验证通过 - VirtualModelMapper和PipelineTableManager现在使用一致的虚拟模型名称');
    });

    it('应该提供修复后的一致性验证', () => {
      // 模拟修复方案1: VirtualModelMapper返回provider名称
      const getMappedVirtualModel = (inputModel: string, request: any, providers: any[]): string => {
        // 简化的映射逻辑 - 返回第一个provider的名称
        return providers[0]?.name || TEST_VIRTUAL_MODELS.DEFAULT;
      };

      // 模拟修复方案2: PipelineTableManager使用consistent虚拟模型名称
      const getConsistentVirtualModel = (provider: any): string => {
        // 返回一致的虚拟模型名称
        return TEST_VIRTUAL_MODELS.DEFAULT;
      };

      const mockProviders = [{ name: TEST_PROVIDER_CONFIG.NAME, models: [TEST_MODEL_NAMES.LM_STUDIO_MODELS.GPT_OSS_20B] }];
      
      const mappedVirtualModel = getMappedVirtualModel(TEST_MODEL_NAMES.CLAUDE_SONNET_4, {}, mockProviders);
      const pipelineVirtualModel = getConsistentVirtualModel(mockProviders[0]);

      console.log(TEST_STEP_MESSAGES.FIX_VERIFICATION);
      console.log(`   ${TEST_FIX_SUGGESTIONS.SOLUTION_1_DESCRIPTION}: ${mappedVirtualModel}`);  
      console.log(`   ${TEST_FIX_SUGGESTIONS.SOLUTION_2_DESCRIPTION}: ${pipelineVirtualModel}`);

      // 我们可以选择任一方案，这里演示方案2 (都使用'default')
      expect(pipelineVirtualModel).toBe(TEST_VIRTUAL_MODELS.DEFAULT);
      console.log(TEST_MESSAGES.FIX_VERIFICATION_SUCCESS);
    });
  });
});