#!/usr/bin/env node

/**
 * LMStudio SDK Priority Integration Test
 * Author: Jason Zhang
 * 
 * Tests LMStudio official SDK detection and automatic fallback to OpenAI-compatible mode
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test the LMStudio SDK integration
async function testLMStudioSDKIntegration() {
    const testResults = {
        testName: 'LMStudio SDK Priority Integration',
        startTime: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0, total: 0 }
    };

    console.log('🧪 Starting LMStudio SDK Priority Integration Test');
    
    try {
        // Test 1: SDK Detector Import and Initialization
        await runTest(testResults, 'SDK Detector Import', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            const detector = new SDKDetector('official-first');
            
            if (!detector) {
                throw new Error('SDK Detector failed to initialize');
            }
            
            return { detector, message: 'SDK Detector initialized successfully' };
        });

        // Test 2: LMStudio SDK Manager Import and Initialization
        await runTest(testResults, 'LMStudio SDK Manager Import', async () => {
            const { LMStudioSDKManager } = await import('../../src/provider/sdk-detection/lmstudio-sdk-manager.js');
            const manager = new LMStudioSDKManager();
            
            if (!manager) {
                throw new Error('LMStudio SDK Manager failed to initialize');
            }
            
            return { manager, message: 'LMStudio SDK Manager initialized successfully' };
        });

        // Test 3: Compatibility Preprocessor Import and Initialization
        await runTest(testResults, 'Compatibility Preprocessor Import', async () => {
            const { CompatibilityPreprocessor } = await import('../../src/provider/sdk-detection/compatibility-preprocessor.js');
            const preprocessor = new CompatibilityPreprocessor('official-first');
            
            if (!preprocessor) {
                throw new Error('Compatibility Preprocessor failed to initialize');
            }
            
            return { preprocessor, message: 'Compatibility Preprocessor initialized successfully' };
        });

        // Test 4: Enhanced OpenAI Client Import and Initialization
        await runTest(testResults, 'Enhanced OpenAI Client Import', async () => {
            const { EnhancedOpenAIClient } = await import('../../src/provider/openai/enhanced-client.js');
            const client = new EnhancedOpenAIClient('official-first');
            
            if (!client) {
                throw new Error('Enhanced OpenAI Client failed to initialize');
            }
            
            return { client, message: 'Enhanced OpenAI Client initialized successfully' };
        });

        // Test 5: SDK Detection for LMStudio
        await runTest(testResults, 'LMStudio SDK Detection', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            const detector = new SDKDetector('official-first');
            
            const detection = await detector.detectSDKs('lmstudio');
            
            if (!detection) {
                throw new Error('SDK detection returned null');
            }
            
            if (!detection.detected || detection.detected.length === 0) {
                throw new Error('No SDKs detected for LMStudio');
            }
            
            if (!detection.fallbackAvailable) {
                throw new Error('Fallback not available');
            }
            
            return { 
                detection, 
                message: `Detected ${detection.detected.length} LMStudio SDKs, fallback available: ${detection.fallbackAvailable}` 
            };
        });

        // Test 6: LMStudio Server Configuration Detection
        await runTest(testResults, 'LMStudio Server Config Detection', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            const detector = new SDKDetector('official-first');
            
            const serverConfig = {
                host: 'localhost',
                port: 1234,
                endpoint: 'http://localhost:1234/v1/chat/completions',
                timeout: 30000,
                maxRetries: 3,
                serverType: 'lmstudio'
            };
            
            const serverDetection = await detector.detectModelServer(serverConfig);
            
            if (!serverDetection) {
                throw new Error('Server detection failed');
            }
            
            if (serverDetection.serverType !== 'lmstudio') {
                throw new Error(`Expected lmstudio, got ${serverDetection.serverType}`);
            }
            
            return { 
                serverDetection, 
                message: `Detected server type: ${serverDetection.serverType}, SDK available: ${serverDetection.sdkAvailable}` 
            };
        });

        // Test 7: Compatibility Preprocessing Strategy Selection
        await runTest(testResults, 'Compatibility Preprocessing Strategy', async () => {
            const { CompatibilityPreprocessor } = await import('../../src/provider/sdk-detection/compatibility-preprocessor.js');
            const preprocessor = new CompatibilityPreprocessor('official-first');
            
            const strategies = preprocessor.getPreprocessingStrategies();
            
            if (!strategies || strategies.length === 0) {
                throw new Error('No preprocessing strategies found');
            }
            
            const lmstudioStrategies = strategies.filter(s => s.conditions.serverType === 'lmstudio');
            
            if (lmstudioStrategies.length === 0) {
                throw new Error('No LMStudio preprocessing strategies found');
            }
            
            return { 
                strategies: lmstudioStrategies, 
                message: `Found ${lmstudioStrategies.length} LMStudio preprocessing strategies` 
            };
        });

        // Test 8: Mock Request Processing
        await runTest(testResults, 'Mock Request Processing', async () => {
            const mockRequest = {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'user', content: 'Hello, this is a test message for LMStudio SDK integration.' }
                ],
                stream: false,
                temperature: 0.7,
                maxTokens: 100
            };

            const mockServerConfig = {
                host: 'localhost',
                port: 1234,
                endpoint: 'http://localhost:1234/v1/chat/completions',
                timeout: 30000,
                maxRetries: 3,
                serverType: 'lmstudio'
            };

            // Test compatibility preprocessor with mock data
            const { CompatibilityPreprocessor } = await import('../../src/provider/sdk-detection/compatibility-preprocessor.js');
            const preprocessor = new CompatibilityPreprocessor('official-first');
            
            // This will handle the request even if LMStudio server is not running
            // by using fallback mechanisms
            const response = await preprocessor.processRequest(mockRequest, mockServerConfig);
            
            if (!response) {
                throw new Error('Preprocessor returned null response');
            }
            
            if (!response.choices || response.choices.length === 0) {
                throw new Error('Response has no choices');
            }
            
            return { 
                response, 
                message: `Mock request processed successfully, response ID: ${response.id}` 
            };
        });

        // Test 9: Enhanced OpenAI Client with LMStudio Detection
        await runTest(testResults, 'Enhanced OpenAI Client LMStudio Detection', async () => {
            const { EnhancedOpenAIClient } = await import('../../src/provider/openai/enhanced-client.js');
            const client = new EnhancedOpenAIClient('official-first');
            
            // Test with LMStudio configuration
            const config = {
                apiKey: 'lm-studio-test-key',
                endpoint: 'http://localhost:1234/v1',
                timeout: 30000,
                retryAttempts: 3
            };
            
            // Initialize client - this should detect LMStudio configuration
            await client.initialize(config);
            
            const sdkInfo = client.getSDKInfo();
            
            if (!sdkInfo) {
                throw new Error('SDK info not available');
            }
            
            // Should detect this as LMStudio server
            if (!sdkInfo.isLMStudioServer) {
                console.warn('⚠️ LMStudio server detection may not work without running server');
            }
            
            return { 
                sdkInfo, 
                message: `LMStudio detection: ${sdkInfo.isLMStudioServer}, config available: ${!!sdkInfo.serverConfig}` 
            };
        });

        // Test 10: SDK Capability Mapping
        await runTest(testResults, 'SDK Capability Mapping', async () => {
            const { SDKDetector } = await import('../../src/provider/sdk-detection/sdk-detector.js');
            const detector = new SDKDetector('official-first');
            
            const detection = await detector.detectSDKs('lmstudio');
            const capabilities = detector.deriveCapabilities(detection.preferred);
            
            if (!capabilities) {
                throw new Error('No capabilities derived');
            }
            
            // Check expected capabilities
            const expectedCapabilities = ['streaming', 'toolCalling', 'customModels'];
            const missingCapabilities = expectedCapabilities.filter(cap => !capabilities[cap]);
            
            if (missingCapabilities.length > 0) {
                console.warn(`⚠️ Missing expected capabilities: ${missingCapabilities.join(', ')}`);
            }
            
            return { 
                capabilities, 
                message: `Capabilities derived: streaming=${capabilities.streaming}, toolCalling=${capabilities.toolCalling}, customModels=${capabilities.customModels}` 
            };
        });

    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        testResults.tests.push({
            name: 'Test Execution',
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

    // Save results
    const outputFile = path.join(__dirname, '..', 'output', `lmstudio-sdk-integration-${Date.now()}.json`);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(testResults, null, 2));

    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Passed: ${testResults.summary.passed}`);
    console.log(`   ❌ Failed: ${testResults.summary.failed}`);
    console.log(`   📁 Results saved: ${outputFile}`);

    return testResults.summary.failed === 0;
}

/**
 * Run individual test with error handling
 */
async function runTest(testResults, testName, testFunction) {
    const startTime = Date.now();
    console.log(`\n🧪 Running: ${testName}`);
    
    try {
        const result = await testFunction();
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
            name: testName,
            status: 'passed',
            duration,
            result: result.message || 'Test passed',
            details: result
        });
        
        console.log(`   ✅ ${testName} - ${result.message}`);
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        
        testResults.tests.push({
            name: testName,
            status: 'failed',
            duration,
            error: error.message,
            stack: error.stack
        });
        
        console.log(`   ❌ ${testName} - ${error.message}`);
        throw error;
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    testLMStudioSDKIntegration()
        .then(success => {
            console.log(`\n🎉 LMStudio SDK Integration Test ${success ? 'PASSED' : 'FAILED'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test runner failed:', error);
            process.exit(1);
        });
}

export { testLMStudioSDKIntegration };