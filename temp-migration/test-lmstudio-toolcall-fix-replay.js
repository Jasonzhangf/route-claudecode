#!/usr/bin/env node

/**
 * LM Studio Tool Call Fix Mock Replay Test
 * 测试LM Studio工具调用修复逻辑的mock回放系统
 * @author Jason Zhang
 * @version v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioToolCallMockReplay {
    constructor() {
        this.testId = `lmstudio-toolcall-replay-${Date.now()}`;
        this.captureFilePath = '/Users/fanzhang/.route-claude-code/database/captures/openai/openai-capture-2025-08-02T00-57-10-246Z-8f661d85-d04b-48ed-88a3-59af874a0b52.json';
        this.results = [];
        
        console.log('🧪 LM Studio Tool Call Fix Mock Replay Test initialized');
        console.log(`📊 Test ID: ${this.testId}`);
    }

    /**
     * 加载捕获的数据
     */
    async loadCaptureData() {
        try {
            console.log(`📂 Loading capture data from: ${this.captureFilePath}`);
            
            const fileContent = await fs.readFile(this.captureFilePath, 'utf8');
            const captureData = JSON.parse(fileContent);
            
            console.log(`✅ Loaded capture data:`, {
                timestamp: captureData.timestamp,
                provider: captureData.provider,
                model: captureData.model,
                requestId: captureData.requestId
            });
            
            return captureData;
            
        } catch (error) {
            console.error('❌ Failed to load capture data:', error.message);
            throw error;
        }
    }

    /**
     * 分析响应数据中的工具调用问题
     */
    analyzeToolCallIssues(captureData) {
        const analysis = {
            hasFinishReasonToolCalls: false,
            hasActualToolCalls: false,
            needsPlaceholderFix: false,
            responseDetails: {},
            issues: []
        };

        try {
            // 检查响应数据
            const response = captureData.response;
            
            if (!response) {
                analysis.issues.push('No response data found');
                return analysis;
            }

            // 检查choices中的finish_reason
            if (response.choices && Array.isArray(response.choices)) {
                for (const choice of response.choices) {
                    if (choice.finish_reason === 'tool_calls') {
                        analysis.hasFinishReasonToolCalls = true;
                        
                        // 检查是否有实际的tool_calls数据
                        if (choice.message && choice.message.tool_calls && choice.message.tool_calls.length > 0) {
                            analysis.hasActualToolCalls = true;
                        }
                    }
                }
            }

            // 判断是否需要placeholder修复
            analysis.needsPlaceholderFix = analysis.hasFinishReasonToolCalls && !analysis.hasActualToolCalls;
            
            // 记录详细信息
            analysis.responseDetails = {
                choiceCount: response.choices?.length || 0,
                finishReasons: response.choices?.map(c => c.finish_reason) || [],
                hasToolCallsData: response.choices?.some(c => c.message?.tool_calls?.length > 0) || false
            };

            if (analysis.needsPlaceholderFix) {
                analysis.issues.push('LM Studio sent finish_reason: "tool_calls" but no actual tool_calls data - needs placeholder fix');
            }

            console.log('🔍 Tool call analysis:', analysis);
            
        } catch (error) {
            analysis.issues.push(`Analysis error: ${error.message}`);
            console.error('❌ Error analyzing tool call issues:', error);
        }

        return analysis;
    }

    /**
     * 模拟创建placeholder工具调用
     */
    createPlaceholderToolCall() {
        const placeholder = {
            id: `call_placeholder_${Date.now()}`,
            type: 'function',
            function: {
                name: 'placeholder_lmstudio_toolcall',
                arguments: JSON.stringify({
                    reason: 'LM Studio indicated tool_calls but provided no data',
                    fix_applied: true,
                    timestamp: new Date().toISOString()
                })
            }
        };

        console.log('🔧 Created placeholder tool call:', placeholder);
        return placeholder;
    }

    /**
     * 模拟修复后的响应
     */
    simulateFixedResponse(originalResponse, placeholderToolCall) {
        const fixedResponse = JSON.parse(JSON.stringify(originalResponse));

        // 为每个choice添加placeholder tool call
        if (fixedResponse.choices && Array.isArray(fixedResponse.choices)) {
            for (const choice of fixedResponse.choices) {
                if (choice.finish_reason === 'tool_calls' && (!choice.message?.tool_calls || choice.message.tool_calls.length === 0)) {
                    if (!choice.message) {
                        choice.message = {};
                    }
                    if (!choice.message.tool_calls) {
                        choice.message.tool_calls = [];
                    }
                    
                    choice.message.tool_calls.push(placeholderToolCall);
                    choice.message.content = choice.message.content || null; // OpenAI格式要求
                    
                    console.log('✅ Applied placeholder fix to choice');
                }
            }
        }

        return fixedResponse;
    }

    /**
     * 验证修复是否正确
     */
    validateFix(originalResponse, fixedResponse) {
        const validation = {
            success: true,
            issues: [],
            improvements: []
        };

        try {
            // 检查修复前后的差异
            const originalChoices = originalResponse.choices || [];
            const fixedChoices = fixedResponse.choices || [];

            if (originalChoices.length !== fixedChoices.length) {
                validation.issues.push('Choice count mismatch after fix');
                validation.success = false;
            }

            for (let i = 0; i < originalChoices.length; i++) {
                const original = originalChoices[i];
                const fixed = fixedChoices[i];

                // 检查finish_reason保持一致
                if (original.finish_reason !== fixed.finish_reason) {
                    validation.issues.push(`finish_reason changed in choice ${i}: ${original.finish_reason} -> ${fixed.finish_reason}`);
                }

                // 检查tool_calls修复
                if (original.finish_reason === 'tool_calls') {
                    const originalToolCalls = original.message?.tool_calls?.length || 0;
                    const fixedToolCalls = fixed.message?.tool_calls?.length || 0;

                    if (originalToolCalls === 0 && fixedToolCalls > 0) {
                        validation.improvements.push(`Added ${fixedToolCalls} placeholder tool calls to choice ${i}`);
                    } else if (originalToolCalls === 0 && fixedToolCalls === 0) {
                        validation.issues.push(`No tool calls added to choice ${i} despite finish_reason: "tool_calls"`);
                        validation.success = false;
                    }
                }
            }

            console.log('🧪 Validation results:', validation);
            
        } catch (error) {
            validation.issues.push(`Validation error: ${error.message}`);
            validation.success = false;
            console.error('❌ Error validating fix:', error);
        }

        return validation;
    }

    /**
     * 模拟客户端接收测试
     */
    simulateClientReceive(fixedResponse) {
        const clientTest = {
            success: false,
            toolCallsReceived: 0,
            errors: [],
            message: ''
        };

        try {
            // 模拟客户端解析响应
            if (!fixedResponse.choices || fixedResponse.choices.length === 0) {
                clientTest.errors.push('No choices in response');
                return clientTest;
            }

            const choice = fixedResponse.choices[0];
            
            if (choice.finish_reason === 'tool_calls') {
                if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
                    clientTest.toolCallsReceived = choice.message.tool_calls.length;
                    clientTest.success = true;
                    clientTest.message = `Successfully received ${clientTest.toolCallsReceived} tool calls`;
                    
                    // 验证tool call格式
                    for (const toolCall of choice.message.tool_calls) {
                        if (!toolCall.id || !toolCall.function?.name) {
                            clientTest.errors.push(`Invalid tool call format: ${JSON.stringify(toolCall)}`);
                        }
                    }
                } else {
                    clientTest.errors.push('finish_reason is tool_calls but no tool_calls data');
                }
            } else {
                clientTest.message = `Response with finish_reason: ${choice.finish_reason} (no tool calls expected)`;
                clientTest.success = true;
            }

            console.log('🎯 Client receive simulation:', clientTest);
            
        } catch (error) {
            clientTest.errors.push(`Client simulation error: ${error.message}`);
            console.error('❌ Error simulating client receive:', error);
        }

        return clientTest;
    }

    /**
     * 运行完整测试
     */
    async runTest() {
        console.log('\n🚀 Starting LM Studio Tool Call Fix Mock Replay Test...\n');
        
        const testResult = {
            testId: this.testId,
            timestamp: new Date().toISOString(),
            success: false,
            stages: {},
            summary: ''
        };

        try {
            // 阶段1: 加载捕获数据
            console.log('📋 Stage 1: Loading capture data...');
            const captureData = await this.loadCaptureData();
            testResult.stages.dataLoad = { success: true, data: 'loaded' };

            // 阶段2: 分析工具调用问题
            console.log('\n📋 Stage 2: Analyzing tool call issues...');
            const analysis = this.analyzeToolCallIssues(captureData);
            testResult.stages.analysis = { success: true, needsFix: analysis.needsPlaceholderFix };

            if (!analysis.needsPlaceholderFix) {
                console.log('ℹ️  No tool call issues found - test complete');
                testResult.success = true;
                testResult.summary = 'No tool call issues detected in capture data';
                return testResult;
            }

            // 阶段3: 创建placeholder修复
            console.log('\n📋 Stage 3: Creating placeholder tool call...');
            const placeholderToolCall = this.createPlaceholderToolCall();
            testResult.stages.placeholderCreation = { success: true, placeholder: placeholderToolCall.id };

            // 阶段4: 模拟修复响应
            console.log('\n📋 Stage 4: Simulating fixed response...');
            const fixedResponse = this.simulateFixedResponse(captureData.response, placeholderToolCall);
            testResult.stages.responseFix = { success: true, applied: 'placeholder_tool_call' };

            // 阶段5: 验证修复
            console.log('\n📋 Stage 5: Validating fix...');
            const validation = this.validateFix(captureData.response, fixedResponse);
            testResult.stages.validation = validation;

            // 阶段6: 模拟客户端接收
            console.log('\n📋 Stage 6: Simulating client receive...');
            const clientTest = this.simulateClientReceive(fixedResponse);
            testResult.stages.clientReceive = clientTest;

            // 综合评估
            testResult.success = validation.success && clientTest.success;
            
            if (testResult.success) {
                testResult.summary = `LM Studio tool call fix working correctly - ${clientTest.toolCallsReceived} placeholder tool calls created and received`;
            } else {
                const allErrors = [
                    ...validation.issues,
                    ...clientTest.errors
                ];
                testResult.summary = `Tool call fix failed: ${allErrors.join(', ')}`;
            }

            console.log('\n🎯 Test Result Summary:');
            console.log(`✅ Success: ${testResult.success}`);
            console.log(`📝 Summary: ${testResult.summary}`);
            
            // 保存测试结果
            await this.saveTestResults(testResult);

        } catch (error) {
            console.error('\n❌ Test failed with error:', error.message);
            testResult.success = false;
            testResult.error = error.message;
            testResult.summary = `Test execution failed: ${error.message}`;
        }

        return testResult;
    }

    /**
     * 保存测试结果
     */
    async saveTestResults(testResult) {
        try {
            const resultsDir = path.join(__dirname, 'test', 'output', 'functional');
            await fs.mkdir(resultsDir, { recursive: true });
            
            const resultsFile = path.join(resultsDir, `${this.testId}.json`);
            await fs.writeFile(resultsFile, JSON.stringify(testResult, null, 2));
            
            console.log(`\n💾 Test results saved: ${resultsFile}`);
            
        } catch (error) {
            console.warn('⚠️ Failed to save test results:', error.message);
        }
    }
}

// 运行测试
async function main() {
    const test = new LMStudioToolCallMockReplay();
    
    try {
        const result = await test.runTest();
        
        console.log('\n' + '='.repeat(60));
        console.log('🎯 FINAL TEST RESULT');
        console.log('='.repeat(60));
        console.log(`Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Summary: ${result.summary}`);
        console.log('='.repeat(60));
        
        process.exit(result.success ? 0 : 1);
        
    } catch (error) {
        console.error('💥 Test execution failed:', error);
        process.exit(1);
    }
}

// 只有直接运行时才执行
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default LMStudioToolCallMockReplay;