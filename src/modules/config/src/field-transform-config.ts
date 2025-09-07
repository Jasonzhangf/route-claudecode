/**
 * 字段转换配置表 - RCC v4.0
 * 
 * 定义Transformer层和ServerCompatibility层的字段转换规则
 * 支持基于配置的字段映射和转换，避免硬编码逻辑
 * 
 * @author RCC v4.0 - Hybrid Mode Architecture
 */

import { FieldTransformRule, FieldTransformationConfig } from './routing-table-types';
import { 
  PROVIDER_MODEL_MAPPINGS 
} from '../../constants/src/bootstrap-constants';

/**
 * 从环境变量获取Provider特定配置
 */
const getProviderConfig = (provider: string) => {
  return {
    name: provider,
    supportsOpenAIPassthrough: process.env[`${provider.toUpperCase()}_SUPPORTS_OPENAI`] === 'true',
    defaultTopP: Number(process.env[`${provider.toUpperCase()}_DEFAULT_TOP_P`]) || 1.0,
    defaultTemperature: Number(process.env[`${provider.toUpperCase()}_DEFAULT_TEMP`]) || 0.7,
    maxTokens: Number(process.env[`${provider.toUpperCase()}_MAX_TOKENS`]) || 4096
  };
};

/**
 * Transformer层字段转换配置表
 * 
 * 处理Anthropic到OpenAI格式的转换
 */
export const TRANSFORMER_FIELD_CONFIGS: Record<string, FieldTransformRule[]> = {
  // 基础字段转换
  basicFields: [
    {
      source: 'model',
      target: 'model',
      transform: (value: any) => value,
      required: true,
      description: '模型名称转换'
    },
    {
      source: 'temperature',
      target: 'temperature',
      transform: (value: any) => {
        const num = Number(value);
        return isNaN(num) ? 0.7 : Math.min(Math.max(num, 0), 2);
      },
      defaultValue: 0.7,
      description: '温度参数转换 (0-2范围)'
    },
    {
      source: 'max_tokens',
      target: 'max_tokens',
      transform: (value: any) => {
        const num = Number(value);
        return isNaN(num) ? 4096 : Math.min(Math.max(num, 1), 32768);
      },
      defaultValue: 4096,
      description: '最大token数转换'
    }
  ],

  // 消息字段转换
  messageFields: [
    {
      source: 'system',
      target: 'messages[0]', // 系统消息插入到messages数组开头
      transform: (system: string, context: any) => {
        if (!system) return context.messages || [];
        
        // 确保context.messages存在且是数组
        const existingMessages = Array.isArray(context.messages) ? context.messages : [];
        
        return [
          { role: 'system', content: system },
          ...existingMessages
        ];
      },
      description: '系统消息转换为OpenAI格式 (增强鲁棒性)'
    },
    {
      source: 'messages',
      target: 'messages',
      transform: (messages: any[]) => {
        if (!Array.isArray(messages)) return [];
        
        // 使用复杂的Anthropic消息转换函数
        const transformFunctions = require('./transform-functions').TransformFunctions;
        return transformFunctions.anthropicMessagesToOpenAI(messages, {});
      },
      description: '复杂消息格式转换 (支持content数组结构)'
    }
  ],

  // 工具字段转换
  toolFields: [
    {
      source: 'tools',
      target: 'tools',
      transform: (tools: any[]) => {
        if (!Array.isArray(tools)) return [];
        return tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema || tool.parameters
          }
        }));
      },
      description: '工具定义格式转换 (Anthropic → OpenAI)'
    },
    {
      source: 'tool_choice',
      target: 'tool_choice',
      transform: (toolChoice: any) => {
        // 使用完善的工具选择转换函数
        const transformFunctions = require('./transform-functions').TransformFunctions;
        return transformFunctions.toolChoiceTransform(toolChoice);
      },
      defaultValue: 'auto',
      description: '工具选择转换 (Anthropic -> OpenAI)'
    }
  ],

  // 扩展参数转换 (Transformer层缺失的字段)
  extendedParameters: [
    {
      source: 'thinking',
      target: 'reasoning',
      transform: (value: any) => {
        // 使用Thinking/Reasoning转换函数
        const transformFunctions = require('./transform-functions').TransformFunctions;
        return transformFunctions.thinkingToReasoning(value);
      },
      description: 'Thinking字段转换为Reasoning格式'
    },
    {
      source: 'top_p',
      target: 'top_p',
      transform: (value: any) => {
        const num = Number(value);
        return isNaN(num) ? 1.0 : Math.min(Math.max(num, 0), 1);
      },
      defaultValue: 1.0,
      description: 'Top-P采样参数转换'
    },
    {
      source: 'top_k',
      target: 'top_k',
      transform: (value: any) => {
        const num = Number(value);
        return isNaN(num) ? undefined : Math.min(Math.max(num, 1), 100);
      },
      description: 'Top-K采样参数转换'
    },
    {
      source: 'stop_sequences',
      target: 'stop',
      transform: (value: any) => {
        // 使用停止序列转换函数
        const transformFunctions = require('./transform-functions').TransformFunctions;
        return transformFunctions.stopSequencesToStop(value);
      },
      defaultValue: [],
      description: '停止序列转换 (stop_sequences -> stop)'
    },
    {
      source: 'presence_penalty',
      target: 'presence_penalty',
      transform: (value: any) => {
        const num = Number(value);
        return isNaN(num) ? 0 : Math.min(Math.max(num, -2), 2);
      },
      defaultValue: 0,
      description: '存在惩罚转换'
    },
    {
      source: 'frequency_penalty',
      target: 'frequency_penalty',
      transform: (value: any) => {
        const num = Number(value);
        return isNaN(num) ? 0 : Math.min(Math.max(num, -2), 2);
      },
      defaultValue: 0,
      description: '频率惩罚转换'
    },
    {
      source: 'logit_bias',
      target: 'logit_bias',
      transform: (value: any) => value || {},
      description: 'Logit偏差转换'
    },
    {
      source: 'user',
      target: 'user',
      transform: (value: any) => String(value || ''),
      description: '用户标识转换'
    },
    {
      source: 'seed',
      target: 'seed',
      transform: (value: any) => {
        const num = Number(value);
        return isNaN(num) ? undefined : Math.floor(num);
      },
      description: '随机种子转换'
    }
  ]
};

/**
 * ServerCompatibility层字段转换配置表
 * 
 * 处理Provider特定的兼容性调整
 */
export const COMPATIBILITY_FIELD_CONFIGS: Record<string, any> = {
  // 通用兼容性规则
  commonRules: {
    parameterNormalization: [
      {
        source: 'temperature',
        target: 'temperature',
        transform: (value: any) => {
          const num = Number(value);
          return isNaN(num) ? 0.7 : Math.min(Math.max(num, 0), 2);
        },
        description: '温度参数标准化'
      },
      {
        source: 'max_tokens',
        target: 'max_tokens',
        transform: (value: any) => {
          const num = Number(value);
          return isNaN(num) ? 4096 : Math.min(Math.max(num, 1), 32768);
        },
        description: '最大token数标准化'
      }
    ],
    
    errorHandling: {
      standardizeErrors: true,
      errorMapping: process.env.ERROR_MAPPING ? JSON.parse(process.env.ERROR_MAPPING) : {
        'quota_exceeded': 'rate_limit_exceeded',
        'invalid_api_key': 'authentication_error',
        'model_not_found': 'invalid_request_error'
      }
    }
  },

  // 各Provider特定配置
  providers: {
    // 通用Provider配置模板
    genericProvider: (providerName: string) => {
      const config = getProviderConfig(providerName);
      
      return {
        provider: providerName,
        supportsOpenAIPassthrough: config.supportsOpenAIPassthrough,
        requestTransforms: [
          // Provider特定参数增强
          {
            source: 'top_p',
            target: 'top_p',
            transform: (value: any) => {
              const num = Number(value);
              const defaultValue = config.defaultTopP;
              return isNaN(num) ? defaultValue : Math.min(Math.max(num, 0), 1);
            },
            description: `${providerName}推荐Top-P值`
          },
          {
            source: 'presence_penalty',
            target: 'presence_penalty',
            transform: (value: any) => {
              const num = Number(value);
              return isNaN(num) ? 0 : Math.min(Math.max(num, -2), 2);
            },
            description: '存在惩罚参数'
          },
          {
            source: 'frequency_penalty',
            target: 'frequency_penalty',
            transform: (value: any) => {
              const num = Number(value);
              return isNaN(num) ? 0 : Math.min(Math.max(num, -2), 2);
            },
            description: '频率惩罚参数'
          }
        ],
        responseTransforms: [
          // Provider响应格式标准化
          {
            source: 'choices[0].finish_reason',
            target: 'choices[0].finish_reason',
            transform: (reason: string) => {
              // 标准化完成原因
              const mapping: Record<string, string> = {
                'stop': 'stop',
                'length': 'length',
                'tool_calls': 'tool_calls',
                'content_filter': 'content_filter'
              };
              return mapping[reason] || reason;
            },
            description: '完成原因标准化'
          }
        ],
        specialHandling: {
          tools: {
            inputFormat: 'openai',
            outputFormat: 'openai'
          },
          streaming: {
            supported: true,
            responseConversion: false
          },
          auth: {
            type: 'bearer',
            tokenSource: 'apiKey'
          }
        }
      };
    }
  }
};

/**
 * 完整的字段转换配置
 */
export const FIELD_TRANSFORMATION_CONFIG: FieldTransformationConfig = {
  transformer: {
    anthropicToOpenAI: [
      ...TRANSFORMER_FIELD_CONFIGS.basicFields,
      ...TRANSFORMER_FIELD_CONFIGS.messageFields,
      ...TRANSFORMER_FIELD_CONFIGS.toolFields,
      ...TRANSFORMER_FIELD_CONFIGS.extendedParameters
    ],
    formatDetection: {
      openAIIndicators: ['model', 'messages', 'temperature', 'max_tokens'],
      anthropicIndicators: ['system', 'tools', 'tool_choice']
    }
  },
  serverCompatibility: {
    providers: {}, // 动态生成Provider配置
    commonRules: COMPATIBILITY_FIELD_CONFIGS.commonRules
  }
};

// 动态生成Provider配置
export const generateProviderConfigs = (providerNames: string[]) => {
  const providers: Record<string, any> = {};
  
  providerNames.forEach(provider => {
    providers[provider] = COMPATIBILITY_FIELD_CONFIGS.providers.genericProvider(provider);
  });
  
  return providers;
};

export default {
  TRANSFORMER_FIELD_CONFIGS,
  COMPATIBILITY_FIELD_CONFIGS,
  FIELD_TRANSFORMATION_CONFIG,
  generateProviderConfigs
};