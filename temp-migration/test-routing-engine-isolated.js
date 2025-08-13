/**
 * 路由引擎隔离测试
 * 直接测试RoutingEngine，不依赖配置转换
 */

import { RoutingEngine } from './src/v3/router/routing-engine.js';

console.log('🔧 路由引擎隔离测试开始...\n');

async function testRoutingEngineIsolated() {
    try {
        // 1. 构造一个符合V3格式的路由配置
        console.log('📋 构造V3格式路由配置...');
        const v3RoutingConfig = {
            default: {
                provider: 'shuaihong-openai-v3',
                model: 'gpt-4o-mini'
            },
            thinking: {
                provider: 'shuaihong-openai-v3',
                model: 'claude-4-sonnet'
            },
            longcontext: {
                provider: 'shuaihong-openai-v3',
                model: 'gemini-2.5-pro'
            },
            background: {
                provider: 'shuaihong-openai-v3',
                model: 'gpt-4o-mini'
            },
            search: {
                provider: 'shuaihong-openai-v3',
                model: 'DeepSeek-V3'
            }
        };
        
        console.log('✅ V3路由配置构造完成');
        console.log('   - 类别数量:', Object.keys(v3RoutingConfig).length);
        console.log('   - default类别:', v3RoutingConfig.default);
        
        // 2. 测试方案1：直接传入categories配置
        console.log('\n🔧 方案1: 直接传入categories配置...');
        try {
            const engine1 = new RoutingEngine(v3RoutingConfig);
            console.log('✅ 方案1成功');
            console.log('   - engine.config存在:', !!engine1.config);
            console.log('   - engine.config keys:', Object.keys(engine1.config));
            
            // 测试路由
            const testRequest = {
                model: 'claude-sonnet-4',
                messages: [{ role: 'user', content: '测试' }],
                metadata: {}
            };
            
            const result1 = engine1.route(testRequest, 'test-request-1');
            console.log('   - 路由结果(providerId):', result1);
            console.log('   - 请求metadata:', testRequest.metadata);
            
        } catch (error) {
            console.error('❌ 方案1失败:', error.message);
        }
        
        // 3. 测试方案2：包装在routing对象中
        console.log('\n🔧 方案2: 包装在routing对象中...');
        try {
            const wrappedConfig = { routing: v3RoutingConfig };
            const engine2 = new RoutingEngine(wrappedConfig);
            console.log('✅ 方案2成功');
            console.log('   - engine.config存在:', !!engine2.config);
            console.log('   - engine.config keys:', Object.keys(engine2.config));
            console.log('   - engine.config.routing存在:', !!engine2.config.routing);
            
            // 测试路由
            const testRequest2 = {
                model: 'claude-sonnet-4',
                messages: [{ role: 'user', content: '测试' }],
                metadata: {}
            };
            
            const result2 = engine2.route(testRequest2, 'test-request-2');
            console.log('   - 路由结果(providerId):', result2);
            console.log('   - 请求metadata:', testRequest2.metadata);
            
        } catch (error) {
            console.error('❌ 方案2失败:', error.message);
            console.error('详细错误:', error.stack);
        }
        
        // 4. 测试方案3：按原始期望格式
        console.log('\n🔧 方案3: 原始期望格式...');
        try {
            // 检查RoutingEngine期望的结构
            const legacyConfig = {
                routing: {
                    default: {
                        providers: ['shuaihong-openai-v3'],
                        models: ['gpt-4o-mini']
                    },
                    thinking: {
                        providers: ['shuaihong-openai-v3'],
                        models: ['claude-4-sonnet']
                    }
                }
            };
            
            const engine3 = new RoutingEngine(legacyConfig);
            console.log('✅ 方案3成功');
            
            const testRequest3 = {
                model: 'claude-sonnet-4',
                messages: [{ role: 'user', content: '测试' }],
                metadata: {}
            };
            
            const result3 = engine3.route(testRequest3, 'test-request-3');
            console.log('   - 路由结果(providerId):', result3);
            console.log('   - 请求metadata:', testRequest3.metadata);
            
        } catch (error) {
            console.error('❌ 方案3失败:', error.message);
        }
        
        console.log('\n🎉 路由引擎隔离测试完成！');
        
    } catch (error) {
        console.error('\n❌ 路由引擎隔离测试失败:');
        console.error('错误消息:', error.message);
        console.error('错误堆栈:\n', error.stack);
        throw error;
    }
}

// 运行测试
testRoutingEngineIsolated();