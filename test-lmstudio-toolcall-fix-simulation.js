#!/usr/bin/env node

/**
 * LM Studio Tool Call Fix Simulation Test
 * 模拟LM Studio发送finish_reason: "tool_calls"但缺少tool_calls数据的情况
 * @author Jason Zhang
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioToolCallFixSimulation {
    constructor() {
        this.testId = `lmstudio-toolcall-simulation-${Date.now()}`;
        this.results = [];
        
        console.log('🧪 LM Studio Tool Call Fix Simulation Test initialized');
        console.log(`📊 Test ID: ${this.testId}`);
    }

    /**
     * 创建模拟的LM Studio问题响应
     * 场景：finish_reason: "tool_calls" 但缺少实际的tool_calls数据
     */
    createProblematicLMStudioResponse() {
        return {
            id: "chatcmpl-test-lmstudio",
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "qwen3-30b",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: null, // LM Studio sometimes returns null content with tool_calls finish_reason
                        // 注意：这里故意缺少tool_calls字段，模拟LM Studio的问题
                    },
                    logprobs: null,
                    finish_reason: "tool_calls" // 关键问题：说明有工具调用，但实际没有tool_calls数据
                }
            ],
            usage: {
                prompt_tokens: 150,
                completion_tokens: 25,
                total_tokens: 175
            },
            system_fingerprint: "lmstudio-test"
        };
    }

    /**
     * 创建正常的OpenAI响应（用于对比）
     */
    createNormalOpenAIResponse() {
        return {
            id: "chatcmpl-normal-openai",
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "gpt-4",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: null,
                        tool_calls: [
                            {
                                id: "call_normal_123",
                                type: "function",
                                function: {
                                    name: "get_current_weather",
                                    arguments: '{"location": "San Francisco, CA"}'
                                }
                            }
                        ]
                    },
                    logprobs: null,
                    finish_reason: "tool_calls"
                }
            ],
            usage: {
                prompt_tokens: 150,
                completion_tokens: 35,
                total_tokens: 185
            }
        };
    }

    /**
     * 检测响应是否需要placeholder修复
     */
    detectNeedsPlaceholderFix(response) {
        const issues = [];
        let needsFix = false;

        if (!response.choices || response.choices.length === 0) {
            issues.push('No choices in response');
            return { needsFix: false, issues };
        }

        for (let i = 0; i < response.choices.length; i++) {
            const choice = response.choices[i];
            
            if (choice.finish_reason === 'tool_calls') {
                if (!choice.message?.tool_calls || choice.message.tool_calls.length === 0) {
                    issues.push(`Choice ${i}: finish_reason is "tool_calls" but no tool_calls data found`);
                    needsFix = true;
                } else {
                    issues.push(`Choice ${i}: finish_reason is "tool_calls" and has ${choice.message.tool_calls.length} tool calls - OK`);
                }
            } else {
                issues.push(`Choice ${i}: finish_reason is "${choice.finish_reason}" - no tool calls expected`);
            }
        }

        console.log('🔍 Detection result:', { needsFix, issues });
        return { needsFix, issues };
    }

    /**
     * 应用placeholder修复
     */
    applyPlaceholderFix(originalResponse) {
        const fixedResponse = JSON.parse(JSON.stringify(originalResponse));
        const fixesApplied = [];

        for (let i = 0; i < fixedResponse.choices.length; i++) {
            const choice = fixedResponse.choices[i];
            
            if (choice.finish_reason === 'tool_calls' && (!choice.message?.tool_calls || choice.message.tool_calls.length === 0)) {
                // 创建placeholder工具调用
                const placeholderToolCall = {
                    id: `call_lmstudio_placeholder_${Date.now()}_${i}`,
                    type: "function",
                    function: {
                        name: "lmstudio_toolcall_placeholder",
                        arguments: JSON.stringify({
                            reason: "LM Studio sent finish_reason='tool_calls' without actual tool_calls data",
                            fix_applied: true,
                            original_finish_reason: choice.finish_reason,
                            choice_index: i,
                            timestamp: new Date().toISOString(),
                            provider: "lmstudio",
                            issue_type: "missing_tool_calls_data"
                        })
                    }
                };

                // 确保message结构存在
                if (!choice.message) {
                    choice.message = { role: "assistant" };
                }
                if (!choice.message.tool_calls) {
                    choice.message.tool_calls = [];
                }

                // 添加placeholder
                choice.message.tool_calls.push(placeholderToolCall);
                
                // 确保content为null（OpenAI格式要求）
                if (choice.message.content === undefined) {
                    choice.message.content = null;
                }

                fixesApplied.push(`Added placeholder tool call to choice ${i}`);
                console.log(`🔧 Applied placeholder fix to choice ${i}:`, placeholderToolCall.id);
            }
        }

        return { fixedResponse, fixesApplied };
    }

    /**
     * 验证修复后的响应
     */
    validateFixedResponse(originalResponse, fixedResponse) {
        const validation = {
            success: true,
            issues: [],
            improvements: [],
            toolCallsAdded: 0
        };

        try {
            // 检查响应结构保持完整
            if (!fixedResponse.choices || fixedResponse.choices.length !== originalResponse.choices.length) {
                validation.issues.push('Response structure changed');
                validation.success = false;
                return validation;
            }

            // 检查每个choice的修复情况
            for (let i = 0; i < originalResponse.choices.length; i++) {
                const original = originalResponse.choices[i];
                const fixed = fixedResponse.choices[i];

                // finish_reason应该保持不变
                if (original.finish_reason !== fixed.finish_reason) {
                    validation.issues.push(`Choice ${i}: finish_reason changed from ${original.finish_reason} to ${fixed.finish_reason}`);
                }

                // 检查tool_calls修复
                if (original.finish_reason === 'tool_calls') {
                    const originalToolCalls = original.message?.tool_calls?.length || 0;
                    const fixedToolCalls = fixed.message?.tool_calls?.length || 0;

                    if (originalToolCalls === 0 && fixedToolCalls > 0) {
                        validation.improvements.push(`Choice ${i}: Added ${fixedToolCalls} placeholder tool calls`);
                        validation.toolCallsAdded += fixedToolCalls;
                    } else if (originalToolCalls === 0 && fixedToolCalls === 0) {
                        validation.issues.push(`Choice ${i}: Still missing tool calls despite finish_reason="tool_calls"`);
                        validation.success = false;
                    } else if (originalToolCalls > 0) {
                        validation.improvements.push(`Choice ${i}: Already had ${originalToolCalls} tool calls - no fix needed`);
                    }

                    // 验证tool call格式
                    if (fixed.message?.tool_calls) {
                        for (const toolCall of fixed.message.tool_calls) {
                            if (!toolCall.id || !toolCall.type || !toolCall.function?.name) {
                                validation.issues.push(`Choice ${i}: Invalid tool call format`);
                                validation.success = false;
                            }
                        }
                    }
                }
            }

            console.log('✅ Validation completed:', validation);

        } catch (error) {
            validation.issues.push(`Validation error: ${error.message}`);
            validation.success = false;
            console.error('❌ Validation error:', error);
        }

        return validation;
    }

    /**
     * 模拟客户端处理测试
     */
    simulateClientProcessing(response) {
        const clientResult = {
            success: false,
            toolCallsReceived: 0,
            toolCallsProcessed: 0,
            errors: [],
            messages: []
        };

        try {
            if (!response.choices || response.choices.length === 0) {
                clientResult.errors.push('No choices in response');
                return clientResult;
            }

            const choice = response.choices[0];
            
            if (choice.finish_reason === 'tool_calls') {
                if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
                    clientResult.toolCallsReceived = choice.message.tool_calls.length;
                    
                    // 模拟处理每个工具调用
                    for (const toolCall of choice.message.tool_calls) {
                        try {
                            // 验证工具调用格式
                            if (!toolCall.id || !toolCall.function?.name) {
                                clientResult.errors.push(`Invalid tool call: ${JSON.stringify(toolCall)}`);
                                continue;
                            }

                            // 模拟执行工具调用
                            const args = JSON.parse(toolCall.function.arguments || '{}');
                            clientResult.toolCallsProcessed++;
                            
                            if (toolCall.function.name === 'lmstudio_toolcall_placeholder') {
                                clientResult.messages.push(`Processed placeholder tool call (LM Studio fix): ${args.reason}`);
                            } else {
                                clientResult.messages.push(`Processed tool call: ${toolCall.function.name}`);
                            }
                            
                        } catch (argError) {
                            clientResult.errors.push(`Failed to parse tool call arguments: ${argError.message}`);
                        }
                    }
                    
                    clientResult.success = clientResult.toolCallsProcessed > 0;
                    
                } else {
                    clientResult.errors.push('finish_reason is "tool_calls" but no tool_calls data available');
                }
            } else {
                clientResult.messages.push(`No tool calls expected (finish_reason: ${choice.finish_reason})`);
                clientResult.success = true;
            }

            console.log('🎯 Client processing result:', clientResult);

        } catch (error) {
            clientResult.errors.push(`Client processing error: ${error.message}`);
            console.error('❌ Client processing error:', error);
        }

        return clientResult;
    }

    /**
     * 运行完整测试套件
     */
    async runTestSuite() {
        console.log('\n🚀 Starting LM Studio Tool Call Fix Simulation Test Suite...\n');

        const testResults = {
            testId: this.testId,
            timestamp: new Date().toISOString(),
            overallSuccess: false,
            tests: []
        };

        try {
            // Test 1: LM Studio问题场景
            console.log('=' * 60);
            console.log('🧪 Test 1: LM Studio Problematic Response');
            console.log('=' * 60);
            
            const problematicResponse = this.createProblematicLMStudioResponse();
            console.log('📝 Created problematic LM Studio response:', {
                finish_reason: problematicResponse.choices[0].finish_reason,
                has_tool_calls: !!problematicResponse.choices[0].message?.tool_calls,
                tool_calls_count: problematicResponse.choices[0].message?.tool_calls?.length || 0
            });

            // 检测是否需要修复
            const detection = this.detectNeedsPlaceholderFix(problematicResponse);
            
            // 应用修复
            const { fixedResponse, fixesApplied } = this.applyPlaceholderFix(problematicResponse);
            
            // 验证修复
            const validation = this.validateFixedResponse(problematicResponse, fixedResponse);
            
            // 模拟客户端处理
            const clientResult = this.simulateClientProcessing(fixedResponse);

            const test1Result = {
                name: 'LM Studio Problematic Response',
                success: detection.needsFix && validation.success && clientResult.success,
                detection,
                fixesApplied,
                validation,
                clientResult
            };
            
            testResults.tests.push(test1Result);
            
            console.log(`\n✅ Test 1 Result: ${test1Result.success ? 'PASS' : 'FAIL'}`);
            console.log(`   - Detection: ${detection.needsFix ? 'Detected issue' : 'No issue detected'}`);
            console.log(`   - Fixes Applied: ${fixesApplied.length}`);
            console.log(`   - Validation: ${validation.success ? 'PASS' : 'FAIL'}`);
            console.log(`   - Client Processing: ${clientResult.success ? 'PASS' : 'FAIL'}`);
            console.log(`   - Tool Calls Added: ${validation.toolCallsAdded}`);
            console.log(`   - Tool Calls Processed: ${clientResult.toolCallsProcessed}`);

            // Test 2: 正常OpenAI响应（对照组）
            console.log('\n' + '=' * 60);
            console.log('🧪 Test 2: Normal OpenAI Response (Control Group)');
            console.log('=' * 60);
            
            const normalResponse = this.createNormalOpenAIResponse();
            console.log('📝 Created normal OpenAI response:', {
                finish_reason: normalResponse.choices[0].finish_reason,
                has_tool_calls: !!normalResponse.choices[0].message?.tool_calls,
                tool_calls_count: normalResponse.choices[0].message?.tool_calls?.length || 0
            });

            // 检测（应该不需要修复）
            const normalDetection = this.detectNeedsPlaceholderFix(normalResponse);
            
            // 尝试应用修复（应该无变化）
            const { fixedResponse: normalFixed, fixesApplied: normalFixes } = this.applyPlaceholderFix(normalResponse);
            
            // 验证（应该保持原样）
            const normalValidation = this.validateFixedResponse(normalResponse, normalFixed);
            
            // 模拟客户端处理
            const normalClientResult = this.simulateClientProcessing(normalFixed);

            const test2Result = {
                name: 'Normal OpenAI Response',
                success: !normalDetection.needsFix && normalValidation.success && normalClientResult.success,
                detection: normalDetection,
                fixesApplied: normalFixes,
                validation: normalValidation,
                clientResult: normalClientResult
            };
            
            testResults.tests.push(test2Result);
            
            console.log(`\n✅ Test 2 Result: ${test2Result.success ? 'PASS' : 'FAIL'}`);
            console.log(`   - Detection: ${normalDetection.needsFix ? 'Detected issue (unexpected)' : 'No issue detected'}`);
            console.log(`   - Fixes Applied: ${normalFixes.length}`);
            console.log(`   - Validation: ${normalValidation.success ? 'PASS' : 'FAIL'}`);
            console.log(`   - Client Processing: ${normalClientResult.success ? 'PASS' : 'FAIL'}`);

            // 综合评估
            testResults.overallSuccess = testResults.tests.every(test => test.success);

            console.log('\n' + '=' * 60);
            console.log('🎯 TEST SUITE SUMMARY');
            console.log('=' * 60);
            console.log(`Overall Status: ${testResults.overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
            console.log(`Total Tests: ${testResults.tests.length}`);
            console.log(`Passed: ${testResults.tests.filter(t => t.success).length}`);
            console.log(`Failed: ${testResults.tests.filter(t => !t.success).length}`);
            
            if (testResults.overallSuccess) {
                console.log('\n🎉 LM Studio tool call placeholder fix is working correctly!');
                console.log('✅ The fix can properly detect and handle cases where LM Studio sends');
                console.log('   finish_reason: "tool_calls" but provides no actual tool_calls data');
                console.log('✅ Placeholder tool calls are created and properly processed by clients');
                console.log('✅ Normal responses are left unchanged');
            }

            // 保存测试结果
            await this.saveTestResults(testResults);

        } catch (error) {
            console.error('\n❌ Test suite failed with error:', error.message);
            testResults.overallSuccess = false;
            testResults.error = error.message;
        }

        return testResults;
    }

    /**
     * 保存测试结果
     */
    async saveTestResults(testResults) {
        try {
            const resultsDir = path.join(__dirname, 'test', 'output', 'functional');
            await fs.mkdir(resultsDir, { recursive: true });
            
            const resultsFile = path.join(resultsDir, `${this.testId}.json`);
            await fs.writeFile(resultsFile, JSON.stringify(testResults, null, 2));
            
            console.log(`\n💾 Test results saved: ${resultsFile}`);
            
        } catch (error) {
            console.warn('⚠️ Failed to save test results:', error.message);
        }
    }
}

// 运行测试
async function main() {
    const test = new LMStudioToolCallFixSimulation();
    
    try {
        const result = await test.runTestSuite();
        process.exit(result.overallSuccess ? 0 : 1);
        
    } catch (error) {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    }
}

// 只有直接运行时才执行
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default LMStudioToolCallFixSimulation;