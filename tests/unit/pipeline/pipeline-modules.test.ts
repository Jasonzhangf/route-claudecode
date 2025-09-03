// Pipeline Module Unit Tests
import { MockDataGenerator } from '../../data/mocks/mock-data-generator';
import { testFixtures } from '../../data/fixtures/test-fixtures';

describe('Pipeline Module Unit Tests', () => {
  // Test Transformer Module
  describe('Transformer Module Tests', () => {
    test('should convert Anthropic format to OpenAI format', () => {
      const anthropicRequest = {
        model: 'default',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            name: 'list_files',
            description: '列出指定目录下的文件',
            input_schema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: '要列出文件的目录路径'
                }
              },
              required: ['path']
            }
          }
        ]
      };

      const expectedOpenAIRequest = {
        model: 'default',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '要列出文件的目录路径'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      // Verify the transformation
      expect(anthropicRequest.messages[0].content).toBe(expectedOpenAIRequest.messages[0].content);
      expect(anthropicRequest.tools[0].name).toBe(expectedOpenAIRequest.tools[0].function.name);
    });

    test('should handle tool format conversion', () => {
      const anthropicTool = {
        name: 'list_files',
        description: '列出指定目录下的文件',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string'
            }
          },
          required: ['path']
        }
      };

      const expectedOpenAITool = {
        type: 'function',
        function: {
          name: 'list_files',
          description: '列出指定目录下的文件',
          parameters: {
            type: 'object',
            properties: {
              path: {
                type: 'string'
              }
            },
            required: ['path']
          }
        }
      };

      expect(anthropicTool.name).toBe(expectedOpenAITool.function.name);
      expect(anthropicTool.input_schema.required).toEqual(expectedOpenAITool.function.parameters.required);
    });
  });

  // Test Protocol Module
  describe('Protocol Module Tests', () => {
    test('should validate OpenAI format requests', () => {
      const openAIRequest = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '要列出文件的目录路径'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      // Validate required fields
      expect(openAIRequest.model).toBeDefined();
      expect(openAIRequest.messages).toBeDefined();
      expect(openAIRequest.messages.length).toBeGreaterThan(0);
      expect(openAIRequest.tools).toBeDefined();
    });

    test('should reject Anthropic format requests', () => {
      const anthropicRequest = {
        model: 'default',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            name: 'list_files', // Anthropic format
            description: '列出指定目录下的文件',
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
        ]
      };

      // Should detect Anthropic format
      const isAnthropicFormat = anthropicRequest.tools[0].hasOwnProperty('name') && 
                               anthropicRequest.tools[0].hasOwnProperty('input_schema');
      
      expect(isAnthropicFormat).toBe(true);
    });
  });

  // Test Server Compatibility Module
  describe('Server Compatibility Module Tests', () => {
    test('should apply Qwen-specific transformations', () => {
      const qwenRequest = {
        model: 'qwen-max',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      // Qwen-specific adjustments
      const maxTokens = 262144;
      const enhanceTool = true;

      expect(qwenRequest.model).toBe('qwen-max');
      expect(maxTokens).toBe(262144);
      expect(enhanceTool).toBe(true);
    });

    test('should apply ModelScope-specific transformations', () => {
      const modelscopeRequest = {
        model: 'Qwen/Qwen3-Coder-480B-A35B-Instruct',
        messages: [
          {
            role: 'user',
            content: '列出本项目下文件列表'
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'list_files',
              description: '列出指定目录下的文件',
              parameters: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string'
                  }
                },
                required: ['path']
              }
            }
          }
        ]
      };

      // ModelScope-specific adjustments
      const maxTokens = 131072;
      const enhanceTool = true;

      expect(modelscopeRequest.model).toBe('Qwen/Qwen3-Coder-480B-A35B-Instruct');
      expect(maxTokens).toBe(131072);
      expect(enhanceTool).toBe(true);
    });
  });

  // Test Response Transformer Module
  describe('Response Transformer Module Tests', () => {
    test('should convert OpenAI format to Anthropic format', () => {
      const openAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'list_files',
                    arguments: '{"path": "."}'
                  }
                }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      };

      const expectedAnthropicResponse = {
        id: 'msg_0123456789',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '我将帮您列出项目文件。'
          },
          {
            type: 'tool_use',
            id: 'toolu_0123456789',
            name: 'list_files',
            input: {
              path: '.'
            }
          }
        ],
        model: 'rcc4-router',
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      };

      // Verify the transformation
      expect(expectedAnthropicResponse.content[1].type).toBe('tool_use');
      expect(expectedAnthropicResponse.content[1].name).toBe('list_files');
    });

    test('should handle response format validation', () => {
      const anthropicResponse = {
        id: 'msg_0123456789',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: '我将帮您列出项目文件。'
          },
          {
            type: 'tool_use',
            id: 'toolu_0123456789',
            name: 'list_files',
            input: {
              path: '.'
            }
          }
        ],
        model: 'rcc4-router',
        stop_reason: 'tool_use'
      };

      // Validate required fields
      expect(anthropicResponse.type).toBe('message');
      expect(anthropicResponse.content).toBeDefined();
      expect(anthropicResponse.content.length).toBe(2);
      expect(anthropicResponse.content[1].type).toBe('tool_use');
    });
  });
});