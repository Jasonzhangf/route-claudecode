/**
 * 测试V3配置文件的路由功能
 * 验证LMStudio和混合负载均衡配置是否符合V3路由字段结构
 */

import { RoutingEngine } from './src/v3/router/routing-engine.js';
import fs from 'fs';

console.log('🔧 V3配置文件路由测试开始...\n');

async function testV3ConfigRouting() {
    try {
        const configFiles = [
            './test-config-lmstudio.json',
            './config-mixed-load-balancing-v3.json',
            './src/v3/config/environments/development/config.json',
            './src/v3/config/environments/production/config.json'
        ];

        for (const configFile of configFiles) {
            console.log(`\n📋 测试配置文件: ${configFile}`);
            
            if (!fs.existsSync(configFile)) {
                console.log(`⚠️  配置文件不存在，跳过: ${configFile}`);
                continue;
            }

            try {
                // 读取并解析配置
                const configContent = fs.readFileSync(configFile, 'utf8');
                const config = JSON.parse(configContent);
                
                console.log(`✅ 配置文件解析成功`);
                console.log(`   - 服务器端口: ${config.server.port}`);
                console.log(`   - 架构版本: ${config.server.architecture}`);
                console.log(`   - Provider数量: ${Object.keys(config.providers).length}`);
                
                // 检查路由配置结构
                if (config.routing && config.routing.categories) {
                    console.log(`   - 路由策略: ${config.routing.strategy}`);
                    console.log(`   - 路由类别: ${Object.keys(config.routing.categories).join(', ')}`);
                    
                    // 创建路由引擎测试
                    const engine = new RoutingEngine(config);
                    console.log(`✅ 路由引擎创建成功`);
                    
                    // 测试每个类别的路由
                    const categories = Object.keys(config.routing.categories);
                    for (const category of categories) {
                        const categoryConfig = config.routing.categories[category];
                        console.log(`   📍 类别 ${category}:`);
                        console.log(`      - Provider: ${categoryConfig.provider}`);
                        console.log(`      - Model: ${categoryConfig.model}`);
                        
                        // 测试路由功能
                        const testRequest = {
                            model: 'test-model',
                            messages: [{ role: 'user', content: '测试' }],
                            metadata: {}
                        };
                        
                        // 模拟determineCategory返回当前类别
                        const originalDetermineCategory = engine.determineCategory;
                        engine.determineCategory = () => category;
                        
                        try {
                            const providerId = engine.route(testRequest, `test-${category}`);
                            console.log(`      ✅ 路由结果: ${providerId}`);
                            console.log(`      📊 Metadata: model=${testRequest.metadata.targetModel}, category=${testRequest.metadata.routingCategory}`);
                        } catch (error) {
                            console.log(`      ❌ 路由失败: ${error.message}`);
                        } finally {
                            // 恢复原始方法
                            engine.determineCategory = originalDetermineCategory;
                        }
                    }
                } else {
                    console.log(`❌ 路由配置格式不正确 - 缺少 routing.categories`);
                }
                
            } catch (error) {
                console.error(`❌ 配置文件测试失败: ${error.message}`);
            }
        }
        
        console.log('\n🎉 V3配置文件路由测试完成！');
        
    } catch (error) {
        console.error('\n❌ V3配置文件路由测试失败:');
        console.error('错误消息:', error.message);
        console.error('错误堆栈:\n', error.stack);
        throw error;
    }
}

// 运行测试
testV3ConfigRouting();