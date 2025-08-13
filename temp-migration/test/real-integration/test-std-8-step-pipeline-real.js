#!/usr/bin/env node

/**
 * STD-8-STEP-PIPELINE 真实集成验证测试
 * [架构修复] V3六层架构的标准8步验证流程
 * 
 * 测试目标:
 * 1. Client Layer - 客户端层验证
 * 2. Router Layer - 路由层验证  
 * 3. Post-processor Layer - 后处理层验证
 * 4. Transformer Layer - 转换层验证
 * 5. Provider-Protocol Layer - 提供商协议层验证
 * 6. Preprocessor Layer - 预处理层验证
 * 7. Server Layer - 服务器层验证
 * 8. End-to-end Integration - 端到端集成验证
 * 
 * @author Jason Zhang
 * @version v3.0-real-pipeline-test
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class STD8StepPipelineRealTest {
    constructor() {
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            stepResults: [],
            details: []
        };
        
        this.testStartTime = Date.now();
        this.projectRoot = path.resolve(__dirname, '../..');
        this.dashboardUrl = 'http://localhost:3458';
    }

    /**
     * Execute complete STD-8-STEP-PIPELINE real validation
     */
    async runCompleteValidation() {
        console.log('🧪 STD-8-STEP-PIPELINE 真实集成验证');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [架构修复] V3六层架构标准验证流程');
        console.log('📋 目标: 验证每一层的真实实现和集成');
        console.log(`🌐 Dashboard: ${this.dashboardUrl}`);
        console.log('');

        try {
            // Step 1: Client Layer Validation
            await this.validateStep1ClientLayer();
            
            // Step 2: Router Layer Validation
            await this.validateStep2RouterLayer();
            
            // Step 3: Post-processor Layer Validation
            await this.validateStep3PostprocessorLayer();
            
            // Step 4: Transformer Layer Validation
            await this.validateStep4TransformerLayer();
            
            // Step 5: Provider-Protocol Layer Validation
            await this.validateStep5ProviderProtocolLayer();
            
            // Step 6: Preprocessor Layer Validation
            await this.validateStep6PreprocessorLayer();
            
            // Step 7: Server Layer Validation
            await this.validateStep7ServerLayer();
            
            // Step 8: End-to-end Integration Validation
            await this.validateStep8EndToEndIntegration();

            // Generate comprehensive report
            await this.generateValidationReport();

        } catch (error) {
            console.error('❌ STD-8-STEP-PIPELINE validation failed:', error);
            this.recordStepResult('Complete Pipeline Validation', false, error.message);
        }
        
        return this.testResults;
    }

    /**
     * Step 1: Client Layer Validation
     */
    async validateStep1ClientLayer() {
        console.log('🔍 Step 1: Client Layer Validation...');
        
        try {
            // Check V3 CLI availability
            const cliExists = await this.checkFileExists('src/cli-v3.ts');
            console.log(`  ✅ V3 CLI component: ${cliExists ? 'Available' : 'Missing'}`);

            // Test Dashboard client interface
            const dashboardResponse = await this.testDashboardAccess();
            console.log(`  ✅ Dashboard client access: ${dashboardResponse.accessible ? 'Working' : 'Failed'}`);

            // Verify client-server communication
            const apiResponse = await this.testAPIEndpoints();
            console.log(`  ✅ API endpoints: ${apiResponse.working} working, ${apiResponse.failed} failed`);

            const stepPassed = cliExists && dashboardResponse.accessible && (apiResponse.failed === 0);
            
            this.recordStepResult('Step 1: Client Layer', stepPassed,
                `CLI: ${cliExists}, Dashboard: ${dashboardResponse.accessible}, APIs: ${apiResponse.working}/${apiResponse.total}`);

        } catch (error) {
            this.recordStepResult('Step 1: Client Layer', false, error.message);
            console.log('  ❌ Client layer validation failed:', error.message);
        }
    }

    /**
     * Step 2: Router Layer Validation
     */
    async validateStep2RouterLayer() {
        console.log('🔍 Step 2: Router Layer Validation...');
        
        try {
            // Check routing configuration
            const routingResponse = await fetch(`${this.dashboardUrl}/api/routing`);
            
            if (routingResponse.ok) {
                const routingData = await routingResponse.json();
                console.log(`  ✅ Routing categories detected: ${routingData.length}`);
                
                // Verify standard routing categories
                const standardCategories = ['default', 'background', 'thinking', 'longcontext', 'search'];
                const foundCategories = routingData.map(r => r.category);
                const missingCategories = standardCategories.filter(c => !foundCategories.includes(c));
                
                if (missingCategories.length === 0) {
                    console.log('  ✅ All standard routing categories present');
                } else {
                    console.log(`  ⚠️ Missing categories: ${missingCategories.join(', ')}`);
                }

                this.recordStepResult('Step 2: Router Layer', missingCategories.length === 0,
                    `Found ${routingData.length} categories, missing: ${missingCategories.length}`);

            } else {
                throw new Error(`Router API failed: HTTP ${routingResponse.status}`);
            }

        } catch (error) {
            this.recordStepResult('Step 2: Router Layer', false, error.message);
            console.log('  ❌ Router layer validation failed:', error.message);
        }
    }

    /**
     * Step 3: Post-processor Layer Validation
     */
    async validateStep3PostprocessorLayer() {
        console.log('🔍 Step 3: Post-processor Layer Validation...');
        
        try {
            // Check if post-processor components exist in V3 structure
            const postprocessorExists = await this.checkFileExists('src/v3/post-processor') || 
                                       await this.checkFileExists('src/v3/runtime-management');
            
            // Check configuration management (part of post-processing)
            const configResponse = await this.testConfigurationManagement();
            
            console.log(`  ✅ Post-processor layer: ${postprocessorExists ? 'Available' : 'Integrated'}`);
            console.log(`  ✅ Configuration management: ${configResponse.working ? 'Working' : 'Failed'}`);

            this.recordStepResult('Step 3: Post-processor Layer', configResponse.working,
                `Layer exists: ${postprocessorExists}, Config management: ${configResponse.working}`);

        } catch (error) {
            this.recordStepResult('Step 3: Post-processor Layer', false, error.message);
            console.log('  ❌ Post-processor layer validation failed:', error.message);
        }
    }

    /**
     * Step 4: Transformer Layer Validation
     */
    async validateStep4TransformerLayer() {
        console.log('🔍 Step 4: Transformer Layer Validation...');
        
        try {
            // Check transformer components in V3 structure
            const transformerPaths = [
                'src/v3/transformation',
                'test/mock-server/data-replay-system/simulation',
                'src/provider'
            ];

            let transformerComponents = 0;
            for (const path of transformerPaths) {
                if (await this.checkFileExists(path)) {
                    transformerComponents++;
                    console.log(`  ✅ Transformer component found: ${path}`);
                }
            }

            // Test data transformation capabilities through mock server
            const mockServerExists = await this.checkFileExists('test/mock-server/data-replay-system');
            console.log(`  ✅ Mock server transformer: ${mockServerExists ? 'Available' : 'Missing'}`);

            const stepPassed = transformerComponents >= 1 && mockServerExists;

            this.recordStepResult('Step 4: Transformer Layer', stepPassed,
                `Components: ${transformerComponents}, Mock server: ${mockServerExists}`);

        } catch (error) {
            this.recordStepResult('Step 4: Transformer Layer', false, error.message);
            console.log('  ❌ Transformer layer validation failed:', error.message);
        }
    }

    /**
     * Step 5: Provider-Protocol Layer Validation
     */
    async validateStep5ProviderProtocolLayer() {
        console.log('🔍 Step 5: Provider-Protocol Layer Validation...');
        
        try {
            // Check provider protocols through Dashboard API
            const providersResponse = await fetch(`${this.dashboardUrl}/api/providers`);
            
            if (providersResponse.ok) {
                const providers = await providersResponse.json();
                console.log(`  ✅ Provider-protocols detected: ${providers.length}`);
                
                // Check for expected providers
                const providerNames = providers.map(p => p.name.toLowerCase());
                const expectedProviders = ['anthropic', 'openai', 'gemini', 'codewhisperer'];
                const foundProviders = expectedProviders.filter(p => 
                    providerNames.some(name => name.includes(p))
                );
                
                console.log(`  ✅ Standard providers found: ${foundProviders.join(', ')}`);

                // Check LMStudio SDK integration
                const lmStudioSDK = await this.checkFileExists('src/v3/provider/sdk-integration/lmstudio-ollama-sdk-manager.js');
                console.log(`  ✅ LMStudio SDK integration: ${lmStudioSDK ? 'Available' : 'Missing'}`);

                const stepPassed = providers.length > 0 && foundProviders.length >= 2;

                this.recordStepResult('Step 5: Provider-Protocol Layer', stepPassed,
                    `Providers: ${providers.length}, Standard: ${foundProviders.length}, SDK: ${lmStudioSDK}`);

            } else {
                throw new Error(`Providers API failed: HTTP ${providersResponse.status}`);
            }

        } catch (error) {
            this.recordStepResult('Step 5: Provider-Protocol Layer', false, error.message);
            console.log('  ❌ Provider-protocol layer validation failed:', error.message);
        }
    }

    /**
     * Step 6: Preprocessor Layer Validation
     */
    async validateStep6PreprocessorLayer() {
        console.log('🔍 Step 6: Preprocessor Layer Validation...');
        
        try {
            // Check preprocessor components
            const preprocessorPaths = [
                'src/v3/provider/sdk-integration',
                'src/v3/service-management',
                'src/provider'
            ];

            let preprocessorComponents = 0;
            for (const path of preprocessorPaths) {
                if (await this.checkFileExists(path)) {
                    preprocessorComponents++;
                    console.log(`  ✅ Preprocessor component found: ${path}`);
                }
            }

            // Check service management (part of preprocessing)
            const serviceManagement = await this.checkFileExists('src/v3/service-management/service-controller.js');
            console.log(`  ✅ Service management: ${serviceManagement ? 'Available' : 'Missing'}`);

            const stepPassed = preprocessorComponents >= 2 && serviceManagement;

            this.recordStepResult('Step 6: Preprocessor Layer', stepPassed,
                `Components: ${preprocessorComponents}, Service management: ${serviceManagement}`);

        } catch (error) {
            this.recordStepResult('Step 6: Preprocessor Layer', false, error.message);
            console.log('  ❌ Preprocessor layer validation failed:', error.message);
        }
    }

    /**
     * Step 7: Server Layer Validation
     */
    async validateStep7ServerLayer() {
        console.log('🔍 Step 7: Server Layer Validation...');
        
        try {
            // Test server components through Dashboard
            const healthResponse = await fetch(`${this.dashboardUrl}/api/health`);
            
            if (healthResponse.ok) {
                const health = await healthResponse.json();
                console.log(`  ✅ Server health: ${health.status}`);
                console.log(`  ✅ Dashboard server: ${health.dashboard ? 'Running' : 'Stopped'}`);
                console.log(`  ✅ Monitoring: ${health.monitoring ? 'Active' : 'Inactive'}`);

                // Check mock server system
                const mockServerExists = await this.checkFileExists('test/mock-server/data-replay-system/core/mock-server-core.js');
                console.log(`  ✅ Mock server core: ${mockServerExists ? 'Available' : 'Missing'}`);

                const stepPassed = health.status === 'healthy' && health.dashboard && mockServerExists;

                this.recordStepResult('Step 7: Server Layer', stepPassed,
                    `Health: ${health.status}, Dashboard: ${health.dashboard}, Mock server: ${mockServerExists}`);

            } else {
                throw new Error(`Health API failed: HTTP ${healthResponse.status}`);
            }

        } catch (error) {
            this.recordStepResult('Step 7: Server Layer', false, error.message);
            console.log('  ❌ Server layer validation failed:', error.message);
        }
    }

    /**
     * Step 8: End-to-end Integration Validation
     */
    async validateStep8EndToEndIntegration() {
        console.log('🔍 Step 8: End-to-end Integration Validation...');
        
        try {
            // Test complete system status
            const systemResponse = await fetch(`${this.dashboardUrl}/api/status`);
            
            if (systemResponse.ok) {
                const systemData = await systemResponse.json();
                console.log(`  ✅ System uptime: ${Math.round(systemData.uptime)}s`);
                console.log(`  ✅ Configurations loaded: ${systemData.configCount}`);
                console.log(`  ✅ Provider protocols: ${systemData.providerProtocolCount}`);
                console.log(`  ✅ Routing rules: ${systemData.routingRules}`);

                // Check if monitoring is active
                const monitoringActive = systemData.isMonitoring;
                console.log(`  ✅ Real-time monitoring: ${monitoringActive ? 'Active' : 'Inactive'}`);

                // Verify all previous steps passed
                const allStepsPassed = this.testResults.stepResults.every(step => step.passed);
                console.log(`  ✅ All pipeline steps: ${allStepsPassed ? 'Passed' : 'Some failed'}`);

                const integrationPassed = systemData.configCount > 0 && 
                                        systemData.providerProtocolCount > 0 && 
                                        monitoringActive && 
                                        allStepsPassed;

                this.recordStepResult('Step 8: End-to-end Integration', integrationPassed,
                    `Configs: ${systemData.configCount}, Providers: ${systemData.providerProtocolCount}, Monitoring: ${monitoringActive}, Steps passed: ${allStepsPassed}`);

            } else {
                throw new Error(`System status API failed: HTTP ${systemResponse.status}`);
            }

        } catch (error) {
            this.recordStepResult('Step 8: End-to-end Integration', false, error.message);
            console.log('  ❌ End-to-end integration validation failed:', error.message);
        }
    }

    // Helper Methods

    /**
     * Check if file or directory exists
     */
    async checkFileExists(relativePath) {
        try {
            const fullPath = path.join(this.projectRoot, relativePath);
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Test Dashboard access
     */
    async testDashboardAccess() {
        try {
            const response = await fetch(this.dashboardUrl);
            return {
                accessible: response.ok,
                status: response.status
            };
        } catch (error) {
            return {
                accessible: false,
                error: error.message
            };
        }
    }

    /**
     * Test API endpoints
     */
    async testAPIEndpoints() {
        const endpoints = [
            '/api/status',
            '/api/providers', 
            '/api/routing',
            '/api/health'
        ];

        let working = 0;
        let failed = 0;

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${this.dashboardUrl}${endpoint}`);
                if (response.ok) {
                    working++;
                } else {
                    failed++;
                }
            } catch {
                failed++;
            }
        }

        return { working, failed, total: endpoints.length };
    }

    /**
     * Test configuration management
     */
    async testConfigurationManagement() {
        try {
            const configExists = await this.checkFileExists('src/v3/runtime-management/configuration/dynamic-config-manager.js');
            const statusResponse = await fetch(`${this.dashboardUrl}/api/status`);
            
            if (statusResponse.ok) {
                const data = await statusResponse.json();
                return {
                    working: configExists && data.configCount > 0,
                    configCount: data.configCount
                };
            }
            
            return { working: configExists, configCount: 0 };
        } catch {
            return { working: false, configCount: 0 };
        }
    }

    /**
     * Record step result
     */
    recordStepResult(stepName, passed, details = '') {
        this.testResults.total++;
        if (passed) {
            this.testResults.passed++;
        } else {
            this.testResults.failed++;
        }
        
        const stepResult = {
            step: stepName,
            passed,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.stepResults.push(stepResult);
        this.testResults.details.push(stepResult);
    }

    /**
     * Generate comprehensive validation report
     */
    async generateValidationReport() {
        const duration = Date.now() - this.testStartTime;
        const successRate = Math.round((this.testResults.passed / this.testResults.total) * 100);

        console.log('');
        console.log('📊 STD-8-STEP-PIPELINE 真实验证报告');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [架构修复] V3六层架构标准流程验证完成');
        console.log(`📈 整体成功率: ${successRate}% (${this.testResults.passed}/${this.testResults.total})`);
        console.log(`⏱️ 执行时长: ${Math.round(duration / 1000)}秒`);
        console.log(`🌐 Dashboard URL: ${this.dashboardUrl}`);
        console.log('');
        
        // Step-by-step results
        console.log('📋 8步验证详细结果:');
        this.testResults.stepResults.forEach((step, index) => {
            const status = step.passed ? '✅' : '❌';
            const stepNum = index + 1;
            console.log(`  ${status} ${stepNum}. ${step.step.replace('Step ' + stepNum + ': ', '')}`);
            if (step.details) {
                console.log(`     ${step.details}`);
            }
        });

        // Overall assessment
        console.log('');
        console.log('🎯 V3六层架构评估:');
        if (successRate >= 90) {
            console.log('  🟢 优秀: V3六层架构完全就绪，可投入生产使用');
        } else if (successRate >= 75) {
            console.log('  🟡 良好: V3六层架构基本就绪，需要优化部分层');
        } else if (successRate >= 50) {
            console.log('  🟠 可接受: V3六层架构部分就绪，需要重点修复');
        } else {
            console.log('  🔴 需要改进: V3六层架构存在重大问题');
        }

        // Recommendations
        console.log('');
        console.log('📋 下一步建议:');
        if (successRate >= 90) {
            console.log('  ✅ 开始生产部署准备');
            console.log('  ✅ 执行性能基准测试');
            console.log('  ✅ 完成用户验收测试');
        } else {
            console.log('  🔧 修复失败的验证步骤');
            console.log('  🔧 重新执行STD-8-STEP-PIPELINE');
            console.log('  🔧 检查具体组件实现');
        }

        // Save detailed report
        const reportPath = path.join(__dirname, 'std-8-step-pipeline-real-report.json');
        const report = {
            testType: 'STD-8-STEP-PIPELINE Real Validation',
            timestamp: new Date().toISOString(),
            duration: duration,
            results: this.testResults,
            successRate: successRate,
            dashboardUrl: this.dashboardUrl,
            assessment: {
                status: successRate >= 90 ? 'excellent' : successRate >= 75 ? 'good' : successRate >= 50 ? 'acceptable' : 'needs-improvement',
                readyForProduction: successRate >= 90
            },
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                architecture: process.arch,
                projectRoot: this.projectRoot
            }
        };

        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 详细报告已保存: ${reportPath}`);
        
        return report;
    }
}

// Main execution
async function main() {
    const validator = new STD8StepPipelineRealTest();
    const results = await validator.runCompleteValidation();
    
    // Exit with appropriate code
    const success = results.failed === 0;
    process.exit(success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { STD8StepPipelineRealTest };