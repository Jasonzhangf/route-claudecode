/**
 * 工具调用转换测试用例
 * 直接测试Anthropic到OpenAI工具格式转换功能
 */
import { transformAnthropicToOpenAI } from '../modules/pipeline-modules/transformers/anthropic-openai-converter';

describe('Tool Calling Transformer Tests', () => {
    test('should convert Anthropic tools to OpenAI tools format', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "What's the weather like in San Francisco?"
                }
            ],
            tools: [
                {
                    name: "get_weather",
                    description: "Get the current weather for a location",
                    input_schema: {
                        type: "object",
                        properties: {
                            location: {
                                type: "string",
                                description: "The city and state, e.g. San Francisco, CA"
                            }
                        },
                        required: ["location"]
                    }
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.tools).toBeDefined();
        expect(Array.isArray(openaiRequest.tools)).toBe(true);
        expect(openaiRequest.tools.length).toBe(1);
        expect(openaiRequest.tools[0].type).toBe('function');
        expect(openaiRequest.tools[0].function.name).toBe(anthropicRequest.tools[0].name);
        expect(openaiRequest.tools[0].function.description).toBe(anthropicRequest.tools[0].description);
        expect(openaiRequest.tools[0].function.parameters).toEqual(anthropicRequest.tools[0].input_schema);
    });

    test('should handle tool use in messages correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "What's the weather like in San Francisco?"
                },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "tool_use",
                            id: "toolu_01A09q90qw90lq91781qw9lq",
                            name: "get_weather",
                            input: {
                                location: "San Francisco, CA"
                            }
                        }
                    ]
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.messages).toBeDefined();
        expect(Array.isArray(openaiRequest.messages)).toBe(true);
        expect(openaiRequest.messages.length).toBe(2);
        expect(openaiRequest.messages[1].tool_calls).toBeDefined();
        expect(Array.isArray(openaiRequest.messages[1].tool_calls)).toBe(true);
        expect(openaiRequest.messages[1].tool_calls.length).toBe(1);
        expect(openaiRequest.messages[1].tool_calls[0].id).toBe(anthropicRequest.messages[1].content[0].id);
        expect(openaiRequest.messages[1].tool_calls[0].type).toBe('function');
        expect(openaiRequest.messages[1].tool_calls[0].function.name).toBe(anthropicRequest.messages[1].content[0].name);
        expect(openaiRequest.messages[1].tool_calls[0].function.arguments).toBe(JSON.stringify(anthropicRequest.messages[1].content[0].input));
    });

    test('should handle tool results correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "What's the weather like in San Francisco?"
                },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "tool_use",
                            id: "toolu_01A09q90qw90lq91781qw9lq",
                            name: "get_weather",
                            input: {
                                location: "San Francisco, CA"
                            }
                        }
                    ]
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "tool_result",
                            tool_use_id: "toolu_01A09q90qw90lq91781qw9lq",
                            content: "The weather in San Francisco is sunny with a temperature of 72°F."
                        }
                    ]
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.messages).toBeDefined();
        expect(Array.isArray(openaiRequest.messages)).toBe(true);
        expect(openaiRequest.messages.length).toBe(3);
        
        // Check that the tool result is properly converted
        const toolResultMessage = openaiRequest.messages[2];
        expect(toolResultMessage.role).toBe('user');
        expect(typeof toolResultMessage.content).toBe('string');
        expect(toolResultMessage.content).toContain('[Tool Result for toolu_01A09q90qw90lq91781qw9lq]');
        expect(toolResultMessage.content).toContain('The weather in San Francisco is sunny with a temperature of 72°F.');
    });

    test('should handle multiple tools correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Get weather and time for San Francisco"
                }
            ],
            tools: [
                {
                    name: "get_weather",
                    description: "Get the current weather for a location",
                    input_schema: {
                        type: "object",
                        properties: {
                            location: { type: "string" }
                        },
                        required: ["location"]
                    }
                },
                {
                    name: "get_time",
                    description: "Get the current time for a location",
                    input_schema: {
                        type: "object",
                        properties: {
                            location: { type: "string" }
                        },
                        required: ["location"]
                    }
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.tools).toBeDefined();
        expect(Array.isArray(openaiRequest.tools)).toBe(true);
        expect(openaiRequest.tools.length).toBe(2);
        
        expect(openaiRequest.tools[0].type).toBe('function');
        expect(openaiRequest.tools[0].function.name).toBe('get_weather');
        
        expect(openaiRequest.tools[1].type).toBe('function');
        expect(openaiRequest.tools[1].function.name).toBe('get_time');
    });
});