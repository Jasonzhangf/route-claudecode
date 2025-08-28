#!/usr/bin/env npx tsx

/**
 * 流水线流程验证脚本
 * 
 * 执行完整的流水线处理流程验证
 * 确保输入处理到HTTP发出前的所有阶段正常工作
 * 
 * @author Pipeline Validation Script
 */

import * as fs from 'fs';
import * as path from 'path';
import { ValidationLogger } from '../src/utils/validation-logger';
import { PipelineFlowValidator } from '../src/tools/pipeline-flow-validator';
import { PIPELINE_DEFAULTS } from '../src/constants/pipeline-defaults';

interface ValidationScenario {
  name: string;
  description: string;
  input: {
    model: string;
    messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    tools?: Array<{
      name: string;
      description: string;
      input_schema: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
      };
    }>;
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
  };
  context: {
    requestId: string;
    pipelineId: string;
    metadata?: Record<string, any>;
  };
  expectedResults: {
    shouldSucceed: boolean;
    expectedAdjustments?: string[];
    expectedProvider?: string;
  };
}

async function loadConfiguration(): Promise<any> {
  const configPath = path.resolve(process.env.HOME || '', '.route-claudecode/config.json');
  
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configContent);
  } catch (error) {
    ValidationLogger.error('Failed to load configuration', {
      configPath,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // 使用默认配置进行验证
    return {
      providers: [
        {
          name: 'qwen',
          baseURL: PIPELINE_DEFAULTS.PROVIDER_ENDPOINTS.QWEN.BASE_URL,
          apiKey: 'validation-qwen-key',
          models: ['qwen-max', 'qwen-plus']
        },
        {
          name: 'lmstudio',
          baseURL: PIPELINE_DEFAULTS.PROVIDER_ENDPOINTS.LMSTUDIO.BASE_URL,
          apiKey: 'validation-lmstudio-key',
          models: ['llama-3.1-8b']
        },
        {
          name: 'modelscope',
          baseURL: PIPELINE_DEFAULTS.PROVIDER_ENDPOINTS.MODELSCOPE.BASE_URL,
          apiKey: 'validation-modelscope-key',
          models: ['qwen2-72b-instruct']
        }
      ]
    };
  }
}

function createValidationScenarios(): ValidationScenario[] {
  return [
    {
      name: 'Simple Text Request',
      description: 'Basic text request without tools',
      input: {
        model: 'qwen-max',
        messages: [
          { role: 'user', content: '你好，请介绍一下自己' }
        ],
        max_tokens: PIPELINE_DEFAULTS.REQUEST_DEFAULTS.MAX_TOKENS,
        temperature: PIPELINE_DEFAULTS.REQUEST_DEFAULTS.TEMPERATURE
      },
      context: {
        requestId: 'validation-req-001',
        pipelineId: 'qwen-max-key0'
      },
      expectedResults: {
        shouldSucceed: true,
        expectedProvider: 'qwen'
      }
    },
    {
      name: 'Tool Calling Request',
      description: 'Request with tool calling functionality',
      input: {
        model: 'qwen-plus',
        messages: [
          { role: 'user', content: '请列出当前目录的文件' }
        ],
        tools: [
          {
            name: 'list_files',
            description: 'List files in a directory',
            input_schema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path' }
              },
              required: ['path']
            }
          }
        ],
        max_tokens: 2000,
        temperature: 0.3
      },
      context: {
        requestId: 'validation-req-002',
        pipelineId: 'qwen-plus-key0'
      },
      expectedResults: {
        shouldSucceed: true,
        expectedProvider: 'qwen'
      }
    },
    {
      name: 'LMStudio Stream Adjustment',
      description: 'LMStudio provider with stream disabled',
      input: {
        model: 'llama-3.1-8b',
        messages: [
          { role: 'user', content: 'Generate a creative story' }
        ],
        stream: true,
        temperature: 0.8
      },
      context: {
        requestId: 'validation-req-003',
        pipelineId: 'lmstudio-llama-3.1-8b-key0'
      },
      expectedResults: {
        shouldSucceed: true,
        expectedAdjustments: ['stream_disabled_for_lmstudio'],
        expectedProvider: 'lmstudio'
      }
    },
    {
      name: 'Qwen Temperature Clamping',
      description: 'Qwen provider with temperature adjustment',
      input: {
        model: 'qwen-max',
        messages: [
          { role: 'user', content: 'Be very creative in your response' }
        ],
        temperature: 2.5 // Should be clamped to 2.0
      },
      context: {
        requestId: 'validation-req-004',
        pipelineId: 'qwen-max-key0'
      },
      expectedResults: {
        shouldSucceed: true,
        expectedAdjustments: ['temperature_clamped_to_qwen_limit'],
        expectedProvider: 'qwen'
      }
    },
    {
      name: 'ModelScope Model Mapping',
      description: 'ModelScope provider with model name mapping',
      input: {
        model: 'qwen2-72b-instruct',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: '请解释量子计算的基本原理' }
        ],
        max_tokens: 4000,
        temperature: 1.0
      },
      context: {
        requestId: 'validation-req-005',
        pipelineId: 'modelscope-qwen2-72b-instruct-key0',
        metadata: {
          priority: 'high'
        }
      },
      expectedResults: {
        shouldSucceed: true,
        expectedProvider: 'modelscope'
      }
    }
  ];
}

async function runValidationScenario(
  validator: PipelineFlowValidator,
  scenario: ValidationScenario
): Promise<{ scenario: string; success: boolean; details: any }> {
  
  ValidationLogger.info('🧪 Running validation scenario', {
    scenarioName: scenario.name,
    description: scenario.description
  });

  try {
    const result = await validator.validateCompleteFlow(scenario.input, scenario.context);
    
    const success = result.success === scenario.expectedResults.shouldSucceed;
    
    if (success) {
      ValidationLogger.info('✅ Validation scenario passed', {
        scenarioName: scenario.name,
        processingTime: result.processingTime,
        stagesCompleted: Object.keys(result.stageResults).length
      });
    } else {
      ValidationLogger.error('❌ Validation scenario failed', {
        scenarioName: scenario.name,
        expected: scenario.expectedResults.shouldSucceed,
        actual: result.success,
        errors: result.errors
      });
    }

    return {
      scenario: scenario.name,
      success,
      details: {
        expected: scenario.expectedResults,
        actual: {
          success: result.success,
          processingTime: result.processingTime,
          errors: result.errors,
          warnings: result.warnings,
          stageResults: result.stageResults
        }
      }
    };

  } catch (error) {
    ValidationLogger.error('💥 Validation scenario exception', {
      scenarioName: scenario.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      scenario: scenario.name,
      success: false,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        expected: scenario.expectedResults
      }
    };
  }
}

async function main(): Promise<void> {
  ValidationLogger.info('🚀 Starting Pipeline Flow Validation');

  try {
    // 加载配置
    const config = await loadConfiguration();
    ValidationLogger.info('📋 Configuration loaded', {
      providerCount: config.providers?.length || 0
    });

    // 创建验证器
    const validator = new PipelineFlowValidator(config);

    // 创建验证场景
    const scenarios = createValidationScenarios();
    ValidationLogger.info('📝 Validation scenarios created', {
      scenarioCount: scenarios.length
    });

    // 运行所有验证场景
    const results: Array<{ scenario: string; success: boolean; details: any }> = [];
    
    for (const scenario of scenarios) {
      const result = await runValidationScenario(validator, scenario);
      results.push(result);
    }

    // 生成报告
    const totalScenarios = results.length;
    const passedScenarios = results.filter(r => r.success).length;
    const failedScenarios = totalScenarios - passedScenarios;

    ValidationLogger.info('📊 Validation Report Summary', {
      totalScenarios,
      passedScenarios,
      failedScenarios,
      successRate: `${((passedScenarios / totalScenarios) * 100).toFixed(1)}%`
    });

    // 详细结果
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      ValidationLogger.info(`${status} Scenario ${index + 1}: ${result.scenario}`, {
        success: result.success,
        details: result.details
      });
    });

    if (failedScenarios === 0) {
      ValidationLogger.info('🎉 All pipeline flow validation scenarios passed!');
      process.exit(0);
    } else {
      ValidationLogger.error('💥 Some pipeline flow validation scenarios failed');
      process.exit(1);
    }

  } catch (error) {
    ValidationLogger.error('❌ Pipeline flow validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    process.exit(1);
  }
}

// 运行验证
if (require.main === module) {
  main().catch((error) => {
    console.error('Pipeline flow validation error:', error);
    process.exit(1);
  });
}