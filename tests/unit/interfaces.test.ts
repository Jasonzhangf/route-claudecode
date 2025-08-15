/**
 * RCC v4.0 核心接口测试
 * 
 * 验证核心接口的基础功能和类型正确性
 * 
 * @author Jason Zhang
 */

import {
  StandardRequestBuilder,
  StandardResponseBuilder,
  MessageBuilder,
  ToolBuilder,
  ModuleInterface,
  BaseModule,
  ModuleType
} from '../../src/interfaces';

describe('RCC v4.0 Core Interfaces', () => {
  describe('StandardRequest Builder', () => {
    it('should create valid standard request', () => {
      const message = new MessageBuilder('user').setText('Hello, world!').build();
      const request = new StandardRequestBuilder('test-req-001', 'test-model')
        .setMessages([message])
        .setTemperature(0.7)
        .setMaxTokens(1000)
        .setStream(false)
        .build();

      expect(request.id).toBe('test-req-001');
      expect(request.model).toBe('test-model');
      expect(request.temperature).toBe(0.7);
      expect(request.maxTokens).toBe(1000);
      expect(request.stream).toBe(false);
      expect(request.metadata).toBeDefined();
      expect(request.timestamp).toBeInstanceOf(Date);
    });

    it('should create request with messages', () => {
      const message = new MessageBuilder('user')
        .setText('Test message')
        .build();

      const request = new StandardRequestBuilder('test-req-002', 'test-model')
        .setMessages([message])
        .build();

      expect(request.messages).toHaveLength(1);
      expect(request.messages[0]?.role).toBe('user');
      expect(request.messages[0]?.content).toBe('Test message');
    });

    it('should create request with tools', () => {
      const tool = new ToolBuilder()
        .setName('test_function')
        .setDescription('A test function')
        .addParameter('param1', { type: 'string', description: 'Test parameter' }, true)
        .build();

      const message = new MessageBuilder('user').setText('Test with tools').build();
      const request = new StandardRequestBuilder('test-req-003', 'test-model')
        .setMessages([message])
        .setTools([tool])
        .build();

      expect(request.tools).toHaveLength(1);
      expect(request.tools?.[0]?.function.name).toBe('test_function');
      expect(request.tools?.[0]?.function.description).toBe('A test function');
    });
  });

  describe('StandardResponse Builder', () => {
    it('should create valid standard response', () => {
      const response = new StandardResponseBuilder('test-resp-001')
        .setModel('test-model')
        .setUsage({
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30
        })
        .addChoice({
          index: 0,
          message: {
            role: 'assistant',
            content: 'Test response'
          },
          finishReason: 'stop'
        })
        .build();

      expect(response.id).toBe('test-resp-001');
      expect(response.model).toBe('test-model');
      expect(response.usage?.totalTokens).toBe(30);
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0]?.message.content).toBe('Test response');
    });
  });

  describe('Message Builder', () => {
    it('should create text message', () => {
      const message = new MessageBuilder('user')
        .setText('Hello, world!')
        .setName('TestUser')
        .addTag('test')
        .build();

      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.name).toBe('TestUser');
      expect(message.metadata?.tags).toContain('test');
    });

    it('should create message with content blocks', () => {
      const message = new MessageBuilder('assistant')
        .addTextBlock('Here is the result:')
        .addToolUseBlock('tool-1', 'calculate', { x: 5, y: 3 })
        .build();

      expect(Array.isArray(message.content)).toBe(true);
      const content = message.content as any[];
      expect(content).toHaveLength(2);
      expect(content[0].type).toBe('text');
      expect(content[1].type).toBe('tool_use');
    });
  });

  describe('Tool Builder', () => {
    it('should create valid tool definition', () => {
      const tool = new ToolBuilder()
        .setName('calculate')
        .setDescription('Performs mathematical calculations')
        .addParameter('operation', {
          type: 'string',
          enum: ['add', 'subtract', 'multiply', 'divide'],
          description: 'The operation to perform'
        }, true)
        .addParameter('x', {
          type: 'number',
          description: 'First operand'
        }, true)
        .addParameter('y', {
          type: 'number',
          description: 'Second operand'
        }, true)
        .setRiskLevel('low')
        .addTag('math')
        .build();

      expect(tool.type).toBe('function');
      expect(tool.function.name).toBe('calculate');
      expect(tool.function.description).toBe('Performs mathematical calculations');
      expect(tool.function.parameters.required).toContain('operation');
      expect(tool.function.parameters.required).toContain('x');
      expect(tool.function.parameters.required).toContain('y');
      expect(tool.metadata?.riskLevel).toBe('low');
      expect(tool.metadata?.tags).toContain('math');
    });
  });

  describe('Base Module', () => {
    class TestModule extends BaseModule {
      public readonly id = 'test-module';
      public readonly name = 'Test Module';
      public readonly version = '1.0.0';
      public readonly type: ModuleType = 'preprocessor';
      public readonly interfaces = {
        input: { type: 'any', schema: {}, description: 'Any input' },
        output: { type: 'any', schema: {}, description: 'Processed output' }
      };

      public async process(input: any): Promise<any> {
        const startTime = Date.now();
        const result = { ...input, processed: true };
        const processingTime = Date.now() - startTime;
        this.updateMetrics(processingTime);
        return result;
      }

      public async validate(input: any): Promise<any> {
        return { valid: true, errors: [] };
      }
    }

    it('should create and use base module', async () => {
      const module = new TestModule();
      
      expect(module.id).toBe('test-module');
      expect(module.name).toBe('Test Module');
      expect(module.version).toBe('1.0.0');
      expect(module.type).toBe('preprocessor');

      const input = { data: 'test' };
      const result = await module.process(input);
      
      expect(result.data).toBe('test');
      expect(result.processed).toBe(true);

      const metrics = module.getMetrics();
      expect(metrics.processedRequests).toBe(1);
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should validate input correctly', async () => {
      const module = new TestModule();
      const validation = await module.validate({ test: 'data' });
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});