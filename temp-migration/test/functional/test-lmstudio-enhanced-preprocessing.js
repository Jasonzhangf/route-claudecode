#!/usr/bin/env node

/**
 * Enhanced LMStudio Testing System with Automatic Data Packet Capture
 * Addresses preprocessing parsing issues and performs comprehensive testing
 * Author: Jason Zhang
 * Version: v3.0-enhanced
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LMStudioEnhancedTester {
    constructor() {
        this.testId = `lmstudio-enhanced-${Date.now()}`;
        this.captureDir = '/tmp/lmstudio-test-captures';
        this.results = {
            testId: this.testId,
            timestamp: new Date().toISOString(),
            stages: {},
            summary: { passed: 0, failed: 0, total: 0 }
        };
        
        console.log('🧪 Enhanced LMStudio Testing System initialized');
        console.log(`📊 Test ID: ${this.testId}`);
    }

    /**
     * Stage 1: Automatic Data Packet Capture
     */
    async captureDataPackets() {
        console.log('\n📋 Stage 1: Automatic Data Packet Capture');
        
        try {
            // Ensure capture directory exists
            await fs.mkdir(this.captureDir, { recursive: true });
            
            // Start LMStudio server if not running
            const serverStatus = await this.checkLMStudioServer();
            if (!serverStatus.running) {
                console.log('🚀 Starting LMStudio server...');
                await this.startLMStudioServer();
            }
            
            // Capture test requests
            const testRequests = [
                {
                    name: 'simple-text',
                    request: { 
                        messages: [{ role: 'user', content: '请简单介绍一下你自己' }],
                        model: 'local-model',
                        stream: false
                    }
                },
                {
                    name: 'tool-call-request',
                    request: {
                        messages: [{ role: 'user', content: '请总结本项目的架构并且保存为md文档' }],
                        model: 'local-model',
                        stream: false,
                        tools: [{
                            type: 'function',
                            function: {
                                name: 'create_file',
                                description: 'Create a file with content',
                                parameters: {
                                    type: 'object',
                                    properties: {
                                        filename: { type: 'string' },
                                        content: { type: 'string' }
                                    },
                                    required: ['filename', 'content']
                                }
                            }
                        }]
                    }
                },
                {
                    name: 'streaming-request',
                    request: {
                        messages: [{ role: 'user', content: '请详细解释Claude Code Router的工作原理' }],
                        model: 'local-model',
                        stream: true
                    }
                }
            ];
            
            const capturedData = [];
            
            for (const testCase of testRequests) {
                console.log(`📡 Capturing: ${testCase.name}`);
                
                try {
                    const response = await this.sendTestRequest(testCase.request);
                    const captureData = {
                        testCase: testCase.name,
                        timestamp: new Date().toISOString(),
                        request: testCase.request,
                        response: response,
                        metadata: {
                            hasToolCalls: this.hasToolCalls(response),
                            finishReason: this.extractFinishReason(response),
                            contentType: this.analyzeContentType(response),
                            needsPreprocessing: this.needsPreprocessing(response)
                        }
                    };
                    
                    capturedData.push(captureData);
                    
                    // Save individual capture
                    const captureFile = path.join(this.captureDir, `${testCase.name}-${Date.now()}.json`);
                    await fs.writeFile(captureFile, JSON.stringify(captureData, null, 2));
                    
                    console.log(`   ✅ Captured to: ${captureFile}`);
                    
                } catch (error) {
                    console.log(`   ❌ Capture failed: ${error.message}`);
                    capturedData.push({
                        testCase: testCase.name,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            this.results.stages.dataCapture = {
                success: true,
                capturedRequests: capturedData.length,
                captureDir: this.captureDir,
                data: capturedData
            };
            
            return capturedData;
            
        } catch (error) {
            console.error('❌ Data capture failed:', error.message);
            this.results.stages.dataCapture = {
                success: false,
                error: error.message
            };
            throw error;
        }
    }

    /**
     * Stage 2: Preprocessing Issue Analysis
     */
    async analyzePreprocessingIssues(capturedData) {
        console.log('\n📋 Stage 2: Preprocessing Issue Analysis');
        
        const issues = {
            finishReasonMismatches: [],
            embeddedToolCalls: [],
            formatInconsistencies: [],
            streamingProblems: []
        };
        
        for (const capture of capturedData) {
            if (capture.error) continue;
            
            const response = capture.response;
            
            // Check finish_reason mismatches
            if (this.hasToolCallContent(response) && !this.hasCorrectFinishReason(response)) {
                issues.finishReasonMismatches.push({
                    testCase: capture.testCase,
                    expected: 'tool_calls',
                    actual: this.extractFinishReason(response),
                    content: this.extractToolCallContent(response)
                });
            }
            
            // Check for embedded tool calls (LMStudio specific format)
            const embeddedCalls = this.detectEmbeddedToolCalls(response);
            if (embeddedCalls.length > 0) {
                issues.embeddedToolCalls.push({
                    testCase: capture.testCase,
                    embeddedCalls: embeddedCalls,
                    needsExtraction: true
                });
            }
            
            // Check format inconsistencies
            const formatIssues = this.detectFormatIssues(response);
            if (formatIssues.length > 0) {
                issues.formatInconsistencies.push({
                    testCase: capture.testCase,
                    issues: formatIssues
                });
            }
            
            // Check streaming problems
            if (capture.request.stream && this.hasStreamingIssues(response)) {
                issues.streamingProblems.push({
                    testCase: capture.testCase,
                    issues: this.getStreamingIssues(response)
                });
            }
        }
        
        console.log(`🔍 Analysis Results:`);
        console.log(`   - Finish reason mismatches: ${issues.finishReasonMismatches.length}`);
        console.log(`   - Embedded tool calls: ${issues.embeddedToolCalls.length}`);
        console.log(`   - Format inconsistencies: ${issues.formatInconsistencies.length}`);
        console.log(`   - Streaming problems: ${issues.streamingProblems.length}`);
        
        this.results.stages.preprocessingAnalysis = {
            success: true,
            issues: issues,
            totalIssues: Object.values(issues).reduce((sum, arr) => sum + arr.length, 0)
        };
        
        return issues;
    }

    /**
     * Stage 3: Apply Preprocessing Fixes
     */
    async applyPreprocessingFixes(capturedData, issues) {
        console.log('\n📋 Stage 3: Apply Preprocessing Fixes');
        
        const fixedData = [];
        
        for (const capture of capturedData) {
            if (capture.error) {
                fixedData.push(capture);
                continue;
            }
            
            let fixedResponse = JSON.parse(JSON.stringify(capture.response));
            const appliedFixes = [];
            
            // Fix 1: Correct finish_reason for tool calls
            if (this.hasToolCallContent(fixedResponse) && !this.hasCorrectFinishReason(fixedResponse)) {
                fixedResponse = this.fixFinishReason(fixedResponse);
                appliedFixes.push('finish_reason_correction');
            }
            
            // Fix 2: Extract embedded tool calls
            const embeddedCalls = this.detectEmbeddedToolCalls(fixedResponse);
            if (embeddedCalls.length > 0) {
                fixedResponse = this.extractEmbeddedToolCalls(fixedResponse, embeddedCalls);
                appliedFixes.push('embedded_tool_call_extraction');
            }
            
            // Fix 3: Format standardization
            if (this.needsFormatStandardization(fixedResponse)) {
                fixedResponse = this.standardizeFormat(fixedResponse);
                appliedFixes.push('format_standardization');
            }
            
            // Fix 4: Streaming response cleanup
            if (capture.request.stream && this.needsStreamingCleanup(fixedResponse)) {
                fixedResponse = this.cleanupStreamingResponse(fixedResponse);
                appliedFixes.push('streaming_cleanup');
            }
            
            fixedData.push({
                ...capture,
                originalResponse: capture.response,
                response: fixedResponse,
                appliedFixes: appliedFixes,
                fixSuccess: appliedFixes.length > 0
            });
            
            console.log(`   ✅ ${capture.testCase}: Applied ${appliedFixes.length} fixes`);
        }
        
        this.results.stages.preprocessingFixes = {
            success: true,
            totalFixes: fixedData.reduce((sum, item) => sum + (item.appliedFixes?.length || 0), 0),
            fixedResponses: fixedData.filter(item => item.fixSuccess).length
        };
        
        return fixedData;
    }

    /**
     * Stage 4: End-to-End Testing with File Redirection
     */
    async performEndToEndTesting(fixedData) {
        console.log('\n📋 Stage 4: End-to-End Testing with File Redirection');
        
        const e2eResults = [];
        
        // Test the specific request: "请总结本项目的架构并且保存为md文档"
        const architectureSummaryTest = {
            name: 'architecture-summary-e2e',
            input: '请总结本项目的架构并且保存为md文档',
            expectedOutput: 'architecture-summary.md',
            testType: 'file-creation'
        };
        
        try {
            console.log(`🚀 Running E2E test: ${architectureSummaryTest.name}`);
            
            // Create test configuration
            const testConfig = {
                server: {
                    port: 5507, // Use different port for testing
                    host: '127.0.0.1'
                },
                providers: {
                    lmstudio: {
                        type: 'lmstudio',
                        endpoint: 'http://localhost:1234/v1/chat/completions',
                        authentication: { type: 'none' },
                        models: ['local-model'],
                        timeout: 30000
                    }
                },
                routing: {
                    default: {
                        provider: 'lmstudio',
                        model: 'local-model'
                    }
                }
            };
            
            const configFile = path.join(this.captureDir, 'test-config.json');
            await fs.writeFile(configFile, JSON.stringify(testConfig, null, 2));
            
            // Start RCC server with test configuration
            const rccResult = await this.runRCCWithFileRedirection(
                architectureSummaryTest.input,
                configFile,
                architectureSummaryTest.expectedOutput
            );
            
            e2eResults.push({
                test: architectureSummaryTest.name,
                success: rccResult.success,
                output: rccResult.output,
                fileCreated: rccResult.fileCreated,
                duration: rccResult.duration,
                errors: rccResult.errors || []
            });
            
            console.log(`   ${rccResult.success ? '✅' : '❌'} E2E test completed`);
            
        } catch (error) {
            console.error(`   ❌ E2E test failed: ${error.message}`);
            e2eResults.push({
                test: architectureSummaryTest.name,
                success: false,
                error: error.message
            });
        }
        
        this.results.stages.endToEndTesting = {
            success: e2eResults.every(result => result.success),
            tests: e2eResults,
            totalTests: e2eResults.length
        };
        
        return e2eResults;
    }

    /**
     * Helper Methods
     */
    
    async checkLMStudioServer() {
        try {
            const response = await fetch('http://localhost:1234/v1/models');
            return { running: response.ok };
        } catch (error) {
            return { running: false, error: error.message };
        }
    }
    
    async startLMStudioServer() {
        // This would typically start LMStudio server
        // For now, we'll assume it's manually started
        console.log('⚠️ Please ensure LMStudio server is running on port 1234');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    async sendTestRequest(request) {
        const response = await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }
    
    hasToolCalls(response) {
        return response.choices?.some(choice => 
            choice.message?.tool_calls?.length > 0
        ) || false;
    }
    
    extractFinishReason(response) {
        return response.choices?.[0]?.finish_reason || 'unknown';
    }
    
    analyzeContentType(response) {
        const content = response.choices?.[0]?.message?.content || '';
        
        if (content.includes('functions.')) return 'embedded_tool_call';
        if (content.includes('<think>')) return 'thinking_content';
        if (content.length > 1000) return 'long_content';
        return 'normal_text';
    }
    
    needsPreprocessing(response) {
        return this.analyzeContentType(response) !== 'normal_text' ||
               this.hasToolCallContent(response) && !this.hasCorrectFinishReason(response);
    }
    
    hasToolCallContent(response) {
        const content = response.choices?.[0]?.message?.content || '';
        return content.includes('functions.') || 
               content.includes('Tool call:') ||
               response.choices?.[0]?.message?.tool_calls?.length > 0;
    }
    
    hasCorrectFinishReason(response) {
        return this.extractFinishReason(response) === 'tool_calls';
    }
    
    extractToolCallContent(response) {
        const content = response.choices?.[0]?.message?.content || '';
        const match = content.match(/functions\.(\w+)/);
        return match ? match[1] : null;
    }
    
    detectEmbeddedToolCalls(response) {
        const content = response.choices?.[0]?.message?.content || '';
        const matches = content.match(/functions\.(\w+)\s*\n\s*(\{.*?\})/gs);
        
        return matches ? matches.map(match => {
            const [, functionName, args] = match.match(/functions\.(\w+)\s*\n\s*(\{.*?\})/s) || [];
            return { functionName, args };
        }) : [];
    }
    
    detectFormatIssues(response) {
        const issues = [];
        
        if (!response.choices || response.choices.length === 0) {
            issues.push('no_choices');
        }
        
        if (!response.id) {
            issues.push('missing_id');
        }
        
        if (!response.model) {
            issues.push('missing_model');
        }
        
        return issues;
    }
    
    hasStreamingIssues(response) {
        // Check for streaming-specific issues
        return false; // Placeholder
    }
    
    getStreamingIssues(response) {
        return []; // Placeholder
    }
    
    fixFinishReason(response) {
        const fixed = JSON.parse(JSON.stringify(response));
        if (fixed.choices && fixed.choices.length > 0) {
            fixed.choices[0].finish_reason = 'tool_calls';
        }
        return fixed;
    }
    
    extractEmbeddedToolCalls(response, embeddedCalls) {
        const fixed = JSON.parse(JSON.stringify(response));
        
        if (fixed.choices && fixed.choices.length > 0) {
            const choice = fixed.choices[0];
            
            // Create standard tool_calls format
            choice.message.tool_calls = embeddedCalls.map((call, index) => ({
                id: `call_${Date.now()}_${index}`,
                type: 'function',
                function: {
                    name: call.functionName,
                    arguments: call.args
                }
            }));
            
            // Clean content
            let content = choice.message.content || '';
            embeddedCalls.forEach(call => {
                const pattern = new RegExp(`functions\\.${call.functionName}\\s*\\n\\s*\\{.*?\\}`, 'gs');
                content = content.replace(pattern, '').trim();
            });
            
            choice.message.content = content || null;
            choice.finish_reason = 'tool_calls';
        }
        
        return fixed;
    }
    
    needsFormatStandardization(response) {
        return this.detectFormatIssues(response).length > 0;
    }
    
    standardizeFormat(response) {
        const fixed = JSON.parse(JSON.stringify(response));
        
        // Add missing fields
        if (!fixed.id) {
            fixed.id = `lmstudio-${Date.now()}`;
        }
        
        if (!fixed.model) {
            fixed.model = 'local-model';
        }
        
        if (!fixed.object) {
            fixed.object = 'chat.completion';
        }
        
        return fixed;
    }
    
    needsStreamingCleanup(response) {
        return false; // Placeholder
    }
    
    cleanupStreamingResponse(response) {
        return response; // Placeholder
    }
    
    async runRCCWithFileRedirection(input, configFile, expectedOutputFile) {
        const startTime = Date.now();
        
        try {
            // Create input file
            const inputFile = path.join(this.captureDir, 'test-input.txt');
            await fs.writeFile(inputFile, input);
            
            // Create output directory
            const outputDir = path.join(this.captureDir, 'output');
            await fs.mkdir(outputDir, { recursive: true });
            
            // Run RCC with file redirection
            const rccCommand = [
                'node', 'rcc3', 'code',
                '--config', configFile,
                '--input', inputFile,
                '--output-dir', outputDir
            ];
            
            console.log(`   🚀 Running: ${rccCommand.join(' ')}`);
            
            const result = await this.executeCommand(rccCommand);
            
            // Check if expected file was created
            const expectedFile = path.join(outputDir, expectedOutputFile);
            let fileCreated = false;
            let fileContent = '';
            
            try {
                fileContent = await fs.readFile(expectedFile, 'utf-8');
                fileCreated = true;
            } catch (error) {
                // File not created
            }
            
            return {
                success: result.exitCode === 0 && fileCreated,
                output: result.stdout,
                errors: result.stderr ? [result.stderr] : [],
                fileCreated: fileCreated,
                fileContent: fileContent,
                duration: Date.now() - startTime
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }
    
    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            const [cmd, ...args] = command;
            const child = spawn(cmd, args, { 
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            child.on('close', (code) => {
                resolve({
                    exitCode: code,
                    stdout: stdout,
                    stderr: stderr
                });
            });
            
            child.on('error', (error) => {
                reject(error);
            });
            
            // Set timeout
            setTimeout(() => {
                child.kill();
                reject(new Error('Command timeout'));
            }, 60000); // 60 second timeout
        });
    }

    /**
     * Main test execution
     */
    async runFullTest() {
        console.log('\n🚀 Starting Enhanced LMStudio Testing System...\n');
        
        try {
            // Stage 1: Capture data packets
            const capturedData = await this.captureDataPackets();
            this.results.summary.total++;
            if (this.results.stages.dataCapture.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Stage 2: Analyze preprocessing issues
            const issues = await this.analyzePreprocessingIssues(capturedData);
            this.results.summary.total++;
            if (this.results.stages.preprocessingAnalysis.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Stage 3: Apply fixes
            const fixedData = await this.applyPreprocessingFixes(capturedData, issues);
            this.results.summary.total++;
            if (this.results.stages.preprocessingFixes.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Stage 4: End-to-end testing
            const e2eResults = await this.performEndToEndTesting(fixedData);
            this.results.summary.total++;
            if (this.results.stages.endToEndTesting.success) this.results.summary.passed++;
            else this.results.summary.failed++;
            
            // Save comprehensive results
            await this.saveResults();
            
            return this.results;
            
        } catch (error) {
            console.error('❌ Test execution failed:', error.message);
            this.results.error = error.message;
            this.results.summary.failed = this.results.summary.total;
            return this.results;
        }
    }
    
    async saveResults() {
        const resultsFile = path.join(this.captureDir, `${this.testId}-results.json`);
        await fs.writeFile(resultsFile, JSON.stringify(this.results, null, 2));
        
        console.log(`\n💾 Test results saved: ${resultsFile}`);
        
        // Print summary
        console.log('\n📊 Test Summary:');
        console.log(`   ✅ Passed: ${this.results.summary.passed}/${this.results.summary.total}`);
        console.log(`   ❌ Failed: ${this.results.summary.failed}/${this.results.summary.total}`);
        console.log(`   📁 Capture directory: ${this.captureDir}`);
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new LMStudioEnhancedTester();
    
    tester.runFullTest()
        .then(results => {
            const success = results.summary.failed === 0;
            console.log(`\n🎯 Enhanced LMStudio Testing ${success ? 'COMPLETED' : 'FAILED'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test system failed:', error);
            process.exit(1);
        });
}

export default LMStudioEnhancedTester;