/**
 * 流式协议测试用例
 * 测试流式请求的格式转换功能
 */
import { transformAnthropicToOpenAI } from '../modules/pipeline-modules/transformers/anthropic-openai-converter';

describe('Streaming Protocol Tests', () => {

    test('should handle streaming requests correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Tell me a story"
                }
            ],
            stream: true
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.stream).toBe(true);
        expect(openaiRequest.model).toBe(anthropicRequest.model);
        expect(openaiRequest.messages).toEqual(anthropicRequest.messages);
    });

    test('should handle non-streaming requests correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "What is 2+2?"
                }
            ],
            stream: false
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.stream).toBe(false);
        expect(openaiRequest.model).toBe(anthropicRequest.model);
        expect(openaiRequest.messages).toEqual(anthropicRequest.messages);
    });

    test('should default to non-streaming when stream parameter is not specified', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello"
                }
            ]
            // No stream parameter specified
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.stream === false || openaiRequest.stream === undefined).toBe(true);
    });

    test('should handle streaming with tools correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "What's the weather like?"
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
                }
            ],
            stream: true
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.stream).toBe(true);
        expect(openaiRequest.tools).toBeDefined();
        expect(Array.isArray(openaiRequest.tools)).toBe(true);
        expect(openaiRequest.tools.length).toBe(1);
        expect(openaiRequest.tools[0].type).toBe('function');
    });

    test('should handle streaming with system messages correctly', () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            system: "You are a helpful assistant that tells stories.",
            messages: [
                {
                    role: "user",
                    content: "Tell me a short story"
                }
            ],
            stream: true
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest).toBeDefined();
        expect(openaiRequest.stream).toBe(true);
        expect(openaiRequest.messages).toBeDefined();
        expect(Array.isArray(openaiRequest.messages)).toBe(true);
        expect(openaiRequest.messages.length).toBe(2);
        expect(openaiRequest.messages[0].role).toBe('system');
        expect(openaiRequest.messages[0].content).toBe(anthropicRequest.system);
        expect(openaiRequest.messages[1].role).toBe('user');
        expect(openaiRequest.system).toBeUndefined();
    });
});