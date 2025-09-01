/**
 * Claude Code请求模拟器单元测试
 *
 * 提供完整的Claude Code请求模拟能力，满足验收标准1：
 * Claude Code输入的所有request可以通过标准的单元测试模拟
 *
 * @author RCC Client Module
 * @version 4.0.0
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ClientInputValidator, InputValidationError } from '../validation/input-validator';
import { ClientOutputValidator, OutputValidationError } from '../validation/output-validator';
import { PortBasedDebugRecorder } from '../debug/port-based-recorder';
import { ErrorHandler } from '../../middleware/error-handler';
import { DebugManagerImpl } from '../../debug/debug-manager';
import { ClaudeCodeRequest, ClaudeCodeResponse } from '../schemas/claude-code-schemas';
import { JQJsonHandler } from '../../utils/jq-json-handler';

/**
 * Claude Code请求模拟器
 */
class ClaudeCodeRequestSimulator {
  private inputValidator: ClientInputValidator;
  private outputValidator: ClientOutputValidator;
  private debugRecorder: PortBasedDebugRecorder;
  private errorHandler: ErrorHandler;
  private debugManager: DebugManagerImpl;

  constructor() {
    this.errorHandler = new ErrorHandler();
    this.debugManager = new DebugManagerImpl();
    this.inputValidator = new ClientInputValidator(this.errorHandler, this.debugManager);
    this.outputValidator = new ClientOutputValidator(this.errorHandler, this.debugManager);
    this.debugRecorder = new PortBasedDebugRecorder('./test-debug-logs');
  }

  /**
   * 模拟完整的Claude Code请求处理流程
   */
  async simulateRequest(
    request: any,
    expectedResponse?: any,
    shouldFail: boolean = false,
    port: number = 5506
  ): Promise<{
    success: boolean;
    validatedInput?: ClaudeCodeRequest;
    validatedOutput?: ClaudeCodeResponse;
    error?: Error;
    processingTime: number;
    debugRecord?: any;
  }> {
    const requestId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // 记录请求开始
      this.debugRecorder.recordRequestStart(port, requestId, request, {
        userAgent: 'ClaudeCodeRequestSimulator/4.0.0',
        clientIP: '127.0.0.1',
        sessionId: 'test_session',
        conversationId: 'test_conversation',
      });

      // 步骤1: 输入验证
      const validatedInput = this.inputValidator.validateClaudeCodeRequest(request, requestId);

      // 步骤2: 模拟处理（如果提供了预期响应）
      let response = expectedResponse;
      if (!response && !shouldFail) {
        response = this.generateMockResponse(validatedInput, requestId);
      }

      // 步骤3: 输出验证（如果有响应）
      let validatedOutput;
      if (response) {
        validatedOutput = this.outputValidator.validateClaudeCodeResponse(response, requestId);
      }

      // 如果设置了shouldFail但没有失败，抛出错误
      if (shouldFail && !response) {
        throw new Error('Simulated processing failure');
      }

      const processingTime = Date.now() - startTime;

      // 记录成功
      this.debugRecorder.recordRequestSuccess(
        port,
        requestId,
        validatedOutput,
        processingTime,
        { success: true, processingTime: processingTime * 0.1 },
        { success: true, processingTime: processingTime * 0.1 }
      );

      return {
        success: true,
        validatedInput,
        validatedOutput,
        processingTime,
        debugRecord: { requestId, port, success: true },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      // 记录失败
      this.debugRecorder.recordRequestFailure(
        port,
        requestId,
        error as Error,
        processingTime,
        { success: false, errors: [(error as Error).message] },
        { success: false, errors: [(error as Error).message] }
      );

      return {
        success: false,
        error: error as Error,
        processingTime,
        debugRecord: { requestId, port, success: false, error: (error as Error).message },
      };
    }
  }

  /**
   * 生成模拟响应
   */
  private generateMockResponse(request: ClaudeCodeRequest, requestId: string): ClaudeCodeResponse {
    return {
      id: `msg_${requestId}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: `This is a mock response for your request with model ${request.model}. Your message was: ${JQJsonHandler.stringifyJson(request.messages[0]?.content || 'No content')}`,
        },
      ],
      model: request.model,
      stop_reason: 'end_turn',
      usage: {
        input_tokens: this.estimateTokens(JQJsonHandler.stringifyJson(request.messages)),
        output_tokens: 50,
      },
    };
  }

  /**
   * 估算token数量（简单模拟）
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * 清理测试资源
   */
  cleanup(): void {
    this.debugRecorder.destroy();
  }
}

describe('Claude Code Request Simulator - 验收标准测试', () => {
  let simulator: ClaudeCodeRequestSimulator;

  beforeEach(() => {
    simulator = new ClaudeCodeRequestSimulator();
  });

  afterEach(() => {
    simulator.cleanup();
  });

  describe('验收标准1: 完整的Claude Code请求模拟能力', () => {
    it('应该能模拟基本的text-only请求', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
      };

      const result = await simulator.simulateRequest(request);

      expect(result.success).toBe(true);
      expect(result.validatedInput).toBeDefined();
      expect(result.validatedOutput).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.debugRecord).toBeDefined();
    });

    it('应该能模拟带system prompt的请求', async () => {
      const request = {
        model: 'claude-3-opus-20240229',
        max_tokens: 2000,
        system: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user',
            content: 'Explain quantum computing',
          },
        ],
        temperature: 0.7,
      };

      const result = await simulator.simulateRequest(request);

      expect(result.success).toBe(true);
      expect(result.validatedInput?.system).toBe('You are a helpful assistant.');
      expect(result.validatedInput?.temperature).toBe(0.7);
    });

    it('应该能模拟多轮对话请求', async () => {
      const request = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'What is the capital of France?',
          },
          {
            role: 'assistant',
            content: 'The capital of France is Paris.',
          },
          {
            role: 'user',
            content: 'What is its population?',
          },
        ],
      };

      const result = await simulator.simulateRequest(request);

      expect(result.success).toBe(true);
      expect(result.validatedInput?.messages).toHaveLength(3);
      expect(result.validatedInput?.messages[1].role).toBe('assistant');
    });

    it('应该能模拟带工具的请求', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: 'What is the weather like in New York?',
          },
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather information',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
                unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
              },
              required: ['location'],
            },
          },
        ],
        tool_choice: {
          type: 'auto',
        },
      };

      const result = await simulator.simulateRequest(request);

      expect(result.success).toBe(true);
      expect(result.validatedInput?.tools).toHaveLength(1);
      expect(result.validatedInput?.tools?.[0].name).toBe('get_weather');
    });

    it('应该能模拟streaming请求', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        stream: true,
        messages: [
          {
            role: 'user',
            content: 'Write a short story',
          },
        ],
      };

      const result = await simulator.simulateRequest(request);

      expect(result.success).toBe(true);
      expect(result.validatedInput?.stream).toBe(true);
    });

    it('应该能模拟带metadata的请求', async () => {
      const request = {
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        metadata: {
          user_id: 'user_123',
          conversation_id: 'conv_456',
        },
      };

      const result = await simulator.simulateRequest(request);

      expect(result.success).toBe(true);
      expect(result.validatedInput?.metadata?.user_id).toBe('user_123');
      expect(result.validatedInput?.metadata?.conversation_id).toBe('conv_456');
    });
  });

  describe('验收标准2: 输入验证错误的详细处理', () => {
    it('应该在输入阶段立即捕获缺失必需字段的错误', async () => {
      const invalidRequest = {
        // 缺少 model 字段
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      };

      const result = await simulator.simulateRequest(invalidRequest, undefined, false);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(InputValidationError);

      const error = result.error as InputValidationError;
      expect(error.module).toBe('client.input.validation');
      expect(error.field).toBe('model');
      expect(error.code).toBe('FIELD_VALIDATION_FAILED');
      expect(error.details).toBeDefined();
    });

    it('应该在输入阶段立即捕获无效字段类型的错误', async () => {
      const invalidRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 'invalid_number', // 应该是数字
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      };

      const result = await simulator.simulateRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(InputValidationError);

      const error = result.error as InputValidationError;
      expect(error.field).toBe('max_tokens');
      expect(error.expected).toContain('number');
      expect(error.actual).toContain('string');
    });

    it('应该在输入阶段立即捕获业务逻辑错误', async () => {
      const invalidRequest = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 8192, // haiku模型不支持超过4096
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      };

      const result = await simulator.simulateRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(InputValidationError);

      const error = result.error as InputValidationError;
      expect(error.code).toBe('MODEL_TOKEN_LIMIT_EXCEEDED');
      expect(error.message).toContain('claude-3-haiku');
    });

    it('应该在输入阶段立即捕获工具定义不一致的错误', async () => {
      const invalidRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather',
            input_schema: { type: 'object', properties: {} },
          },
        ],
        tool_choice: {
          type: 'tool',
          name: 'get_temperature', // 工具不存在
        },
      };

      const result = await simulator.simulateRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(InputValidationError);

      const error = result.error as InputValidationError;
      expect(error.code).toBe('TOOL_NOT_FOUND');
      expect(error.field).toBe('tool_choice.name');
    });

    it('应该在输入阶段立即捕获消息序列错误', async () => {
      const invalidRequest = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
          {
            role: 'user', // 连续的user消息
            content: 'How are you?',
          },
        ],
      };

      const result = await simulator.simulateRequest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(InputValidationError);

      const error = result.error as InputValidationError;
      expect(error.code).toBe('INVALID_MESSAGE_SEQUENCE');
      expect(error.field).toBe('messages[1].role');
    });
  });

  describe('验收标准3: Debug系统按端口保存数据', () => {
    it('应该按端口保存所有请求和响应数据', async () => {
      const port = 5507;
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Test debug recording',
          },
        ],
      };

      const result = await simulator.simulateRequest(request, undefined, false, port);

      expect(result.success).toBe(true);

      // 验证debug记录
      const portStats = simulator['debugRecorder'].getPortStats(port);
      expect(portStats).toBeDefined();
      expect(portStats!.port).toBe(port);
      expect(portStats!.totalRequests).toBeGreaterThan(0);
      expect(portStats!.successfulRequests).toBeGreaterThan(0);

      // 验证记录的数据
      const records = simulator['debugRecorder'].getPortRecords(port, 1);
      expect(records).toHaveLength(1);
      expect(records[0].port).toBe(port);
      expect(records[0].input).toEqual(request);
      expect(records[0].output).toBeDefined();
    });

    it('应该记录失败请求的详细信息', async () => {
      const port = 5508;
      const invalidRequest = {
        model: 'invalid-model',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Test error recording',
          },
        ],
      };

      const result = await simulator.simulateRequest(invalidRequest, undefined, false, port);

      expect(result.success).toBe(false);

      // 验证错误统计
      const portStats = simulator['debugRecorder'].getPortStats(port);
      expect(portStats).toBeDefined();
      expect(portStats!.failedRequests).toBeGreaterThan(0);
      expect(portStats!.inputValidationErrors).toBeGreaterThan(0);

      // 验证错误记录
      const records = simulator['debugRecorder'].getPortRecords(port, 1);
      expect(records).toHaveLength(1);
      expect(records[0].error).toBeDefined();
      expect(records[0].error!.name).toBe('InputValidationError');
    });

    it('应该支持实际数据验证', async () => {
      const port = 5509;
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Test data validation',
          },
        ],
      };

      await simulator.simulateRequest(request, undefined, false, port);

      // 验证记录的数据
      const validationResult = simulator['debugRecorder'].validateRecordedData(port, {
        requireInput: true,
        requireOutput: true,
        maxProcessingTime: 10000,
      });

      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
      expect(validationResult.stats.totalRecords).toBeGreaterThan(0);
      expect(validationResult.stats.validRecords).toBeGreaterThan(0);
      expect(validationResult.stats.invalidRecords).toBe(0);
    });
  });

  describe('验收标准4: 输出字段校验', () => {
    it('应该验证响应输出的完整性', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Test output validation',
          },
        ],
      };

      const validResponse = {
        id: 'msg_test_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'This is a valid response',
          },
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      const result = await simulator.simulateRequest(request, validResponse);

      expect(result.success).toBe(true);
      expect(result.validatedOutput).toBeDefined();
      expect(result.validatedOutput!.id).toBe('msg_test_123');
      expect(result.validatedOutput!.content[0].text).toBe('This is a valid response');
    });

    it('应该拒绝格式错误的输出', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Test invalid output',
          },
        ],
      };

      const invalidResponse = {
        // 缺少 id 字段
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Response without id',
          },
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      const result = await simulator.simulateRequest(request, invalidResponse);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(OutputValidationError);

      const error = result.error as OutputValidationError;
      expect(error.module).toBe('client.output.validation');
      expect(error.field).toBe('id');
    });

    it('应该验证业务逻辑的一致性', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Test business logic validation',
          },
        ],
      };

      const inconsistentResponse = {
        id: 'msg_test_456',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '', // 空文本内容
          },
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      const result = await simulator.simulateRequest(request, inconsistentResponse);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(OutputValidationError);

      const error = result.error as OutputValidationError;
      expect(error.code).toBe('EMPTY_TEXT_CONTENT');
    });

    it('应该验证token统计的合理性', async () => {
      const request = {
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'Test token validation',
          },
        ],
      };

      const negativeTokenResponse = {
        id: 'msg_test_789',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Valid response text',
          },
        ],
        model: 'claude-3-sonnet-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: -5, // 负数token
          output_tokens: 10,
        },
      };

      const result = await simulator.simulateRequest(request, negativeTokenResponse);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(OutputValidationError);

      const error = result.error as OutputValidationError;
      expect(error.code).toBe('NEGATIVE_INPUT_TOKENS');
    });
  });

  describe('综合验收测试', () => {
    it('应该在真实场景下通过所有验收标准', async () => {
      const port = 5510;

      // 测试多个不同类型的请求
      const testCases = [
        {
          name: '简单文本请求',
          request: {
            model: 'claude-3-haiku-20240307',
            max_tokens: 1000,
            messages: [{ role: 'user', content: 'Hello world' }],
          },
          shouldSuccess: true,
        },
        {
          name: '带工具的复杂请求',
          request: {
            model: 'claude-3-sonnet-20240229',
            max_tokens: 2000,
            system: 'You are a helpful assistant.',
            messages: [{ role: 'user', content: 'What is the weather?' }],
            tools: [
              {
                name: 'get_weather',
                description: 'Get weather info',
                input_schema: { type: 'object', properties: {} },
              },
            ],
            tool_choice: { type: 'auto' },
          },
          shouldSuccess: true,
        },
        {
          name: '无效请求',
          request: {
            model: '',
            max_tokens: 0,
            messages: [],
          },
          shouldSuccess: false,
        },
      ];

      const results = [];

      for (const testCase of testCases) {
        const result = await simulator.simulateRequest(testCase.request, undefined, false, port);
        results.push({
          name: testCase.name,
          success: result.success,
          expected: testCase.shouldSuccess,
        });

        expect(result.success).toBe(testCase.shouldSuccess);
      }

      // 验证debug记录
      const portStats = simulator['debugRecorder'].getPortStats(port);
      expect(portStats).toBeDefined();
      expect(portStats!.totalRequests).toBe(testCases.length);
      expect(portStats!.successfulRequests).toBeGreaterThan(0);
      expect(portStats!.failedRequests).toBeGreaterThan(0);

      // 验证数据完整性
      const validationResult = simulator['debugRecorder'].validateRecordedData(port);
      expect(validationResult.valid).toBe(true);
    });
  });
});
