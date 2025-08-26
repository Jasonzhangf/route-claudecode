/**
 * Claude Code工具调用流程测试
 * 基于debug数据进行逻辑解析测试，验证修复后的双向转换流程
 * 
 * 流程验证：
 * 1. Client → Router → Transformer (Anthropic→OpenAI协议转换)
 * 2. Transformer → Server Compatibility (参数调整，无协议转换)
 * 3. Server Compatibility → LM Studio (OpenAI格式)
 * 4. 响应路径：LM Studio → Server Compatibility → Transformer (OpenAI→Anthropic协议转换)
 * 
 * @author RCC v4.0
 */

import * as http from 'http';
import { secureLogger } from '../utils/secure-logger';
import { API_DEFAULTS } from '../constants/api-defaults';
import { DEFAULT_TIMEOUTS, DEFAULT_RETRY_CONFIG } from '../constants/compatibility-constants';
import { TEST_MODEL_NAMES } from '../constants/test-constants';
import { JQJsonHandler } from '../utils/jq-json-handler';

interface ToolCallingTestRequest {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: string;
    content: string;
  }>;
  tools: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: {
        type: string;
        properties: Record<string, any>;
        required: string[];
      };
    };
  }>;
  tool_choice: string;
}

interface ToolCallingTestResponse {
  choices?: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  error?: {
    type: string;
    message: string;
  };
}

/**
 * 工具调用流程测试器
 */
export class ToolCallingFlowTester {
  private readonly testEndpoint: string;
  private readonly testApiKey: string;
  private readonly testPort: number;

  constructor(port?: number, endpoint?: string, apiKey?: string) {
    this.testEndpoint = endpoint || API_DEFAULTS.TEST_ENDPOINTS.LOCALHOST;
    this.testApiKey = apiKey || API_DEFAULTS.TEST_API_KEYS.PROXY_KEY;
    this.testPort = port || API_DEFAULTS.TEST_PORTS.PRIMARY;
  }

  /**
   * 创建标准的Claude Code工具调用请求
   */
  private createToolCallingRequest(model?: string): ToolCallingTestRequest {
    return {
      model: model || TEST_MODEL_NAMES.CLAUDE_SONNET_4,
      max_tokens: API_DEFAULTS.MAX_TOKENS.STANDARD,
      messages: [
        {
          role: 'user',
          content: '请列出当前目录中的文件'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'bash',
            description: 'Execute bash commands',
            parameters: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'The bash command to execute'
                }
              },
              required: ['command']
            }
          }
        }
      ],
      tool_choice: 'auto'
    };
  }

  /**
   * 执行工具调用流程测试
   */
  async executeToolCallingTest(model?: string): Promise<void> {
    secureLogger.info('🧪 开始工具调用流程测试', {
      endpoint: this.testEndpoint,
      port: this.testPort,
      model: model || 'default',
      testType: 'tool_calling_flow'
    });

    try {
      // 1. 创建测试请求
      const testRequest = this.createToolCallingRequest(model);
      
      secureLogger.info('📝 创建工具调用测试请求', {
        model: testRequest.model,
        toolCount: testRequest.tools.length,
        toolNames: testRequest.tools.map(t => t.function.name)
      });

      // 2. 发送请求并分析响应
      const response = await this.sendTestRequest(testRequest);
      
      // 3. 分析流水线处理结果
      this.analyzeResponse(response);

    } catch (error) {
      secureLogger.error('❌ 工具调用流程测试失败', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * 发送测试请求
   */
  private async sendTestRequest(request: ToolCallingTestRequest): Promise<ToolCallingTestResponse> {
    return new Promise((resolve, reject) => {
      const requestData = JQJsonHandler.stringifyJson(request, true);
      
      const options: http.RequestOptions = {
        hostname: 'localhost',
        port: this.testPort,
        path: API_DEFAULTS.ENDPOINTS.MESSAGES,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData),
          'Authorization': `Bearer ${this.testApiKey}`,
          'X-Debug': 'true'
        },
        timeout: DEFAULT_TIMEOUTS.STANDARD
      };

      secureLogger.info('🚀 发送工具调用请求', {
        path: options.path,
        contentLength: Buffer.byteLength(requestData),
        timeout: DEFAULT_TIMEOUTS.STANDARD
      });

      const req = http.request(options, (res) => {
        let responseData = '';
        
        secureLogger.info('📡 接收响应', {
          statusCode: res.statusCode,
          headers: res.headers
        });
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedResponse: ToolCallingTestResponse = JQJsonHandler.parseJsonString(responseData);
            resolve(parsedResponse);
          } catch (error) {
            secureLogger.error('❌ 响应解析失败', {
              error: error.message,
              responseLength: responseData.length,
              responsePreview: responseData.substring(0, 200)
            });
            reject(new Error(`Response parsing failed: ${error.message}`));
          }
        });
      });

      // 设置最大监听器数量，防止内存泄漏警告
      req.setMaxListeners(20);

      req.on('error', (error) => {
        secureLogger.error('❌ 请求错误', {
          error: error.message,
          code: (error as any).code
        });
        reject(error);
      });

      req.on('timeout', () => {
        secureLogger.error('⏰ 请求超时', {
          timeout: DEFAULT_TIMEOUTS.STANDARD
        });
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(requestData);
      req.end();
    });
  }

  /**
   * 分析响应并验证流水线处理
   */
  private analyzeResponse(response: ToolCallingTestResponse): void {
    secureLogger.info('🔍 分析工具调用响应', {
      hasChoices: !!response.choices,
      hasError: !!response.error,
      choiceCount: response.choices?.length || 0
    });

    if (response.error) {
      secureLogger.error('❌ 工具调用失败', {
        errorType: response.error.type,
        errorMessage: response.error.message,
        analysisResult: 'FAILURE'
      });
      
      // 分析失败原因
      this.analyzeFailureReason(response.error);
      return;
    }

    if (response.choices && response.choices.length > 0) {
      const choice = response.choices[0];
      
      secureLogger.info('✅ 工具调用成功', {
        finishReason: choice.finish_reason,
        hasContent: !!choice.message.content,
        hasToolCalls: !!choice.message.tool_calls,
        toolCallCount: choice.message.tool_calls?.length || 0,
        analysisResult: 'SUCCESS'
      });

      // 验证工具调用转换
      if (choice.message.tool_calls) {
        this.validateToolCallConversion(choice.message.tool_calls);
      } else {
        secureLogger.warn('⚠️ 未检测到工具调用', {
          contentLength: choice.message.content?.length || 0,
          finishReason: choice.finish_reason
        });
      }
    } else {
      secureLogger.error('❌ 响应格式异常', {
        responseStructure: Object.keys(response),
        analysisResult: 'INVALID_RESPONSE'
      });
    }
  }

  /**
   * 分析失败原因
   */
  private analyzeFailureReason(error: { type: string; message: string }): void {
    const failureReasons = {
      'Invalid literal value, expected \'function\'': 'Server Compatibility层工具格式转换问题',
      'model_not_found': 'Virtual Model映射问题',
      'timeout': '流水线处理超时',
      'authentication_error': 'API密钥配置问题'
    };

    const knownReason = Object.entries(failureReasons).find(([key]) => 
      error.message.includes(key)
    );

    if (knownReason) {
      secureLogger.info('🔧 失败原因分析', {
        category: knownReason[0],
        diagnosis: knownReason[1],
        recommendedAction: this.getRecommendedAction(knownReason[0])
      });
    } else {
      secureLogger.info('❓ 未知失败原因', {
        errorType: error.type,
        errorMessage: error.message,
        recommendedAction: '需要进一步调试分析'
      });
    }
  }

  /**
   * 验证工具调用转换结果
   */
  private validateToolCallConversion(toolCalls: Array<any>): void {
    secureLogger.info('🔧 验证工具调用转换', {
      toolCallCount: toolCalls.length
    });

    toolCalls.forEach((toolCall, index) => {
      const isValidFormat = toolCall.id && toolCall.type === 'function' && 
                           toolCall.function && toolCall.function.name;
      
      secureLogger.info(`工具调用${index + 1}验证`, {
        toolCallId: toolCall.id,
        functionName: toolCall.function?.name,
        hasArguments: !!toolCall.function?.arguments,
        formatValid: isValidFormat,
        conversionResult: isValidFormat ? 'SUCCESS' : 'FORMAT_ERROR'
      });

      if (isValidFormat) {
        try {
          const args = JQJsonHandler.parseJsonString(toolCall.function.arguments);
          secureLogger.info(`工具调用${index + 1}参数解析`, {
            argumentKeys: Object.keys(args),
            argumentValid: true
          });
        } catch (error) {
          secureLogger.error(`工具调用${index + 1}参数解析失败`, {
            argumentsRaw: toolCall.function.arguments,
            parseError: error.message
          });
        }
      }
    });
  }

  /**
   * 获取推荐的修复行动
   */
  private getRecommendedAction(errorCategory: string): string {
    const actions: Record<string, string> = {
      'Invalid literal value, expected \'function\'': '检查Server Compatibility层的工具格式验证逻辑',
      'model_not_found': '检查Virtual Model映射配置和Pipeline表生成',
      'timeout': '优化流水线处理性能或增加超时时间',
      'authentication_error': '验证API密钥配置和认证逻辑'
    };

    return actions[errorCategory] || '需要详细调试分析';
  }
}

/**
 * 执行工具调用流程测试
 */
export async function runToolCallingFlowTest(
  port?: number, 
  model?: string, 
  endpoint?: string, 
  apiKey?: string
): Promise<void> {
  const tester = new ToolCallingFlowTester(port, endpoint, apiKey);
  await tester.executeToolCallingTest(model);
}

/**
 * ModelScope配置专用测试函数
 */
export async function runModelScopeToolCallingTest(
  configPort?: number,
  customModel?: string
): Promise<void> {
  // 从环境变量或参数获取配置，避免硬编码
  const port = configPort || (process.env.RCC_TEST_PORT ? parseInt(process.env.RCC_TEST_PORT) : API_DEFAULTS.TEST_PORTS.ALTERNATIVE);
  const model = customModel || process.env.RCC_TEST_MODEL || TEST_MODEL_NAMES.CLAUDE_SONNET_4;
  const apiKey = process.env.RCC_TEST_API_KEY || API_DEFAULTS.TEST_API_KEYS.PROXY_KEY;
  
  secureLogger.info('🚀 开始ModelScope Claude工具调用测试', {
    port,
    model,
    provider: 'modelscope',
    configSource: configPort ? 'parameter' : (process.env.RCC_TEST_PORT ? 'environment' : 'default')
  });
  
  await runToolCallingFlowTest(port, model, undefined, apiKey);
}

// 如果直接运行此文件
if (require.main === module) {
  // 检查命令行参数
  const args = process.argv.slice(2);
  const isModelScopeTest = args.includes('--modelscope') || args.includes('--ms');
  
  if (isModelScopeTest) {
    secureLogger.info('📝 运行ModelScope专用测试');
    runModelScopeToolCallingTest().catch((error) => {
      secureLogger.error('ModelScope工具调用测试执行失败', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  } else {
    secureLogger.info('📝 运行默认工具调用测试');
    runToolCallingFlowTest().catch((error) => {
      secureLogger.error('工具调用流程测试执行失败', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  }
}