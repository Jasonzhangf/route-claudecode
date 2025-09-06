/**
 * 复杂场景转换测试用例
 * 测试复杂的多轮对话、工具调用和内容格式转换
 */
import { transformAnthropicToOpenAI } from '../modules/pipeline-modules/transformers/anthropic-openai-converter';

describe('Complex Scenarios Tests', () => {

    test('should handle complex multi-turn conversation with tools', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            system: "You are a helpful assistant with access to weather and calendar tools.",
            messages: [
                {
                    role: "user",
                    content: "What's the weather like in San Francisco today?"
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
                },
                {
                    role: "assistant",
                    content: "The weather in San Francisco today is sunny with a temperature of 72°F."
                },
                {
                    role: "user",
                    content: "What about tomorrow?"
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
                            },
                            date: {
                                type: "string",
                                description: "The date for which to get weather information"
                            }
                        },
                        required: ["location"]
                    }
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        // Verify the overall structure
        expect(openaiRequest.model).toBe(anthropicRequest.model);
        expect(openaiRequest.tools).toBeDefined();
        expect(openaiRequest.tools.length).toBe(1);
        
        // Verify system message conversion
        expect(openaiRequest.messages[0].role).toBe('system');
        expect(openaiRequest.messages[0].content).toBe(anthropicRequest.system);
        
        // Verify user message
        expect(openaiRequest.messages[1].role).toBe('user');
        expect(openaiRequest.messages[1].content).toBe(anthropicRequest.messages[0].content);
        
        // Verify tool use conversion
        expect(openaiRequest.messages[2].role).toBe('assistant');
        expect(openaiRequest.messages[2].tool_calls).toBeDefined();
        const toolUse = anthropicRequest.messages[1].content[0] as any;
        expect(openaiRequest.messages[2].tool_calls[0].id).toBe(toolUse.id);
        expect(openaiRequest.messages[2].tool_calls[0].type).toBe('function');
        expect(openaiRequest.messages[2].tool_calls[0].function.name).toBe(toolUse.name);
        
        // Verify tool result conversion
        expect(openaiRequest.messages[3].role).toBe('tool');
        const toolResult = anthropicRequest.messages[2].content[0] as any;
        expect(openaiRequest.messages[3].tool_call_id).toBe(toolResult.tool_use_id);
        expect(openaiRequest.messages[3].content).toBe(toolResult.content);
        
        // Verify assistant response
        expect(openaiRequest.messages[4].role).toBe('assistant');
        expect(openaiRequest.messages[4].content).toBe(anthropicRequest.messages[3].content);
        
        // Verify follow-up user message
        expect(openaiRequest.messages[5].role).toBe('user');
        expect(openaiRequest.messages[5].content).toBe(anthropicRequest.messages[4].content);
    });

    test('should handle empty content arrays correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello"
                },
                {
                    role: "assistant",
                    content: [] // Empty content array
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages[0].role).toBe('user');
        expect(openaiRequest.messages[0].content).toBe('Hello');
        expect(openaiRequest.messages[1].role).toBe('assistant');
        expect(openaiRequest.messages[1].content).toBe('');
    });

    test('should handle mixed content types in messages', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "What do you see in this image?"
                        },
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: "image/jpeg",
                                data: "/9j/4AAQSkZJRgABAQEASABIAAD/..."
                            }
                        }
                    ]
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages[0].role).toBe('user');
        // For complex content types, we might need to verify the structure differently
        expect(openaiRequest.messages[0].content).toBeDefined();
    });

    test('should handle deeply nested tool calls', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            system: "You are a helpful assistant with access to multiple tools.",
            messages: [
                {
                    role: "user",
                    content: "I need to plan a trip to Paris."
                },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "tool_use",
                            id: "toolu_01A09q90qw90lq91781qw9lq",
                            name: "get_weather",
                            input: {
                                location: "Paris, France"
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
                            content: "The weather in Paris is 65°F and partly cloudy."
                        }
                    ]
                },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "tool_use",
                            id: "toolu_02B10r01rx01mr02892rx0mr",
                            name: "get_flight_info",
                            input: {
                                origin: "New York",
                                destination: "Paris",
                                date: "2023-07-15"
                            }
                        }
                    ]
                }
            ],
            tools: [
                {
                    name: "get_weather",
                    description: "Get weather information",
                    input_schema: {
                        type: "object",
                        properties: {
                            location: { type: "string" }
                        }
                    }
                },
                {
                    name: "get_flight_info",
                    description: "Get flight information",
                    input_schema: {
                        type: "object",
                        properties: {
                            origin: { type: "string" },
                            destination: { type: "string" },
                            date: { type: "string" }
                        }
                    }
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        // Verify multiple tool calls are handled correctly
        expect(openaiRequest.tools.length).toBe(2);
        
        // Verify first tool call
        expect(openaiRequest.messages[2].tool_calls[0].id).toBe("toolu_01A09q90qw90lq91781qw9lq");
        expect(openaiRequest.messages[2].tool_calls[0].function.name).toBe("get_weather");
        
        // Verify first tool result
        expect(openaiRequest.messages[3].role).toBe('tool');
        expect(openaiRequest.messages[3].tool_call_id).toBe("toolu_01A09q90qw90lq91781qw9lq");
        
        // Verify second tool call
        expect(openaiRequest.messages[4].tool_calls[0].id).toBe("toolu_02B10r01rx01mr02892rx0mr");
        expect(openaiRequest.messages[4].tool_calls[0].function.name).toBe("get_flight_info");
    });

    test('should preserve all parameters in complex scenarios', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Generate a creative story"
                }
            ],
            system: "You are a creative writer.",
            max_tokens: 2000,
            temperature: 0.9,
            top_p: 0.95,
            top_k: 50,
            stop_sequences: ["\n\nHuman:", "\n\nAssistant:"],
            stream: false
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.max_tokens).toBe(2000);
        expect(openaiRequest.temperature).toBe(0.9);
        expect(openaiRequest.top_p).toBe(0.95);
        expect(openaiRequest.top_k).toBe(50);
        expect(openaiRequest.stream).toBe(false);
        expect(openaiRequest.stop).toBeDefined();
        expect(Array.isArray(openaiRequest.stop)).toBe(true);
        expect(openaiRequest.stop).toEqual(["\n\nHuman:", "\n\nAssistant:"]);
    });
    
    test('should handle error cases gracefully', () => {
        // Test with invalid tool structure
        const invalidToolRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Test message"
                }
            ],
            tools: [
                {
                    // Missing required name field
                    description: "Invalid tool",
                    input_schema: {}
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(invalidToolRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.tools).toBeDefined();
        expect(Array.isArray(openaiRequest.tools)).toBe(true);
        // Invalid tools should be filtered out
        expect(openaiRequest.tools.length).toBe(0);
    });
});