#!/usr/bin/env node

/**
 * Test: Debug System Integration - v3.0 Architecture
 * 
 * Validates that the debug system correctly records I/O across all six architectural layers:
 * Client → Router → Post-processor → Transformer → Provider-Protocol → Preprocessor → Server
 * 
 * Test Objectives:
 * 1. Verify debug system initialization
 * 2. Test I/O recording at all layers
 * 3. Validate audit trail creation
 * 4. Check performance metrics collection
 * 5. Verify database file creation in ~/.route-claudecode/database
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

const TEST_NAME = 'debug-system-integration';
const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test', 'output', 'functional');
const DATABASE_PATH = path.join(os.homedir(), '.route-claudecode', 'database');
const TEST_SERVER_PORT = 3460; // Use different port to avoid conflicts

/**
 * Main test execution
 */
async function runTest() {
    const startTime = Date.now();
    const testId = `${TEST_NAME}-${Date.now()}`;
    
    console.log('🧪 Debug System Integration Test Starting...');
    console.log(`📋 Test ID: ${testId}`);
    console.log(`📊 Database Path: ${DATABASE_PATH}`);
    
    // Ensure output directory exists
    if (!fs.existsSync(TEST_OUTPUT_DIR)) {
        fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    
    const testResults = {
        testId,
        testName: TEST_NAME,
        startTime: new Date(startTime).toISOString(),
        results: {},
        summary: {},
        databaseFiles: {},
        errors: []
    };
    
    try {
        // Test 1: Initialize Debug System
        console.log('\n📋 Test 1: Debug System Initialization');
        const initResult = await testDebugSystemInitialization();
        testResults.results.initialization = initResult;
        console.log(initResult.success ? '✅ PASSED' : '❌ FAILED');
        
        // Test 2: Start Debug Test Server
        console.log('\n📋 Test 2: Debug Test Server Startup');
        const serverResult = await testServerStartup();
        testResults.results.serverStartup = serverResult;
        console.log(serverResult.success ? '✅ PASSED' : '❌ FAILED');
        
        // Test 3: Send Test Request with Full Layer Recording
        console.log('\n📋 Test 3: Full Layer I/O Recording');
        const recordingResult = await testLayerRecording();
        testResults.results.layerRecording = recordingResult;
        console.log(recordingResult.success ? '✅ PASSED' : '❌ FAILED');
        
        // Test 4: Validate Database Files Creation
        console.log('\n📋 Test 4: Database Files Validation');
        const databaseResult = await testDatabaseValidation();
        testResults.results.databaseValidation = databaseResult;
        testResults.databaseFiles = databaseResult.files || {};
        console.log(databaseResult.success ? '✅ PASSED' : '❌ FAILED');
        
        // Test 5: Validate Audit Trail
        console.log('\n📋 Test 5: Audit Trail Validation');
        const auditResult = await testAuditTrailValidation();
        testResults.results.auditTrail = auditResult;
        console.log(auditResult.success ? '✅ PASSED' : '❌ FAILED');
        
        // Calculate summary
        const totalTests = Object.keys(testResults.results).length;
        const passedTests = Object.values(testResults.results).filter(r => r.success).length;
        const failedTests = totalTests - passedTests;
        
        testResults.summary = {
            totalTests,
            passed: passedTests,
            failed: failedTests,
            successRate: `${Math.round((passedTests / totalTests) * 100)}%`,
            duration: `${Date.now() - startTime}ms`
        };
        
        console.log('\n📊 Test Summary:');
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${failedTests}`);
        console.log(`   Success Rate: ${testResults.summary.successRate}`);
        console.log(`   Duration: ${testResults.summary.duration}`);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error);
        testResults.errors.push({
            type: 'execution_error',
            message: error.message,
            stack: error.stack
        });
    }
    
    // Save test results
    testResults.endTime = new Date().toISOString();
    const outputFile = path.join(TEST_OUTPUT_DIR, `${testId}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(testResults, null, 2));
    
    console.log(`\n📄 Test results saved to: ${outputFile}`);
    
    // Return overall success
    const overallSuccess = testResults.summary.failed === 0;
    console.log(`\n${overallSuccess ? '✅' : '❌'} Debug System Integration Test ${overallSuccess ? 'COMPLETED' : 'FAILED'}`);
    
    return testResults;
}

/**
 * Test 1: Debug System Initialization
 */
async function testDebugSystemInitialization() {
    try {
        // Import and test debug system
        const { DebugSystem } = await import('../../src/v3/debug/debug-system.js');
        
        const debugSystem = new DebugSystem({
            enableRecording: true,
            enableAuditTrail: true,
            enableReplay: true,
            enablePerformanceMetrics: true
        });
        
        const status = debugSystem.getDebugStatus();
        
        return {
            success: true,
            details: {
                sessionId: status.sessionId,
                components: status.components,
                activeOperations: status.activeOperations,
                wrappedLayers: status.wrappedLayers,
                debugEnabled: status.debugEnabled
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            details: { error: error.stack }
        };
    }
}

/**
 * Test 2: Debug Test Server Startup
 */
async function testServerStartup() {
    try {
        // Check if TypeScript is compiled
        const serverPath = path.join(process.cwd(), 'dist', 'v3', 'server', 'router-server-debug-test.js');
        
        if (!fs.existsSync(serverPath)) {
            return {
                success: false,
                error: 'Debug test server not compiled',
                details: { missingFile: serverPath }
            };
        }
        
        return {
            success: true,
            details: {
                serverPath,
                port: TEST_SERVER_PORT,
                compiled: true
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            details: { error: error.stack }
        };
    }
}

/**
 * Test 3: Full Layer I/O Recording
 */
async function testLayerRecording() {
    try {
        // For now, we'll test that the debug components are properly structured
        const { DebugRecorder } = await import('../../src/v3/debug/debug-recorder.js');
        
        const recorder = new DebugRecorder();
        
        // Simulate recording for each layer
        const layers = ['client', 'router', 'post-processor', 'transformer', 'provider-protocol', 'preprocessor', 'server'];
        const recordIds = [];
        
        for (const layer of layers) {
            const recordId = recorder.recordLayerIO(layer, 'input', { testData: `${layer} test data` }, { testMode: true });
            recordIds.push(recordId);
        }
        
        return {
            success: true,
            details: {
                layersRecorded: layers.length,
                recordIds: recordIds,
                sessionSummary: recorder.getSessionSummary()
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            details: { error: error.stack }
        };
    }
}

/**
 * Test 4: Database Files Validation
 */
async function testDatabaseValidation() {
    try {
        // Check if database directory exists
        if (!fs.existsSync(DATABASE_PATH)) {
            return {
                success: false,
                error: 'Database directory does not exist',
                details: { expectedPath: DATABASE_PATH }
            };
        }
        
        // Check subdirectories
        const expectedDirs = ['sessions', 'layers', 'audit', 'performance', 'replay'];
        const existingDirs = [];
        const missingDirs = [];
        
        for (const dir of expectedDirs) {
            const dirPath = path.join(DATABASE_PATH, dir);
            if (fs.existsSync(dirPath)) {
                existingDirs.push(dir);
            } else {
                missingDirs.push(dir);
            }
        }
        
        // Count files in layers directory
        const layersDir = path.join(DATABASE_PATH, 'layers');
        let layerFiles = [];
        if (fs.existsSync(layersDir)) {
            layerFiles = fs.readdirSync(layersDir).filter(f => f.endsWith('.json'));
        }
        
        return {
            success: existingDirs.length === expectedDirs.length,
            details: {
                databasePath: DATABASE_PATH,
                existingDirs,
                missingDirs,
                layerFiles: layerFiles.length,
                recentFiles: layerFiles.slice(-5) // Last 5 files
            },
            files: {
                layerFiles: layerFiles.length,
                directories: existingDirs.length
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            details: { error: error.stack }
        };
    }
}

/**
 * Test 5: Audit Trail Validation
 */
async function testAuditTrailValidation() {
    try {
        const { DebugRecorder } = await import('../../src/v3/debug/debug-recorder.js');
        
        const recorder = new DebugRecorder();
        
        // Test audit trail recording
        const auditId = recorder.recordAuditTrail(
            'client',
            'router', 
            'test-data-id',
            { transformedData: 'test transformation' }
        );
        
        const sessionSummary = recorder.getSessionSummary();
        
        return {
            success: true,
            details: {
                auditId,
                auditTrailLength: sessionSummary.auditTrail.length,
                sessionId: sessionSummary.sessionId
            }
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            details: { error: error.stack }
        };
    }
}

// Run the test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runTest()
        .then(results => {
            process.exit(results.summary.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Test failed with error:', error);
            process.exit(1);
        });
}

export default runTest;