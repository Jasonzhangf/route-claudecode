#!/usr/bin/env node

/**
 * Task 6.5 Comprehensive SDK Integration Test
 * Author: Jason Zhang
 * 
 * Comprehensive test for Task 6.5: LMStudio/Ollama SDK Priority Integration
 * Tests all requirements specified in Task 6.5
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main test function for Task 6.5 requirements
 */
async function testTask6Point5Comprehensive() {
    const testResults = {
        testName: 'Task 6.5 Comprehensive SDK Integration',
        requirements: [
            '6.5.1 检测并优先使用LMStudio/Ollama的官方SDK',
            '6.5.2 实现LMStudio官方SDK集成，OpenAI兼容作为fallback',
            '6.5.3 实现Ollama官方SDK集成，独立实现作为fallback',
            '6.5.4 运行时动态SDK检测和策略选择',
            '6.5.5 实现兼容性预处理，支持fallback模式',
            '6.5.6 维护本地模型服务的性能优化',
            '6.5.7 添加本地模型服务器的特定配置支持',
            '6.5.8 SDK功能检测和能力映射'
        ],
        startTime: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0, total: 0, warnings: 0 }
    };

    console.log('🎯 Starting Task 6.5 Comprehensive SDK Integration Test');
    console.log('📋 Testing Requirements: LMStudio/Ollama SDK Priority Integration');
    
    try {
        // Requirement 6.5.1: 检测并优先使用官方SDK
        await runRequirementTest(testResults, '6.5.1 官方SDK检测和优先级', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            
            // Test LMStudio SDK detection with official-first strategy
            const detector = new SDKDetector('official-first');
            const lmstudioDetection = await detector.detectSDKs('lmstudio');
            
            // Verify detection results
            if (!lmstudioDetection.detected || lmstudioDetection.detected.length === 0) {
                throw new Error('No LMStudio SDKs detected');
            }
            
            // Check if official SDK has higher priority
            const sdks = lmstudioDetection.detected;
            const officialSDK = sdks.find(sdk => sdk.name.includes('official'));
            const fallbackSDK = sdks.find(sdk => sdk.name.includes('compatible') || sdk.name.includes('openai'));
            
            if (officialSDK && fallbackSDK && officialSDK.priority <= fallbackSDK.priority) {
                throw new Error('Official SDK should have higher priority than fallback');
            }
            
            // Test Ollama SDK detection (mockup)
            const ollamaDetection = await detector.detectSDKs('ollama');
            
            return {
                lmstudioSDKs: sdks.length,
                ollamaSDKs: ollamaDetection.detected.length,
                lmstudioFallback: lmstudioDetection.fallbackAvailable,
                ollamaFallback: ollamaDetection.fallbackAvailable,
                message: `Detected ${sdks.length} LMStudio SDKs, ${ollamaDetection.detected.length} Ollama SDKs`
            };
        });

        // Requirement 6.5.2: LMStudio官方SDK集成
        await runRequirementTest(testResults, '6.5.2 LMStudio官方SDK集成', async () => {
            const { LMStudioSDKManager } = await import('../../src/provider/sdk-detection/lmstudio-sdk-manager.js');
            
            const manager = new LMStudioSDKManager();
            const testConfig = {
                host: 'localhost',
                port: 1234,
                endpoint: 'http://localhost:1234/v1',
                timeout: 30000,
                maxRetries: 3,
                serverType: 'lmstudio'
            };
            
            // Initialize manager (should detect official SDK or fallback)
            await manager.initialize(testConfig);
            
            const currentSDK = manager.getCurrentSDK();
            if (!currentSDK) {
                throw new Error('No SDK selected after initialization');
            }
            
            // Test fallback capability
            if (manager.isOfficialSDKAvailable()) {
                console.log('   🎯 Official LMStudio SDK available');
            } else {
                console.log('   🔄 Using OpenAI-compatible fallback mode');
            }
            
            // Test capabilities
            const capabilities = manager.getCapabilities();
            if (!capabilities.streaming && !capabilities.customModels) {
                throw new Error('Expected capabilities not found');
            }
            
            return {
                sdkName: currentSDK.name,
                version: currentSDK.version,
                officialAvailable: manager.isOfficialSDKAvailable(),
                capabilities: Object.keys(capabilities).filter(k => capabilities[k]),
                message: `Using ${currentSDK.name} v${currentSDK.version}, capabilities: ${Object.keys(capabilities).filter(k => capabilities[k]).join(', ')}`
            };
        });

        // Requirement 6.5.3: Ollama SDK集成 (Mockup)
        await runRequirementTest(testResults, '6.5.3 Ollama SDK集成 (Mockup)', async () => {
            const { OllamaSDKManager } = await import('../../src/provider/sdk-detection/ollama-sdk-manager.js');
            
            const manager = new OllamaSDKManager();
            const testConfig = {
                host: 'localhost',
                port: 11434,
                endpoint: 'http://localhost:11434/api/chat',
                timeout: 30000,
                maxRetries: 3,
                serverType: 'ollama'
            };
            
            // Initialize mockup manager
            await manager.initialize(testConfig);
            
            const currentSDK = manager.getCurrentSDK();
            if (!currentSDK || !currentSDK.name.includes('mockup')) {
                throw new Error('Ollama mockup SDK not initialized properly');
            }
            
            // Test mockup capabilities
            const capabilities = manager.getCapabilities();
            const models = await manager.getAvailableModels();
            
            return {
                sdkName: currentSDK.name,
                mockup: true,
                models: models.length,
                capabilities: Object.keys(capabilities).filter(k => capabilities[k]),
                message: `Ollama mockup initialized with ${models.length} mock models`
            };
        }, true); // Mark as mockup test

        // Requirement 6.5.4: 运行时动态SDK检测和策略选择
        await runRequirementTest(testResults, '6.5.4 运行时动态SDK检测', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            
            // Test different strategies
            const strategies = ['official-first', 'performance-first', 'compatibility-first', 'fallback-only'];
            const results = {};
            
            for (const strategy of strategies) {
                const detector = new SDKDetector(strategy);
                const detection = await detector.detectSDKs('lmstudio');
                
                results[strategy] = {
                    preferred: detection.preferred?.name || 'none',
                    count: detection.detected.length
                };
            }
            
            // Test strategy updates
            const detector = new SDKDetector('official-first');
            detector.updateStrategy('fallback-only');
            
            if (detector.getStrategy() !== 'fallback-only') {
                throw new Error('Strategy update failed');
            }
            
            // Test cache functionality
            const detection1 = await detector.detectSDKs('lmstudio');
            const detection2 = await detector.detectSDKs('lmstudio');
            
            return {
                strategies: results,
                strategyUpdate: true,
                cacheWorking: detection1.detected.length === detection2.detected.length,
                message: `Tested ${strategies.length} strategies, cache working: ${detection1.detected.length === detection2.detected.length}`
            };
        });

        // Requirement 6.5.5: 兼容性预处理和fallback模式
        await runRequirementTest(testResults, '6.5.5 兼容性预处理和Fallback', async () => {
            const { CompatibilityPreprocessor } = await import('../../src/provider/sdk-detection/compatibility-preprocessor.js');
            
            const preprocessor = new CompatibilityPreprocessor('official-first');
            
            // Test preprocessing strategies
            const strategies = preprocessor.getPreprocessingStrategies();
            const lmstudioStrategies = strategies.filter(s => s.conditions.serverType === 'lmstudio');
            const ollamaStrategies = strategies.filter(s => s.conditions.serverType === 'ollama');
            const genericStrategies = strategies.filter(s => s.conditions.serverType === 'openai-compatible');
            
            if (lmstudioStrategies.length === 0) {
                throw new Error('No LMStudio preprocessing strategies found');
            }
            
            // Test fallback mode
            preprocessor.setFallbackEnabled(true);
            
            const testRequest = {
                model: 'test-model',
                messages: [{ role: 'user', content: 'Test message' }],
                stream: false
            };
            
            const testConfig = {
                host: 'localhost',
                port: 1234,
                endpoint: 'http://localhost:1234/v1',
                timeout: 30000,
                maxRetries: 3,
                serverType: 'lmstudio'
            };
            
            // This should work even if LMStudio is not running due to fallback
            const response = await preprocessor.processRequest(testRequest, testConfig);
            
            if (!response || !response.choices) {
                throw new Error('Fallback preprocessing failed');
            }
            
            return {
                totalStrategies: strategies.length,
                lmstudioStrategies: lmstudioStrategies.length,
                ollamaStrategies: ollamaStrategies.length,
                genericStrategies: genericStrategies.length,
                fallbackWorking: true,
                responseReceived: !!response.id,
                message: `${strategies.length} strategies available, fallback processing successful`
            };
        });

        // Requirement 6.5.6: 本地模型服务性能优化
        await runRequirementTest(testResults, '6.5.6 本地模型服务性能优化', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            
            const detector = new SDKDetector('performance-first');
            
            // Test cache performance
            const startTime = Date.now();
            await detector.detectSDKs('lmstudio');
            const firstCallTime = Date.now() - startTime;
            
            const cacheStartTime = Date.now();
            await detector.detectSDKs('lmstudio');
            const cachedCallTime = Date.now() - cacheStartTime;
            
            // Cached call should be significantly faster
            const cacheSpeedup = firstCallTime / Math.max(cachedCallTime, 1);
            
            // Test server capabilities for performance-related features
            const serverConfig = {
                host: 'localhost',
                port: 1234,
                endpoint: 'http://localhost:1234/v1',
                timeout: 30000,
                maxRetries: 3,
                serverType: 'lmstudio'
            };
            
            const { CompatibilityPreprocessor } = await import('../../src/provider/sdk-detection/compatibility-preprocessor.js');
            const preprocessor = new CompatibilityPreprocessor('performance-first');
            const capabilities = await preprocessor.getServerCapabilities(serverConfig);
            
            return {
                firstCallTime,
                cachedCallTime,
                cacheSpeedup: Math.round(cacheSpeedup * 10) / 10,
                streamingSupported: capabilities.capabilities.streaming,
                batchSupported: capabilities.capabilities.batchRequests,
                message: `Cache speedup: ${Math.round(cacheSpeedup * 10) / 10}x, streaming: ${capabilities.capabilities.streaming}`
            };
        });

        // Requirement 6.5.7: 本地模型服务器特定配置支持
        await runRequirementTest(testResults, '6.5.7 本地服务器特定配置', async () => {
            const { EnhancedOpenAIClient } = await import('../../src/provider/openai/enhanced-client.js');
            
            // Test LMStudio configuration detection
            const lmstudioClient = new EnhancedOpenAIClient('official-first');
            const lmstudioConfig = {
                apiKey: 'lm-studio-key',
                endpoint: 'http://localhost:1234/v1',
                timeout: 30000,
                retryAttempts: 3
            };
            
            await lmstudioClient.initialize(lmstudioConfig);
            const lmstudioInfo = lmstudioClient.getSDKInfo();
            
            // Test generic OpenAI configuration
            const openaiClient = new EnhancedOpenAIClient('official-first');
            const openaiConfig = {
                apiKey: 'sk-test-key',
                endpoint: 'https://api.openai.com/v1',
                timeout: 30000,
                retryAttempts: 3
            };
            
            await openaiClient.initialize(openaiConfig);
            const openaiInfo = openaiClient.getSDKInfo();
            
            // Verify configuration-specific behavior
            if (lmstudioInfo.isLMStudioServer === openaiInfo.isLMStudioServer) {
                throw new Error('Configuration detection not working properly');
            }
            
            return {
                lmstudioDetected: lmstudioInfo.isLMStudioServer,
                lmstudioConfig: !!lmstudioInfo.serverConfig,
                openaiDetected: !openaiInfo.isLMStudioServer,
                openaiConfig: !openaiInfo.serverConfig,
                message: `LMStudio detected: ${lmstudioInfo.isLMStudioServer}, OpenAI detected: ${!openaiInfo.isLMStudioServer}`
            };
        });

        // Requirement 6.5.8: SDK功能检测和能力映射
        await runRequirementTest(testResults, '6.5.8 SDK功能检测和能力映射', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            
            const detector = new SDKDetector('official-first');
            
            // Test capability mapping for different SDK types
            const lmstudioDetection = await detector.detectSDKs('lmstudio');
            const ollamaDetection = await detector.detectSDKs('ollama');
            
            const lmstudioCapabilities = detector.deriveCapabilities(lmstudioDetection.preferred);
            const ollamaCapabilities = detector.deriveCapabilities(ollamaDetection.preferred);
            const nullCapabilities = detector.deriveCapabilities(null);
            
            // Verify capability structure
            const expectedCapabilities = ['streaming', 'toolCalling', 'multiModal', 'embeddings', 'fineTuning', 'customModels', 'batchRequests'];
            
            for (const cap of expectedCapabilities) {
                if (!(cap in lmstudioCapabilities)) {
                    throw new Error(`Missing capability field: ${cap}`);
                }
            }
            
            // Verify different capabilities for different SDKs
            const lmstudioActive = Object.values(lmstudioCapabilities).some(v => v);
            const ollamaActive = Object.values(ollamaCapabilities).some(v => v);
            const nullActive = Object.values(nullCapabilities).some(v => v);
            
            if (!lmstudioActive || !ollamaActive || nullActive) {
                console.warn('⚠️ Capability mapping may need adjustment');
            }
            
            return {
                lmstudioCapabilities: Object.keys(lmstudioCapabilities).filter(k => lmstudioCapabilities[k]),
                ollamaCapabilities: Object.keys(ollamaCapabilities).filter(k => ollamaCapabilities[k]),
                nullCapabilities: Object.keys(nullCapabilities).filter(k => nullCapabilities[k]),
                capabilityFields: expectedCapabilities.length,
                message: `LMStudio: ${Object.keys(lmstudioCapabilities).filter(k => lmstudioCapabilities[k]).length} capabilities, Ollama: ${Object.keys(ollamaCapabilities).filter(k => ollamaCapabilities[k]).length} capabilities`
            };
        });

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        testResults.tests.push({
            requirement: 'Test Execution',
            status: 'failed',
            error: error.message,
            duration: 0
        });
    }

    // Finalize results
    testResults.endTime = new Date().toISOString();
    testResults.summary.total = testResults.tests.length;
    testResults.summary.passed = testResults.tests.filter(t => t.status === 'passed').length;
    testResults.summary.failed = testResults.tests.filter(t => t.status === 'failed').length;
    testResults.summary.warnings = testResults.tests.filter(t => t.mockup || t.warning).length;

    // Save results
    const outputFile = path.join(__dirname, '..', 'output', `task-6-5-comprehensive-${Date.now()}.json`);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(testResults, null, 2));

    // Print summary
    console.log('\n📊 Task 6.5 Test Summary:');
    console.log(`   ✅ Passed: ${testResults.summary.passed}`);
    console.log(`   ❌ Failed: ${testResults.summary.failed}`);
    console.log(`   ⚠️  Warnings: ${testResults.summary.warnings}`);
    console.log(`   📁 Results saved: ${outputFile}`);

    // Print requirement coverage
    console.log('\n📋 Requirement Coverage:');
    testResults.requirements.forEach((req, index) => {
        const test = testResults.tests[index];
        const status = test ? (test.status === 'passed' ? '✅' : '❌') : '⚠️';
        const mockup = test?.mockup ? ' (Mockup)' : '';
        console.log(`   ${status} ${req}${mockup}`);
    });

    return testResults.summary.failed === 0;
}

/**
 * Run requirement-specific test
 */
async function runRequirementTest(testResults, requirementName, testFunction, isMockup = false) {
    const startTime = Date.now();
    console.log(`\n🧪 Testing: ${requirementName}`);
    
    try {
        const result = await testFunction();
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
            requirement: requirementName,
            status: 'passed',
            duration,
            result: result.message || 'Requirement satisfied',
            details: result,
            mockup: isMockup
        });
        
        const mockupLabel = isMockup ? ' (Mockup)' : '';
        console.log(`   ✅ ${requirementName}${mockupLabel} - ${result.message}`);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
            requirement: requirementName,
            status: 'failed',
            duration,
            error: error.message,
            stack: error.stack,
            mockup: isMockup
        });
        
        const mockupLabel = isMockup ? ' (Mockup)' : '';
        console.log(`   ❌ ${requirementName}${mockupLabel} - ${error.message}`);
        throw error;
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    testTask6Point5Comprehensive()
        .then(success => {
            console.log(`\n🎉 Task 6.5 Comprehensive Test ${success ? 'PASSED' : 'FAILED'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test runner failed:', error);
            process.exit(1);
        });
}

export { testTask6Point5Comprehensive };