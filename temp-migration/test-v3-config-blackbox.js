/**
 * V3配置文件黑盒测试
 * 测试所有V3配置文件是否符合路由引擎期待的格式
 * 检查并修正配置文件，清除冗余和废弃文件
 */

import { RoutingEngine } from './src/v3/router/routing-engine.js';
import { loadUserConfig } from './src/v3/config/config-merger.js';
import fs from 'fs';
import path from 'path';

console.log('🔧 V3配置文件黑盒测试开始...\n');

async function testV3ConfigBlackbox() {
    try {
        // 1. 发现所有V3配置文件
        const configFiles = [
            './src/v3/config/environments/development/config.json',
            './src/v3/config/environments/production/config.json', 
            './src/v3/config/environments/testing/config.json',
            './config/user/user-config-lmstudio.json',
            './config/user/user-config-mixed-providers.json',
            './test-config-lmstudio.json',
            './config-mixed-load-balancing-v3.json'
        ];

        console.log('📋 发现的配置文件:');
        for (const file of configFiles) {
            console.log(`   ${fs.existsSync(file) ? '✅' : '❌'} ${file}`);
        }

        const testResults = [];

        // 2. 对每个配置文件进行黑盒测试
        for (const configFile of configFiles) {
            console.log(`\n🔧 黑盒测试: ${configFile}`);
            
            if (!fs.existsSync(configFile)) {
                console.log(`⚠️  配置文件不存在，跳过: ${configFile}`);
                testResults.push({
                    file: configFile,
                    status: 'missing',
                    errors: ['File does not exist']
                });
                continue;
            }

            try {
                const result = await testSingleConfig(configFile);
                testResults.push(result);
                
            } catch (error) {
                console.error(`❌ 测试失败: ${error.message}`);
                testResults.push({
                    file: configFile,
                    status: 'failed',
                    errors: [error.message]
                });
            }
        }

        // 3. 汇总测试结果
        console.log('\n📊 测试结果汇总:');
        const passed = testResults.filter(r => r.status === 'passed').length;
        const failed = testResults.filter(r => r.status === 'failed').length;
        const missing = testResults.filter(r => r.status === 'missing').length;
        const needsFix = testResults.filter(r => r.status === 'needs_fix').length;

        console.log(`   ✅ 通过: ${passed}`);
        console.log(`   ❌ 失败: ${failed}`);
        console.log(`   ⚠️  缺失: ${missing}`);
        console.log(`   🔧 需要修复: ${needsFix}`);

        // 4. 详细错误报告
        console.log('\n📝 详细错误报告:');
        for (const result of testResults) {
            if (result.status !== 'passed') {
                console.log(`\n   ${result.file}:`);
                console.log(`   状态: ${result.status}`);
                if (result.errors) {
                    result.errors.forEach(error => {
                        console.log(`     - ${error}`);
                    });
                }
                if (result.fixes) {
                    console.log('   建议修复:');
                    result.fixes.forEach(fix => {
                        console.log(`     → ${fix}`);
                    });
                }
            }
        }

        // 5. 推荐清理的文件
        console.log('\n🗑️  推荐清理的配置文件:');
        const redundantFiles = [
            './test-config-lmstudio.json',
            './config-mixed-load-balancing-v3.json',
            './test-merged-config-user-config-lmstudio.json',
            './test-merged-config-user-config-mixed-providers.json'
        ];

        for (const file of redundantFiles) {
            if (fs.existsSync(file)) {
                console.log(`   🗑️  ${file} - 测试文件，可以删除`);
            }
        }

        console.log('\n🎉 V3配置文件黑盒测试完成！');
        
    } catch (error) {
        console.error('\n❌ V3配置文件黑盒测试失败:');
        console.error('错误消息:', error.message);
        console.error('错误堆栈:\n', error.stack);
        throw error;
    }
}

/**
 * 测试单个配置文件
 */
async function testSingleConfig(configFile) {
    const result = {
        file: configFile,
        status: 'unknown',
        errors: [],
        fixes: []
    };

    try {
        // 1. 读取并解析配置文件
        const configContent = fs.readFileSync(configFile, 'utf8');
        const rawConfig = JSON.parse(configContent);
        
        console.log(`   📋 原始配置解析成功`);
        
        // 2. 检查是否是用户配置格式（需要合并）
        let config;
        const isUserConfig = !rawConfig.server?.architecture && 
                            !rawConfig.errors && 
                            !rawConfig.validation;
        
        if (isUserConfig) {
            console.log(`   🔄 用户配置，进行合并...`);
            config = loadUserConfig(configFile);
        } else {
            console.log(`   ⚙️  系统配置，直接使用`);
            config = rawConfig;
        }

        // 3. 验证基本结构
        const requiredFields = ['server', 'providers', 'routing'];
        const missingFields = [];
        
        for (const field of requiredFields) {
            if (!config[field]) {
                missingFields.push(field);
            }
        }
        
        if (missingFields.length > 0) {
            result.errors.push(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // 4. 测试路由引擎兼容性
        console.log(`   🎯 测试路由引擎兼容性...`);
        
        try {
            const engine = new RoutingEngine(config);
            console.log(`   ✅ 路由引擎创建成功`);

            // 测试所有路由类别
            if (config.routing && config.routing.categories) {
                const categories = Object.keys(config.routing.categories);
                console.log(`   📊 测试 ${categories.length} 个路由类别...`);

                for (const category of categories) {
                    const categoryConfig = config.routing.categories[category];
                    
                    // 检查类别配置结构
                    if (!categoryConfig.provider) {
                        result.errors.push(`Category ${category}: missing provider field`);
                    }
                    if (!categoryConfig.model) {
                        result.errors.push(`Category ${category}: missing model field`);
                    }
                    
                    // 检查provider是否存在于providers配置中
                    if (categoryConfig.provider && !config.providers[categoryConfig.provider]) {
                        result.errors.push(`Category ${category}: provider '${categoryConfig.provider}' not found in providers config`);
                    }

                    // 模拟路由测试
                    try {
                        const testRequest = {
                            model: 'test-model',
                            messages: [{ role: 'user', content: '测试' }],
                            metadata: {}
                        };

                        // 覆盖determineCategory方法来测试特定类别
                        const originalMethod = engine.determineCategory;
                        engine.determineCategory = () => category;
                        
                        const providerId = engine.route(testRequest, `test-${category}`);
                        
                        if (providerId !== categoryConfig.provider) {
                            result.errors.push(`Category ${category}: routing returned '${providerId}' but expected '${categoryConfig.provider}'`);
                        }

                        // 恢复原始方法
                        engine.determineCategory = originalMethod;
                        
                    } catch (routingError) {
                        result.errors.push(`Category ${category}: routing failed - ${routingError.message}`);
                    }
                }
            } else {
                result.errors.push('Missing routing.categories configuration');
            }
            
        } catch (engineError) {
            result.errors.push(`RoutingEngine creation failed: ${engineError.message}`);
        }

        // 5. 检查provider配置完整性
        if (config.providers) {
            console.log(`   🔌 验证 ${Object.keys(config.providers).length} 个Provider配置...`);
            
            for (const [providerName, providerConfig] of Object.entries(config.providers)) {
                if (!providerConfig.type) {
                    result.errors.push(`Provider ${providerName}: missing type field`);
                }
                if (!providerConfig.endpoint) {
                    result.errors.push(`Provider ${providerName}: missing endpoint field`);
                }
                if (!providerConfig.authentication) {
                    result.errors.push(`Provider ${providerName}: missing authentication field`);
                }
            }
        }

        // 6. 确定最终状态
        if (result.errors.length === 0) {
            result.status = 'passed';
            console.log(`   ✅ 所有测试通过`);
        } else {
            result.status = 'needs_fix';
            console.log(`   ⚠️  发现 ${result.errors.length} 个问题`);
            
            // 生成修复建议
            if (missingFields.length > 0) {
                result.fixes.push(`Add missing fields: ${missingFields.join(', ')}`);
            }
            if (result.errors.some(e => e.includes('routing.categories'))) {
                result.fixes.push('Update routing configuration to use routing.categories structure');
            }
        }

    } catch (parseError) {
        result.status = 'failed';
        result.errors.push(`Parse error: ${parseError.message}`);
        console.log(`   ❌ 解析失败: ${parseError.message}`);
    }

    return result;
}

// 运行测试
testV3ConfigBlackbox();