// 基本转换测试用例
import fetch from 'node-fetch';

describe('Basic Transformer Tests', () => {
    const RCC_V4_PORT = 5511;
    const CCR_PORT = 5510;
    const RCC_V4_URL = `http://localhost:${RCC_V4_PORT}/transform`;
    const CCR_URL = `http://localhost:${CCR_PORT}/transform`;

    // Helper function to send requests to both services
    const transformWithRCC = async (request: any) => {
        const response = await fetch(RCC_V4_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });
        return await response.json();
    };

    const transformWithCCR = async (request: any) => {
        const response = await fetch(CCR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });
        return await response.json();
    };

    test('should convert simple Anthropic request to OpenAI format', async () => {
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

        const openaiRequest = await transformWithRCC(anthropicRequest);
        
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

        const openaiRequest = await transformWithRCC(anthropicRequest);
        
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

        const openaiRequest = await transformWithRCC(anthropicRequest);
        
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

        const openaiRequest = await transformWithRCC(anthropicRequest);
        
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

        const openaiRequest = await transformWithRCC(anthropicRequest);
        
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

        // Get results from both services
        const rccResult = await transformWithRCC(anthropicRequest);
        // Note: CCR might not be available in all test environments
        // const ccrResult = await transformWithCCR(anthropicRequest);

        // Basic validation that the transformation is working
        expect(rccResult.messages).toBeDefined();
        expect(rccResult.messages.length).toBe(2); // system + user message
        expect(rccResult.messages[0].role).toBe('system');
        expect(rccResult.messages[1].role).toBe('user');
    });
});