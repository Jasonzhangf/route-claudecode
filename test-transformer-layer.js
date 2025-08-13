#!/usr/bin/env node
/**
 * Transformer Layer to OpenAI Layer Test
 * 测试Transformer层到OpenAI层的请求传递
 * 
 * Project owner: Jason Zhang
 */

import { transformationManager } from './src/v3/transformer/manager.js';
import { createOpenAIClient } from './dist/v3/provider-protocol/openai/client-factory.js';

async function testTransformerLayer() {
    console.log('🧪 测试3: Transformer层到OpenAI层传递');
    console.log('======================================');
    
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
    
    // Step 2: 使用Transformation Manager
    console.log('🔧 使用Transformation Manager进行格式转换');
    
    // Step 3: 构造Anthropic格式请求（来自Router层的请求）
    const anthropicRequest = {
        model: 'claude-sonnet-4',
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
    
    console.log('📝 Transformer层接收的Anthropic请求:');
    console.log(JSON.stringify(anthropicRequest, null, 2));
    
    // Step 4: 使用Transformation Manager转换请求
    try {
        const transformedRequest = transformationManager.transform(anthropicRequest, {
            sourceFormat: 'anthropic',
            targetFormat: 'openai', 
            direction: 'request'
        });
        console.log('✅ Transformer转换成功');
        console.log('🔄 转换后的OpenAI格式请求:');
        console.log(JSON.stringify(transformedRequest, null, 2));
        
        // Step 5: 创建OpenAI client并发送请求
        const config = {
            endpoint: 'http://localhost:1234/v1/chat/completions',
            models: ['gpt-oss-20b-mlx'],
            authentication: {
                credentials: {
                    apiKey: 'any-key'
                }
            }
        };
        
        const client = createOpenAIClient(config, 'lmstudio-transformer-test');
        console.log('🔧 OpenAI client实例已创建');
        
        // Step 6: 发送转换后的请求到OpenAI层
        console.log('📤 发送转换后的请求到OpenAI层...');
        
        // 需要添加目标模型到请求中
        const requestWithTargetModel = {
            ...transformedRequest,
            model: 'gpt-oss-20b-mlx' // 设置为LM Studio的目标模型
        };
        
        console.log('📝 最终发送到OpenAI层的请求:');
        console.log(JSON.stringify(requestWithTargetModel, null, 2));
        
        const openaiResponse = await client.sendRequest(requestWithTargetModel);
        
        console.log('✅ OpenAI层响应成功');
        console.log('📨 OpenAI层原始响应:');
        console.log(JSON.stringify(openaiResponse, null, 2));
        
        // Step 7: 使用Transformation Manager转换响应回Anthropic格式
        const finalResponse = transformationManager.transform(openaiResponse, {
            sourceFormat: 'openai',
            targetFormat: 'anthropic',
            direction: 'response'
        });
        
        console.log('✅ Transformer响应转换成功');
        console.log('🎯 最终Anthropic格式响应:');
        console.log(JSON.stringify(finalResponse, null, 2));
        
        // 验证工具调用
        if (finalResponse.content && Array.isArray(finalResponse.content)) {
            const toolUseBlocks = finalResponse.content.filter(c => c.type === 'tool_use');
            if (toolUseBlocks.length > 0) {
                console.log('🔧 检测到工具调用:');
                toolUseBlocks.forEach((tool, i) => {
                    console.log(`  ${i + 1}. ${tool.name}: ${JSON.stringify(tool.input)}`);
                });
                console.log('✅ 测试3通过: Transformer层双向转换正常');
            } else {
                console.log('⚠️  未检测到工具调用块');
            }
        } else {
            console.log('⚠️  最终响应格式不符合Anthropic标准');
        }
        
    } catch (error) {
        console.error('❌ 测试3失败: Transformer层处理错误');
        console.error('错误信息:', error.message);
        console.error('完整错误:', error);
    }
    
    console.log('\\n✅ 测试3完成: Transformer层到OpenAI层传递验证');
}

// 运行测试
testTransformerLayer().catch(console.error);