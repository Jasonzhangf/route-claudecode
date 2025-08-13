#!/usr/bin/env node

/**
 * Demo: Data Capture and Replay System Test
 * 
 * 测试数据捕获和回放系统的完整功能：
 * 1. 数据捕获 - 记录每个流水线步骤的输入/输出
 * 2. 数据回放 - 从任意步骤重新开始执行
 * 3. 工具调用模拟 - 完美回放工具执行结果
 * 
 * @author Jason Zhang
 * @created 2025-08-13
 */

import { DebugRecorder } from './src/v3/debug/debug-recorder.js';
import { ReplaySystem } from './src/v3/debug/replay-system.js';

async function runDataCaptureAndReplayDemo() {
    console.log('🎬 数据捕获和回放系统测试开始...');
    
    // 1. 创建调试记录器
    console.log('\n📊 步骤1: 初始化数据捕获系统');
    const recorder = new DebugRecorder();
    
    // 2. 模拟完整的六层架构流水线数据捕获
    console.log('\n🔄 步骤2: 模拟六层架构流水线数据捕获');
    const pipelineSteps = [
        { layer: 'client', operation: 'input', data: { request: 'analyze this code', user: 'developer' } },
        { layer: 'client', operation: 'output', data: { validated: true, requestId: 'req-123' } },
        
        { layer: 'router', operation: 'input', data: { requestId: 'req-123', model: 'claude-4-sonnet' } },
        { layer: 'router', operation: 'output', data: { provider: 'anthropic', endpoint: '/v1/messages' } },
        
        { layer: 'post-processor', operation: 'input', data: { rawResponse: 'Analysis complete' } },
        { layer: 'post-processor', operation: 'output', data: { formatted: true, hasToolCalls: false } },
        
        { layer: 'transformer', operation: 'input', data: { format: 'anthropic', target: 'openai' } },
        { layer: 'transformer', operation: 'output', data: { transformed: true, format: 'openai' } },
        
        { layer: 'provider-protocol', operation: 'input', data: { protocol: 'anthropic', request: {} } },
        { layer: 'provider-protocol', operation: 'output', data: { response: 'API call successful' } },
        
        { layer: 'preprocessor', operation: 'input', data: { toolCalls: [{ name: 'file_read', args: {} }] } },
        { layer: 'preprocessor', operation: 'output', data: { toolResults: [{ result: 'file content' }] } },
        
        { layer: 'server', operation: 'input', data: { finalResponse: 'Complete analysis' } },
        { layer: 'server', operation: 'output', data: { sent: true, statusCode: 200 } }
    ];
    
    const recordIds = [];
    for (const step of pipelineSteps) {
        const recordId = recorder.recordLayerIO(
            step.layer, 
            step.operation, 
            step.data, 
            { 
                requestId: 'req-123',
                timestamp: new Date().toISOString(),
                pipeline: 'six-layer-architecture'
            }
        );
        recordIds.push(recordId);
        
        // 记录层间转换的审计追踪
        if (step.operation === 'output') {
            recorder.recordAuditTrail(
                step.layer,
                getNextLayer(step.layer),
                recordId,
                step.data
            );
        }
    }
    
    console.log(`✅ 捕获了 ${recordIds.length} 个数据记录`);
    
    // 3. 创建性能指标记录
    console.log('\n⏱️ 步骤3: 记录性能指标');
    recorder.recordPerformanceMetrics(
        'full-pipeline',
        'complete-request',
        Date.now() - 1000,
        Date.now(),
        {
            totalLayers: 6,
            requestType: 'code-analysis',
            hasToolCalls: true
        }
    );
    
    // 4. 创建回放场景
    console.log('\n🎭 步骤4: 创建回放场景');
    const scenarioName = 'code-analysis-full-pipeline';
    const replayScenarioId = recorder.createReplayScenario(scenarioName, recordIds);
    console.log(`✅ 回放场景已创建: ${replayScenarioId}`);
    
    // 5. 初始化回放系统
    console.log('\n▶️ 步骤5: 初始化回放系统');
    const replaySystem = new ReplaySystem();
    
    // 创建自定义场景用于回放
    const customScenarioId = replaySystem.createScenario('custom-code-analysis', {
        description: '完整代码分析流水线回放',
        layers: ['client', 'router', 'post-processor', 'transformer', 'provider-protocol', 'preprocessor', 'server'],
        replayMode: 'sequential',
        preserveTiming: true
    });
    
    console.log(`✅ 自定义回放场景已创建: ${customScenarioId}`);
    
    // 6. 执行回放测试
    console.log('\n🔄 步骤6: 执行数据回放');
    try {
        const replayResults = await replaySystem.startReplay('custom-code-analysis', {
            speed: 2.0, // 2倍速回放
            mode: 'simulation'
        });
        
        console.log('✅ 回放执行完成:');
        console.log(`   - 场景名称: ${replayResults.scenarioName}`);
        console.log(`   - 执行模式: ${replayResults.results.executionMode}`);
        console.log(`   - 总执行数: ${replayResults.results.summary.totalExecuted}`);
        console.log(`   - 成功数: ${replayResults.results.summary.successful}`);
        console.log(`   - 失败数: ${replayResults.results.summary.failed}`);
        console.log(`   - 总耗时: ${replayResults.results.summary.totalDuration}ms`);
        
    } catch (error) {
        console.log(`❌ 回放执行失败: ${error.message}`);
    }
    
    // 7. 显示回放状态和可用场景
    console.log('\n📋 步骤7: 回放系统状态');
    const replayStatus = replaySystem.getReplayStatus();
    console.log('回放系统状态:', replayStatus);
    
    const availableScenarios = replaySystem.getAvailableScenarios();
    console.log(`\n可用回放场景 (${availableScenarios.length}个):`);
    availableScenarios.forEach(scenario => {
        console.log(`  📁 ${scenario.scenarioName}`);
        console.log(`     - 创建时间: ${scenario.createdAt}`);
        console.log(`     - 追踪数量: ${scenario.totalTraces}`);
        console.log(`     - 涉及层级: ${scenario.layersInvolved.join(', ')}`);
        console.log(`     - 描述: ${scenario.description}`);
    });
    
    // 8. 会话总结
    console.log('\n📊 步骤8: 会话总结');
    const sessionSummary = recorder.getSessionSummary();
    console.log('数据捕获会话总结:');
    console.log(`  - 会话ID: ${sessionSummary.sessionId}`);
    console.log(`  - 开始时间: ${sessionSummary.startTime}`);
    console.log(`  - 结束时间: ${sessionSummary.endTime}`);
    console.log(`  - 记录数量: ${sessionSummary.recordCount}`);
    console.log(`  - 数据库路径: ${sessionSummary.databasePath}`);
    
    console.log('\n🎉 数据捕获和回放系统测试完成！');
    
    return {
        captureSession: sessionSummary,
        replayStatus: replayStatus,
        availableScenarios: availableScenarios
    };
}

/**
 * 获取流水线中的下一层
 */
function getNextLayer(currentLayer) {
    const layerOrder = ['client', 'router', 'post-processor', 'transformer', 'provider-protocol', 'preprocessor', 'server'];
    const currentIndex = layerOrder.indexOf(currentLayer);
    return currentIndex < layerOrder.length - 1 ? layerOrder[currentIndex + 1] : 'end';
}

// 运行演示
if (import.meta.url === `file://${process.argv[1]}`) {
    runDataCaptureAndReplayDemo()
        .then(results => {
            console.log('\n✅ 演示运行成功');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 演示运行失败:', error);
            process.exit(1);
        });
}

export default runDataCaptureAndReplayDemo;