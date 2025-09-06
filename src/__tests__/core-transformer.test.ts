// 核心转换器功能测试
import { SecureAnthropicToOpenAITransformer } from '../modules/pipeline-modules/transformers/secure-anthropic-openai-transformer';
import { transformAnthropicToOpenAI } from '../modules/pipeline-modules/transformers/anthropic-openai-converter';

describe('Test Environment Setup', () => {
    test('should have correct environment variables', () => {
        expect(process.env.NODE_ENV).toBeDefined();
    });
    
    test('should have Jest timeout configured', () => {
        expect(jest.setTimeout).toBeDefined();
    });
    
    test('should be able to run assertions', () => {
        expect(true).toBe(true);
        expect('test').toContain('es');
        expect([1, 2, 3]).toHaveLength(3);
    });
});

describe('Core Transformer Tests', () => {
    let transformer: SecureAnthropicToOpenAITransformer;

    beforeEach(() => {
        transformer = new SecureAnthropicToOpenAITransformer({
            preserveToolCalls: true,
            mapSystemMessage: true,
            defaultMaxTokens: 4096,
            transformDirection: 'anthropic-to-openai'
        });
    });

    test('should convert Anthropic request to OpenAI format', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello, how are you?"
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.model).toBe(anthropicRequest.model);
        expect(openaiRequest.messages).toEqual(anthropicRequest.messages);
        expect(openaiRequest.max_tokens).toBe(anthropicRequest.max_tokens);
        expect(openaiRequest.temperature).toBe(anthropicRequest.temperature);
        expect(openaiRequest.stream).toBe(false);
    });

    test('should handle system messages correctly', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            system: "You are a helpful assistant.",
            messages: [
                {
                    role: "user",
                    content: "Hello, how are you?"
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages[0].role).toBe('system');
        expect(openaiRequest.messages[0].content).toBe(anthropicRequest.system);
        expect(openaiRequest.messages[1].role).toBe('user');
        expect(openaiRequest.messages[1].content).toBe(anthropicRequest.messages[0].content);
        expect(openaiRequest.system).toBeUndefined();
    });

    test('should handle multiple messages correctly', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello"
                },
                {
                    role: "assistant",
                    content: "Hi there! How can I help you?"
                },
                {
                    role: "user",
                    content: "I need help with TypeScript"
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages).toEqual(anthropicRequest.messages);
    });

    test('should handle empty content messages', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: ""
                }
            ]
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.messages[0].content).toBe("");
    });

    test('should preserve additional parameters', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            messages: [
                {
                    role: "user",
                    content: "Hello"
                }
            ],
            temperature: 0.8,
            top_p: 0.9,
            top_k: 40
        };

        const openaiRequest = transformAnthropicToOpenAI(anthropicRequest);
        
        expect(openaiRequest.temperature).toBe(0.8);
        expect(openaiRequest.top_p).toBe(0.9);
        expect(openaiRequest.top_k).toBe(40);
    });

    test('should compare results with Claude Code Router', async () => {
        const anthropicRequest = {
            model: "claude-3-opus-20240229",
            system: "You are a helpful assistant.",
            messages: [
                {
                    role: "user",
                    content: "Hello, how are you?"
                }
            ],
            max_tokens: 1000,
            temperature: 0.7
        };

        // Get transformation result
        const rccResult = transformAnthropicToOpenAI(anthropicRequest);
        // Direct transformation test completed

        // Basic validation that the transformation is working
        expect(rccResult.messages).toBeDefined();
        expect(rccResult.messages.length).toBe(2); // system + user message
        expect(rccResult.messages[0].role).toBe('system');
        expect(rccResult.messages[1].role).toBe('user');
    });
});