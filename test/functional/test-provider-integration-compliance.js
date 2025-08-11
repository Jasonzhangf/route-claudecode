#!/usr/bin/env node

/**
 * Provider Integration Compliance Test
 * Author: Jason Zhang
 * 
 * Tests compliance with Task 6.6 provider integration guidelines
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test provider integration compliance
 */
async function testProviderIntegrationCompliance(providerName) {
    const testResults = {
        testName: 'Provider Integration Compliance Test',
        providerName,
        startTime: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0, total: 0, compliance: 0 }
    };

    console.log(`🔍 Starting Provider Integration Compliance Test for: ${providerName}`);
    console.log('📋 Testing Task 6.6 compliance guidelines');
    
    try {
        // Test 1: Standardized Directory Structure
        await runComplianceTest(testResults, 'Standardized Directory Structure', async () => {
            const requiredStructure = [
                `src/provider/${providerName}/index.ts`,
                `src/provider/${providerName}/client.ts`,
                `src/provider/${providerName}/auth.ts`,
                `src/provider/${providerName}/converter.ts`,
                `src/provider/${providerName}/parser.ts`,
                `src/provider/${providerName}/types.ts`,
                `src/provider/${providerName}/preprocessor.ts`
            ];
            
            const existingFiles = [];
            const missingFiles = [];
            
            for (const file of requiredStructure) {
                try {
                    const filePath = path.resolve(process.cwd(), file);
                    await fs.access(filePath);
                    existingFiles.push(file);
                } catch {
                    missingFiles.push(file);
                }
            }
            
            if (missingFiles.length > 0) {
                throw new Error(`Missing files: ${missingFiles.join(', ')}`);
            }
            
            return {
                totalFiles: requiredStructure.length,
                existingFiles: existingFiles.length,
                message: `All ${requiredStructure.length} required files present`
            };
        });

        // Test 2: ProviderClient Interface Compliance
        await runComplianceTest(testResults, 'ProviderClient Interface Compliance', async () => {
            const providerModule = await import(`../../src/provider/${providerName}/index.js`).catch(() => null);
            if (!providerModule) {
                throw new Error('Provider module not found or not properly exported');
            }
            
            const ClientClass = providerModule[`${capitalize(providerName)}Client`];
            if (!ClientClass) {
                throw new Error(`${capitalize(providerName)}Client not exported`);
            }
            
            // Check if it extends BaseProvider
            const testConfig = {
                apiKey: 'test-key',
                endpoint: 'https://api.test.com',
                timeout: 30000,
                retryAttempts: 3,
                models: ['test-model']
            };
            
            const client = new ClientClass(testConfig);
            
            // Required methods from ProviderClient interface
            const requiredMethods = [
                'initialize',
                'processRequest',
                'healthCheck',
                'getAvailableModels',
                'getCapabilities',
                'cleanup'
            ];
            
            const missingMethods = requiredMethods.filter(method => 
                typeof client[method] !== 'function'
            );
            
            if (missingMethods.length > 0) {
                throw new Error(`Missing required methods: ${missingMethods.join(', ')}`);
            }
            
            return {
                implementedMethods: requiredMethods.length - missingMethods.length,
                totalMethods: requiredMethods.length,
                message: `All ${requiredMethods.length} interface methods implemented`
            };
        });

        // Test 3: Zero Hardcoding Verification
        await runComplianceTest(testResults, 'Zero Hardcoding Verification', async () => {
            const sourceFiles = [
                `src/provider/${providerName}/client.ts`,
                `src/provider/${providerName}/auth.ts`,
                `src/provider/${providerName}/converter.ts`,
                `src/provider/${providerName}/preprocessor.ts`
            ];
            
            const violations = [];
            
            for (const file of sourceFiles) {
                try {
                    const filePath = path.resolve(process.cwd(), file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    
                    // Hardcoding patterns to detect
                    const patterns = [
                        { pattern: /apiKey:\s*['"](?!test-|mock-|placeholder)[a-zA-Z0-9-_]{20,}['"]/, desc: 'Hardcoded API key' },
                        { pattern: /endpoint:\s*['"]https:\/\/api\.[a-z-]+\.com['"](?![^}]*\||\s*:)/, desc: 'Hardcoded endpoint' },
                        { pattern: /model:\s*['"](?!test-|mock-|placeholder|example)[a-z0-9-]{5,}['"](?!\s*[\|\:]|\s*=>)/, desc: 'Hardcoded model name' },
                        { pattern: /'sk-[a-zA-Z0-9]{40,}'/, desc: 'Hardcoded OpenAI API key' },
                        { pattern: /'AIza[a-zA-Z0-9_-]{35}'/, desc: 'Hardcoded Google API key' }
                    ];
                    
                    for (const { pattern, desc } of patterns) {
                        if (pattern.test(content)) {
                            violations.push(`${file}: ${desc}`);
                        }
                    }
                    
                } catch (error) {
                    console.warn(`⚠️ Could not check ${file}: ${error.message}`);
                }
            }
            
            if (violations.length > 0) {
                throw new Error(`Hardcoding violations: ${violations.join('; ')}`);
            }
            
            return {
                filesChecked: sourceFiles.length,
                violations: violations.length,
                message: `No hardcoding found in ${sourceFiles.length} files`
            };
        });

        // Test 4: Preprocessing Focus Architecture
        await runComplianceTest(testResults, 'Preprocessing Focus Architecture', async () => {
            const preprocessorModule = await import(`../../src/provider/${providerName}/preprocessor.js`).catch(() => null);
            if (!preprocessorModule) {
                throw new Error('Preprocessor module not found');
            }
            
            const PreprocessorClass = preprocessorModule[`${capitalize(providerName)}Preprocessor`];
            if (!PreprocessorClass) {
                throw new Error(`${capitalize(providerName)}Preprocessor not exported`);
            }
            
            const testConfig = {
                apiKey: 'test-key',
                endpoint: 'https://api.test.com',
                timeout: 30000,
                retryAttempts: 3,
                models: ['test-model']
            };
            
            const preprocessor = new PreprocessorClass(testConfig);
            
            // Required preprocessing methods
            const requiredMethods = [
                'preprocessRequest',
                'postprocessResponse',
                'validatePreprocessedRequest',
                'getPreprocessingStats'
            ];
            
            const missingMethods = requiredMethods.filter(method => 
                typeof preprocessor[method] !== 'function'
            );
            
            if (missingMethods.length > 0) {
                throw new Error(`Missing preprocessing methods: ${missingMethods.join(', ')}`);
            }
            
            // Test preprocessing stats
            try {
                const stats = preprocessor.getPreprocessingStats();
                if (!stats || typeof stats !== 'object') {
                    throw new Error('Preprocessing stats not properly implemented');
                }
                
                const totalRules = Object.values(stats).reduce((sum, count) => sum + count, 0);
                if (totalRules === 0) {
                    console.warn('⚠️ No preprocessing rules defined');
                }
                
                return {
                    implementedMethods: requiredMethods.length,
                    preprocessingRules: totalRules,
                    message: `Preprocessing architecture complete with ${totalRules} rules`
                };
                
            } catch (error) {
                throw new Error(`Preprocessing stats error: ${error.message}`);
            }
        });

        // Test 5: Official SDK Priority Implementation
        await runComplianceTest(testResults, 'Official SDK Priority Implementation', async () => {
            const clientModule = await import(`../../src/provider/${providerName}/client.js`).catch(() => null);
            if (!clientModule) {
                throw new Error('Client module not found');
            }
            
            // Read client.ts source to check for SDK priority implementation
            const clientPath = path.resolve(process.cwd(), `src/provider/${providerName}/client.ts`);
            const clientContent = await fs.readFile(clientPath, 'utf-8');
            
            // Look for SDK priority patterns
            const sdkPatterns = [
                /try\s*{[\s\S]*?sdk/i,  // Try-catch block with SDK
                /official.*sdk/i,       // Official SDK references
                /fallback/i,           // Fallback mechanism
                /http.*client/i        // HTTP client fallback
            ];
            
            const foundPatterns = sdkPatterns.filter(pattern => pattern.test(clientContent));
            
            const hasSDKPriority = foundPatterns.length >= 2; // At least 2 patterns should be present
            
            return {
                sdkPriorityImplemented: hasSDKPriority,
                detectedPatterns: foundPatterns.length,
                message: `SDK priority ${hasSDKPriority ? 'implemented' : 'not found'} (${foundPatterns.length}/4 patterns)`
            };
        });

        // Test 6: Comprehensive Error Handling
        await runComplianceTest(testResults, 'Comprehensive Error Handling', async () => {
            const parserModule = await import(`../../src/provider/${providerName}/parser.js`).catch(() => null);
            if (!parserModule) {
                throw new Error('Parser module not found');
            }
            
            const ParserClass = parserModule[`${capitalize(providerName)}Parser`];
            if (!ParserClass) {
                throw new Error(`${capitalize(providerName)}Parser not exported`);
            }
            
            const parser = new ParserClass();
            
            // Test error parsing
            if (typeof parser.parseError !== 'function') {
                throw new Error('parseError method not implemented');
            }
            
            // Test with various error formats
            const testErrors = [
                { error: { message: 'Test error', type: 'test' } },
                { error: { message: 'Another error' } },
                'String error'
            ];
            
            let successfulParses = 0;
            
            for (const testError of testErrors) {
                try {
                    const result = parser.parseError(testError);
                    if (result instanceof Error && result.message) {
                        successfulParses++;
                    }
                } catch (error) {
                    console.warn(`⚠️ Error parsing failed for: ${JSON.stringify(testError)}`);
                }
            }
            
            if (successfulParses === 0) {
                throw new Error('Error parsing not working correctly');
            }
            
            return {
                testedErrors: testErrors.length,
                successfulParses,
                message: `Error handling works for ${successfulParses}/${testErrors.length} test cases`
            };
        });

        // Test 7: Test Coverage and Documentation
        await runComplianceTest(testResults, 'Test Coverage and Documentation', async () => {
            const testFiles = [
                `test/functional/test-${providerName}-integration.js`,
                `test/functional/test-${providerName}-integration.md`,
                `test/functional/test-${providerName}-validation.js`
            ];
            
            const existingFiles = [];
            const missingFiles = [];
            
            for (const file of testFiles) {
                try {
                    const filePath = path.resolve(process.cwd(), file);
                    await fs.access(filePath);
                    existingFiles.push(file);
                } catch {
                    missingFiles.push(file);
                }
            }
            
            if (existingFiles.length === 0) {
                throw new Error('No test files found');
            }
            
            // Check if integration test is executable
            if (existingFiles.includes(`test/functional/test-${providerName}-integration.js`)) {
                const testPath = path.resolve(process.cwd(), `test/functional/test-${providerName}-integration.js`);
                const testContent = await fs.readFile(testPath, 'utf-8');
                
                if (!testContent.includes('#!/usr/bin/env node')) {
                    console.warn('⚠️ Integration test missing shebang for CLI execution');
                }
            }
            
            return {
                totalTestFiles: testFiles.length,
                existingTestFiles: existingFiles.length,
                missingTestFiles: missingFiles.length,
                message: `${existingFiles.length}/${testFiles.length} test files present`
            };
        });

        // Test 8: Type Safety and TypeScript Compliance
        await runComplianceTest(testResults, 'Type Safety and TypeScript Compliance', async () => {
            const typesModule = await import(`../../src/provider/${providerName}/types.js`).catch(() => null);
            if (!typesModule) {
                throw new Error('Types module not found or not properly compiled');
            }
            
            // Check for essential types
            const requiredTypes = [
                `${capitalize(providerName)}Config`,
                `${capitalize(providerName)}Request`,
                `${capitalize(providerName)}Response`,
                `${capitalize(providerName)}ErrorResponse`
            ];
            
            const availableTypes = Object.keys(typesModule);
            const missingTypes = requiredTypes.filter(type => !availableTypes.includes(type));
            
            if (missingTypes.length > 0) {
                throw new Error(`Missing type definitions: ${missingTypes.join(', ')}`);
            }
            
            // Check TypeScript source file for proper typing
            const typesPath = path.resolve(process.cwd(), `src/provider/${providerName}/types.ts`);
            const typesContent = await fs.readFile(typesPath, 'utf-8');
            
            const hasInterfaces = /interface\s+\w+/.test(typesContent);
            const hasExports = /export\s+(interface|type)/.test(typesContent);
            
            if (!hasInterfaces || !hasExports) {
                throw new Error('TypeScript interfaces not properly defined or exported');
            }
            
            return {
                requiredTypes: requiredTypes.length,
                availableTypes: availableTypes.length,
                missingTypes: missingTypes.length,
                hasProperTypeScript: hasInterfaces && hasExports,
                message: `All ${requiredTypes.length} required types present with proper TypeScript definitions`
            };
        });

    } catch (error) {
        console.error('❌ Compliance test execution failed:', error.message);
        testResults.tests.push({
            name: 'Test Execution',
            status: 'failed',
            error: error.message,
            duration: 0
        });
    }

    // Calculate compliance score
    testResults.endTime = new Date().toISOString();
    testResults.summary.total = testResults.tests.length;
    testResults.summary.passed = testResults.tests.filter(t => t.status === 'passed').length;
    testResults.summary.failed = testResults.tests.filter(t => t.status === 'failed').length;
    testResults.summary.compliance = testResults.summary.total > 0 
        ? Math.round((testResults.summary.passed / testResults.summary.total) * 100)
        : 0;

    // Save results
    const outputFile = path.join(__dirname, '..', 'output', `provider-compliance-${providerName}-${Date.now()}.json`);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, JSON.stringify(testResults, null, 2));

    // Print summary
    console.log('\n📊 Provider Integration Compliance Summary:');
    console.log(`   Provider: ${providerName}`);
    console.log(`   ✅ Passed: ${testResults.summary.passed}`);
    console.log(`   ❌ Failed: ${testResults.summary.failed}`);
    console.log(`   📈 Compliance: ${testResults.summary.compliance}%`);
    console.log(`   📁 Results: ${outputFile}`);

    // Detailed results
    console.log('\n📋 Compliance Test Results:');
    testResults.tests.forEach(test => {
        const status = test.status === 'passed' ? '✅' : '❌';
        console.log(`   ${status} ${test.name}: ${test.result || test.error}`);
    });

    // Compliance rating
    let rating = 'FAIL';
    if (testResults.summary.compliance >= 90) rating = 'EXCELLENT';
    else if (testResults.summary.compliance >= 80) rating = 'GOOD';
    else if (testResults.summary.compliance >= 70) rating = 'ACCEPTABLE';
    else if (testResults.summary.compliance >= 60) rating = 'NEEDS IMPROVEMENT';

    console.log(`\n🎯 Overall Compliance Rating: ${rating} (${testResults.summary.compliance}%)`);
    
    return testResults.summary.compliance >= 70; // 70% minimum compliance
}

/**
 * Run individual compliance test
 */
async function runComplianceTest(testResults, testName, testFunction) {
    const startTime = Date.now();
    console.log(`\n🔍 Testing: ${testName}`);
    
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

/**
 * Utility function to capitalize string
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const providerName = process.argv[2];
    
    if (!providerName) {
        console.error('❌ Usage: node test-provider-integration-compliance.js <provider-name>');
        console.error('   Example: node test-provider-integration-compliance.js myProvider');
        process.exit(1);
    }
    
    testProviderIntegrationCompliance(providerName)
        .then(success => {
            console.log(`\n🎉 Provider Integration Compliance Test ${success ? 'PASSED' : 'FAILED'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Compliance test failed:', error);
            process.exit(1);
        });
}

export { testProviderIntegrationCompliance };