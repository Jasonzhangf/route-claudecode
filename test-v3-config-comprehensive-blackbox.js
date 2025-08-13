/**
 * V3配置文件全面黑盒测试
 * 包含Provider类型验证、路由系统验证、服务器启动验证
 * 真正的端到端黑盒测试，检测所有潜在问题
 */

import { RoutingEngine } from './src/v3/router/routing-engine.js';
import { loadUserConfig } from './src/v3/config/config-merger.js';
import { RouterServer } from './dist/v3/server/router-server.js';
import fs from 'fs';
import path from 'path';

console.log('🔧 V3配置文件全面黑盒测试开始...\n');

// V3系统支持的Provider类型（从类型定义中获取）
const SUPPORTED_PROVIDER_TYPES = [
    'codewhisperer', 
    'gemini', 
    'openai', 
    'anthropic', 
    'lmstudio', 
    'shuaihong'
];

// Provider Protocol工厂支持的类型
const PROVIDER_PROTOCOL_TYPES = [
    'anthropic',
    'openai', 
    'gemini',
    'codewhisperer'
];

async function testV3ConfigComprehensive() {
    try {
        // 1. 发现所有V3配置文件
        const configFiles = [
            './src/v3/config/environments/development/config.json',
            './src/v3/config/environments/production/config.json', 
            './src/v3/config/environments/testing/config.json',
            './config/user/user-config-lmstudio.json',
            './config/user/user-config-mixed-providers.json'
        ];

        console.log('📋 发现的配置文件:');
        for (const file of configFiles) {
            console.log(`   ${fs.existsSync(file) ? '✅' : '❌'} ${file}`);
        }

        const testResults = [];

        // 2. 对每个配置文件进行全面黑盒测试
        for (const configFile of configFiles) {
            console.log(`\n🔧 全面黑盒测试: ${configFile}`);
            
            if (!fs.existsSync(configFile)) {
                console.log(`⚠️  配置文件不存在，跳过: ${configFile}`);
                testResults.push({
                    file: configFile,
                    status: 'missing',
                    errors: ['File does not exist'],
                    tests: {
                        configParsing: 'skipped',
                        providerTypeValidation: 'skipped',
                        routingEngineTest: 'skipped',
                        serverInitializationTest: 'skipped',
                        providerProtocolTest: 'skipped'
                    }
                });
                continue;
            }

            try {
                const result = await testSingleConfigComprehensive(configFile);
                testResults.push(result);
                
            } catch (error) {
                console.error(`❌ 测试失败: ${error.message}`);
                testResults.push({
                    file: configFile,
                    status: 'failed',
                    errors: [error.message],
                    tests: {
                        configParsing: 'failed',
                        providerTypeValidation: 'failed',
                        routingEngineTest: 'failed',
                        serverInitializationTest: 'failed',
                        providerProtocolTest: 'failed'
                    }
                });
            }
        }

        // 3. 汇总测试结果
        console.log('\n📊 全面测试结果汇总:');
        const passed = testResults.filter(r => r.status === 'passed').length;
        const failed = testResults.filter(r => r.status === 'failed').length;
        const missing = testResults.filter(r => r.status === 'missing').length;
        const needsFix = testResults.filter(r => r.status === 'needs_fix').length;

        console.log(`   ✅ 完全通过: ${passed}`);
        console.log(`   ❌ 测试失败: ${failed}`);
        console.log(`   ⚠️  文件缺失: ${missing}`);
        console.log(`   🔧 需要修复: ${needsFix}`);

        // 4. 分类错误分析
        console.log('\n🔍 错误分类分析:');
        const errorCategories = {
            configParsing: 0,
            providerTypeValidation: 0,
            routingEngineTest: 0,
            serverInitializationTest: 0,
            providerProtocolTest: 0
        };

        for (const result of testResults) {
            if (result.tests) {
                Object.keys(errorCategories).forEach(testType => {
                    if (result.tests[testType] === 'failed') {
                        errorCategories[testType]++;
                    }
                });
            }
        }

        console.log('   错误类型统计:');
        Object.entries(errorCategories).forEach(([testType, count]) => {
            if (count > 0) {
                console.log(`     ${testType}: ${count} 个配置文件失败`);
            }
        });

        // 5. 详细错误报告
        console.log('\n📝 详细错误报告:');
        for (const result of testResults) {
            if (result.status !== 'passed') {
                console.log(`\n   📄 ${result.file}:`);
                console.log(`   状态: ${result.status}`);
                
                if (result.tests) {
                    console.log('   测试结果:');
                    Object.entries(result.tests).forEach(([testType, status]) => {
                        const icon = status === 'passed' ? '✅' : 
                                   status === 'failed' ? '❌' : 
                                   status === 'skipped' ? '⏭️' : '⚠️';
                        console.log(`     ${icon} ${testType}: ${status}`);
                    });
                }
                
                if (result.errors && result.errors.length > 0) {
                    console.log('   具体错误:');
                    result.errors.forEach(error => {
                        console.log(`     - ${error}`);
                    });
                }
                
                if (result.fixes && result.fixes.length > 0) {
                    console.log('   建议修复:');
                    result.fixes.forEach(fix => {
                        console.log(`     → ${fix}`);
                    });
                }
            }
        }

        console.log('\n🎉 V3配置文件全面黑盒测试完成！');
        
        return testResults;
        
    } catch (error) {
        console.error('\n❌ V3配置文件全面黑盒测试失败:');
        console.error('错误消息:', error.message);
        console.error('错误堆栈:\n', error.stack);
        throw error;
    }
}

/**
 * 对单个配置文件进行全面测试
 */
async function testSingleConfigComprehensive(configFile) {
    const result = {
        file: configFile,
        status: 'unknown',
        errors: [],
        fixes: [],
        tests: {
            configParsing: 'pending',
            providerTypeValidation: 'pending',
            routingEngineTest: 'pending',
            serverInitializationTest: 'pending',
            providerProtocolTest: 'pending'
        }
    };

    try {
        // 测试1: 配置解析测试
        console.log(`   📋 测试1: 配置解析...`);
        let config;
        try {
            const configContent = fs.readFileSync(configFile, 'utf8');
            const rawConfig = JSON.parse(configContent);
            
            // 检查是否是用户配置格式（需要合并）
            const isUserConfig = !rawConfig.server?.architecture && 
                                !rawConfig.errors && 
                                !rawConfig.validation;
            
            if (isUserConfig) {
                console.log(`     🔄 用户配置，进行合并...`);
                config = loadUserConfig(configFile);
                console.log(`     ✅ 配置合并成功`);
            } else {
                console.log(`     ⚙️  系统配置，直接使用`);
                config = rawConfig;
            }
            
            result.tests.configParsing = 'passed';
            console.log(`   ✅ 测试1通过: 配置解析成功`);
        } catch (parseError) {
            result.tests.configParsing = 'failed';
            result.errors.push(`配置解析失败: ${parseError.message}`);
            console.log(`   ❌ 测试1失败: ${parseError.message}`);
            throw parseError; // 配置解析失败，后续测试无法进行
        }

        // 测试2: Provider类型验证测试
        console.log(`   🔌 测试2: Provider类型验证...`);
        try {
            if (!config.providers || Object.keys(config.providers).length === 0) {
                throw new Error('No providers configured');
            }

            const providerValidationErrors = [];
            for (const [providerName, providerConfig] of Object.entries(config.providers)) {
                console.log(`     🔍 验证Provider: ${providerName}`);
                
                // 检查基本字段
                if (!providerConfig.type) {
                    providerValidationErrors.push(`Provider ${providerName}: missing type field`);
                    continue;
                }
                
                // 检查类型是否受支持
                if (!SUPPORTED_PROVIDER_TYPES.includes(providerConfig.type)) {
                    providerValidationErrors.push(`Provider ${providerName}: unsupported type '${providerConfig.type}'. Supported types: ${SUPPORTED_PROVIDER_TYPES.join(', ')}`);
                }
                
                // 检查Provider Protocol支持
                if (!PROVIDER_PROTOCOL_TYPES.includes(providerConfig.type)) {
                    providerValidationErrors.push(`Provider ${providerName}: type '${providerConfig.type}' not supported by Provider Protocol layer. Supported: ${PROVIDER_PROTOCOL_TYPES.join(', ')}`);
                }
                
                // 检查其他必需字段
                if (!providerConfig.endpoint) {
                    providerValidationErrors.push(`Provider ${providerName}: missing endpoint field`);
                }
                if (!providerConfig.authentication) {
                    providerValidationErrors.push(`Provider ${providerName}: missing authentication field`);
                }
                
                console.log(`     ✅ Provider ${providerName}: 类型=${providerConfig.type}, 端点=${providerConfig.endpoint}`);
            }

            if (providerValidationErrors.length > 0) {
                result.errors.push(...providerValidationErrors);
                result.tests.providerTypeValidation = 'failed';
                console.log(`   ❌ 测试2失败: 发现${providerValidationErrors.length}个Provider类型问题`);
            } else {
                result.tests.providerTypeValidation = 'passed';
                console.log(`   ✅ 测试2通过: 所有Provider类型有效`);
            }
        } catch (error) {
            result.tests.providerTypeValidation = 'failed';
            result.errors.push(`Provider类型验证失败: ${error.message}`);
            console.log(`   ❌ 测试2失败: ${error.message}`);
        }

        // 测试3: 路由引擎测试
        console.log(`   🎯 测试3: 路由引擎测试...`);
        try {
            const engine = new RoutingEngine(config);
            console.log(`     ✅ 路由引擎创建成功`);

            // 测试所有路由类别
            if (config.routing && config.routing.categories) {
                const categories = Object.keys(config.routing.categories);
                console.log(`     📊 测试 ${categories.length} 个路由类别...`);

                const routingErrors = [];
                for (const category of categories) {
                    const categoryConfig = config.routing.categories[category];
                    
                    // 检查类别配置结构
                    if (!categoryConfig.provider) {
                        routingErrors.push(`Category ${category}: missing provider field`);
                        continue;
                    }
                    if (!categoryConfig.model) {
                        routingErrors.push(`Category ${category}: missing model field`);
                        continue;
                    }
                    
                    // 检查provider是否存在于providers配置中
                    if (!config.providers[categoryConfig.provider]) {
                        routingErrors.push(`Category ${category}: provider '${categoryConfig.provider}' not found in providers config`);
                        continue;
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
                            routingErrors.push(`Category ${category}: routing returned '${providerId}' but expected '${categoryConfig.provider}'`);
                        } else {
                            console.log(`     ✅ 类别 ${category}: ${categoryConfig.provider} → ${categoryConfig.model}`);
                        }

                        // 恢复原始方法
                        engine.determineCategory = originalMethod;
                        
                    } catch (routingError) {
                        routingErrors.push(`Category ${category}: routing failed - ${routingError.message}`);
                    }
                }

                if (routingErrors.length > 0) {
                    result.errors.push(...routingErrors);
                    result.tests.routingEngineTest = 'failed';
                    console.log(`   ❌ 测试3失败: 发现${routingErrors.length}个路由问题`);
                } else {
                    result.tests.routingEngineTest = 'passed';
                    console.log(`   ✅ 测试3通过: 所有路由类别正常`);
                }
            } else {
                result.errors.push('Missing routing.categories configuration');
                result.tests.routingEngineTest = 'failed';
                console.log(`   ❌ 测试3失败: 缺少routing.categories配置`);
            }
            
        } catch (engineError) {
            result.tests.routingEngineTest = 'failed';
            result.errors.push(`RoutingEngine creation failed: ${engineError.message}`);
            console.log(`   ❌ 测试3失败: 路由引擎创建失败 - ${engineError.message}`);
        }

        // 测试4: 服务器初始化测试
        console.log(`   🚀 测试4: 服务器初始化测试...`);
        try {
            // 尝试创建RouterServer实例（但不启动）
            const server = new RouterServer(config);
            console.log(`     ✅ RouterServer实例创建成功`);
            
            result.tests.serverInitializationTest = 'passed';
            console.log(`   ✅ 测试4通过: 服务器初始化成功`);
            
        } catch (serverError) {
            result.tests.serverInitializationTest = 'failed';
            result.errors.push(`Server initialization failed: ${serverError.message}`);
            console.log(`   ❌ 测试4失败: 服务器初始化失败 - ${serverError.message}`);
        }

        // 测试5: Provider Protocol测试（模拟）
        console.log(`   🔗 测试5: Provider Protocol支持测试...`);
        try {
            const protocolErrors = [];
            
            for (const [providerName, providerConfig] of Object.entries(config.providers)) {
                console.log(`     🔍 检查Provider Protocol支持: ${providerName}`);
                
                // 检查Provider类型是否被Protocol层支持
                if (!PROVIDER_PROTOCOL_TYPES.includes(providerConfig.type)) {
                    protocolErrors.push(`Provider ${providerName}: type '${providerConfig.type}' not supported by Provider Protocol layer`);
                } else {
                    console.log(`     ✅ Provider ${providerName}: Protocol支持 ${providerConfig.type}`);
                }
            }

            if (protocolErrors.length > 0) {
                result.errors.push(...protocolErrors);
                result.tests.providerProtocolTest = 'failed';
                console.log(`   ❌ 测试5失败: 发现${protocolErrors.length}个Protocol问题`);
            } else {
                result.tests.providerProtocolTest = 'passed';
                console.log(`   ✅ 测试5通过: 所有Provider Protocol支持`);
            }
            
        } catch (protocolError) {
            result.tests.providerProtocolTest = 'failed';
            result.errors.push(`Provider Protocol test failed: ${protocolError.message}`);
            console.log(`   ❌ 测试5失败: ${protocolError.message}`);
        }

        // 6. 确定最终状态
        const failedTests = Object.values(result.tests).filter(status => status === 'failed').length;
        
        if (failedTests === 0) {
            result.status = 'passed';
            console.log(`   🎉 所有5项测试通过！`);
        } else {
            result.status = 'needs_fix';
            console.log(`   ⚠️  ${failedTests}/5 项测试失败，需要修复`);
            
            // 生成修复建议
            if (result.errors.some(e => e.includes('unsupported type'))) {
                result.fixes.push('修正不支持的Provider类型：将openai-compatible改为openai');
            }
            if (result.errors.some(e => e.includes('not supported by Provider Protocol'))) {
                result.fixes.push('确保Provider类型被Protocol层支持');
            }
            if (result.errors.some(e => e.includes('routing.categories'))) {
                result.fixes.push('添加或修正routing.categories配置结构');
            }
        }

    } catch (error) {
        result.status = 'failed';
        result.errors.push(`全面测试失败: ${error.message}`);
        console.log(`   ❌ 全面测试失败: ${error.message}`);
    }

    return result;
}

// 运行测试
testV3ConfigComprehensive();