#!/usr/bin/env node

/**
 * Mock Server Data Replay Usage Demo
 * 演示如何使用mock服务器回放捕获的数据
 * @author Jason Zhang
 * @version v3.0
 */

import { DataReplayInfrastructure } from './test/mock-server/data-replay-system/replay/data-replay-infrastructure.js';

class MockReplayDemo {
    constructor() {
        this.replayInfrastructure = new DataReplayInfrastructure({
            databasePath: '/Users/fanzhang/.route-claude-code/database'
        });
    }

    /**
     * 演示基本数据回放功能
     */
    async demoBasicReplay() {
        console.log('🎬 Starting Mock Server Data Replay Demo...\n');

        try {
            // 1. 初始化数据重放基础设施
            console.log('📋 Step 1: Initializing Data Replay Infrastructure');
            await this.replayInfrastructure.initialize();
            
            // 2. 显示基础设施状态
            console.log('\n📊 Step 2: Infrastructure Status');
            const status = this.replayInfrastructure.getInfrastructureStatus();
            console.log('Infrastructure Status:', JSON.stringify(status, null, 2));

            // 3. 显示统计信息
            console.log('\n📈 Step 3: Database Statistics');
            const stats = this.replayInfrastructure.getStats();
            console.log('Database Stats:', JSON.stringify(stats, null, 2));

            // 4. 演示数据查询
            console.log('\n🔍 Step 4: Demo Data Query');
            
            const queryRequest = {
                provider: 'openai',
                operation: 'chat_completion',
                timeRange: {
                    startTime: '2025-08-01T00:00:00Z',
                    endTime: '2025-08-03T00:00:00Z'
                }
            };

            try {
                const replayData = await this.replayInfrastructure.serveDataFromDatabase(queryRequest);
                console.log('✅ Successfully retrieved replay data:', {
                    totalFiles: replayData.totalFiles,
                    entries: replayData.entries.length,
                    processedAt: replayData.processedAt
                });

                // 显示第一个条目的示例
                if (replayData.entries.length > 0) {
                    const firstEntry = replayData.entries[0];
                    console.log('\n📄 Sample Entry:');
                    console.log('- Source File:', firstEntry.replayMetadata?.sourceFile);
                    console.log('- Provider:', firstEntry.provider);
                    console.log('- Model:', firstEntry.model);
                    console.log('- Timestamp:', firstEntry.timestamp);
                    
                    // 检查是否是LM Studio相关数据
                    if (firstEntry.provider?.includes('lmstudio') || firstEntry.model?.includes('qwen')) {
                        console.log('🎯 Found LM Studio related data - perfect for tool call testing!');
                    }
                }
                
            } catch (queryError) {
                console.log('ℹ️ No matching data found for query:', queryError.message);
                console.log('💡 This is normal if no data has been captured yet.');
            }

            // 5. 演示scenario支持
            console.log('\n🎭 Step 5: Scenario-based Testing');
            console.log('Available test scenarios:');
            console.log('- lmstudio_tool_call_fix: Test LM Studio tool call placeholder creation');
            console.log('- openai_normal_response: Test normal OpenAI responses');
            console.log('- provider_failover: Test provider switching scenarios');
            console.log('- streaming_recovery: Test streaming response recovery');

            // 6. 清理
            console.log('\n🧹 Step 6: Cleanup');
            await this.replayInfrastructure.cleanup();
            
            console.log('\n✅ Mock Server Data Replay Demo completed successfully!');
            console.log('\n💡 Usage Tips:');
            console.log('1. Use the replay infrastructure to test specific scenarios');
            console.log('2. Captured data is automatically cleaned of sensitive information');
            console.log('3. The mock server can simulate various provider behaviors');
            console.log('4. Perfect for testing tool call fixes without hitting real APIs');

        } catch (error) {
            console.error('❌ Demo failed:', error.message);
            throw error;
        }
    }

    /**
     * 演示LM Studio工具调用场景
     */
    async demoLMStudioScenario() {
        console.log('\n🎯 LM Studio Tool Call Scenario Demo');
        console.log('=' * 50);

        // 模拟LM Studio问题场景的数据
        const lmstudioScenarioData = {
            provider: 'lmstudio',
            model: 'qwen3-30b',
            request: {
                model: 'qwen3-30b',
                messages: [
                    {
                        role: 'user',
                        content: 'Please help me write a simple test function'
                    }
                ],
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'write_code',
                            description: 'Write code based on requirements'
                        }
                    }
                ]
            },
            response: {
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: null
                            // 注意：故意缺少tool_calls，模拟LM Studio问题
                        },
                        finish_reason: 'tool_calls' // 问题所在：说有工具调用但没有数据
                    }
                ]
            }
        };

        console.log('📝 Scenario: LM Studio sends finish_reason="tool_calls" but no tool_calls data');
        console.log('🔧 Expected Fix: System should create placeholder tool call');
        console.log('✅ Result: Client receives valid tool call and can continue processing');
        
        return lmstudioScenarioData;
    }
}

// 运行演示
async function main() {
    const demo = new MockReplayDemo();
    
    try {
        await demo.demoBasicReplay();
        await demo.demoLMStudioScenario();
        
        console.log('\n🎉 All demos completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('💥 Demo execution failed:', error);
        process.exit(1);
    }
}

// 只有直接运行时才执行
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export default MockReplayDemo;