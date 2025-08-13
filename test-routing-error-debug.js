/**
 * 路由错误专门调试单元测试
 * 针对 "Cannot read properties of undefined (reading 'default')" 错误
 */

import { RoutingEngine } from './src/v3/router/routing-engine.js';
import { convertV3ToRouterConfig } from './dist/v3/config/v3-to-router-config.js';
import fs from 'fs';

console.log('🐛 路由错误专门调试测试开始...\n');

async function testRoutingErrorDebug() {
    try {
        // 1. 加载真实的V3配置文件
        const configPath = '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-openai-shuaihong-v3-5508.json';
        console.log('📋 加载V3配置文件:', configPath);
        
        const v3Config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ V3配置加载成功');
        console.log('   - providers数量:', Object.keys(v3Config.providers).length);
        console.log('   - routing结构:', typeof v3Config.routing);
        console.log('   - routing.categories存在:', !!v3Config.routing.categories);
        
        // 2. 调试配置转换过程
        console.log('\n🔄 开始配置转换...');
        
        // 设置必要的环境变量
        process.env.NODE_ENV = 'testing';
        
        const routerConfig = convertV3ToRouterConfig(configPath);
        
        console.log('✅ 转换后的RouterConfig:');
        console.log('   - routing结构:', typeof routerConfig.routing);
        console.log('   - routing keys:', Object.keys(routerConfig.routing || {}));
        console.log('   - routing.default存在:', !!routerConfig.routing?.default);
        console.log('   - routing.default内容:', routerConfig.routing?.default);
        
        // 3. 测试RoutingEngine初始化
        console.log('\n🔧 测试RoutingEngine初始化...');
        const routingEngine = new RoutingEngine(routerConfig.routing);
        console.log('✅ RoutingEngine初始化成功');
        console.log('   - engine.config:', typeof routingEngine.config);
        console.log('   - engine.config keys:', Object.keys(routingEngine.config || {}));
        
        // 4. 测试路由决策过程
        console.log('\n🎯 测试路由决策过程...');
        const testRequest = {
            model: 'claude-sonnet-4',
            messages: [{ role: 'user', content: '测试消息' }],
            max_tokens: 100
        };
        
        console.log('📝 测试请求:', {
            model: testRequest.model,
            messageCount: testRequest.messages.length
        });
        
        // 5. 单步调试路由过程
        console.log('\n🔍 单步调试路由过程...');
        
        // Step 1: determineCategory
        const category = routingEngine.determineCategory(testRequest);
        console.log('   - 确定类别:', category);
        
        // Step 2: 检查配置访问
        console.log('   - 检查config结构:');
        console.log('     * routingEngine.config:', !!routingEngine.config);
        console.log('     * routingEngine.config.routing:', !!routingEngine.config.routing);
        console.log('     * routingEngine.config.default:', !!routingEngine.config.default);
        console.log('     * routingEngine.config[category]:', !!routingEngine.config[category]);
        
        // Step 3: 尝试获取路由配置
        console.log('   - 尝试路由配置访问:');
        const routingConfig1 = routingEngine.config.routing ? routingEngine.config.routing[category] : undefined;
        const routingConfig2 = routingEngine.config[category];
        
        console.log('     * config.routing[category]:', !!routingConfig1, routingConfig1);
        console.log('     * config[category]:', !!routingConfig2, routingConfig2);
        
        // Step 4: 完整路由调用
        console.log('\n🚀 完整路由调用测试...');
        const routeResult = routingEngine.route(testRequest);
        console.log('✅ 路由成功:', routeResult);
        
        console.log('\n🎉 所有路由错误调试测试通过！');
        
    } catch (error) {
        console.error('\n❌ 路由错误调试测试失败:');
        console.error('错误消息:', error.message);
        console.error('错误堆栈:\n', error.stack);
        
        // 额外调试信息
        if (error.message.includes('Cannot read properties of undefined')) {
            console.error('\n🔍 详细错误分析:');
            console.error('这是一个未定义属性访问错误');
            console.error('可能的原因:');
            console.error('1. routingEngine.config未正确初始化');
            console.error('2. config.routing结构不正确');
            console.error('3. 配置转换过程中丢失了数据');
        }
        
        throw error;
    }
}

// 运行调试测试
testRoutingErrorDebug();