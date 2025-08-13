#!/usr/bin/env node
/**
 * LM Studio Direct Preprocessor Test
 * 直接测试preprocessor层到LM Studio的通信
 * 
 * Project owner: Jason Zhang
 */

import axios from 'axios';
import { LMStudioOpenAIPreprocessor } from './src/v3/preprocessor/lmstudio-openai-preprocessor.js';

const LM_STUDIO_ENDPOINT = 'http://localhost:1234/v1/chat/completions';

async function testLMStudioDirect() {
    console.log('🧪 测试1: 直接调用LM Studio (preprocessor层)');
    console.log('========================================');
    
    // Step 1: 检查LM Studio是否运行
    try {
        const modelsResponse = await axios.get('http://localhost:1234/v1/models');
        console.log('✅ LM Studio服务正在运行');
        console.log(`📋 可用模型:`, modelsResponse.data.data.map(m => m.id));
    } catch (error) {
        console.error('❌ LM Studio服务未运行，请先启动LM Studio');
        return;
    }
    
    // Step 2: 创建preprocessor实例
    const config = {
        endpoint: LM_STUDIO_ENDPOINT,
        models: ['gpt-oss-20b-mlx']
    };
    
    const preprocessor = new LMStudioOpenAIPreprocessor(config);
    console.log('🔧 LM Studio preprocessor实例已创建');
    
    // Step 3: 构造Anthropic格式的工具调用请求
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
        ]
    };
    
    console.log('📝 构造的Anthropic请求:');
    console.log(JSON.stringify(anthropicRequest, null, 2));
    
    // Step 4: 使用preprocessor转换请求
    const context = {
        providerId: 'lmstudio-test',
        targetModel: 'gpt-oss-20b-mlx',
        config: config
    };
    
    try {
        const processedRequest = await preprocessor.processRequest(anthropicRequest, context);
        console.log('✅ Preprocessor转换成功');
        console.log('🔄 转换后的OpenAI请求:');
        console.log(JSON.stringify(processedRequest, null, 2));
        
        // Step 5: 直接发送到LM Studio
        console.log('📤 发送请求到LM Studio...');
        const response = await axios.post(LM_STUDIO_ENDPOINT, processedRequest, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer any-key'
            },
            timeout: 30000
        });
        
        console.log('✅ LM Studio响应成功');
        console.log('📨 LM Studio原始响应:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Step 6: 使用preprocessor后处理响应
        const processedResponse = await preprocessor.postprocessResponse(
            response.data, 
            anthropicRequest, 
            context
        );
        
        console.log('✅ Preprocessor后处理成功');
        console.log('🎯 最终Anthropic格式响应:');
        console.log(JSON.stringify(processedResponse, null, 2));
        
        // 验证工具调用
        if (processedResponse.content && Array.isArray(processedResponse.content)) {
            const toolUseBlocks = processedResponse.content.filter(c => c.type === 'tool_use');
            if (toolUseBlocks.length > 0) {
                console.log('🔧 检测到工具调用:');
                toolUseBlocks.forEach((tool, i) => {
                    console.log(`  ${i + 1}. ${tool.name}: ${JSON.stringify(tool.input)}`);
                });
            }
        }
        
        console.log('\n✅ 测试1完成: LM Studio preprocessor层通信正常');
        
    } catch (error) {
        console.error('❌ 测试1失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
        console.error('完整错误:', error);
    }
}

// 运行测试
testLMStudioDirect().catch(console.error);