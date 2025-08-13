#!/usr/bin/env node
/**
 * OpenAI Layer to Preprocessor Test
 * 测试OpenAI层到preprocessor的请求传递
 * 
 * Project owner: Jason Zhang
 */

import { createOpenAIClient } from './dist/v3/provider-protocol/openai/client-factory.js';

async function testOpenAILayer() {
    console.log('🧪 测试2: OpenAI层到preprocessor传递');
    console.log('====================================');
    
    // Step 1: 检查LM Studio是否运行
    try {
        const response = await fetch('http://localhost:1234/v1/models');
        if (response.ok) {
            console.log('✅ LM Studio服务正在运行');
        } else {
            throw new Error('LM Studio not responding');
        }
    } catch (error) {
        console.error('❌ LM Studio服务未运行，请先启动LM Studio');
        return;
    }
    
    // Step 2: 创建OpenAI client实例
    const config = {
        endpoint: 'http://localhost:1234/v1/chat/completions',
        models: ['gpt-oss-20b-mlx'],
        authentication: {
            credentials: {
                apiKey: 'any-key'
            }
        }
    };
    
    const client = createOpenAIClient(config, 'lmstudio-test');
    console.log('🔧 OpenAI client实例已创建');
    
    // Step 3: 构造请求（已经是处理后的格式，模拟从router传来的请求）
    const request = {
        model: 'gpt-oss-20b-mlx', // 注意：这应该是路由后的目标模型
        max_tokens: 1000,
        tools: [
            {
                name: 'ls',
                description: 'List files in current directory',
                input_schema: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Directory path to list',
                            default: '.'
                        }
                    }
                }
            }
        ],
        messages: [
            {
                role: 'user',
                content: 'Please list the files in the current directory'
            }
        ],
        stream: false
    };
    
    console.log('📝 OpenAI层接收的请求:');
    console.log(JSON.stringify(request, null, 2));
    
    // Step 4: 测试非流式请求
    try {
        console.log('📤 发送非流式请求...');
        const response = await client.sendRequest(request);
        
        console.log('✅ OpenAI层非流式响应成功');
        console.log('📨 OpenAI层响应:');
        console.log(JSON.stringify(response, null, 2));
        
        // 验证响应格式
        if (response.content && Array.isArray(response.content)) {
            const toolUseBlocks = response.content.filter(c => c.type === 'tool_use');
            if (toolUseBlocks.length > 0) {
                console.log('🔧 检测到工具调用:');
                toolUseBlocks.forEach((tool, i) => {
                    console.log(`  ${i + 1}. ${tool.name}: ${JSON.stringify(tool.input)}`);
                });
                console.log('✅ 测试2A通过: 非流式工具调用正常');
            } else {
                console.log('⚠️  未检测到工具调用块');
            }
        } else {
            console.log('⚠️  响应格式不符合Anthropic标准');
        }
        
    } catch (error) {
        console.error('❌ 测试2A失败: 非流式请求错误');
        console.error('错误信息:', error.message);
        if (error.response) {
            console.error('HTTP状态:', error.response.status);
            console.error('HTTP数据:', error.response.data);
        }
    }
    
    // Step 5: 测试流式请求
    try {
        console.log('\\n📤 发送流式请求...');
        const streamRequest = { ...request, stream: true };
        
        console.log('🔄 开始流式处理...');
        let chunkCount = 0;
        let toolCallDetected = false;
        
        // 使用 for await...of 来处理异步生成器
        for await (const chunk of client.sendStreamRequest(streamRequest)) {
            chunkCount++;
            console.log(`📦 流式块 ${chunkCount}:`, JSON.stringify(chunk, null, 2));
            
            if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
                toolCallDetected = true;
                console.log(`🔧 检测到工具调用: ${chunk.content_block.name}`);
            }
        }
        
        console.log(`✅ 测试2B通过: 流式请求完成，共处理${chunkCount}个块`);
        if (toolCallDetected) {
            console.log('✅ 流式工具调用检测正常');
        }
        
    } catch (error) {
        console.error('❌ 测试2B失败: 流式请求错误');
        console.error('错误信息:', error.message);
        if (error.response) {
            console.error('HTTP状态:', error.response.status);
            console.error('HTTP数据:', error.response.data);
        }
    }
    
    console.log('\\n✅ 测试2完成: OpenAI层到preprocessor传递验证');
}

// 运行测试
testOpenAILayer().catch(console.error);