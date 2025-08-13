#!/usr/bin/env node

/**
 * LMStudio路由连接检查工具
 * 检查路由系统是否是mockup，以及是否正确连接到LMStudio
 * Author: Jason Zhang
 * Version: v3.0
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioRoutingConnectionChecker {
    constructor() {
        this.checkId = `lmstudio-routing-check-${Date.now()}`;
        this.results = {
            checkId: this.checkId,
            timestamp: new Date().toISOString(),
            checks: {},
            summary: {
                isMockup: null,
                isConnectedToLMStudio: null,
                overallStatus: 'unknown'
            }
        };
        
        console.log('🔍 LMStudio路由连接检查工具启动');
        console.log(`📊 检查ID: ${this.checkId}`);
    }

    /**
     * 检查1: LMStudio服务器状态
     */
    async checkLMStudioServer() {
        console.log('\n📋 检查1: LMStudio服务器状态');
        
        try {
            // 检查LMStudio服务器是否运行
            const modelsResponse = await fetch('http://localhost:1234/v1/models');
            
            if (!modelsResponse.ok) {
                throw new Error(`HTTP ${modelsResponse.status}: ${modelsResponse.statusText}`);
            }
            
            const models = await modelsResponse.json();
            const modelCount = models.data?.length || 0;
            
            console.log(`   ✅ LMStudio服务器运行正常`);
            console.log(`   📊 可用模型数量: ${modelCount}`);
            
            if (modelCount > 0) {
                console.log(`   🎯 当前加载的模型: ${models.data[0].id}`);
            }
            
            // 测试基本完成功能
            const testResponse = await fetch('http://localhost:1234/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'local-model',
                    messages: [{ role: 'user', content: 'Hello' }],
                    max_tokens: 10
                })
            });
            
            const testResult = await testResponse.json();
            
            this.results.checks.lmstudioServer = {
                success: true,
                running: true,
                modelCount: modelCount,
                currentModel: models.data?.[0]?.id || 'unknown',
                completionTest: testResponse.ok,
                testResponse: testResult
            };
            
            console.log(`   ✅ 完成测试: ${testResponse.ok ? '成功' : '失败'}`);
            
            return true;
            
        } catch (error) {
            console.log(`   ❌ LMStudio服务器检查失败: ${error.message}`);
            
            this.results.checks.lmstudioServer = {
                success: false,
                running: false,
                error: error.message
            };
            
            return false;
        }
    }

    /**
     * 检查2: 路由服务器状态
     */
    async checkRouterServer() {
        console.log('\n📋 检查2: 路由服务器状态');
        
        try {
            // 检查路由服务器状态
            const statusResponse = await fetch('http://localhost:5506/status');
            
            if (!statusResponse.ok) {
                throw new Error(`HTTP ${statusResponse.status}: ${statusResponse.statusText}`);
            }
            
            const status = await statusResponse.json();
            
            console.log(`   ✅ 路由服务器运行正常`);
            console.log(`   📊 服务器版本: ${status.version}`);
            console.log(`   📊 运行时间: ${Math.round(status.uptime)}秒`);
            console.log(`   📊 提供商数量: ${status.providers?.length || 0}`);
            console.log(`   📊 提供商列表: ${status.providers?.join(', ') || 'none'}`);
            console.log(`   📊 调试模式: ${status.debug ? '启用' : '禁用'}`);
            
            // 检查健康状态
            const healthResponse = await fetch('http://localhost:5506/health');
            const health = await healthResponse.json();
            
            console.log(`   📊 健康状态: ${health.overall}`);
            console.log(`   📊 健康提供商: ${health.healthy}/${health.total}`);
            
            this.results.checks.routerServer = {
                success: true,
                running: true,
                version: status.version,
                uptime: status.uptime,
                providers: status.providers,
                debug: status.debug,
                health: health.overall,
                healthyProviders: health.healthy,
                totalProviders: health.total,
                providerDetails: health.providers
            };
            
            return true;
            
        } catch (error) {
            console.log(`   ❌ 路由服务器检查失败: ${error.message}`);
            
            this.results.checks.routerServer = {
                success: false,
                running: false,
                error: error.message
            };
            
            return false;
        }
    }

    /**
     * 检查3: 路由配置分析
     */
    async checkRoutingConfiguration() {
        console.log('\n📋 检查3: 路由配置分析');
        
        try {
            // 查找当前运行的配置文件
            const configPaths = [
                '/Users/fanzhang/.route-claudecode/config/v3/single-provider/config-lmstudio-v3-5506.json',
                './test/output/functional/test-service-data/test-config/single-provider/config-openai-lmstudio-5506.json',
                './test-config-lmstudio.json'
            ];
            
            let activeConfig = null;
            let configPath = null;
            
            for (const path of configPaths) {
                try {
                    const content = await fs.readFile(path, 'utf-8');
                    activeConfig = JSON.parse(content);
                    configPath = path;
                    console.log(`   ✅ 找到配置文件: ${path}`);
                    break;
                } catch (error) {
                    // 继续尝试下一个路径
                }
            }
            
            if (!activeConfig) {
                throw new Error('未找到活动的LMStudio配置文件');
            }
            
            // 分析配置
            const isLMStudioConfig = this.analyzeLMStudioConfig(activeConfig);
            
            console.log(`   📊 配置版本: ${activeConfig.version || 'unknown'}`);
            console.log(`   📊 服务器端口: ${activeConfig.server?.port || 'unknown'}`);
            console.log(`   📊 路由策略: ${activeConfig.routing?.strategy || 'unknown'}`);
            console.log(`   📊 默认提供商: ${activeConfig.routing?.defaultProvider || 'unknown'}`);
            
            // 检查LMStudio相关配置
            if (activeConfig.openaicompatible?.baseURL) {
                console.log(`   📊 LMStudio端点: ${activeConfig.openaicompatible.baseURL}`);
                console.log(`   📊 是否指向LMStudio: ${activeConfig.openaicompatible.baseURL.includes('localhost:1234') ? '是' : '否'}`);
            }
            
            this.results.checks.routingConfiguration = {
                success: true,
                configPath: configPath,
                config: activeConfig,
                isLMStudioConfig: isLMStudioConfig,
                version: activeConfig.version,
                port: activeConfig.server?.port,
                strategy: activeConfig.routing?.strategy,
                defaultProvider: activeConfig.routing?.defaultProvider,
                lmstudioEndpoint: activeConfig.openaicompatible?.baseURL
            };
            
            return isLMStudioConfig;
            
        } catch (error) {
            console.log(`   ❌ 路由配置分析失败: ${error.message}`);
            
            this.results.checks.routingConfiguration = {
                success: false,
                error: error.message
            };
            
            return false;
        }
    }

    /**
     * 检查4: 实际连接测试
     */
    async checkActualConnection() {
        console.log('\n📋 检查4: 实际连接测试');
        
        try {
            // 通过路由服务器发送测试请求
            const testRequest = {
                model: 'qwen3-30b', // 使用配置中的模型名
                messages: [{ 
                    role: 'user', 
                    content: '请回答：你是通过什么方式连接的？请简短回答。' 
                }],
                max_tokens: 50,
                stream: false
            };
            
            console.log('   📡 通过路由服务器发送测试请求...');
            
            const startTime = Date.now();
            const response = await fetch('http://localhost:5506/v1/messages', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(testRequest)
            });
            
            const duration = Date.now() - startTime;
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            console.log(`   ✅ 连接测试成功`);
            console.log(`   📊 响应时间: ${duration}ms`);
            console.log(`   📊 响应类型: ${result.type || 'unknown'}`);
            console.log(`   📊 模型: ${result.model || 'unknown'}`);
            
            if (result.content && result.content.length > 0) {
                const responseText = result.content[0].text || '';
                console.log(`   📊 响应内容: ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}`);
                
                // 分析响应内容判断是否为mockup
                const isMockupResponse = this.analyzeResponseForMockup(responseText);
                console.log(`   📊 是否为模拟响应: ${isMockupResponse ? '是' : '否'}`);
            }
            
            this.results.checks.actualConnection = {
                success: true,
                responseTime: duration,
                response: result,
                isMockupResponse: this.analyzeResponseForMockup(result.content?.[0]?.text || ''),
                connectionWorking: true
            };
            
            return true;
            
        } catch (error) {
            console.log(`   ❌ 实际连接测试失败: ${error.message}`);
            
            this.results.checks.actualConnection = {
                success: false,
                error: error.message,
                connectionWorking: false
            };
            
            return false;
        }
    }

    /**
     * 检查5: 代码分析 - 查找mockup标识
     */
    async checkCodeForMockup() {
        console.log('\n📋 检查5: 代码分析 - 查找mockup标识');
        
        try {
            const mockupIndicators = [];
            
            // 检查关键文件中的mockup标识
            const filesToCheck = [
                'src/v3/provider-protocol/base-provider.ts',
                'src/v3/server/router-server.ts',
                'src/v3/session/manager.ts',
                'src/v3/debug/debug-system.ts'
            ];
            
            for (const filePath of filesToCheck) {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    
                    // 查找mockup相关的代码
                    const mockupPatterns = [
                        /mock|Mock|MOCK/g,
                        /createMockResponse/g,
                        /Mock implementation/g,
                        /placeholder|Placeholder/g,
                        /TODO.*implement/g
                    ];
                    
                    for (const pattern of mockupPatterns) {
                        const matches = content.match(pattern);
                        if (matches) {
                            mockupIndicators.push({
                                file: filePath,
                                pattern: pattern.toString(),
                                matches: matches.length,
                                examples: matches.slice(0, 3)
                            });
                        }
                    }
                } catch (error) {
                    // 文件不存在或无法读取，跳过
                }
            }
            
            console.log(`   📊 检查文件数量: ${filesToCheck.length}`);
            console.log(`   📊 发现mockup标识: ${mockupIndicators.length}个文件`);
            
            if (mockupIndicators.length > 0) {
                console.log('   ⚠️ 发现的mockup标识:');
                mockupIndicators.forEach(indicator => {
                    console.log(`     - ${indicator.file}: ${indicator.matches}个匹配`);
                });
            } else {
                console.log('   ✅ 未发现明显的mockup标识');
            }
            
            this.results.checks.codeAnalysis = {
                success: true,
                filesChecked: filesToCheck.length,
                mockupIndicators: mockupIndicators,
                hasMockupCode: mockupIndicators.length > 0
            };
            
            return mockupIndicators.length === 0;
            
        } catch (error) {
            console.log(`   ❌ 代码分析失败: ${error.message}`);
            
            this.results.checks.codeAnalysis = {
                success: false,
                error: error.message
            };
            
            return null;
        }
    }

    /**
     * 分析配置是否为LMStudio配置
     */
    analyzeLMStudioConfig(config) {
        const indicators = {
            hasLMStudioEndpoint: false,
            hasLMStudioProvider: false,
            hasCorrectPort: false,
            isLMStudioConfig: false
        };
        
        // 检查端点配置
        if (config.openaicompatible?.baseURL?.includes('localhost:1234')) {
            indicators.hasLMStudioEndpoint = true;
        }
        
        // 检查提供商配置
        if (config.routing?.models) {
            for (const [modelName, modelConfig] of Object.entries(config.routing.models)) {
                if (modelConfig.account === 'lmstudio' || modelConfig.provider === 'lmstudio') {
                    indicators.hasLMStudioProvider = true;
                    break;
                }
            }
        }
        
        // 检查端口配置
        if (config.server?.port === 5506) {
            indicators.hasCorrectPort = true;
        }
        
        indicators.isLMStudioConfig = indicators.hasLMStudioEndpoint && 
                                    (indicators.hasLMStudioProvider || indicators.hasCorrectPort);
        
        return indicators.isLMStudioConfig;
    }

    /**
     * 分析响应内容判断是否为mockup
     */
    analyzeResponseForMockup(responseText) {
        if (!responseText || typeof responseText !== 'string') {
            return false;
        }
        
        const mockupPatterns = [
            /mock|Mock|MOCK/i,
            /placeholder|Placeholder/i,
            /test.*response/i,
            /simulated|simulation/i,
            /dummy.*data/i,
            /This is a mock/i
        ];
        
        return mockupPatterns.some(pattern => pattern.test(responseText));
    }

    /**
     * 生成最终分析报告
     */
    generateFinalReport() {
        console.log('\n📋 最终分析报告');
        console.log('='.repeat(50));
        
        // 分析是否为mockup
        let isMockup = false;
        let mockupReasons = [];
        
        // 检查代码中是否有mockup
        if (this.results.checks.codeAnalysis?.hasMockupCode) {
            isMockup = true;
            mockupReasons.push('代码中发现mockup实现');
        }
        
        // 检查响应是否为mockup
        if (this.results.checks.actualConnection?.isMockupResponse) {
            isMockup = true;
            mockupReasons.push('响应内容显示为模拟数据');
        }
        
        // 检查连接失败
        if (!this.results.checks.actualConnection?.connectionWorking) {
            mockupReasons.push('实际连接测试失败');
        }
        
        // 分析是否连接到LMStudio
        let isConnectedToLMStudio = false;
        let connectionReasons = [];
        
        if (this.results.checks.lmstudioServer?.running) {
            connectionReasons.push('LMStudio服务器运行正常');
        } else {
            connectionReasons.push('LMStudio服务器未运行');
        }
        
        if (this.results.checks.routingConfiguration?.isLMStudioConfig) {
            connectionReasons.push('路由配置指向LMStudio');
        } else {
            connectionReasons.push('路由配置未正确指向LMStudio');
        }
        
        if (this.results.checks.actualConnection?.connectionWorking && !isMockup) {
            isConnectedToLMStudio = true;
            connectionReasons.push('实际连接测试成功且非模拟');
        }
        
        // 更新结果
        this.results.summary.isMockup = isMockup;
        this.results.summary.isConnectedToLMStudio = isConnectedToLMStudio;
        this.results.summary.overallStatus = isConnectedToLMStudio ? 'connected' : 
                                           isMockup ? 'mockup' : 'disconnected';
        
        // 输出报告
        console.log(`📊 是否为Mockup系统: ${isMockup ? '是' : '否'}`);
        if (mockupReasons.length > 0) {
            console.log(`   原因: ${mockupReasons.join(', ')}`);
        }
        
        console.log(`📊 是否连接到LMStudio: ${isConnectedToLMStudio ? '是' : '否'}`);
        console.log(`   原因: ${connectionReasons.join(', ')}`);
        
        console.log(`📊 总体状态: ${this.results.summary.overallStatus.toUpperCase()}`);
        
        // 生成建议
        this.generateRecommendations();
        
        return this.results.summary;
    }

    /**
     * 生成建议
     */
    generateRecommendations() {
        console.log('\n📋 建议和下一步操作');
        console.log('-'.repeat(30));
        
        const recommendations = [];
        
        if (this.results.summary.isMockup) {
            recommendations.push('🔧 系统当前使用mockup实现，需要启用真实的LMStudio连接');
            recommendations.push('📝 检查provider-protocol实现，确保使用真实的HTTP客户端');
            recommendations.push('🔍 审查代码中的mock标识，替换为实际实现');
        }
        
        if (!this.results.checks.lmstudioServer?.running) {
            recommendations.push('🚀 启动LMStudio服务器在端口1234');
            recommendations.push('📋 确保LMStudio中加载了合适的模型');
        }
        
        if (!this.results.checks.routingConfiguration?.isLMStudioConfig) {
            recommendations.push('⚙️ 检查路由配置文件，确保正确指向LMStudio端点');
            recommendations.push('🔗 验证openaicompatible.baseURL设置为http://localhost:1234');
        }
        
        if (!this.results.checks.actualConnection?.connectionWorking) {
            recommendations.push('🔌 测试网络连接，确保路由服务器能访问LMStudio');
            recommendations.push('📊 检查防火墙和端口设置');
        }
        
        if (this.results.summary.isConnectedToLMStudio) {
            recommendations.push('✅ 系统工作正常，LMStudio连接已建立');
            recommendations.push('📈 可以进行生产环境部署');
        }
        
        recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
        });
    }

    /**
     * 保存检查结果
     */
    async saveResults() {
        const resultsFile = `lmstudio-routing-check-${Date.now()}.json`;
        await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));
        
        console.log(`\n💾 检查结果已保存: ${resultsFile}`);
        return resultsFile;
    }

    /**
     * 运行完整检查
     */
    async runFullCheck() {
        console.log('\n🚀 开始LMStudio路由连接完整检查...\n');
        
        try {
            // 执行所有检查
            await this.checkLMStudioServer();
            await this.checkRouterServer();
            await this.checkRoutingConfiguration();
            await this.checkActualConnection();
            await this.checkCodeForMockup();
            
            // 生成最终报告
            const summary = this.generateFinalReport();
            
            // 保存结果
            await this.saveResults();
            
            return summary;
            
        } catch (error) {
            console.error('❌ 检查过程中发生错误:', error.message);
            this.results.error = error.message;
            return this.results.summary;
        }
    }
}

// CLI接口
if (import.meta.url === `file://${process.argv[1]}`) {
    const checker = new LMStudioRoutingConnectionChecker();
    
    checker.runFullCheck()
        .then(summary => {
            console.log(`\n🎯 检查完成: ${summary.overallStatus.toUpperCase()}`);
            
            if (summary.overallStatus === 'connected') {
                console.log('🎉 LMStudio路由连接正常工作！');
                process.exit(0);
            } else if (summary.overallStatus === 'mockup') {
                console.log('⚠️ 系统当前使用mockup实现，需要启用真实连接');
                process.exit(1);
            } else {
                console.log('❌ LMStudio路由连接存在问题，请查看建议');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 检查工具执行失败:', error);
            process.exit(1);
        });
}

export default LMStudioRoutingConnectionChecker;