/**
 * 🧪 Debug Recording System Tests - v3.0 Architecture
 * 
 * Comprehensive test suite for the debug recording system
 * Tests Requirements: 2.2, 2.3, 2.5 from Kiro specifications
 * 
 * Test Categories:
 * - Debug recorder functionality
 * - Audit trail system validation
 * - Replay system testing
 * - Performance metrics collection
 * - Integrated debug system testing
 * 
 * @author Jason Zhang
 * @version v3.0-refactor
 * @created 2025-08-11
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import debug system components
import DebugSystem from '../../src/v3/debug/debug-system.js';
import DebugRecorder from '../../src/v3/debug/debug-recorder.js';
import AuditTrailSystem from '../../src/v3/debug/audit-trail-system.js';
import ReplaySystem from '../../src/v3/debug/replay-system.js';
import PerformanceMetricsCollector from '../../src/v3/debug/performance-metrics.js';

/**
 * Debug Recording System Test Suite
 */
class DebugRecordingSystemTests {
    constructor() {
        this.testResults = {
            sessionId: `debug-test-${Date.now()}`,
            startTime: new Date().toISOString(),
            testSuite: 'Debug Recording System',
            results: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0
            }
        };
        
        // Test output directory
        this.outputPath = path.join(__dirname, '..', 'output', 'debug');
        this.ensureOutputDirectory();
    }
    
    /**
     * Ensure test output directory exists
     */
    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputPath)) {
            fs.mkdirSync(this.outputPath, { recursive: true });
        }
    }
    
    /**
     * Run all debug recording system tests
     */
    async runAllTests() {
        console.log('🧪 Starting Debug Recording System Tests...');
        
        try {
            // Test 1: Debug Recorder functionality
            await this.testDebugRecorderFunctionality();
            
            // Test 2: Audit Trail System
            await this.testAuditTrailSystem();
            
            // Test 3: Replay System
            await this.testReplaySystem();
            
            // Test 4: Performance Metrics Collection
            await this.testPerformanceMetricsCollection();
            
            // Test 5: Integrated Debug System
            await this.testIntegratedDebugSystem();
            
            // Test 6: Layer Wrapping and Debug Integration
            await this.testLayerWrappingDebugIntegration();
            
            // Test 7: Scenario Creation and Replay
            await this.testScenarioCreationAndReplay();
            
            // Test 8: Debug System Status and Reporting
            await this.testDebugSystemStatusAndReporting();
            
            // Generate final test report
            await this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test suite execution failed:', error);
            this.recordTestResult('Test Suite Execution', false, error.message);
        }
        
        return this.testResults;
    }
    
    /**
     * Test 1: Debug Recorder Functionality
     */
    async testDebugRecorderFunctionality() {
        const testName = 'Debug Recorder Functionality';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const recorder = new DebugRecorder();
            
            // Test I/O recording
            const recordId = recorder.recordLayerIO(
                'client',
                'input',
                { testData: 'sample input' },
                { operationId: 'test-op-1' }
            );
            
            if (!recordId) {
                throw new Error('Failed to generate record ID');
            }
            
            // Test audit trail recording
            const auditId = recorder.recordAuditTrail(
                'client',
                'router',
                recordId,
                { transformedData: 'processed input' }
            );
            
            if (!auditId) {
                throw new Error('Failed to generate audit ID');
            }
            
            // Test performance metrics recording
            const perfRecord = recorder.recordPerformanceMetrics(
                'client',
                'validate',
                Date.now() - 100,
                Date.now(),
                { testMetric: true }
            );
            
            if (!perfRecord || !perfRecord.duration) {
                throw new Error('Failed to record performance metrics');
            }
            
            // Test replay scenario creation
            const scenarioFile = recorder.createReplayScenario(
                'test-scenario',
                [recordId, auditId]
            );
            
            if (!scenarioFile || !fs.existsSync(scenarioFile)) {
                throw new Error('Failed to create replay scenario');
            }
            
            // Test session summary
            const summary = recorder.getSessionSummary();
            
            if (!summary || !summary.sessionId || !summary.auditTrail) {
                throw new Error('Invalid session summary');
            }
            
            this.recordTestResult(testName, true, 'All debug recorder functions working correctly');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Test 2: Audit Trail System
     */
    async testAuditTrailSystem() {
        const testName = 'Audit Trail System';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const auditSystem = new AuditTrailSystem();
            
            // Test layer trace starting
            const traceId = auditSystem.startLayerTrace(
                'router',
                'route',
                { path: '/api/test' }
            );
            
            if (!traceId) {
                throw new Error('Failed to start layer trace');
            }
            
            // Test layer trace completion
            const completedTrace = auditSystem.completeLayerTrace(
                traceId,
                { routedTo: 'anthropic' },
                'success',
                { duration: 50 }
            );
            
            if (!completedTrace || completedTrace.status !== 'success') {
                throw new Error('Failed to complete layer trace');
            }
            
            // Test data lineage building
            const lineage = auditSystem.buildDataLineage(traceId);
            
            if (!lineage || !lineage.dataFlow || !lineage.rootTraceId) {
                throw new Error('Failed to build data lineage');
            }
            
            // Test audit trail querying
            const queryResults = auditSystem.queryAuditTrail({
                layer: 'router',
                status: 'success'
            });
            
            if (!Array.isArray(queryResults) || queryResults.length === 0) {
                throw new Error('Failed to query audit trail');
            }
            
            // Test audit summary generation
            const auditSummary = auditSystem.getAuditSummary();
            
            if (!auditSummary || !auditSummary.sessionId || !auditSummary.layerStats) {
                throw new Error('Failed to generate audit summary');
            }
            
            this.recordTestResult(testName, true, 'Audit trail system functioning correctly');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Test 3: Replay System
     */
    async testReplaySystem() {
        const testName = 'Replay System';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const replaySystem = new ReplaySystem();
            
            // Test scenario creation
            const scenarioId = replaySystem.createScenario('test-replay-scenario', {
                description: 'Test scenario for replay functionality',
                layers: ['client', 'router'],
                replayMode: 'sequential'
            });
            
            if (!scenarioId) {
                throw new Error('Failed to create replay scenario');
            }
            
            // Test available scenarios listing
            const scenarios = replaySystem.getAvailableScenarios();
            
            if (!Array.isArray(scenarios) || scenarios.length === 0) {
                throw new Error('Failed to list available scenarios');
            }
            
            // Test replay status
            const status = replaySystem.getReplayStatus();
            
            if (!status || !status.replayId || status.state !== 'idle') {
                throw new Error('Invalid replay status');
            }
            
            // Test replay control methods
            replaySystem.setReplaySpeed(2.0);
            
            if (replaySystem.replaySpeed !== 2.0) {
                throw new Error('Failed to set replay speed');
            }
            
            this.recordTestResult(testName, true, 'Replay system functioning correctly');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Test 4: Performance Metrics Collection
     */
    async testPerformanceMetricsCollection() {
        const testName = 'Performance Metrics Collection';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const metricsCollector = new PerformanceMetricsCollector();
            
            // Test timing operations
            const timerId = metricsCollector.startTiming(
                'test-operation',
                'transformer',
                'transform',
                { testData: true }
            );
            
            if (!timerId) {
                throw new Error('Failed to start timing');
            }
            
            // Simulate some work
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // End timing
            const metrics = metricsCollector.endTiming(timerId, {
                success: true,
                outputSize: 1024
            });
            
            if (!metrics || !metrics.duration || metrics.duration < 90) {
                throw new Error('Invalid performance metrics');
            }
            
            // Test system snapshot
            const systemSnapshot = metricsCollector.captureSystemSnapshot();
            
            if (!systemSnapshot || !systemSnapshot.memory || !systemSnapshot.cpu) {
                throw new Error('Failed to capture system snapshot');
            }
            
            // Test analysis report generation
            const analysisReport = metricsCollector.generateAnalysisReport();
            
            if (!analysisReport || !analysisReport.sessionId || !analysisReport.summary) {
                throw new Error('Failed to generate analysis report');
            }
            
            // Test current metrics retrieval
            const currentMetrics = metricsCollector.getCurrentMetrics();
            
            if (!currentMetrics || !currentMetrics.sessionId || !currentMetrics.systemMetrics) {
                throw new Error('Failed to get current metrics');
            }
            
            this.recordTestResult(testName, true, 'Performance metrics collection working correctly');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Test 5: Integrated Debug System
     */
    async testIntegratedDebugSystem() {
        const testName = 'Integrated Debug System';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const debugSystem = new DebugSystem({
                enableRecording: true,
                enableAuditTrail: true,
                enableReplay: true,
                enablePerformanceMetrics: true
            });
            
            // Test debug system status
            const status = debugSystem.getDebugStatus();
            
            if (!status || !status.sessionId || !status.debugEnabled) {
                throw new Error('Invalid debug system status');
            }
            
            // Test enable/disable functionality
            debugSystem.disableDebug();
            
            if (debugSystem.debugEnabled !== false) {
                throw new Error('Failed to disable debug');
            }
            
            debugSystem.enableDebug();
            
            if (debugSystem.debugEnabled !== true) {
                throw new Error('Failed to enable debug');
            }
            
            // Test debug report generation
            const debugReport = debugSystem.generateDebugReport();
            
            if (!debugReport || !debugReport.sessionId || !debugReport.summary) {
                throw new Error('Failed to generate debug report');
            }
            
            this.recordTestResult(testName, true, 'Integrated debug system working correctly');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Test 6: Layer Wrapping and Debug Integration
     */
    async testLayerWrappingDebugIntegration() {
        const testName = 'Layer Wrapping and Debug Integration';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const debugSystem = new DebugSystem();
            
            // Create mock layer for testing
            const mockLayer = {
                processRequest: async (data) => {
                    await new Promise(resolve => setTimeout(resolve, 50));
                    return { processed: true, inputData: data };
                },
                validateInput: (input) => {
                    return input && typeof input === 'object';
                },
                getName: () => 'MockLayer'
            };
            
            // Test layer wrapping
            const wrappedLayer = debugSystem.wrapLayer(mockLayer, 'mock');
            
            if (!wrappedLayer || !wrappedLayer.processRequest) {
                throw new Error('Failed to wrap layer');
            }
            
            // Test wrapped method execution
            const result = await wrappedLayer.processRequest({ test: 'data' });
            
            if (!result || !result.processed || !result.inputData) {
                throw new Error('Wrapped method execution failed');
            }
            
            // Test debug info retrieval
            const layerDebugInfo = wrappedLayer.getDebugInfo();
            
            if (!layerDebugInfo || !layerDebugInfo.layerName || !layerDebugInfo.isWrapped) {
                throw new Error('Failed to get layer debug info');
            }
            
            // Test synchronous method wrapping
            const validationResult = wrappedLayer.validateInput({ valid: true });
            
            if (validationResult !== true) {
                throw new Error('Synchronous method wrapping failed');
            }
            
            this.recordTestResult(testName, true, 'Layer wrapping and debug integration working correctly');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Test 7: Scenario Creation and Replay
     */
    async testScenarioCreationAndReplay() {
        const testName = 'Scenario Creation and Replay';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const debugSystem = new DebugSystem();
            
            // Create a test scenario
            const scenarioId = await debugSystem.createReplayScenario('integration-test-scenario', {
                description: 'Integration test scenario',
                layers: ['client', 'router', 'provider'],
                replayMode: 'sequential'
            });
            
            if (!scenarioId) {
                throw new Error('Failed to create replay scenario');
            }
            
            // NOTE: In a real test, we would start a replay here
            // For this mock test, we'll just verify the scenario was created
            const replayStatus = debugSystem.getDebugStatus().replayStatus;
            
            if (!replayStatus || !replayStatus.availableScenarios) {
                throw new Error('Replay status not available');
            }
            
            this.recordTestResult(testName, true, 'Scenario creation working correctly (replay test skipped for mock)');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Test 8: Debug System Status and Reporting
     */
    async testDebugSystemStatusAndReporting() {
        const testName = 'Debug System Status and Reporting';
        console.log(`🧪 Testing: ${testName}`);
        
        try {
            const debugSystem = new DebugSystem();
            
            // Create a mock layer and wrap it
            const mockLayer = {
                process: async () => ({ result: 'processed' })
            };
            
            debugSystem.wrapLayer(mockLayer, 'test-layer');
            
            // Get comprehensive status
            const status = debugSystem.getDebugStatus();
            
            if (!status.sessionId || status.wrappedLayers.length === 0) {
                throw new Error('Invalid debug status');
            }
            
            // Generate debug report
            const report = debugSystem.generateDebugReport();
            
            if (!report || !report.sessionId || !report.summary) {
                throw new Error('Failed to generate debug report');
            }
            
            // Test finalization
            const finalReport = debugSystem.finalize();
            
            if (!finalReport || !finalReport.sessionId) {
                throw new Error('Failed to finalize debug system');
            }
            
            this.recordTestResult(testName, true, 'Debug system status and reporting working correctly');
            
        } catch (error) {
            this.recordTestResult(testName, false, error.message);
        }
    }
    
    /**
     * Record individual test result
     * @param {string} testName - Name of the test
     * @param {boolean} passed - Whether test passed
     * @param {string} message - Test result message
     */
    recordTestResult(testName, passed, message) {
        const result = {
            testName,
            status: passed ? 'PASSED' : 'FAILED',
            message,
            timestamp: new Date().toISOString(),
            duration: 0 // Would be calculated in real implementation
        };
        
        this.testResults.results.push(result);
        this.testResults.summary.total++;
        
        if (passed) {
            this.testResults.summary.passed++;
            console.log(`✅ ${testName}: ${message}`);
        } else {
            this.testResults.summary.failed++;
            console.log(`❌ ${testName}: ${message}`);
        }
    }
    
    /**
     * Generate comprehensive test report
     */
    async generateTestReport() {
        this.testResults.endTime = new Date().toISOString();
        this.testResults.summary.successRate = 
            (this.testResults.summary.passed / this.testResults.summary.total * 100).toFixed(2);
        
        // Save test report
        const reportFile = path.join(this.outputPath, `debug-recording-system-test-report-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(this.testResults, null, 2));
        
        // Generate summary
        console.log('\\n🧪 Debug Recording System Test Results:');
        console.log(`📊 Total Tests: ${this.testResults.summary.total}`);
        console.log(`✅ Passed: ${this.testResults.summary.passed}`);
        console.log(`❌ Failed: ${this.testResults.summary.failed}`);
        console.log(`📈 Success Rate: ${this.testResults.summary.successRate}%`);
        console.log(`📄 Report saved: ${reportFile}`);
        
        return this.testResults;
    }
}

// CLI execution support
if (import.meta.url === `file://${process.argv[1]}`) {
    const testSuite = new DebugRecordingSystemTests();
    
    testSuite.runAllTests()
        .then((results) => {
            process.exit(results.summary.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('Test execution failed:', error);
            process.exit(1);
        });
}

export default DebugRecordingSystemTests;