#!/usr/bin/env node

/**
 * 400 Bad Request错误诊断脚本
 * 分析LMStudio工具调用的400错误具体原因
 */

import fs from 'fs';

async function diagnose400Error() {
    console.log('🔍 诊断 400 Bad Request 错误...\n');

    const tests = [
        {
            name: '1. 简单消息（无工具）',
            request: {
                model: "qwen3-30b",
                max_tokens: 50,
                messages: [{"role": "user", "content": "你好"}]
            }
        },
        {
            name: '2. 工具调用消息（Anthropic格式）',
            request: {
                model: "qwen3-30b", 
                max_tokens: 200,
                messages: [{"role": "user", "content": "列出当前目录"}],
                tools: [
                    {
                        name: "bash",
                        description: "Execute bash commands",
                        input_schema: {
                            type: "object",
                            properties: {
                                command: {
                                    type: "string",
                                    description: "The bash command to execute"
                                }
                            },
                            required: ["command"]
                        }
                    }
                ]
            }
        },
        {
            name: '3. 检查LMStudio直连（OpenAI格式）',
            endpoint: 'http://localhost:1234/v1/chat/completions',
            request: {
                model: "qwen3-30b",
                max_tokens: 200,
                messages: [{"role": "user", "content": "列出当前目录"}],
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "bash",
                            description: "Execute bash commands",
                            parameters: {
                                type: "object",
                                properties: {
                                    command: {
                                        type: "string",
                                        description: "The bash command to execute"
                                    }
                                },
                                required: ["command"]
                            }
                        }
                    }
                ]
            }
        }
    ];

    for (const test of tests) {
        console.log(`\n${test.name}`);
        console.log('='.repeat(50));
        
        const endpoint = test.endpoint || 'http://localhost:5506/v1/messages';
        console.log(`🎯 请求地址: ${endpoint}`);
        console.log(`📝 请求内容: ${JSON.stringify(test.request, null, 2)}`);
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(test.request)
            });

            console.log(`📊 HTTP状态: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ 成功响应: ${JSON.stringify(data, null, 2).substring(0, 300)}...`);
            } else {
                const errorText = await response.text();
                console.log(`❌ 错误响应: ${errorText}`);
                
                // 尝试解析JSON错误
                try {
                    const errorJson = JSON.parse(errorText);
                    console.log(`🔍 错误详情: ${JSON.stringify(errorJson, null, 2)}`);
                } catch {
                    console.log(`🔍 原始错误: ${errorText}`);
                }
            }
            
        } catch (error) {
            console.log(`💥 请求失败: ${error.message}`);
        }
    }

    console.log('\n📋 诊断完成');
    console.log('==============');
    console.log('分析以上结果可以确定：');
    console.log('1. 简单消息是否正常工作？');
    console.log('2. 路由器的Anthropic工具格式是否被正确处理？');
    console.log('3. LMStudio是否支持OpenAI工具调用格式？');
}

diagnose400Error().catch(console.error);